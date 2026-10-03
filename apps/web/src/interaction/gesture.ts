import { copyDocument } from '../model/document';
import type { Bar, ChartDocument } from '../model/document';
import { placeBar, snapWeek } from '../model/rules';

export type GestureKind = 'draw' | 'move' | 'resize-left' | 'resize-right';
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
  meaningful = false;
  constructor(
    document: ChartDocument,
    readonly kind: GestureKind,
    readonly id: string,
    readonly pointerStart: number,
    readonly weekWidth: number,
    displayed?: Interval,
  ) {
    this.before = copyDocument(document);
    this.preview = this.before;
    const original = document.bars.find((bar) => bar.id === id);
    if (kind !== 'draw' && !original) throw new Error('Missing gesture bar');
    this.original = original
      ? { ...original }
      : { id, start: pointerStart, end: pointerStart, name: '' };
    // Painted coordinates can differ from committed coordinates during settlement.
    // They seed pointer attachment only; the document snapshot remains the history boundary.
    this.displayed = { ...(displayed ?? this.original) };
    this.tracking = this.displayed;
  }
  update(pointer: number): void {
    const delta = pointer - this.pointerStart;
    this.meaningful ||= Math.abs(delta * this.weekWidth) >= 4 - 1e-9;
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
      start: snappedStart,
      end: snappedEnd,
    };
    const direction =
      this.kind === 'resize-left' || (this.kind === 'move' && delta < 0)
        ? 'left'
        : 'right';
    this.preview = placeBar(this.before, proposal, direction);
  }
  cancel(): ChartDocument {
    return copyDocument(this.before);
  }
  commit(): ChartDocument {
    return copyDocument(this.preview);
  }
}
