import { expect, it } from 'vitest';
import { Gesture } from './gesture';
import { assertDocument, emptyDocument } from '../model/document';
import { History } from '../model/history';

const before = () => ({
  ...emptyDocument(),
  bars: [
    { id: 'a', rowId: 'row-1', start: 0, end: 2, name: 'A' },
    { id: 'b', rowId: 'row-1', start: 2, end: 4, name: 'B' },
    { id: 'c', rowId: 'row-1', start: 4, end: 5, name: 'C' },
  ],
});

it.each(['right', 'left'] as const)(
  'an activated %s push continues beyond the neighbors original positions and reverses on retraction',
  (direction) => {
    const right = direction === 'right';
    const document = before();
    if (!right)
      document.bars = document.bars.map((bar) => ({
        ...bar,
        start: 6 - bar.end,
        end: 6 - bar.start,
      }));
    const origin = right ? 1 : 5;
    const sign = right ? 1 : -1;
    const gesture = new Gesture(document, 'move', 'a', origin, 80);
    gesture.update(origin + sign, 0);
    gesture.update(origin + sign, 300);
    for (const distance of [2, 3, 4, 6]) {
      gesture.update(origin + sign * distance, 300 + distance * 500);
      expect(gesture.validDrop).toBe(true);
      expect(gesture.pushAt).toBeNull();
      expect(
        gesture.preview.bars.map(({ start, end }) => [start, end]),
      ).toEqual(
        right
          ? [
              [distance, distance + 2],
              [distance + 2, distance + 4],
              [distance + 4, distance + 5],
            ]
          : [
              [4 - distance, 6 - distance],
              [2 - distance, 4 - distance],
              [1 - distance, 2 - distance],
            ],
      );
      assertDocument(gesture.preview);
    }
    const history = new History(document);
    history.commit('move', gesture.commit(), 'a');
    history.undo();
    expect(history.document).toEqual(document);
    history.redo();
    expect(history.document).toEqual(gesture.preview);
    gesture.update(origin + sign, 4000);
    expect(gesture.preview.bars[1].start).toBe(right ? 3 : 1);
    gesture.update(origin, 4500);
    expect(gesture.preview).toEqual(document);
    gesture.update(origin + sign, 5000);
    expect(gesture.validDrop).toBe(false);
    gesture.update(origin + sign, 5300);
    expect(gesture.validDrop).toBe(true);
  },
);

it('waits 300ms of snapped contact, even while moving, then activates the complete cascade', () => {
  const gesture = new Gesture(before(), 'move', 'a', 1, 80);
  gesture.update(1.4, 0);
  gesture.update(1.4, 1000);
  expect(gesture.pushAt).toBeNull(); // Painted overlap alone does not start the clock.
  gesture.update(1.5, 1000);
  expect(gesture.proposal).toMatchObject({ start: 1, end: 3 });
  expect(gesture.validDrop).toBe(false);
  expect(gesture.pushAt).toBe(1300);
  gesture.update(1.6, 1299);
  expect(gesture.preview).toEqual(before());
  assertDocument(gesture.preview);
  gesture.update(1.6, 1300);
  expect(gesture.validDrop).toBe(true);
  expect(gesture.pushAt).toBeNull();
  expect(gesture.preview.bars.map(({ start, end }) => [start, end])).toEqual([
    [1, 3],
    [3, 5],
    [5, 6],
  ]);
  assertDocument(gesture.commit());
});

it.each(['right', 'left'] as const)(
  'speeding up releases an activated %s push for overtaking; slowing over a neighbor starts a fresh delay',
  (direction) => {
    const right = direction === 'right';
    const document = before();
    if (!right)
      document.bars = document.bars.map((bar) => ({
        ...bar,
        start: 6 - bar.end,
        end: 6 - bar.start,
      }));
    const origin = right ? 1 : 5;
    const sign = right ? 1 : -1;
    const gesture = new Gesture(document, 'move', 'a', origin, 80);
    gesture.update(origin + sign, 0);
    gesture.update(origin + sign, 300);
    gesture.update(origin + sign * 4, 2300);
    expect(gesture.preview.bars[1].start).toBe(right ? 6 : -2);
    gesture.update(origin + sign * 10, 2400); // Fast continuation passes the chain.
    expect(gesture.validDrop).toBe(true);
    expect(gesture.preview.bars.slice(1)).toEqual(document.bars.slice(1));
    const history = new History(document);
    history.commit('move', gesture.commit(), 'a');
    history.undo();
    expect(history.document).toEqual(document);
    history.redo();
    expect(history.document).toEqual(gesture.preview);
    gesture.update(origin + sign * 2, 3400); // Slow return into the original neighbor.
    gesture.update(origin + sign * 2, 3699);
    expect(gesture.validDrop).toBe(false);
    expect(gesture.preview).toEqual(document);
    expect(gesture.commit()).toEqual(document); // An invalid drop still cancels everything.
    gesture.update(origin + sign * 2, 3700);
    expect(gesture.validDrop).toBe(true);
    expect(gesture.preview.bars[1].start).toBe(right ? 0 : 4);
    assertDocument(gesture.commit());
  },
);

