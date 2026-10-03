// View-only state and coordinates; neither is persisted in document history.
export interface ViewportState {
  selectedId: string | null;
  editingId: string | null;
  firstWeek: number;
}
export const initialViewport = (): ViewportState => ({
  selectedId: null,
  editingId: null,
  firstWeek: FIRST_WEEK,
});
export const FIRST_WEEK = -2;
export const WEEK_COUNT = 12;
export const BAR_INSET = 5;
export const LABEL_WIDTH = 218;
export const pointerWeek = (
  clientX: number,
  laneLeft: number,
  weekWidth: number,
  firstWeek = FIRST_WEEK,
): number => firstWeek + (clientX - laneLeft) / weekWidth;

// Convert the painted border box back to week coordinates, including the bar's visual inset.
export function displayedInterval(
  bounds: { left: number; width: number },
  laneLeft: number,
  weekWidth: number,
  firstWeek = FIRST_WEEK,
): { start: number; end: number } {
  const start = pointerWeek(
    bounds.left - BAR_INSET,
    laneLeft,
    weekWidth,
    firstWeek,
  );
  return { start, end: start + (bounds.width + BAR_INSET * 2) / weekWidth };
}

export interface VisibleTimeline {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

// CSS pixels, independent of zoom. Speed ramps linearly from the zone's inner edge.
export const EDGE_ZONE = 40;
export const EDGE_SPEED = 240;
export function edgeVelocity(
  pointer: { x: number; y: number },
  bounds: VisibleTimeline,
): number {
  if (
    pointer.x < bounds.left ||
    pointer.x > bounds.right ||
    pointer.y < bounds.top ||
    pointer.y > bounds.bottom
  )
    return 0;
  const zone = Math.min(EDGE_ZONE, (bounds.right - bounds.left) / 2);
  if (zone <= 0) return 0;
  if (pointer.x < bounds.left + zone)
    return -EDGE_SPEED * (1 - (pointer.x - bounds.left) / zone);
  if (pointer.x > bounds.right - zone)
    return EDGE_SPEED * (1 - (bounds.right - pointer.x) / zone);
  return 0;
}
