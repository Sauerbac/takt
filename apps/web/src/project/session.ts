import { contentKey, newProject, type ProjectSnapshot } from './format';
import type {
  FileIdentity,
  OpenedProject,
  PlatformAdapter,
  RecoveryRecord,
  SaveOutcome,
} from './platform';

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
  update(snapshot: ProjectSnapshot) {
    this.snapshot = snapshot;
    this.changed();
    void this.persist();
  }
  async persist() {
    if (!this.snapshot) return;
    const record: RecoveryRecord = {
      version: 1,
      baseline: this.baseline,
      id: this.recoveryId,
      updatedAt: new Date().toISOString(),
      snapshot: this.snapshot,
      ...(this.file ? { file: this.file } : {}),
    };
    this.writes = this.writes.then(async () => {
      try {
        await this.adapter.writeRecovery(record);
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
    await this.writes;
    if (generation !== this.generation || id !== this.recoveryId) return false;
    try {
      await this.adapter.removeRecovery(id);
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