it.each([1000, 1004])(
  'the speed escape is strictly above 1000 CSS px/s (%s)',
  (speed) => {
    const gesture = new Gesture(before(), 'move', 'a', 1, 80);
    gesture.update(2, 0);
    gesture.update(2, 300);
    gesture.update(2 + (speed * 0.2) / 80, 500);
    expect(gesture.validDrop).toBe(speed === 1000);
    expect(gesture.pushAt).toBe(speed === 1000 ? null : 800);
    assertDocument(gesture.preview);
  },
);

it('fast movement resets pending contact, so slowing or stopping must wait a fresh 300ms', () => {
  const gesture = new Gesture(before(), 'move', 'a', 1, 80);
  gesture.update(2, 0);
  gesture.update(2.2, 10);
  expect(gesture.pushAt).toBe(310);
  gesture.update(2.2, 300);
  expect(gesture.validDrop).toBe(false);
  gesture.update(2.2, 310);
  expect(gesture.validDrop).toBe(true);
});

it('viewport movement under a stationary screen pointer cannot trigger the speed escape', () => {
  const gesture = new Gesture(before(), 'move', 'a', 1, 80);
  gesture.update(2, 0, 100);
  gesture.update(2, 300, 100);
  gesture.update(6, 310, 100);
  expect(gesture.validDrop).toBe(true);
  expect(gesture.preview.bars[1].start).toBe(7);
});

it.each(['right', 'left'] as const)(
  'fast retraction of a %s push brings the chain back with the held bar rather than releasing it',
  (direction) => {
    const right = direction === 'right';
    const document = before();
    if (!right)
      document.bars = document.bars.map((bar) => ({
        ...bar,
        start: 6 - bar.end,
        end: 6 - bar.start,
      }));
    const origin = right ? 1 : 5;
    const sign = right ? 1 : -1;
    const gesture = new Gesture(document, 'move', 'a', origin, 80);
    gesture.update(origin + sign, 0);
    gesture.update(origin + sign, 300);
    gesture.update(origin + sign * 6, 2300);
    gesture.update(origin + sign * 3, 2400); // 2400 px/s toward the pickup.
    expect(gesture.validDrop).toBe(true);
    expect(gesture.pushAt).toBeNull();
    expect(gesture.preview.bars[1].start).toBe(right ? 5 : -1);
    gesture.update(origin, 2500);
    expect(gesture.preview).toEqual(document);
    assertDocument(gesture.preview);
  },
);

it('can overtake at a moderate pace before activation and commit without displacing crossed bars', () => {
  const gesture = new Gesture(before(), 'move', 'a', 1, 80);
  gesture.update(2, 100);
  expect(gesture.validDrop).toBe(false);
  gesture.update(3, 200);
  expect(gesture.validDrop).toBe(false);
  gesture.update(4, 300);
  gesture.update(6, 350);
  expect(gesture.validDrop).toBe(true);
  expect(gesture.commit().bars.map(({ start, end }) => [start, end])).toEqual([
    [5, 7],
    [2, 4],
    [4, 5],
  ]);
  assertDocument(gesture.commit());
});

it('cancels early overlapping drops, creates no history, and preserves redo', () => {
  const history = new History(emptyDocument());
  history.commit('draw', before(), 'a');
  history.undo();
  history.redo();
  const shifted = new Gesture(before(), 'move', 'a', 1, 80);
  shifted.update(8);
  history.commit('move', shifted.commit(), 'a');
  history.undo();
  const gesture = new Gesture(history.document, 'move', 'a', 1, 80);
  gesture.update(2, 0);
  gesture.update(2, 299);
  expect(gesture.commit()).toEqual(before());
  expect(history.commit('move', gesture.commit(), 'a')).toBe(false);
  expect(history.canRedo).toBe(true);
});

it('clearing an activated neighbor reverses its push and returning starts a fresh delay', () => {
  const gesture = new Gesture(before(), 'move', 'a', 1, 80);
  gesture.update(2, 0);
  gesture.update(2, 300);
  expect(gesture.preview.bars[1].start).toBe(3);
  gesture.update(1, 350);
  expect(gesture.preview).toEqual(before());
  gesture.update(2, 400);
  gesture.update(2, 699);
  expect(gesture.validDrop).toBe(false);
  expect(gesture.preview).toEqual(before());
  gesture.update(2, 700);
  expect(gesture.preview.bars[1].start).toBe(3);
  expect(gesture.cancel()).toEqual(before());
});

