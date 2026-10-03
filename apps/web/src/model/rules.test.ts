import { describe, expect, it } from 'vitest';
import { assertDocument, emptyDocument } from './document';
import type { Bar, ChartDocument } from './document';
import { placeBar, snapWeek } from './rules';
import { History } from './history';
import { Gesture } from '../interaction/gesture';

const bar = (id: string, start: number, end: number): Bar => ({
  id,
  start,
  end,
  name: '',
});
const doc = (...bars: Bar[]): ChartDocument => ({ ...emptyDocument(), bars });
const chain = () => doc(bar('a', 0, 2), bar('b', 2, 4), bar('c', 4, 5));
const ranges = (document: ChartDocument) =>
  document.bars.map(({ id, start, end }) => [id, start, end]);

describe('whole-week rules', () => {
  it.each([
    [-2.51, -3],
    [-2.5, -2],
    [-0.5, 0],
    [0.49, 0],
    [0.5, 1],
    [2.5, 3],
    [3, 3],
  ])('snaps %s to %s, including later negative ties', (input, result) =>
    expect(snapWeek(input)).toBe(result),
  );
  it('allows adjacency and pushes a complete right chain without changing duration', () => {
    expect(ranges(placeBar(chain(), bar('a', 0, 2), 'right'))).toEqual(
      ranges(chain()),
    );
    expect(ranges(placeBar(chain(), bar('a', 0, 3), 'right'))).toEqual([
      ['a', 0, 3],
      ['b', 3, 5],
      ['c', 5, 6],
    ]);
  });
  it('pushes left cascades, including negative weeks', () => {
    expect(ranges(placeBar(chain(), bar('c', 3, 5), 'left'))).toEqual([
      ['a', -1, 1],
      ['b', 1, 3],
      ['c', 3, 5],
    ]);
  });
  it('pushes conflicting bars right during creation and leaves distant bars alone', () => {
    const before = doc(bar('b', 2, 4), bar('c', 4, 5), bar('far', 9, 10));
    expect(ranges(placeBar(before, bar('new', 1, 3), 'right'))).toEqual([
      ['b', 3, 5],
      ['c', 5, 6],
      ['far', 9, 10],
      ['new', 1, 3],
    ]);
    expect(before.bars[0].start).toBe(2);
  });
  it('ignores bars crossed on the way to a non-conflicting destination', () => {
    expect(ranges(placeBar(chain(), bar('a', 7, 9), 'right'))).toEqual([
      ['a', 7, 9],
      ['b', 2, 4],
      ['c', 4, 5],
    ]);
  });
  it('preserves invariants across many intervals, directions and durations', () => {
    for (let start = -8; start <= 10; start++) {
      for (let duration = 1; duration <= 6; duration++) {
        for (const direction of ['left', 'right'] as const) {
          const before = chain();
          const result = placeBar(
            before,
            bar('new', start, start + duration),
            direction,
          );
          assertDocument(result);
          for (const original of before.bars) {
            const pushed = result.bars.find((item) => item.id === original.id)!;
            expect(pushed.end - pushed.start).toBe(
              original.end - original.start,
            );
          }
        }
      }
    }
  });
});

