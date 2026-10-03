export interface Bar {
  readonly id: string;
  readonly rowId: string;
  readonly start: number;
  readonly end: number;
  readonly name: string;
}

export interface Row {
  readonly id: string;
  readonly sectionId: string;
  readonly name: string;
}

export interface Section {
  readonly id: string;
  readonly name: string;
}

// A milestone's boundary is the start of the following week (Week 2 ends at 3).
export interface Milestone {
  readonly id: string;
  readonly rowId: string;
  readonly boundary: number;
  readonly name: string;
}

export interface ChartDocument {
  readonly sections: readonly Section[];
  readonly rows: readonly Row[];
  readonly bars: readonly Bar[];
  readonly milestones: readonly Milestone[];
}

export const emptyDocument = (): ChartDocument => ({
  sections: [{ id: 'section-1', name: '' }],
  rows: [{ id: 'row-1', sectionId: 'section-1', name: '' }],
  bars: [],
  milestones: [],
});
export const copyDocument = (document: ChartDocument): ChartDocument => ({
  ...document,
  sections: document.sections.map((section) => ({ ...section })),
  rows: document.rows.map((row) => ({ ...row })),
  bars: document.bars.map((bar) => ({ ...bar })),
  milestones: document.milestones.map((item) => ({ ...item })),
});

export function assertDocument(document: ChartDocument): void {
  const ids = new Set<string>();
  const rowIds = new Set<string>();
  const sectionIds = new Set<string>();
  for (const section of document.sections) {
    if (ids.has(section.id)) throw new Error('Duplicate section');
    ids.add(section.id);
    sectionIds.add(section.id);
  }
  for (const row of document.rows) {
    if (ids.has(row.id) || !sectionIds.has(row.sectionId))
      throw new Error('Invalid row');
    ids.add(row.id);
    rowIds.add(row.id);
  }
  const bars = [...document.bars].sort((a, b) => a.start - b.start);
  const ends = new Map<string, number>();
  bars.forEach((bar) => {
    if (
      ids.has(bar.id) ||
      !rowIds.has(bar.rowId) ||
      !Number.isInteger(bar.start) ||
      !Number.isInteger(bar.end) ||
      bar.end <= bar.start
    )
      throw new Error('Invalid bar');
    if ((ends.get(bar.rowId) ?? -Infinity) > bar.start)
      throw new Error('Overlapping bars');
    ends.set(bar.rowId, bar.end);
    ids.add(bar.id);
  });
  const boundaries = new Set<string>();
  for (const item of document.milestones) {
    const key = JSON.stringify([item.rowId, item.boundary]);
    if (
      ids.has(item.id) ||
      !rowIds.has(item.rowId) ||
      !Number.isInteger(item.boundary) ||
      boundaries.has(key)
    )
      throw new Error('Invalid milestone');
    ids.add(item.id);
    boundaries.add(key);
  }
}
