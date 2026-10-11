import { contentKey, newProject, type ProjectSnapshot } from './format';
import type {
  FileIdentity,
  OpenedProject,
  PlatformAdapter,
  RecoveryRecord,
  SaveOutcome,
} from './platform';

/** Longest a scroll, zoom or collapse change waits before reaching recovery. */
export const VIEW_PERSIST_DELAY = 1000;

export class ProjectSession {
  snapshot: ProjectSnapshot | null = null;
  file?: FileIdentity;
  home = true;
  generation = 0;
  baseline = '';
  recoveryId: string = crypto.randomUUID();
  recoveryWarning = '';
  error = '';
  drafts: RecoveryRecord[] = [];
  private writes = Promise.resolve();
  private viewTimer: ReturnType<typeof setTimeout> | undefined;
  private written = '';
  /** Whether this document has a recovery record. An untouched document has nothing to recover. */
  private recorded = false;
  private replacementRequest = 0;
  constructor(
    readonly adapter: PlatformAdapter,
    readonly changed: () => void = () => {},
  ) {}
  get modified() {
    return !!this.snapshot && contentKey(this.snapshot) !== this.baseline;
  }
  async initialize() {
    await this.refreshDrafts();
  }
  cancelReplacement() {
    this.replacementRequest++;
  }
  async refreshDrafts() {
    try {
      this.drafts = await this.adapter.listRecovery();
      if (this.adapter.recoveryWarning)
        this.recoveryWarning = this.adapter.recoveryWarning;
    } catch {
      this.recoveryWarning =
        'Recovery is unavailable. Your edits are still available; download or save a copy.';
    }
    this.changed();
  }
  /** Edits reach recovery immediately; view-only changes are coalesced. */
  update(snapshot: ProjectSnapshot) {
    const edited =
      !this.snapshot ||
      snapshot.title !== this.snapshot.title ||
      snapshot.document !== this.snapshot.document;
    this.snapshot = snapshot;
    this.changed();
    if (edited) void this.persist();
    else
      this.viewTimer ??= setTimeout(
        () => void this.persist(),
        VIEW_PERSIST_DELAY,
      );
  }
  /** Write a waiting view change now: before file commands, Home, and page or window exit. */
  flush() {
    return this.viewTimer === undefined ? this.writes : this.persist();
  }
  async persist() {
    clearTimeout(this.viewTimer);
    this.viewTimer = undefined;
    if (!this.snapshot || !(this.recorded || this.modified)) return;
    this.recorded = true;
    const stored = {
      version: 1 as const,
      baseline: this.baseline,
      id: this.recoveryId,
      snapshot: this.snapshot,
      ...(this.file ? { file: this.file } : {}),
    };
    const key = JSON.stringify(stored);
    const record: RecoveryRecord = {
      ...stored,
      updatedAt: new Date().toISOString(),
    };
    this.writes = this.writes.then(async () => {
      if (key === this.written) return;
      try {
        await this.adapter.writeRecovery(record);
        this.written = key;
        this.recoveryWarning = '';
      } catch {
        this.recoveryWarning =
          'Recovery is unavailable. Your edits are still available; download or save a copy.';
      }
      this.changed();
    });
    await this.writes;
  }
  replace(
    opened: OpenedProject,
    recovered = false,
    recoveryId: string = crypto.randomUUID(),
  ) {
    this.replacementRequest++;
    this.snapshot = opened.snapshot;
    this.file = opened.file;
    this.baseline = recovered ? '' : contentKey(opened.snapshot);
    this.generation++;
    this.home = false;
    this.recoveryId = recoveryId;
    this.recorded = recovered;
    this.written = '';
    this.error = '';
    this.changed();
    void this.persist();
  }
  create() {
    this.replace({ snapshot: newProject() });
  }
  async discard() {
    const id = this.recoveryId,
      generation = this.generation,
      key = this.snapshot ? contentKey(this.snapshot) : '';
    clearTimeout(this.viewTimer);
    this.viewTimer = undefined;
    await this.writes;
    if (generation !== this.generation || id !== this.recoveryId) return false;
    if (!this.recorded) return true;
    try {
      await this.adapter.removeRecovery(id);
      this.recorded = false;
      this.written = '';
    } catch {
      this.recoveryWarning =
        'Could not remove this recovery copy. Retry before discarding.';
      this.changed();
      return false;
    }
    if (
      id === this.recoveryId &&
      this.snapshot &&
      contentKey(this.snapshot) !== key
    ) {
      await this.persist();
      return false;
    }
    return generation === this.generation && id === this.recoveryId;
  }
  async save(options?: {
    saveAs?: boolean;
    overwrite?: boolean;
    acknowledge?: boolean;
  }): Promise<SaveOutcome> {
    if (!this.snapshot) return { status: 'cancelled' };
    const snapshot = this.snapshot,
      generation = this.generation;
    let result: SaveOutcome;
    try {
      result = await this.adapter.save(snapshot, this.file, options);
    } catch (error) {
      result = {
        status: 'failure',
        message:
          error instanceof Error
            ? error.message
            : 'Could not save this project.',
      };
    }
    if (generation !== this.generation) return { status: 'cancelled' };
    if (result.status === 'success') {
      if (options?.acknowledge !== false) this.baseline = contentKey(snapshot);
      this.file = result.value;
      void this.persist();
    }
    if (result.status === 'failure') this.error = result.message;
    this.changed();
    return result;
  }
  acknowledge(snapshot: ProjectSnapshot, generation: number) {
    if (generation !== this.generation) return false;
    this.baseline = contentKey(snapshot);
    this.changed();
    void this.persist();
    return true;
  }
  async resume(record: RecoveryRecord) {
    const request = ++this.replacementRequest,
      generation = this.generation;
    const claimed = (await this.adapter.claimRecovery?.(record)) ?? record;
    if (request !== this.replacementRequest || generation !== this.generation) {
      if (claimed.id !== this.recoveryId)
        await this.adapter.abandonRecoveryClaim?.(claimed, record);
      return false;
    }
    this.replace(claimed, true, claimed.id);
    return true;
  }
}
