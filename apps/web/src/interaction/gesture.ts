import { copyDocument } from '../model/document';
import type { Bar, ChartDocument } from '../model/document';
import { placeBar, placeBarBetween, snapWeek } from '../model/rules';
import type { PushDirection } from '../model/rules';

export type GestureKind = 'draw' | 'move' | 'resize-left' | 'resize-right';
export const MOVE_PUSH_DELAY = 300;
export const MOVE_OVERTAKE_SPEED = 1000;
export interface Interval {
  readonly start: number;
  readonly end: number;
}

export class Gesture {
  readonly before: ChartDocument;
  readonly original: Bar;
  readonly displayed: Interval;
  preview: ChartDocument;
  tracking: Interval;
  proposal: Bar | null = null;
  validDrop = true;
  pushAt: number | null = null;
  private contacts = new Map<
    string,
    { since: number; direction: PushDirection }
  >();
  private lastPointer: number;
  private lastTime: number | null = null;
  private lastSpeedPointer: number | null = null;
  private activePushes: { neighbor: Bar; direction: PushDirection }[] = [];
  private movementDirection: PushDirection = 'right';
  meaningful = false;
  constructor(
    document: ChartDocument,
    readonly kind: GestureKind,
    readonly id: string,
    readonly pointerStart: number,
    readonly weekWidth: number,
    displayed?: Interval,
    rowId = document.rows[0].id,
  ) {
    this.before = copyDocument(document);
    this.preview = this.before;
    const original = document.bars.find((bar) => bar.id === id);
    if (kind !== 'draw' && !original) throw new Error('Missing gesture bar');
    this.original = original
      ? { ...original }
      : { id, rowId, start: pointerStart, end: pointerStart, name: '' };
    // Painted coordinates can differ from committed coordinates during settlement.
    // They seed pointer attachment only; the document snapshot remains the history boundary.
    this.displayed = { ...(displayed ?? this.original) };
    this.tracking = this.displayed;
    this.lastPointer = pointerStart;
  }
  // The browser supplies monotonic elapsed time; model collision rules remain timeless.
  update(
    pointer: number,
    time = 0,
    speedPointer = pointer * this.weekWidth,
    rowId = this.original.rowId,
    verticalPixels = 0,
  ): void {
    const enteredRow =
      this.kind === 'move' &&
      rowId !== (this.proposal?.rowId ?? this.original.rowId);
    const elapsed = this.lastTime === null ? 0 : time - this.lastTime;
    const pixelDelta =
      this.lastSpeedPointer === null ? 0 : speedPointer - this.lastSpeedPointer;
    const overtaking =
      !enteredRow &&
      elapsed > 0 &&
      (Math.abs(pixelDelta) * 1000) / elapsed > MOVE_OVERTAKE_SPEED;
    this.lastTime = time;
    this.lastSpeedPointer = speedPointer;
    if (pointer > this.lastPointer) this.movementDirection = 'right';
    else if (pointer < this.lastPointer) this.movementDirection = 'left';
    if (enteredRow) this.movementDirection = 'right';
    this.lastPointer = pointer;
    const delta = pointer - this.pointerStart;
    this.meaningful ||=
      Math.abs(delta * this.weekWidth) >= 4 - 1e-9 ||
      (this.kind === 'move' && Math.abs(verticalPixels) >= 4);
    if (!this.meaningful) return;
    let start = this.displayed.start;
    let end = this.displayed.end;
    // Creation may still be settling from a narrower painted width. Preserve that
    // pickup width as the visual lower bound; the semantic result still has a one-week minimum.
    const visualMinimum = Math.min(1, end - start);
    if (this.kind === 'draw') {
      start = Math.min(this.pointerStart, pointer);
      end = Math.max(this.pointerStart, pointer);
    } else if (this.kind === 'move') {
      start += delta;
      end += delta;
    } else if (this.kind === 'resize-left')
      start = Math.min(start + delta, end - visualMinimum);
    else end = Math.max(end + delta, start + visualMinimum);
    this.tracking = { start, end };
    const snappedStart =
      this.kind === 'resize-right'
        ? this.original.start
        : this.kind === 'resize-left'
          ? Math.min(this.original.end - 1, snapWeek(start))
          : snapWeek(start);
    const snappedEnd =
      this.kind === 'move'
        ? snappedStart + this.original.end - this.original.start
        : this.kind === 'resize-left'
          ? this.original.end
          : Math.max(snappedStart + 1, snapWeek(end));
    const proposal = {
      ...this.original,
      rowId: this.kind === 'move' ? rowId : this.original.rowId,
      start: snappedStart,
      end: snappedEnd,
    };
    this.proposal = proposal;
    this.validDrop = true;
    this.pushAt = null;
    if (enteredRow) {
      this.activePushes = [];
      this.contacts.clear();
    }
    let direction: PushDirection =
      this.kind === 'resize-left' ? 'left' : 'right';
    if (this.kind === 'move') {
      // Fast continuation lets the held bar pass and restores the neighbors.
      // Fast retraction keeps its anchor and unwinds the push normally.
      if (
        overtaking &&
        (!this.activePushes.length ||
          this.activePushes.some(
            ({ neighbor, direction }) =>
              (pixelDelta > 0 ? 'right' : 'left') === direction &&
              (direction === 'right'
                ? proposal.end > neighbor.start
                : proposal.start < neighbor.end),
          ))
      ) {
        this.activePushes = [];
        this.contacts.clear();
      }
      if (this.activePushes.length) {
        const pushing = this.activePushes.some(({ neighbor, direction }) =>
          direction === 'right'
            ? proposal.end > neighbor.start
            : proposal.start < neighbor.end,
        );
        if (pushing) {
          this.preview = this.resolvePushes(proposal);
          return;
        }
        this.activePushes = [];
        this.contacts.clear();
      }
      // Pending contact uses committed intervals; every preview and cancellation
      // derives from the same pointer-down document, even after overtaking.
      const colliding = this.before.bars.filter(
        (bar) =>
          bar.id !== this.id &&
          bar.rowId === proposal.rowId &&
          bar.start < proposal.end &&
          bar.end > proposal.start,
      );
      const current = new Set(colliding.map((bar) => bar.id));
      for (const id of this.contacts.keys())
        if (!current.has(id)) this.contacts.delete(id);
      for (const bar of colliding)
        if (!this.contacts.has(bar.id))
          this.contacts.set(bar.id, {
            since: time,
            // A row entry is a fresh approach. If already overlapping, use
            // the entry interval's side of this neighbor, not motion in the
            // departed row. Equal centers retain the rightward fallback.
            direction: enteredRow
              ? proposal.start + proposal.end > bar.start + bar.end
                ? 'left'
                : 'right'
              : this.movementDirection,
          });
      if (colliding.length) {
        const [id, contact] = [...this.contacts.entries()].reduce(
          (first, next) => (next[1].since < first[1].since ? next : first),
        );
        const deadline = contact.since + MOVE_PUSH_DELAY;
        // Keep the approach direction throughout this contact, including timer-only
        // updates and retraction. Passing clear then returning starts a new approach.
        direction = contact.direction;
        this.validDrop = time >= deadline;
        if (!this.validDrop) {
          this.pushAt = deadline;
          // Pending overlap is presentation state only. Keep every document snapshot valid.
          this.preview = this.before;
          return;
        }
        const neighbor = colliding.find((bar) => bar.id === id)!;
        const opposite = colliding.filter(
          (bar) =>
            this.contacts.get(bar.id)!.direction !== direction &&
            time >= this.contacts.get(bar.id)!.since + MOVE_PUSH_DELAY,
        );
        if (opposite.length) {
          const left = colliding.filter(
            (bar) => this.contacts.get(bar.id)!.direction === 'left',
          );
          const right = colliding.filter(
            (bar) => this.contacts.get(bar.id)!.direction === 'right',
          );
          this.activePushes = [
            {
              neighbor: left.reduce((a, b) => (a.start > b.start ? a : b)),
              direction: 'left',
            },
            {
              neighbor: right.reduce((a, b) => (a.start < b.start ? a : b)),
              direction: 'right',
            },
          ];
        } else this.activePushes = [{ neighbor, direction }];
        this.contacts.clear();
        this.preview = this.resolvePushes(proposal);
        return;
      }
    }
    this.preview = placeBar(this.before, proposal, direction);
  }
  private resolvePushes(proposal: Bar): ChartDocument {
    const left = this.activePushes.find((push) => push.direction === 'left');
    const right = this.activePushes.find((push) => push.direction === 'right');
    if (left && right)
      return placeBarBetween(
        this.before,
        proposal,
        left.neighbor.id,
        right.neighbor.id,
      );
    const push = this.activePushes[0];
    return placeBar(this.before, proposal, push.direction, push.neighbor.id);
  }
  cancel(): ChartDocument {
    return copyDocument(this.before);
  }
  commit(): ChartDocument {
    return copyDocument(this.validDrop ? this.preview : this.before);
  }
}
