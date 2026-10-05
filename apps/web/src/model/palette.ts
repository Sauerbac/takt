// Shared source of truth for document validation and all color controls.
// Muted hue families each offer light, medium, and deep tones.
export const palette = {
  apricot: { name: 'Peach', fill: '#f3b184', ink: '#874327' },
  lavender: { name: 'Lavender', fill: '#b5a2e0', ink: '#563c86' },
  'sea-blue': { name: 'Sea blue', fill: '#a0d4dd', ink: '#2e626b' },
  slate: { name: 'Slate', fill: '#8290a3', ink: '#182e47' },
  rose: { name: 'Rose', fill: '#b37976', ink: '#442c2b' },
  sage: { name: 'Sage', fill: '#abc4ad', ink: '#385b40' },
  'light-peach': { name: 'Light peach', fill: '#f9d9c2', ink: '#874327' },
  'light-lavender': { name: 'Light lavender', fill: '#ddd2f1', ink: '#563c86' },
  'light-sea-blue': { name: 'Light sea blue', fill: '#cee9ed', ink: '#2e626b' },
  'light-sage': { name: 'Light sage', fill: '#d7e5d8', ink: '#385b40' },
  'light-rose': { name: 'Light rose', fill: '#e9cecc', ink: '#6c3e3b' },
  'light-slate': { name: 'Light slate', fill: '#d0d7e0', ink: '#304761' },
  'deep-peach': {
    name: 'Deep peach',
    fill: '#aa5935',
    ink: '#ffffff',
    labelInk: '#aa5935',
  },
  'deep-lavender': {
    name: 'Deep lavender',
    fill: '#74589e',
    ink: '#ffffff',
    labelInk: '#74589e',
  },
  'deep-sea-blue': {
    name: 'Deep sea blue',
    fill: '#437d88',
    ink: '#ffffff',
    labelInk: '#437d88',
  },
  'deep-sage': {
    name: 'Deep sage',
    fill: '#567b5d',
    ink: '#ffffff',
    labelInk: '#567b5d',
  },
  'deep-rose': {
    name: 'Deep rose',
    fill: '#945551',
    ink: '#ffffff',
    labelInk: '#945551',
  },
  'deep-slate': {
    name: 'Deep slate',
    fill: '#455970',
    ink: '#ffffff',
    labelInk: '#455970',
  },
} as const;

export type Color = keyof typeof palette;
export const quickColors: readonly Color[] = [
  'apricot',
  'lavender',
  'sea-blue',
  'slate',
];
export const colorRows: readonly (readonly Color[])[] = [
  [
    'light-peach',
    'light-lavender',
    'light-sea-blue',
    'light-sage',
    'light-rose',
    'light-slate',
  ],
  ['apricot', 'lavender', 'sea-blue', 'sage', 'rose', 'slate'],
  [
    'deep-peach',
    'deep-lavender',
    'deep-sea-blue',
    'deep-sage',
    'deep-rose',
    'deep-slate',
  ],
];
