import { expect, it } from 'vitest';
import { assertDocument, emptyDocument } from '../model/document';
import type { ChartDocument } from '../model/document';
import { History } from '../model/history';
import { placeMilestone } from '../model/rules';
import { Gesture } from './gesture';
import { MilestoneGesture } from './milestone';

const before = (): ChartDocument => ({
  ...emptyDocument(),
  rows: ['row-1', 'row-2', 'row-3'].map((id) => ({ id, name: '' })),
  bars: [
    { id: 'a', rowId: 'row-1', start: 0, end: 2, name: 'A' },
    { id: 'b', rowId: 'row-2', start: 0, end: 2, name: 'B' },
    { id: 'c', rowId: 'row-2', start: 2, end: 3, name: 'C' },
    { id: 'd', rowId: 'row-3', start: 0, end: 1, name: 'D' },
  ],
  milestones: [
    { id: 'm', rowId: 'row-1', boundary: 1, name: '' },
    { id: 'n', rowId: 'row-2', boundary: 3, name: '' },
  ],
});

it('entering between two bars opens space on both sides and commits both cascades together', () => {
  const initial = before();
  const document = {
    ...initial,
    bars: [
      { ...initial.bars[0], rowId: 'row-2', start: 2, end: 5 },
      { ...initial.bars[1], rowId: 'row-1', start: 0, end: 4 },
      { ...initial.bars[2], rowId: 'row-1', start: 4, end: 6 },
      { ...initial.bars[3], rowId: 'row-1', start: -1, end: 0 },
      { id: 'e', rowId: 'row-1', start: 6, end: 7, name: '' },
    ],
  };
  const gesture = new Gesture(document, 'move', 'a', 3.5, 80);
  gesture.update(3.5, 0, 280, 'row-1', -44);
  gesture.update(3.5, 299, 280, 'row-1', -44);
  expect(gesture.validDrop).toBe(false);
  expect(gesture.preview).toEqual(document);
  gesture.update(3.5, 300, 280, 'row-1', -44);
  expect(gesture.preview.bars.map(({ start, end }) => [start, end])).toEqual([
    [2, 5],
    [-2, 2],
    [5, 7],
    [-3, -2],
    [7, 8],
  ]);
  assertDocument(gesture.preview);
  const history = new History(document);
  history.commit('move', gesture.commit(), 'a');
  history.undo();
  expect(history.document).toEqual(document);
  history.redo();
  expect(history.document).toEqual(gesture.preview);
  expect(gesture.cancel()).toEqual(document);
  // Clearing one side restores that chain; returning must retain the split.
  gesture.update(5.5, 1300, 440, 'row-1', -44);
  expect(gesture.preview.bars[1]).toEqual(document.bars[1]);
  expect(gesture.preview.bars[2]).toMatchObject({ start: 7, end: 9 });
  gesture.update(3.5, 2300, 280, 'row-1', -44);
  expect(gesture.preview).toEqual(history.document);
  gesture.update(3.5, 2400, 280, 'row-2', 0);
  expect(gesture.preview).toEqual(document);
  gesture.update(3.5, 2500, 280, 'row-1', -44);
  gesture.update(3.5, 2800, 280, 'row-1', -44);
  gesture.update(7.5, 4800, 600, 'row-1', -44);
  gesture.update(6.5, 4850, 520, 'row-1', -44); // Fast retraction while left is clear.
  expect(gesture.validDrop).toBe(true);
  expect(gesture.preview.bars[1]).toEqual(document.bars[1]);
  expect(gesture.preview.bars[2]).toMatchObject({ start: 8, end: 10 });
  gesture.update(9.5, 4900, 760, 'row-1', -44); // Fast continuation releases both sides.
  expect(gesture.preview.bars[1]).toEqual(document.bars[1]);
  expect(gesture.preview.bars[2]).toEqual(document.bars[2]);
});