describe('gesture transactions', () => {
  it.each([
    [3, 5],
    [5, 3],
  ])('draws the same interval from %s to %s', (from, to) => {
    const gesture = new Gesture(emptyDocument(), 'draw', 'new', from, 80);
    gesture.update(to);
    expect(ranges(gesture.commit())).toEqual([['new', 3, 5]]);
  });
  it('creates nothing for a click or jitter, and begins at exactly four pixels', () => {
    const gesture = new Gesture(emptyDocument(), 'draw', 'new', 3.1, 80);
    gesture.update(3.1);
    expect(gesture.commit().bars).toEqual([]);
    gesture.update(3.14);
    expect(gesture.commit().bars).toEqual([]);
    gesture.update(3.15);
    expect(ranges(gesture.commit())).toEqual([['new', 3, 4]]);
  });
  it('snaps both draw boundaries, including half ties', () => {
    const gesture = new Gesture(emptyDocument(), 'draw', 'new', -0.5, 80);
    gesture.update(2.5);
    expect(ranges(gesture.preview)).toEqual([['new', 0, 3]]);
    expect(gesture.tracking).toEqual({ start: -0.5, end: 2.5 });
  });
  it('keeps movement continuous while previewing whole weeks', () => {
    const gesture = new Gesture(chain(), 'move', 'a', 0.3, 80);
    gesture.update(0.7);
    expect(gesture.tracking.start).toBeCloseTo(0.4);
    expect(gesture.preview.bars[0].start).toBe(0);
    gesture.update(0.8);
    expect(gesture.validDrop).toBe(false);
    gesture.update(0.8, 300);
    expect(ranges(gesture.preview)).toEqual([
      ['a', 1, 3],
      ['b', 3, 5],
      ['c', 5, 6],
    ]);
  });
  it.each(['resize-left', 'resize-right'] as const)(
    'resizing a settling bar by %s keeps the committed opposite boundary',
    (kind) => {
      const before = doc(bar('a', 3, 5));
      const gesture = new Gesture(before, kind, 'a', 4, 80, {
        start: 2.8,
        end: 4.8,
      });
      gesture.update(kind === 'resize-left' ? 3.6 : 4.9);
      expect(gesture.tracking.start).toBeCloseTo(
        kind === 'resize-left' ? 2.4 : 2.8,
      );
      expect(gesture.tracking.end).toBeCloseTo(
        kind === 'resize-left' ? 4.8 : 5.7,
      );
      expect(ranges(gesture.commit())).toEqual([
        ['a', kind === 'resize-left' ? 2 : 3, kind === 'resize-left' ? 5 : 6],
      ]);
      expect(gesture.cancel()).toEqual(before);
    },
  );
  it('uses displayed geometry for pickup without changing committed duration or history', () => {
    const before = doc(bar('a', 1, 3), bar('b', 3, 5), bar('c', 5, 6));
    const gesture = new Gesture(before, 'move', 'a', 1.9, 80, {
      start: 0.8,
      end: 2.6,
    });
    expect(gesture.tracking).toEqual({ start: 0.8, end: 2.6 });
    gesture.update(2.6);
    gesture.update(2.6, 300);
    expect(gesture.tracking.start).toBeCloseTo(1.5);
    expect(gesture.tracking.end).toBeCloseTo(3.3);
    expect(ranges(gesture.commit())).toEqual([
      ['a', 2, 4],
      ['b', 4, 6],
      ['c', 6, 7],
    ]);
    expect(gesture.cancel()).toEqual(before);
    const history = new History(before);
    history.commit('move', gesture.commit(), 'a');
    history.undo();
    expect(history.document).toEqual(before);
    history.redo();
    expect(history.document).toEqual(gesture.preview);
  });
  it.each(['resize-left', 'resize-right'] as const)(
    'resizing a narrow creation settlement by %s keeps tracking continuous with a semantic one-week minimum',
    (kind) => {
      const before = doc(bar('a', 3, 4));
      const displayed =
        kind === 'resize-right'
          ? { start: 3, end: 3.7 }
          : { start: 3.3, end: 4 };
      const gesture = new Gesture(
        before,
        kind,
        'a',
        kind === 'resize-right' ? 3.7 : 3.3,
        80,
        displayed,
      );
      gesture.update(kind === 'resize-right' ? 3.8 : 3.2);
      expect(gesture.tracking).toEqual(
        kind === 'resize-right'
          ? { start: 3, end: 3.8 }
          : { start: 3.2, end: 4 },
      );
      expect(gesture.preview).toEqual(before);
    },
  );
  it.each(['resize-left', 'resize-right'] as const)(
    'clamps %s to one week without switching handles',
    (kind) => {
      const gesture = new Gesture(chain(), kind, 'a', 0, 80);
      gesture.update(kind === 'resize-left' ? 20 : -20);
      expect(gesture.preview.bars[0]).toMatchObject(
        kind === 'resize-left' ? { start: 1, end: 2 } : { start: 0, end: 1 },
      );
      expect(gesture.tracking.end - gesture.tracking.start).toBe(1);
    },
  );
  it('reverses pushed previews from the original document, then commits only the visible result', () => {
    const gesture = new Gesture(chain(), 'resize-right', 'a', 2, 80);
    gesture.update(3);
    expect(gesture.preview.bars[2].start).toBe(5);
    gesture.update(2);
    expect(gesture.preview).toEqual(chain());
    gesture.update(3.4);
    const visible = gesture.preview;
    expect(gesture.commit()).toEqual(visible);
    expect(gesture.cancel()).toEqual(chain());
  });
  it('reverses creation pushes and cancels the complete transaction', () => {
    const before = doc(bar('b', 2, 4), bar('c', 4, 5));
    const gesture = new Gesture(before, 'draw', 'new', 0, 80);
    gesture.update(3);
    expect(gesture.preview.bars[1].start).toBe(5);
    gesture.update(1);
    expect(gesture.preview.bars[1].start).toBe(4);
    expect(gesture.cancel()).toEqual(before);
  });
  it('leftward moves and left-edge extensions push left and reverse', () => {
    for (const kind of ['move', 'resize-left'] as const) {
      const gesture = new Gesture(chain(), kind, 'c', 4, 80);
      gesture.update(3);
      if (kind === 'move') gesture.update(3, 300);
      expect(gesture.preview.bars[0].start).toBe(-1);
      gesture.update(4);
      expect(gesture.preview).toEqual(chain());
    }
  });
});

