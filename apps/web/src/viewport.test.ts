import { expect, it } from 'vitest';
import {
  clampZoom,
  zoomFirstWeek,
  displayedInterval,
  pointerWeek,
} from './viewport';
import { Gesture } from './interaction/gesture';
import { emptyDocument } from './model/document';
import { History } from './model/history';

it('preserves pointer or center time across clamped zoom levels and scrolled geometry', () => {
  expect(clampZoom(0.1)).toBe(0.5);
  expect(clampZoom(3)).toBe(2);
  for (const first of [-20.4, -2, 3.5])
    for (const anchor of [0, 100, 450, 900])
      for (const scale of [0.5, 0.75, 1, 1.25, 2]) {
        const next = zoomFirstWeek(first, 75, 75 * scale, anchor);
        expect(pointerWeek(anchor, 0, 75 * scale, next)).toBeCloseTo(
          pointerWeek(anchor, 0, 75, first),
        );
      }
});

it('maps painted pickup geometry through a fractional viewport without shifting document weeks', () => {
  const firstWeek = -6.25;
  expect(pointerWeek(300, 100, 80, firstWeek)).toBe(-3.75);
  expect(
    displayedInterval({ left: 365, width: 150 }, 100, 80, firstWeek),
  ).toEqual({ start: -3, end: -1 });
});

it('re-projects a stationary pointer through scrolling while retaining the gesture history boundary', () => {
  const before = {
    ...emptyDocument(),
    bars: [{ id: 'a', rowId: 'row-1', start: 0, end: 2, name: '' }],
  };
  const history = new History(before);
  const gesture = new Gesture(
    before,
    'move',
    'a',
    pointerWeek(340, 100, 80),
    80,
  );
  gesture.update(pointerWeek(740, 100, 80));
  gesture.update(pointerWeek(740, 100, 80, 0));
  expect(gesture.tracking).toEqual({ start: 7, end: 9 });
  gesture.update(pointerWeek(340, 100, 80));
  expect(gesture.preview).toEqual(before);
  gesture.update(pointerWeek(740, 100, 80, 0));
  history.commit('move', gesture.commit(), 'a');
  history.undo();
  expect(history.document).toEqual(before);
  history.redo();
  expect(history.document.bars[0]).toMatchObject({ start: 7, end: 9 });
});
