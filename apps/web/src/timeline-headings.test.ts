import { expect, it } from 'vitest';
import {
  calendarBands,
  relativeBands,
  headingStride,
} from './timeline-headings';

it('uses spaced week labels anchored across negative and positive weeks', () => {
  expect([80, 40, 20, 10].map(headingStride)).toEqual([1, 2, 4, 8]);
});

it('starts relative months and years at one and uses calendar lengths on both sides of the origin', () => {
  const months = relativeBands(-1, 10, 'month');
  expect(months.map(({ label }) => label)).toEqual([
    'Month 12',
    'Month 1',
    'Month 2',
    'Month 3',
  ]);
  expect(months[0].end).toBe(0);
  expect(months[1].start).toBe(0);
  expect(months[1].end - months[1].start).toBeCloseTo(31 / 7);
  expect(months[2].end - months[2].start).toBeCloseTo(28 / 7);
  const years = relativeBands(-110, 220, 'year');
  expect(years.map(({ label }) => label)).toEqual([
    'Year -2',
    'Year -1',
    'Year 0',
    'Year 1',
    'Year 2',
    'Year 3',
  ]);
  const zero = years.find(({ label }) => label === 'Year 0')!;
  const one = years.find(({ label }) => label === 'Year 1')!;
  expect(zero.end).toBe(0);
  expect(zero.end - zero.start).toBeCloseTo(366 / 7);
  expect(one.start).toBe(0);
  expect(one.end - one.start).toBeCloseTo(365 / 7);
  for (let index = 1; index < years.length; index++) {
    expect(years[index].start).toBe(years[index - 1].end);
  }
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
