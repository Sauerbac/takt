import { describe, expect, it } from 'vitest';
import { monthGrid, moveDate, moveMonth, validDate } from './calendar-grid';

describe('calendar grid date-only arithmetic', () => {
  it('validates leap days, rejects normalized dates and respects supported years', () => {
    for (const value of ['2024-02-29', '0001-01-01', '9999-12-31'])
      expect(validDate(value)).toBe(true);
    for (const value of [
      '2023-02-29',
      '2024-04-31',
      '0000-01-01',
      '2026-1-1',
      'garbage',
    ])
      expect(validDate(value)).toBe(false);
  });
  it('moves across months, leap years and daylight-saving dates without skipping days', () => {
    expect(moveDate('2024-02-28', 1)).toBe('2024-02-29');
    expect(moveDate('2026-03-29', 1)).toBe('2026-03-30');
    expect(moveMonth('2024-01-31', 1)).toBe('2024-02-29');
    expect(moveMonth('2023-03-31', -1)).toBe('2023-02-28');
    expect(moveDate('0001-01-01', -1)).toBe('0001-01-01');
    expect(moveMonth('9999-12-31', 1)).toBe('9999-12-31');
  });
  it('renders six complete Monday-first weeks including adjacent months and boundary blanks', () => {
    const days = monthGrid('2024-02-29').flat();
    expect(days).toHaveLength(42);
    expect(days[0]).toBe('2024-01-29');
    expect(days[41]).toBe('2024-03-10');
    expect(monthGrid('0001-01-01').flat()[0]).toBe('0001-01-01');
    expect(monthGrid('9999-12-01').flat().at(-1)).toBeNull();
  });
});
