import type { Bar, ChartDocument, Color, Milestone } from './document';

export const palette: Readonly<
  Record<Color, { name: string; fill: string; ink: string }>
> = {
  apricot: { name: 'Apricot', fill: '#f3b184', ink: '#874327' },
  lavender: { name: 'Lavender', fill: '#b5a2e0', ink: '#563c86' },
  'sea-blue': { name: 'Sea blue', fill: '#a0d4dd', ink: '#2e626b' },
  slate: { name: 'Slate', fill: '#8290a3', ink: '#182e47' },
  rose: { name: 'Rose', fill: '#b37976', ink: '#442c2b' },
};
export const colorKeys = Object.keys(palette) as Color[];
export function itemColor(
  document: ChartDocument,
  item: Bar | Milestone,
): Color {
  const row = document.rows.find((row) => row.id === item.rowId);
  return (
    item.color ??
    document.sections.find((section) => section.id === row?.sectionId)?.color ??
    'apricot'
  );
}
export function recolor(
  document: ChartDocument,
  id: string,
  color?: Color,
): ChartDocument {
  const change = <T extends { id: string; color?: Color }>(item: T): T => {
    if (item.id !== id) return item;
    const result = { ...item };
    if (color === undefined) delete result.color;
    else result.color = color;
    return result;
  };
  return {
    ...document,
    sections: document.sections.map(change),
    bars: document.bars.map(change),
    milestones: document.milestones.map(change),
  };
}
