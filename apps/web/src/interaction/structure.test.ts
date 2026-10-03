import { expect, it } from 'vitest';
import { assertDocument, emptyDocument } from '../model/document';
import type { ChartDocument } from '../model/document';
import { History } from '../model/history';
import {
  deleteContainer,
  insertRow,
  insertSection,
  moveRow,
  moveSection,
} from '../model/structure';
import { StructureGesture, structureLayout } from './structure';

const initial = (): ChartDocument => ({
  ...emptyDocument(),
  sections: [
    { id: 's1', name: 'Research' },
    { id: 's2', name: 'Delivery' },
    { id: 's3', name: '' },
  ],
  rows: [
    { id: 'r1', sectionId: 's1', name: 'One' },
    { id: 'r2', sectionId: 's1', name: 'Two' },
    { id: 'r3', sectionId: 's2', name: 'Three' },
  ],
  bars: [
    { id: 'a', rowId: 'r1', start: -2, end: 1, name: 'A' },
    { id: 'b', rowId: 'r3', start: 4, end: 7, name: 'B' },
  ],
  milestones: [{ id: 'm', rowId: 'r1', boundary: 0, name: 'M' }],
});

it('inserts rows above/below and sections immediately after the requested section, with empty stored names', () => {
  const before = initial();
  const above = insertRow(before, { id: 'new', sectionId: 's1', name: '' }, 1);
  expect(above.rows.map((row) => row.id)).toEqual(['r1', 'new', 'r2', 'r3']);
  const section = insertSection(before, { id: 'new', name: '' }, 1);
  expect(section.sections.map((section) => section.id)).toEqual([
    's1',
    'new',
    's2',
    's3',
  ]);
  assertDocument(above);
  assertDocument(section);
});

it('all row and section destinations preserve item timing, identity and complete atomic history', () => {
  const before = initial();
  for (const row of before.rows)
    for (const section of before.sections)
      for (let index = 0; index <= 3; index++) {
        const after = moveRow(before, row.id, section.id, index);
        assertDocument(after);
        expect(after.bars).toEqual(before.bars);
        expect(after.milestones).toEqual(before.milestones);
        expect(after.rows.find((item) => item.id === row.id)?.sectionId).toBe(
          section.id,
        );
        const history = new History(before);
        if (history.commit('move-row', after, row.id)) {
          history.undo();
          expect(history.document).toEqual(before);
          history.redo();
          expect(history.document).toEqual(after);
        }
      }
  const after = moveSection(before, 's1', 2);
  expect(after.sections.map((section) => section.id)).toEqual([
    's2',
    's3',
    's1',
  ]);
  expect(after.rows).toEqual(before.rows);
  expect(after.bars).toEqual(before.bars);
});

it('deletes only the container and its contents; empty sections and a completely empty document remain valid', () => {
  const before = initial();
  const row = deleteContainer(before, 'r1');
  expect(row.sections).toEqual(before.sections);
  expect(row.bars.map((bar) => bar.id)).toEqual(['b']);
  expect(row.milestones).toEqual([]);
  const section = deleteContainer(before, 's1');
  expect(section.rows.map((row) => row.id)).toEqual(['r3']);
  const empty = before.sections.reduce(
    (document, section) => deleteContainer(document, section.id),
    before,
  );
  expect(empty.sections).toEqual([]);
  assertDocument(empty);
  const history = new History(before);
  history.commit('delete', section, 's1');
  history.undo();
  expect(history.document).toEqual(before);
  history.redo();
  expect(history.document).toEqual(section);
  expect(() =>
    assertDocument({
      ...before,
      rows: [{ id: 'bad', sectionId: 'missing', name: '' }],
    }),
  ).toThrow('Invalid row');
  expect(() =>
    assertDocument({
      ...before,
      sections: [...before.sections, before.sections[0]],
    }),
  ).toThrow('Duplicate section');
});

it('row preview crosses neighbor midpoints, reverses, cancels without losing redo, and commits once', () => {
  const before = initial();
  const gesture = new StructureGesture(before, 'move-row', 'r1', [], 58);
  gesture.update(101, 0); // Before r2's midpoint at 102.
  expect(gesture.preview).toEqual(before);
  gesture.update(103, 1);
  expect(gesture.preview.rows.map((row) => row.id)).toEqual(['r2', 'r1', 'r3']);
  gesture.update(57, 2);
  expect(gesture.preview).toEqual(before);
  gesture.update(215, 3);
  expect(gesture.preview.rows.find((row) => row.id === 'r1')?.sectionId).toBe(
    's2',
  );
  expect(gesture.preview.bars).toEqual(before.bars);
  const history = new History(before);
  history.commit('move-section', moveSection(before, 's3', 0), 's3');
  history.undo();
  expect(history.commit('move-row', gesture.cancel(), 'r1')).toBe(false);
  expect(history.canRedo).toBe(true);
  expect(history.commit('move-row', gesture.commit(), 'r1')).toBe(true);
  history.undo();
  expect(history.document).toEqual(before);
});

it('collapsed hover waits exactly 500 ms, reverses on leaving, restores on cancellation and expands a committed destination', () => {
  const before = initial();
  const gesture = new StructureGesture(before, 'move-row', 'r1', ['s2'], 58);
  gesture.update(180, 10);
  expect(gesture.hoverAt).toBe(510);
  gesture.update(180, 509);
  expect(gesture.collapsed).toEqual(['s2']);
  gesture.update(180, 510);
  expect(gesture.collapsed).toEqual([]);
  expect(gesture.preview.rows.find((row) => row.id === 'r1')?.sectionId).toBe(
    's2',
  );
  expect(gesture.committedCollapsed()).toEqual([]);
  gesture.update(20, 520);
  expect(gesture.collapsed).toEqual(['s2']);
  expect(gesture.hoverAt).toBe(null);
  gesture.update(180, 600);
  expect(gesture.hoverAt).toBe(1100);
  expect(gesture.cancel()).toEqual(before);
  expect(gesture.originalCollapsed).toEqual(['s2']);
});

it('section preview carries a complete unit, reverses, and needs meaningful movement', () => {
  const before = initial();
  const gesture = new StructureGesture(
    before,
    'move-section',
    's1',
    ['s2'],
    18,
  );
  gesture.update(21, 0);
  expect(gesture.meaningful).toBe(false);
  expect(gesture.commit()).toEqual(before);
  gesture.update(280, 1);
  expect(gesture.preview.sections.map((section) => section.id)).toEqual([
    's2',
    's3',
    's1',
  ]);
  expect(gesture.preview.rows).toEqual(before.rows);
  expect(gesture.preview.bars).toEqual(before.bars);
  gesture.update(18, 2);
  expect(gesture.preview).toEqual(before);
  const layout = structureLayout(before, ['s2']);
  expect(layout.rows.find((row) => row.id === 'r3')?.visible).toBe(false);
  expect(layout.sections.find((section) => section.id === 's2')?.height).toBe(
    72,
  );
});
