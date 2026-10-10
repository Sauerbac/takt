/** A held Web Lock identifies a live document owner without background timers. */
export interface RecoveryLocks {
  request(
    name: string,
    options: { ifAvailable: true },
    callback: (lock: object | null) => Promise<void> | void,
  ): Promise<unknown>;
}
interface Ownership {
  ready: Promise<boolean>;
  settle: (owned: boolean) => void;
  release: () => void;
  held: boolean;
  cancelled: boolean;
}
export class BrowserRecoveryOwnership {
  private readonly records = new Map<string, Ownership>();
  constructor(private readonly locks?: RecoveryLocks) {}

  acquire(id: string): Promise<boolean> {
    if (!this.locks) return Promise.resolve(false);
    const existing = this.records.get(id);
    if (existing) return existing.ready;
    let settle!: (owned: boolean) => void;
    let release!: () => void;
    const ready = new Promise<boolean>((resolve) => (settle = resolve));
    const held = new Promise<void>((resolve) => (release = resolve));
    const ownership: Ownership = {
      ready,
      settle,
      release,
      held: false,
      cancelled: false,
    };
    this.records.set(id, ownership);
    try {
      void this.locks
        .request(
          `takt.recovery.v1:${id}`,
          { ifAvailable: true },
          async (lock) => {
            if (!lock || ownership.cancelled) {
              if (this.records.get(id) === ownership) this.records.delete(id);
              settle(false);
              return;
            }
            ownership.held = true;
            settle(true);
            await held;
          },
        )
        .catch(() => settle(false))
        .finally(() => {
          ownership.held = false;
          if (this.records.get(id) === ownership) this.records.delete(id);
        });
    } catch {
      this.records.delete(id);
      settle(false);
    }
    return ready;
  }
  owns(id: string): boolean {
    return this.records.get(id)?.held === true;
  }
  release(id: string): void {
    const record = this.records.get(id);
    if (!record) return;
    record.cancelled = true;
    record.held = false;
    record.settle(false);
    record.release();
    this.records.delete(id);
  }
  releaseAll(): void {
    for (const id of this.records.keys()) this.release(id);
  }
}
