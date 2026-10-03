// View-only state and coordinates; neither is persisted in document history.
export interface ViewportState {
  selectedId: string | null;
  editingId: string | null;
}
export const initialViewport = (): ViewportState => ({
  selectedId: null,
  editingId: null,
});
export const FIRST_WEEK = -2;
export const WEEK_COUNT = 12;
export const BAR_INSET = 5;
export const pointerWeek = (
  clientX: number,
  laneLeft: number,
  weekWidth: number,
): number => FIRST_WEEK + (clientX - laneLeft) / weekWidth;

// Convert the painted border box back to week coordinates, including the bar's visual inset.
export function displayedInterval(
  bounds: { left: number; width: number },
  laneLeft: number,
  weekWidth: number,
): { start: number; end: number } {
  const start = pointerWeek(bounds.left - BAR_INSET, laneLeft, weekWidth);
  return { start, end: start + (bounds.width + BAR_INSET * 2) / weekWidth };
}
