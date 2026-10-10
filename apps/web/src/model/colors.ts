import type { Bar, ChartDocument, Color, Milestone } from './document';
import { colorAppearance, DEFAULT_COLOR, quickColors } from './palette';

export {
  colorAppearance,
  quickColors,
  DEFAULT_COLOR,
  hueGradient,
} from './palette';
export function colorLabelInk(color: Color): string {
  return colorAppearance(color).ink;
}
// Derive reusable colors from committed objects, including collapsed sections.
// Presets stay first and each custom hue appears only once.
export function documentColors(document: ChartDocument) {
  const colors: { name: string; color: Color }[] = [...quickColors];
  const seen = new Set<Color>(colors.map(({ color }) => color));
  for (const item of [
    ...document.sections,
    ...document.bars,
    ...document.milestones,
  ]) {
    if (item.color === undefined || seen.has(item.color)) continue;
    seen.add(item.color);
    colors.push({ name: `Hue ${item.color}°`, color: item.color });
  }
  return colors;
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