it.each(['left', 'right'] as const)(
  'row entry resets the approach for a %s push, regardless of the pickup position',
  (direction) => {
    const left = direction === 'left';
    const initial = before();
    const document = {
      ...initial,
      bars: [
        { ...initial.bars[0], start: left ? 0 : 6, end: left ? 2 : 8 },
        { ...initial.bars[1], start: 2, end: 4 },
        { ...initial.bars[2], start: left ? 1 : 4, end: left ? 2 : 5 },
        initial.bars[3],
      ],
    };
    const pickup = left ? 1 : 7;
    const entry = left ? 5 : 1;
    const gesture = new Gesture(document, 'move', 'a', pickup, 80);
    gesture.update(entry, 0);
    gesture.update(entry, 1000, entry * 80, 'row-2', 44);
    gesture.update(3, 2000, 240, 'row-2', 44);
    gesture.update(3, 2300, 240, 'row-2', 44);
    expect(gesture.preview.bars[0]).toMatchObject({
      rowId: 'row-2',
      start: 2,
      end: 4,
    });
    expect(gesture.preview.bars[1]).toMatchObject({
      start: left ? 0 : 4,
      end: left ? 2 : 6,
    });
    expect(gesture.preview.bars[2]).toMatchObject({
      start: left ? -1 : 6,
      end: left ? 0 : 7,
    });
    expect(gesture.preview.bars[3]).toEqual(document.bars[3]);
    expect(gesture.preview.milestones).toEqual(document.milestones);
    assertDocument(gesture.preview);
    const history = new History(document);
    history.commit('move', gesture.commit(), 'a');
    history.undo();
    expect(history.document).toEqual(document);
    history.redo();
    expect(history.document).toEqual(gesture.preview);
  },
);

it('vertical-only movement previews each row, restores intermediate pushes, and commits atomically', () => {
  const document = before();
  const gesture = new Gesture(document, 'move', 'a', 1, 80);
  gesture.update(1, 0, 80, 'row-2', 44);
  expect(gesture.validDrop).toBe(false);
  expect(gesture.pushAt).toBe(300);
  expect(gesture.preview).toEqual(document);
  gesture.update(1, 300, 80, 'row-2', 44);
  expect(gesture.validDrop).toBe(true);
  expect(gesture.preview.bars.map(({ start, end }) => [start, end])).toEqual([
    [0, 2],
    [2, 4],
    [4, 5],
    [0, 1],
  ]);
  gesture.update(1, 400, 80, 'row-3', 88);
  expect(gesture.preview).toEqual(document);
  expect(gesture.pushAt).toBe(700);
  gesture.update(1, 700, 80, 'row-3', 88);
  expect(gesture.preview.bars).toEqual([
    { ...document.bars[0], rowId: 'row-3' },
    document.bars[1],
    document.bars[2],
    { ...document.bars[3], start: -1, end: 0 },
  ]);
  expect(gesture.cancel()).toEqual(document);
  const history = new History(document);
  history.commit('move', gesture.commit(), 'a');
  history.undo();
  expect(history.document).toEqual(document);
  history.redo();
  expect(history.document).toEqual(gesture.preview);
});

it('cross-row contact preserves durations and never affects other rows or milestones', () => {
  for (let start = -5; start <= 8; start++) {
    const document = before();
    const gesture = new Gesture(document, 'move', 'a', 1, 80);
    gesture.update(start + 1, 0, 80, 'row-2', 44);
    gesture.update(start + 1, 300, 80, 'row-2', 44);
    assertDocument(gesture.preview);
    expect(gesture.preview.bars[0]).toMatchObject({
      start,
      end: start + 2,
      rowId: 'row-2',
    });
    expect(gesture.preview.bars[3]).toEqual(document.bars[3]);
    expect(gesture.preview.milestones).toEqual(document.milestones);
    for (const bar of gesture.preview.bars) {
      const original = document.bars.find((item) => item.id === bar.id)!;
      expect(bar.end - bar.start).toBe(original.end - original.start);
    }
  }
});

