export interface Bar {
  readonly id: string;
  readonly start: number;
  readonly end: number;
  readonly name: string;
}

// Only the first slice's document data. View state never belongs in this object.
export interface ChartDocument {
  readonly sectionName: string;
  readonly rowName: string;
  readonly bars: readonly Bar[];
}

export const emptyDocument = (): ChartDocument => ({
  sectionName: '',
  rowName: '',
  bars: [],
});
export const copyDocument = (document: ChartDocument): ChartDocument => ({
  ...document,
  bars: document.bars.map((bar) => ({ ...bar })),
});

export function assertDocument(document: ChartDocument): void {
  const bars = [...document.bars].sort((a, b) => a.start - b.start);
  const ids = new Set<string>();
  bars.forEach((bar, index) => {
    if (
      ids.has(bar.id) ||
      !Number.isInteger(bar.start) ||
      !Number.isInteger(bar.end) ||
      bar.end <= bar.start
    )
      throw new Error('Invalid bar');
    if (index && bars[index - 1].end > bar.start)
      throw new Error('Overlapping bars');
    ids.add(bar.id);
  });
}
