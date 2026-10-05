import type { CalendarReference } from './model/document';
import { dateAt } from './model/calendar';

const WEEK = 7 * 86_400_000;
const monthLabel = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  timeZone: 'UTC',
});

// Label density is presentation only. Boundaries remain real dates, including
// months that begin partway through a document week.
export function calendarBands(
  reference: CalendarReference,
  firstWeek: number,
  weekCount: number,
  unit: 'month' | 'year',
) {
  const origin = Date.parse(dateAt(reference, 0));
  const start = new Date(origin + firstWeek * WEEK);
  let year = start.getUTCFullYear();
  let month = unit === 'year' ? 0 : start.getUTCMonth();
  const bands: { start: number; end: number; label: string }[] = [];
  while (true) {
    const date = new Date(Date.UTC(year, month, 1));
    const from = (date.getTime() - origin) / WEEK;
    if (from >= firstWeek + weekCount) break;
    const next = Date.UTC(
      year + (unit === 'year' ? 1 : 0),
      month + (unit === 'month' ? 1 : 0),
      1,
    );
    bands.push({
      start: from,
      end: (next - origin) / WEEK,
      label: unit === 'year' ? String(year) : monthLabel.format(date),
    });
    if (unit === 'year') year++;
    else if (++month === 12) {
      month = 0;
      year++;
    }
  }
  return bands;
}

export function headingStride(weekWidth: number) {
  return 2 ** Math.max(0, Math.ceil(Math.log2(60 / weekWidth)));
}

// Explicit SVG coordinates avoid image tiling seams and browser-specific
// fractional background-size rounding. Header and lane share this week origin.
export function weekGridPath(
  firstWeek: number,
  weekWidth: number,
  width: number,
) {
  return Array.from(
    { length: Math.ceil(width / weekWidth) + 2 },
    (_, index) => {
      const week = Math.floor(firstWeek) + index;
      const x = (week - firstWeek) * weekWidth - 0.5;
      return `M${x} 0V44`;
    },
  ).join('');
}
