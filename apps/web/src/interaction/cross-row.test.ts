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

it('vertical-only movement previews each row, restores intermediate pushes, and commits atomically', () => {
  const document = before();
  const gesture = new Gesture(document, 'move', 'a', 1, 80);
  gesture.update(1, 0, 80, 'row-2', 44);
  expect(gesture.validDrop).toBe(true);
  expect(gesture.pushAt).toBeNull();
  expect(gesture.preview.bars.map(({ start, end }) => [start, end])).toEqual([
    [0, 2],
    [2, 4],
    [4, 5],
    [0, 1],
  ]);
  gesture.update(1, 10, 80, 'row-3', 88);
  expect(gesture.preview.bars).toEqual([
    { ...document.bars[0], rowId: 'row-3' },
    document.bars[1],
    document.bars[2],
    { ...document.bars[3], start: 2, end: 3 },
  ]);
  expect(gesture.cancel()).toEqual(document);
  const history = new History(document);
  history.commit('move', gesture.commit(), 'a');
  history.undo();
  expect(history.document).toEqual(document);
  history.redo();
  expect(history.document).toEqual(gesture.preview);
});

it('cross-row proposals push right even while moving left, and never affect other rows or milestones', () => {
  for (let start = -5; start <= 8; start++) {
    const document = before();
    const gesture = new Gesture(document, 'move', 'a', 1, 80);
    gesture.update(start + 1, 0, 80, 'row-2', 44);
    assertDocument(gesture.preview);
    expect(gesture.preview.bars[0]).toMatchObject({
      start,
      end: start + 2,
      rowId: 'row-2',
    });
    expect(gesture.preview.bars[1].start).toBeGreaterThanOrEqual(0);
    expect(gesture.preview.bars[3]).toEqual(document.bars[3]);
    expect(gesture.preview.milestones).toEqual(document.milestones);
    for (const bar of gesture.preview.bars) {
      const original = document.bars.find((item) => item.id === bar.id)!;
      expect(bar.end - bar.start).toBe(original.end - original.start);
    }
  }
});

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
