import { mount } from 'svelte';
import Editor from '../../src/components/Editor.svelte';
import { emptyDocument } from '../../src/model/document';
import '../../src/tokens.css';

// Named, deterministic component states. This entry is never part of the production build.
const states = {
  Empty: emptyDocument(),
  Chain: {
    ...emptyDocument(),
    bars: [
      { id: 'a', start: 0, end: 2, name: 'Research' },
      { id: 'b', start: 2, end: 4, name: 'Synthesis' },
      { id: 'c', start: 4, end: 5, name: 'Review' },
    ],
  },
  Narrow: {
    ...emptyDocument(),
    bars: [
      { id: 'a', start: 3, end: 4, name: 'A long label that must be clipped' },
    ],
  },
  Separated: {
    ...emptyDocument(),
    bars: [
      { id: 'a', start: 0, end: 1, name: 'Research' },
      { id: 'b', start: 2, end: 3, name: 'Synthesis' },
      { id: 'c', start: 5, end: 6, name: 'Review' },
    ],
  },
  EdgeContact: {
    ...emptyDocument(),
    bars: [
      { id: 'a', start: 0, end: 1, name: 'Research' },
      { id: 'b', start: 8, end: 16, name: 'Long work period' },
    ],
  },
};
const name = new URLSearchParams(location.search).get('state') ?? 'Empty';
if (!(name in states)) throw new Error(`Unknown component state: ${name}`);
mount(Editor, {
  target: document.getElementById('app')!,
  props: { initial: states[name as keyof typeof states] },
});
