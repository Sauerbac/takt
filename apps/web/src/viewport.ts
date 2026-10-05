import type { ChartDocument } from './model/document';
import type { Command } from './model/history';

// View-only state and coordinates; neither is persisted in document history.
export interface ViewportState {
  selectedId: string | null;
  editingId: string | null;
  firstWeek: number;
  zoom: number;
}
export const initialViewport = (): ViewportState => ({
  selectedId: null,
  editingId: null,
  firstWeek: FIRST_WEEK,
  zoom: 1,
});
export const FIRST_WEEK = -2;
export const WEEK_COUNT = 24;
export const BAR_INSET = 5;
export const barInset = (weekWidth: number) =>
  Math.min(BAR_INSET, weekWidth / 4);
export const LABEL_WIDTH = 218;
export const BAR_LABEL_WIDTH = 56;
export const COMPACT_BAR_WIDTH = 32;
export const OVERVIEW_ZOOM_DURATION = 150;

// Removed objects still have a location. Keep that context from the command
// snapshots so undoing creation and redoing deletion can reveal their result.
export function historyLocation(document: ChartDocument, command: Command) {
  const items = [...document.bars, ...document.milestones];
  const selected = items.find((item) => item.id === command.revealId);
  const item =
    selected ??
    [
      ...command.before.bars,
      ...command.before.milestones,
      ...command.after.bars,
      ...command.after.milestones,
    ].find((item) => item.id === command.revealId);
  const rowId = item?.rowId ?? command.revealId;
  const row =
    document.rows.find((row) => row.id === rowId) ??
    [...command.before.rows, ...command.after.rows].find(
      (row) => row.id === rowId,
    );
  const sectionId = row?.sectionId ?? command.revealId;
  const section = document.sections.find((section) => section.id === sectionId);
  const previousSections = command.before.sections.some(
    (section) => section.id === sectionId,
  )
    ? command.before.sections
    : command.after.sections;
  const index = previousSections.findIndex(
    (section) => section.id === sectionId,
  );
  return {
    selectedId: selected?.id ?? null,
    rowId: document.rows.some((row) => row.id === rowId) ? rowId : undefined,
    sectionId:
      section?.id ??
      (index >= 0
        ? document.sections[Math.min(index, document.sections.length - 1)]?.id
        : undefined),
    interval: item
      ? 'boundary' in item
        ? { start: item.boundary - 1, end: item.boundary }
        : { start: item.start, end: item.end }
      : undefined,
  };
}
export const clampZoom = (zoom: number) => Math.max(0.125, Math.min(2, zoom));
// Anchor is a distance in CSS pixels from the timeline's (possibly scrolled) left edge.
export function zoomFirstWeek(
  firstWeek: number,
  oldWidth: number,
  newWidth: number,
  anchor: number,
): number {
  return firstWeek + anchor / oldWidth - anchor / newWidth;
}
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
    bounds.left - barInset(weekWidth),
    laneLeft,
    weekWidth,
    firstWeek,
  );
  return {
    start,
    end: start + (bounds.width + barInset(weekWidth) * 2) / weekWidth,
  };
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