describe('atomic history commands', () => {
  it('undoes and redoes a complete gesture, including every pushed bar', () => {
    const history = new History(chain());
    const gesture = new Gesture(history.document, 'resize-right', 'a', 2, 80);
    gesture.update(3);
    const committed = gesture.commit();
    history.commit('resize-right', committed, 'a');
    history.undo();
    expect(history.document).toEqual(chain());
    expect(history.canUndo).toBe(false);
    history.redo();
    expect(history.document).toEqual(committed);
  });
  it('keeps creation and naming separate and restores creation displacement', () => {
    const before = doc(bar('b', 2, 4));
    const history = new History(before);
    const created = placeBar(before, bar('new', 1, 3), 'right');
    history.commit('draw', created, 'new');
    history.commit(
      'name',
      {
        ...created,
        bars: created.bars.map((bar) =>
          bar.id === 'new' ? { ...bar, name: 'Research' } : bar,
        ),
      },
      'new',
    );
    history.undo();
    expect(history.document).toEqual(created);
    history.undo();
    expect(history.document).toEqual(before);
    history.redo();
    history.redo();
    expect(history.document.bars[1].name).toBe('Research');
  });
  it('creates no history entry for cancellation, unchanged gestures, or skipped naming', () => {
    const history = new History(chain());
    const gesture = new Gesture(history.document, 'move', 'a', 0, 80);
    gesture.update(1);
    expect(gesture.cancel()).toEqual(history.document);
    expect(history.commit('move', gesture.cancel(), 'a')).toBe(false);
    expect(history.commit('name', history.document, 'a')).toBe(false);
    expect(history.canUndo).toBe(false);
  });
  it('clears redo on a new action but preserves it on a no-op', () => {
    const history = new History(emptyDocument());
    history.commit('draw', doc(bar('a', 0, 1)), 'a');
    history.undo();
    history.commit('name', history.document, 'a');
    expect(history.canRedo).toBe(true);
    history.commit('draw', doc(bar('b', 2, 3)), 'b');
    expect(history.canRedo).toBe(false);
  });
  it('owns copies so callers cannot mutate retained history snapshots', () => {
    const original = chain();
    const history = new History(original);
    const returned = history.document;
    expect(returned).not.toBe(original);
    expect(returned.bars[0]).not.toBe(original.bars[0]);
    expect(history.document.bars[0]).not.toBe(returned.bars[0]);
  });
});
