// Date-only UI arithmetic uses UTC, matching the document's calendar mapping.
export function calendarDate(year: number, month: number, day: number) {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  return date;
}
export function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= '0001-01-01' &&
    value <= '9999-12-31' &&
    !Number.isNaN(Date.parse(value)) &&
    isoDate(new Date(value)) === value
  );
}
export function moveDate(value: string, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return boundedDate(date);
}
export function moveMonth(value: string, months: number) {
  const date = new Date(value);
  const first = calendarDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + months,
    1,
  );
  const lastDay = calendarDate(
    first.getUTCFullYear(),
    first.getUTCMonth() + 1,
    0,
  ).getUTCDate();
  first.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return boundedDate(first);
}
function boundedDate(date: Date) {
  if (date.getUTCFullYear() < 1) return '0001-01-01';
  if (date.getUTCFullYear() > 9999) return '9999-12-31';
  return isoDate(date);
}
export function monthGrid(value: string) {
  const date = new Date(value);
  const first = calendarDate(date.getUTCFullYear(), date.getUTCMonth(), 1);
  const offset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 6 }, (_, row) =>
    Array.from({ length: 7 }, (_, column) => {
      const day = calendarDate(
        first.getUTCFullYear(),
        first.getUTCMonth(),
        1 - offset + row * 7 + column,
      );
      return day.getUTCFullYear() < 1 || day.getUTCFullYear() > 9999
        ? null
        : isoDate(day);
    }),
  );
}
