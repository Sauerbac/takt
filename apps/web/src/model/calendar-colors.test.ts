import { describe, expect, it } from 'vitest';
import { assertDocument, copyDocument, emptyDocument } from './document';
import type { ChartDocument } from './document';
import { barTiming, dateAt, milestoneTiming, weekLabel } from './calendar';
import {
  palette,
  colorRows,
  colorLabelInk,
  itemColor,
  recolor,
} from './colors';
import { History } from './history';
import { moveRow } from './structure';
import { placeBar, placeMilestone } from './rules';

describe('calendar weeks', () => {
  const calendar = { week: 3, date: '2026-10-05' };
  it('anchors any week, maps both directions and distinguishes inclusive milestone dates', () => {
    const doc = { ...emptyDocument(), calendar, display: 'dates' as const };
    expect(dateAt(calendar, 0)).toBe('2026-09-14');
    expect(dateAt(calendar, 2)).toBe('2026-09-28');
    expect(dateAt(calendar, 4)).toBe('2026-10-12');
    expect(weekLabel(doc, 3)).toBe('5 Oct 2026');
    expect(barTiming(doc, 3, 6)).toBe('5 Oct 2026–25 Oct 2026');
    expect(milestoneTiming(doc, 4)).toBe('11 Oct 2026');
    expect(weekLabel({ ...doc, display: 'weeks' }, -2)).toBe('Week −2');
    expect(milestoneTiming(emptyDocument(), 3)).toBe('End of Week 2');
  });
  it.each([
    ['2026-03-25', 1, '2026-04-01'],
    ['2026-10-23', 1, '2026-10-30'],
    ['2024-02-23', 1, '2024-03-01'],
    ['2026-12-29', 1, '2027-01-05'],
    ['2026-01-01', -1, '2025-12-25'],
  ])(
    'maps %s by seven days across DST, leap days and years',
    (date, week, expected) => {
      expect(dateAt({ week: 0, date }, week)).toBe(expected);
    },
  );
  it('isolates reference snapshots and undoably retains references across display switches', () => {
    const initial = emptyDocument();
    const history = new History(initial);
    history.commit(
      'calendar',
      { ...initial, calendar, display: 'dates' },
      'calendar',
    );
    const copy = copyDocument(history.document);
    expect(copy.calendar).not.toBe(calendar);
    history.commit(
      'display',
      { ...history.document, display: 'weeks' },
      'calendar',
    );
    expect(history.document.calendar).toEqual(calendar);
    history.commit(
      'calendar',
      { ...history.document, calendar: { week: -2, date: '2026-04-02' } },
      'calendar',
    );
    history.undo();
    expect(history.document.calendar).toEqual(calendar);
    history.undo();
    expect(history.document.display).toBe('dates');
    history.undo();
    expect(history.document).toEqual(initial);
    history.redo();
    expect(history.document.calendar).toEqual(calendar);
  });
  it.each(['2026-02-30', '2026-13-01', 'not a date', '2026-3-01'])(
    'rejects invalid date %s',
    (date) => {
      expect(() =>
        assertDocument({ ...emptyDocument(), calendar: { week: 0, date } }),
      ).toThrow();
    },
  );
  it('rejects calendar display without reference or a fractional anchor', () => {
    expect(() =>
      assertDocument({ ...emptyDocument(), display: 'dates' }),
    ).toThrow();
    expect(() =>
      assertDocument({
        ...emptyDocument(),
        calendar: { ...calendar, week: 0.5 },
      }),
    ).toThrow();
  });
});

describe('color inheritance', () => {
  const initial: ChartDocument = {
    ...emptyDocument(),
    sections: [
      { id: 'section-1', name: '' },
      { id: 'section-2', name: '', color: 'lavender' },
    ],
    bars: [
      { id: 'a', rowId: 'row-1', start: 0, end: 2, name: '' },
      { id: 'b', rowId: 'row-1', start: 2, end: 3, name: '', color: 'rose' },
    ],
    milestones: [{ id: 'm', rowId: 'row-1', boundary: 3, name: '' }],
  };
  it.each(colorRows.flat())(
    'supports %s for sections and item overrides through history and movement',
    (color) => {
      const history = new History(initial);
      history.commit(
        'color',
        recolor(initial, 'section-1', color),
        'section-1',
      );
      assertDocument(history.document);
      expect(itemColor(history.document, history.document.bars[0])).toBe(color);
      expect(itemColor(history.document, history.document.milestones[0])).toBe(
        color,
      );
      expect(itemColor(history.document, history.document.bars[1])).toBe(
        'rose',
      );
      history.commit('color', recolor(history.document, 'a', color), 'a');
      const moved = moveRow(history.document, 'row-1', 'section-2', 0);
      expect(itemColor(moved, moved.bars[0])).toBe(color);
      expect(itemColor(moved, moved.milestones[0])).toBe('lavender');
      history.undo();
      expect(history.document.bars[0]).not.toHaveProperty('color');
      history.undo();
      expect(history.document).toEqual(initial);
      history.redo();
      expect(itemColor(history.document, history.document.bars[0])).toBe(color);
      expect(palette[color].name).not.toMatch(/apricot/i);
      expect(colorLabelInk(color)).not.toBe('#ffffff');
    },
  );
  it('changes inherited bars and milestones, preserves overrides, and resets overrides', () => {
    const doc = recolor(initial, 'section-1', 'sea-blue');
    expect(itemColor(doc, doc.bars[0])).toBe('sea-blue');
    expect(itemColor(doc, doc.milestones[0])).toBe('sea-blue');
    expect(itemColor(doc, doc.bars[1])).toBe('rose');
    const reset = recolor(doc, 'b');
    expect(itemColor(reset, reset.bars[1])).toBe('sea-blue');
    expect(reset.bars[1]).not.toHaveProperty('color');
    expect(initial.sections[0]).not.toHaveProperty('color');
  });
  it('adopts destination section for row and item movement while preserving explicit colors', () => {
    const doc = moveRow(initial, 'row-1', 'section-2', 0);
    expect(itemColor(doc, doc.bars[0])).toBe('lavender');
    expect(itemColor(doc, doc.bars[1])).toBe('rose');
    expect(itemColor(doc, doc.milestones[0])).toBe('lavender');
    const twoRows = {
      ...initial,
      rows: [...initial.rows, { id: 'r2', sectionId: 'section-2', name: '' }],
    };
    const bar = placeBar(twoRows, { ...twoRows.bars[0], rowId: 'r2' }, 'right');
    expect(itemColor(bar, bar.bars[0])).toBe('lavender');
    const milestone = placeMilestone(twoRows, {
      ...twoRows.milestones[0],
      rowId: 'r2',
      color: 'rose',
    });
    expect(itemColor(milestone, milestone.milestones[0])).toBe('rose');
    expect(doc.bars).toEqual(initial.bars);
  });
  it('undoes color changes and inheritance resets independently and clears redo on a new color', () => {
    const history = new History(initial);
    history.commit('color', recolor(history.document, 'a', 'slate'), 'a');
    history.commit('color', recolor(history.document, 'a'), 'a');
    history.undo();
    expect(itemColor(history.document, history.document.bars[0])).toBe('slate');
    history.undo();
    expect(history.document).toEqual(initial);
    history.redo();
    history.commit('color', recolor(history.document, 'a', 'sea-blue'), 'a');
    expect(history.canRedo).toBe(false);
  });
});
