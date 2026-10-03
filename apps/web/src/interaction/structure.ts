import { copyDocument } from '../model/document';
import type { ChartDocument } from '../model/document';
import { moveRow, moveSection, sectionRows } from '../model/structure';

export const ROW_HEIGHT = 44;
export const SECTION_HEIGHT = 36;
export const ADD_HEIGHT = 36;
export const EXPAND_DELAY = 500;

// Coordinates are relative to the chart body, below the timeline headings.
export function structureLayout(
  document: ChartDocument,
  collapsed: readonly string[],
) {
  let top = 0;
  const sections = document.sections.map((section) => {
    const start = top;
    top += SECTION_HEIGHT;
    const rows = sectionRows(document, section.id).map((row) => {
      const rowTop = top;
      if (!collapsed.includes(section.id)) top += ROW_HEIGHT;
      return { ...row, top: rowTop, visible: !collapsed.includes(section.id) };
    });
    const addTop = top;
    top += ADD_HEIGHT;
    return { ...section, top: start, height: top - start, addTop, rows };
  });
  return {
    sections,
    rows: sections.flatMap((section) => section.rows),
    height: top + ADD_HEIGHT,
  };
}

export type StructureKind = 'move-row' | 'move-section';

export class StructureGesture {
  readonly before: ChartDocument;
  readonly originalCollapsed: readonly string[];
  preview: ChartDocument;
  collapsed: readonly string[];
  meaningful = false;
  trackingTop: number;
  hoverAt: number | null = null;
  private hovered: string | null = null;
  private destination: string | null = null;
  private readonly originalTop: number;

  constructor(
    document: ChartDocument,
    readonly kind: StructureKind,
    readonly id: string,
    collapsed: readonly string[],
    private readonly pickup: number,
    paintedTop?: number,
  ) {
    this.before = copyDocument(document);
    this.preview = this.before;
    this.originalCollapsed = [...collapsed];
    this.collapsed = [...collapsed];
    const layout = structureLayout(document, collapsed);
    const object =
      kind === 'move-row'
        ? layout.rows.find((row) => row.id === id)!
        : layout.sections.find((section) => section.id === id)!;
    this.originalTop = paintedTop ?? object.top;
    this.trackingTop = this.originalTop;
  }

  update(pointer: number, time: number) {
    this.meaningful ||= Math.abs(pointer - this.pickup) >= 4;
    if (!this.meaningful) return;
    this.trackingTop = this.originalTop + pointer - this.pickup;
    // Section pickup is on its heading. Use that structural position for
    // midpoint crossings so a large carried group can reverse past a short one.
    const center =
      this.trackingTop +
      (this.kind === 'move-section' ? SECTION_HEIGHT : ROW_HEIGHT) / 2;
    let layout = structureLayout(this.preview, this.collapsed);
    if (this.kind === 'move-section') {
      const index = layout.sections.filter(
        (section) =>
          section.id !== this.id && center >= section.top + section.height / 2,
      ).length;
      this.preview = moveSection(this.before, this.id, index);
      return;
    }
    const target =
      layout.sections.find(
        (section) => center < section.top + section.height,
      ) ?? layout.sections.at(-1);
    if (!target) return;
    if (target.id !== this.hovered) {
      this.hovered = target.id;
      this.hoverAt = this.originalCollapsed.includes(target.id)
        ? time + EXPAND_DELAY
        : null;
      this.collapsed = [...this.originalCollapsed];
    }
    if (this.hoverAt !== null && time >= this.hoverAt) {
      this.collapsed = this.originalCollapsed.filter((id) => id !== target.id);
      this.hoverAt = null;
    }
    if (this.collapsed.includes(target.id)) return;
    layout = structureLayout(this.preview, this.collapsed);
    const rows = layout.sections.find(
      (section) => section.id === target.id,
    )!.rows;
    const index = rows.filter(
      (row) => row.id !== this.id && center >= row.top + ROW_HEIGHT / 2,
    ).length;
    this.destination = target.id;
    this.preview = moveRow(this.before, this.id, target.id, index);
  }

  commit() {
    return this.meaningful ? this.preview : this.before;
  }
  cancel() {
    return this.before;
  }
  committedCollapsed() {
    return this.destination && this.meaningful
      ? this.originalCollapsed.filter((id) => id !== this.destination)
      : this.originalCollapsed;
  }
}
