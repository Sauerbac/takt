import type { Bar, ChartDocument, Color, Milestone } from './document';
import { palette } from './palette';

export { palette, quickColors, colorRows } from './palette';
export function colorLabelInk(color: Color): string {
  const appearance = palette[color];
  return 'labelInk' in appearance ? appearance.labelInk : appearance.ink;
}
export function itemColor(
  document: ChartDocument,
  item: Pick<Bar | Milestone, 'rowId' | 'color'>,
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
