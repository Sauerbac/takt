import { expect, it } from 'vitest';
import { calendarBands, headingStride } from './timeline-headings';

it('uses spaced week labels anchored across negative and positive weeks', () => {
  expect([80, 40, 20, 10].map(headingStride)).toEqual([1, 2, 4, 8]);
});

it('maps real month and year boundaries across leap days and arbitrary week starts', () => {
  const reference = { week: 3, date: '2024-02-29' };
  const months = calendarBands(reference, 2, 6, 'month');
  expect(months.map((band) => band.label)).toEqual(['Feb', 'Mar', 'Apr']);
  expect(months[0].end).toBeCloseTo(3 + 1 / 7);
  expect(months[1].end - months[1].start).toBeCloseTo(31 / 7);
  const years = calendarBands({ week: 0, date: '2026-12-30' }, -2, 8, 'year');
  expect(years.map((band) => band.label)).toEqual(['2026', '2027']);
  expect(years[0].end).toBeCloseTo(2 / 7);
  expect(years[0].end).toBe(years[1].start);
});
