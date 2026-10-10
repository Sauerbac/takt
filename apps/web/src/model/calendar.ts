import type { CalendarReference, ChartDocument } from './document';

const DAY = 86_400_000;
// UTC date-only arithmetic keeps seven-day weeks stable across DST and time zones.
export function dateAt(
  reference: CalendarReference,
  week: number,
  day = 0,
): string {
  const date = new Date(
    Date.parse(reference.date) + ((week - reference.week) * 7 + day) * DAY,
  );
  return date.toISOString().split('T')[0];
}
const formatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
export const formatDate = (date: string) => formatter.format(new Date(date));
// Coordinates remain zero-based; relative labels start at one.
export const relativeWeekLabel = (week: number) => `Week ${week + 1}`;
export function weekLabel(document: ChartDocument, week: number): string {
  return document.display === 'dates' && document.calendar
    ? formatDate(dateAt(document.calendar, week))
    : relativeWeekLabel(week).replace('-', '−');
}
export function barTiming(
  document: ChartDocument,
  start: number,
  end: number,
): string {
  return document.display === 'dates' && document.calendar
    ? `${formatDate(dateAt(document.calendar, start))}–${formatDate(dateAt(document.calendar, end - 1, 6))}`
    : `Weeks ${start + 1}–${end}`;
}
export function milestoneTiming(
  document: ChartDocument,
  boundary: number,
): string {
  return document.display === 'dates' && document.calendar
    ? formatDate(dateAt(document.calendar, boundary - 1, 6))
    : `End of Week ${boundary}`;
}
