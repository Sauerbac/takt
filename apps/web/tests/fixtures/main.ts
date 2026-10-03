import { mount } from 'svelte';
import Editor from '../../src/components/Editor.svelte';
import { emptyDocument } from '../../src/model/document';
import '../../src/tokens.css';

// Named, deterministic component states. This entry is never part of the production build.
const states = {
  Empty: emptyDocument(),
  TallEmpty: {
    ...emptyDocument(),
    rows: Array.from({ length: 30 }, (_, index) => ({
      id: `row-${index + 1}`,
      name: '',
    })),
  },
  CrossRows: {
    ...emptyDocument(),
    rows: [
      { id: 'row-1', name: 'Research' },
      { id: 'row-2', name: 'Design' },
      { id: 'row-3', name: 'Delivery' },
    ],
    bars: [
      { id: 'a', rowId: 'row-1', start: 0, end: 2, name: 'Discovery' },
      { id: 'b', rowId: 'row-2', start: 0, end: 2, name: 'Design' },
      { id: 'c', rowId: 'row-2', start: 2, end: 3, name: 'Review' },
      { id: 'd', rowId: 'row-3', start: 0, end: 1, name: 'Delivery' },
    ],
    milestones: [
      { id: 'm', rowId: 'row-1', boundary: 5, name: 'Kickoff' },
      { id: 'n', rowId: 'row-2', boundary: 3, name: 'Approved' },
    ],
  },
  Tall: {
    ...emptyDocument(),
    rows: Array.from({ length: 30 }, (_, index) => ({
      id: `row-${index + 1}`,
      name: `Lane ${index + 1}`,
    })),
    bars: [{ id: 'a', rowId: 'row-1', start: 0, end: 2, name: 'Discovery' }],
    milestones: [{ id: 'm', rowId: 'row-1', boundary: 5, name: 'Kickoff' }],
  },
  RowEntry: {
    ...emptyDocument(),
    rows: [
      { id: 'row-1', name: 'Destination' },
      { id: 'row-2', name: 'Source' },
    ],
    bars: [
      { id: 'a', rowId: 'row-2', start: 0, end: 1, name: 'Carried bar' },
      { id: 'b', rowId: 'row-1', start: 2, end: 3, name: 'Neighbor' },
      { id: 'c', rowId: 'row-1', start: 1, end: 2, name: 'Left chain' },
      { id: 'd', rowId: 'row-1', start: 3, end: 4, name: 'Right chain' },
    ],
  },
  BetweenBars: {
    ...emptyDocument(),
    rows: [
      { id: 'row-1', name: 'Destination' },
      { id: 'row-2', name: 'Source' },
    ],
    bars: [
      { id: 'a', rowId: 'row-2', start: 2, end: 5, name: 'Insert between' },
      { id: 'b', rowId: 'row-1', start: 0, end: 4, name: 'Left bar' },
      { id: 'c', rowId: 'row-1', start: 4, end: 6, name: 'Right bar' },
      { id: 'd', rowId: 'row-1', start: -1, end: 0, name: 'Left chain' },
      { id: 'e', rowId: 'row-1', start: 6, end: 7, name: 'Right chain' },
    ],
  },
  Chain: {
    ...emptyDocument(),
    bars: [
      { id: 'a', rowId: 'row-1', start: 0, end: 2, name: 'Research' },
      { id: 'b', rowId: 'row-1', start: 2, end: 4, name: 'Synthesis' },
      { id: 'c', rowId: 'row-1', start: 4, end: 5, name: 'Review' },
    ],
  },
  Narrow: {
    ...emptyDocument(),
    bars: [
      {
        id: 'a',
        rowId: 'row-1',
        start: 3,
        end: 4,
        name: 'A long label that must be clipped',
      },
    ],
  },
  Separated: {
    ...emptyDocument(),
    bars: [
      { id: 'a', rowId: 'row-1', start: 0, end: 1, name: 'Research' },
      { id: 'b', rowId: 'row-1', start: 2, end: 3, name: 'Synthesis' },
      { id: 'c', rowId: 'row-1', start: 5, end: 6, name: 'Review' },
    ],
  },
  EdgeContact: {
    ...emptyDocument(),
    bars: [
      { id: 'a', rowId: 'row-1', start: 0, end: 1, name: 'Research' },
      { id: 'b', rowId: 'row-1', start: 8, end: 16, name: 'Long work period' },
    ],
  },
};
const name = new URLSearchParams(location.search).get('state') ?? 'Empty';
if (!(name in states)) throw new Error(`Unknown component state: ${name}`);
mount(Editor, {
  target: document.getElementById('app')!,
  props: { initial: states[name as keyof typeof states] },
});