it.each(['left', 'right'] as const)(
  'entering already overlapped uses the entry side for a %s push and resets contact on every row change',
  (direction) => {
    const left = direction === 'left';
    const initial = before();
    const document = {
      ...initial,
      bars: initial.bars.map((bar) =>
        bar.id === 'b'
          ? { ...bar, start: 2, end: 4 }
          : bar.id === 'c'
            ? { ...bar, start: 6, end: 7 }
            : bar,
      ),
    };
    const gesture = new Gesture(document, 'move', 'a', 1, 80);
    const pointer = left ? 4 : 2;
    // Horizontal travel in the old row points the opposite way for left entry.
    gesture.update(pointer, 0);
    gesture.update(pointer, 100, pointer * 80, 'row-2', 44);
    expect(gesture.validDrop).toBe(false);
    expect(gesture.pushAt).toBe(400);
    gesture.update(pointer, 399, pointer * 80, 'row-2', 44);
    expect(gesture.preview).toEqual(document);
    gesture.update(pointer, 400, pointer * 80, 'row-2', 44);
    expect(gesture.preview.bars[1]).toMatchObject({
      start: left ? 1 : 3,
      end: left ? 3 : 5,
    });
    gesture.update(pointer, 500, pointer * 80, 'row-3', 88);
    expect(gesture.preview.bars[1]).toEqual(document.bars[1]);
    gesture.update(pointer, 600, pointer * 80, 'row-2', 44);
    expect(gesture.validDrop).toBe(false);
    expect(gesture.pushAt).toBe(900);
    gesture.update(pointer, 900, pointer * 80, 'row-2', 44);
    expect(gesture.preview.bars[1]).toMatchObject({ start: left ? 1 : 3 });
    assertDocument(gesture.preview);
  },
);

it('an early overlapping cross-row release cancels the whole move and preserves redo', () => {
  const document = before();
  const history = new History(document);
  history.commit('name', { ...document, sectionName: 'Named' }, 'a');
  history.undo();
  const gesture = new Gesture(document, 'move', 'a', 1, 80);
  gesture.update(1, 0, 80, 'row-2', 44);
  gesture.update(1, 299, 80, 'row-2', 44);
  expect(gesture.validDrop).toBe(false);
  expect(history.commit('move', gesture.commit(), 'a')).toBe(false);
  expect(history.document).toEqual(document);
  expect(history.canRedo).toBe(true);
});

it.each(['left', 'right'] as const)(
  'destination-row %s pushes stay anchored, retract at any speed, and release for forward overtaking',
  (direction) => {
    const left = direction === 'left';
    const initial = before();
    const document = {
      ...initial,
      bars: initial.bars.map((bar) =>
        bar.id === 'b'
          ? { ...bar, start: 2, end: 4 }
          : bar.id === 'c'
            ? { ...bar, start: 6, end: 7 }
            : bar,
      ),
    };
    const gesture = new Gesture(document, 'move', 'a', 1, 80);
    const contact = left ? 4 : 2;
    gesture.update(contact, 0, contact * 80, 'row-2', 44);
    gesture.update(contact, 300, contact * 80, 'row-2', 44);
    const far = left ? -2 : 8;
    gesture.update(far, 2300, far * 80, 'row-2', 44);
    expect(gesture.preview.bars[1]).toMatchObject({
      start: left ? -5 : 9,
      end: left ? -3 : 11,
    });
    gesture.update(contact, 2400, contact * 80, 'row-2', 44);
    expect(gesture.validDrop).toBe(true);
    expect(gesture.preview.bars[1]).toMatchObject({ start: left ? 1 : 3 });
    gesture.update(far, 2500, far * 80, 'row-2', 44);
    expect(gesture.preview.bars[1]).toEqual(document.bars[1]);
    expect(gesture.preview.bars[2]).toEqual(document.bars[2]);
    assertDocument(gesture.preview);
  },
);

