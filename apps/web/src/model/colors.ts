import type { Bar, ChartDocument, Color, Milestone } from './document';
import { colorAppearance, DEFAULT_COLOR } from './palette';

export {
  colorAppearance,
  quickColors,
  DEFAULT_COLOR,
  hueGradient,
} from './palette';
export function colorLabelInk(color: Color): string {
  return colorAppearance(color).ink;
}
export function itemColor(
  document: ChartDocument,
  item: Pick<Bar | Milestone, 'rowId' | 'color'>,
): Color {
  const row = document.rows.find((row) => row.id === item.rowId);
  return (
    item.color ??
    document.sections.find((section) => section.id === row?.sectionId)?.color ??
    DEFAULT_COLOR
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
