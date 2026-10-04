import { expect, it } from 'vitest';
import {
  clampZoom,
  zoomFirstWeek,
  displayedInterval,
  pointerWeek,
  historyLocation,
} from './viewport';
import { Gesture } from './interaction/gesture';
import { emptyDocument } from './model/document';
import { History } from './model/history';
import { deleteContainer, insertRow, insertSection } from './model/structure';
import { placeBar } from './model/rules';

it('retains reveal context through creation undo and deletion redo without selecting removed items', () => {
  const initial = emptyDocument();
  const bar = { id: 'a', rowId: 'row-1', start: -12, end: -9, name: '' };
  const history = new History(initial);
  history.commit('draw', placeBar(initial, bar, 'right'), bar.id);
  const undo = history.undo()!;
  expect(historyLocation(history.document, undo)).toEqual({
    selectedId: null,
    rowId: 'row-1',
    sectionId: 'section-1',
    interval: { start: -12, end: -9 },
  });
  history.redo();
  history.commit('delete', { ...history.document, bars: [] }, bar.id);
  history.undo();
  const redo = history.redo()!;
  expect(historyLocation(history.document, redo)).toEqual({
    selectedId: null,
    rowId: 'row-1',
    sectionId: 'section-1',
    interval: { start: -12, end: -9 },
  });
});

it('reveals the current destination of a moved item and the final date period of a milestone', () => {
  const initial = {
    ...emptyDocument(),
    rows: [
      ...emptyDocument().rows,
      { id: 'row-2', sectionId: 'section-1', name: '' },
    ],
    milestones: [{ id: 'm', rowId: 'row-1', boundary: 5, name: '' }],
  };
  const history = new History(initial);
  history.commit(
    'milestone-move',
    {
      ...initial,
      milestones: [{ ...initial.milestones[0], rowId: 'row-2', boundary: 20 }],
    },
    'm',
  );
  const undo = history.undo()!;
  expect(historyLocation(history.document, undo)).toMatchObject({
    rowId: 'row-1',
    interval: { start: 4, end: 5 },
  });
  const redo = history.redo()!;
  expect(historyLocation(history.document, redo)).toMatchObject({
    rowId: 'row-2',
    interval: { start: 19, end: 20 },
    selectedId: 'm',
  });
});

it('container removal reveals its surviving parent or neighboring section, including the last container', () => {
  const initial = insertRow(
    insertSection(emptyDocument(), { id: 'section-2', name: '' }, 1),
    { id: 'row-2', sectionId: 'section-2', name: '' },
    0,
  );
  const history = new History(initial);
  history.commit('delete', deleteContainer(initial, 'row-1'), 'row-1');
  history.undo();
  const rowDeletion = history.redo()!;
  expect(historyLocation(history.document, rowDeletion)).toMatchObject({
    sectionId: 'section-1',
    rowId: undefined,
  });
  history.commit(
    'delete',
    deleteContainer(history.document, 'section-1'),
    'section-1',
  );
  history.undo();
  const sectionDeletion = history.redo()!;
  expect(historyLocation(history.document, sectionDeletion)).toMatchObject({
    sectionId: 'section-2',
  });
  history.commit(
    'delete',
    deleteContainer(history.document, 'section-2'),
    'section-2',
  );
  history.undo();
  const lastDeletion = history.redo()!;
  expect(historyLocation(history.document, lastDeletion)).toEqual({
    selectedId: null,
    sectionId: undefined,
    rowId: undefined,
    interval: undefined,
  });
});

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