it('leaving the source clears its activated push and returning starts fresh contact', () => {
  const document = before();
  const neighbor = { id: 'source', rowId: 'row-1', start: 2, end: 3, name: '' };
  const source = { ...document, bars: [...document.bars, neighbor] };
  const gesture = new Gesture(source, 'move', 'a', 1, 80);
  gesture.update(2, 0);
  gesture.update(2, 300);
  expect(gesture.preview.bars.at(-1)?.start).toBe(3);
  gesture.update(2, 400, 160, 'row-2', 44);
  expect(gesture.preview.bars.at(-1)).toEqual(neighbor);
  gesture.update(2, 500, 160, 'row-1', 0);
  expect(gesture.validDrop).toBe(false);
  expect(gesture.pushAt).toBe(800);
  gesture.update(2, 800);
  expect(gesture.preview.bars.at(-1)?.start).toBe(3);
});

it('drawing and resizing stay in their source row', () => {
  for (const kind of ['draw', 'resize-left', 'resize-right'] as const) {
    const gesture = new Gesture(
      before(),
      kind,
      kind === 'draw' ? 'new' : 'a',
      1,
      80,
    );
    gesture.update(3, 0, 240, 'row-2', 44);
    expect(gesture.proposal?.rowId).toBe('row-1');
    expect(gesture.preview.bars[1]).toEqual(before().bars[1]);
    assertDocument(gesture.preview);
  }
});

it('milestones coexist with bars, may share boundaries across rows, and reject duplicates', () => {
  const document = before();
  assertDocument(document);
  expect(
    placeMilestone(document, {
      id: 'new',
      rowId: 'row-1',
      boundary: 1,
      name: '',
    }),
  ).toBe(document);
  const result = placeMilestone(document, {
    id: 'new',
    rowId: 'row-3',
    boundary: 1,
    name: '',
  });
  assertDocument(result);
  expect(result.bars).toEqual(document.bars);
  expect(result.milestones).toHaveLength(3);
  expect(() =>
    assertDocument({
      ...document,
      milestones: [
        ...document.milestones,
        { ...document.milestones[0], id: 'duplicate' },
      ],
    }),
  ).toThrow('Invalid milestone');
  expect(() =>
    assertDocument({
      ...document,
      bars: [{ ...document.bars[0], rowId: 'missing' }],
    }),
  ).toThrow('Invalid bar');
});

it('a duplicate milestone drop cancels the entire gesture and preserves redo', () => {
  const document = before();
  const history = new History(document);
  history.commit('name', { ...document, sectionName: 'Named' }, 'm');
  history.undo();
  const gesture = new MilestoneGesture(document, 'm', 1, 80);
  gesture.update(3, 0, 240, 'row-2', 44);
  expect(gesture.proposal).toEqual({ start: 3, end: 3, rowId: 'row-2' });
  expect(gesture.validDrop).toBe(false);
  expect(history.commit('milestone-move', gesture.commit(), 'm')).toBe(false);
  expect(history.canRedo).toBe(true);
  gesture.update(4.5, 10, 360, 'row-2', 44);
  expect(gesture.validDrop).toBe(true);
  expect(gesture.tracking.start).toBe(4.5);
  expect(gesture.preview.milestones[0]).toMatchObject({
    rowId: 'row-2',
    boundary: 5,
  });
  expect(gesture.preview.bars).toEqual(document.bars);
  history.commit('milestone-move', gesture.commit(), 'm');
  history.undo();
  expect(history.document).toEqual(document);
  history.redo();
  expect(history.document).toEqual(gesture.preview);
  expect(gesture.cancel()).toEqual(document);
});

it('vertical-only milestone movement preserves timing and pickup from animated geometry', () => {
  const gesture = new MilestoneGesture(before(), 'm', 0.8, 80, 0.8);
  gesture.update(0.8, 0, 64, 'row-3', 44);
  expect(gesture.tracking.start).toBe(0.8);
  expect(gesture.commit().milestones[0]).toMatchObject({
    boundary: 1,
    rowId: 'row-3',
  });
});
