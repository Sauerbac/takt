import { copyDocument } from '../model/document';
import type { ChartDocument, Milestone } from '../model/document';
import { placeMilestone, snapWeek } from '../model/rules';
import type { Interval } from './gesture';

// Shares the browser adapter's transaction contract, without bar collision state.
export class MilestoneGesture {
  readonly kind = 'milestone-move';
  readonly before: ChartDocument;
  readonly original: Milestone;
  readonly displayed: Interval;
  preview: ChartDocument;
  tracking: Interval;
  proposal: (Interval & { rowId: string }) | null = null;
  meaningful = false;
  validDrop = true;
  readonly pushAt = null;

  constructor(
    document: ChartDocument,
    readonly id: string,
    readonly pointerStart: number,
    readonly weekWidth: number,
    boundary?: number,
  ) {
    this.before = copyDocument(document);
    this.preview = this.before;
    const original = document.milestones.find((item) => item.id === id);
    if (!original) throw new Error('Missing gesture milestone');
    this.original = { ...original };
    const start = boundary ?? original.boundary;
    this.displayed = this.tracking = { start, end: start };
  }

  update(
    pointer: number,
    _time = 0,
    _speedPointer = pointer * this.weekWidth,
    rowId = this.original.rowId,
    verticalPixels = 0,
  ): void {
    const delta = pointer - this.pointerStart;
    this.meaningful ||=
      Math.abs(delta * this.weekWidth) >= 4 - 1e-9 ||
      Math.abs(verticalPixels) >= 4;
    if (!this.meaningful) return;
    const boundary = this.displayed.start + delta;
    this.tracking = { start: boundary, end: boundary };
    const snapped = snapWeek(boundary);
    this.proposal = { rowId, start: snapped, end: snapped };
    const item = { ...this.original, rowId, boundary: snapped };
    const result = placeMilestone(this.before, item);
    this.validDrop = result !== this.before;
    this.preview = result;
  }

  cancel(): ChartDocument {
    return copyDocument(this.before);
  }
  commit(): ChartDocument {
    return copyDocument(this.validDrop ? this.preview : this.before);
  }
}
