import { expect, it } from 'vitest';
import { displayedInterval, pointerWeek } from './viewport';
import { Gesture } from './interaction/gesture';
import { emptyDocument } from './model/document';
import { History } from './model/history';

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
    bars: [{ id: 'a', start: 0, end: 2, name: '' }],
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