it('switching neighbors starts their own delay instead of inheriting earlier contact time', () => {
  const document = {
    ...before(),
    bars: before().bars.map((bar) => ({ ...bar, end: bar.start + 1 })),
  };
  const gesture = new Gesture(document, 'move', 'a', 0, 80);
  gesture.update(2, 0);
  gesture.update(2, 299);
  gesture.update(4, 299);
  gesture.update(4, 300);
  expect(gesture.validDrop).toBe(false);
  expect(gesture.pushAt).toBe(599);
  gesture.update(4, 599);
  expect(gesture.preview.bars.map(({ start, end }) => [start, end])).toEqual([
    [4, 5],
    [2, 3],
    [5, 6],
  ]);
});

it.each(['draw', 'resize-left', 'resize-right'] as const)(
  '%s retains immediate collision handling',
  (kind) => {
    const gesture = new Gesture(
      before(),
      kind,
      kind === 'draw' ? 'new' : kind === 'resize-left' ? 'c' : 'a',
      kind === 'resize-left' ? 4 : 0,
      80,
    );
    gesture.update(3, 0);
    expect(gesture.validDrop).toBe(true);
    expect(gesture.pushAt).toBeNull();
    expect(gesture.preview).not.toEqual(before());
    assertDocument(gesture.commit());
  },
);

it('commits an activated leftward cascade as one reversible history entry', () => {
  const history = new History(before());
  const gesture = new Gesture(history.document, 'move', 'c', 4, 80);
  gesture.update(3, 0);
  gesture.update(3, 300);
  expect(gesture.preview.bars.map(({ start, end }) => [start, end])).toEqual([
    [-1, 1],
    [1, 3],
    [3, 4],
  ]);
  history.commit('move', gesture.commit(), 'c');
  history.undo();
  expect(history.document).toEqual(before());
  expect(history.canUndo).toBe(false);
  history.redo();
  expect(history.document).toEqual(gesture.preview);
});

it.each(['right', 'left'] as const)(
  'overtaking %s and returning pushes from the new approach side, with the pointer held still',
  (outbound) => {
    const right = outbound === 'right';
    const document = {
      ...emptyDocument(),
      bars: [
        {
          id: 'a',
          rowId: 'row-1',
          start: right ? 0 : 4,
          end: right ? 1 : 5,
          name: 'A',
        },
        { id: 'b', rowId: 'row-1', start: 2, end: 3, name: 'B' },
        {
          id: 'near',
          rowId: 'row-1',
          start: right ? 1 : 3,
          end: right ? 2 : 4,
          name: 'Neighbor',
        },
      ],
    };
    const history = new History(document);
    const gesture = new Gesture(document, 'move', 'a', right ? 0.5 : 4.5, 80);
    gesture.update(right ? 3.5 : 1.5, 0);
    expect(gesture.validDrop).toBe(true);
    expect(gesture.preview.bars[1].start).toBe(2);
    gesture.update(2.5, 100);
    gesture.update(2.5, 399);
    expect(gesture.validDrop).toBe(false);
    gesture.update(2.5, 400);
    expect(gesture.validDrop).toBe(true);
    expect(gesture.preview.bars.map(({ start, end }) => [start, end])).toEqual([
      [2, 3],
      right ? [1, 2] : [3, 4],
      right ? [0, 1] : [4, 5],
    ]);
    expect(gesture.tracking).toEqual({ start: 2, end: 3 });
    assertDocument(gesture.preview);
    history.commit('move', gesture.commit(), 'a');
    history.undo();
    expect(history.document).toEqual(document);
    expect(history.canUndo).toBe(false);
    history.redo();
    expect(history.document).toEqual(gesture.preview);
  },
);

it.each(['right', 'left'] as const)(
  'partial retraction within an activated %s contact does not flip the neighbor across the dragged bar',
  (approach) => {
    const right = approach === 'right';
    const document = before();
    if (!right)
      document.bars = document.bars.map((bar) => ({
        ...bar,
        start: 6 - bar.end,
        end: 6 - bar.start,
      }));
    const pointerStart = right ? 1 : 5;
    const pointer = right ? 2 : 4;
    const gesture = new Gesture(document, 'move', 'a', pointerStart, 80);
    gesture.update(pointer, 0);
    gesture.update(pointer, 300);
    const activated = gesture.commit();
    gesture.update(pointer + (right ? -0.2 : 0.2), 350);
    expect(gesture.validDrop).toBe(true);
    expect(gesture.commit()).toEqual(activated);
    gesture.update(pointerStart, 400);
    expect(gesture.preview).toEqual(document);
  },
);
