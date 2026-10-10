import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  contentKey,
  decodeProject,
  encodeProject,
  newProject,
  parseProject,
  suggestedFilename,
} from './format';
const fixture = () =>
  JSON.parse(
    readFileSync(new URL('./fixtures/mixed.takt', import.meta.url), 'utf8'),
  );
describe('portable project format', () => {
  it('round trips mixed semantics, order, negative weeks, inheritance and view', () => {
    const project = decodeProject(fixture());
    expect(parseProject(encodeProject(project))).toEqual(project);
    expect(project.document.sections.map((item) => item.id)).toEqual([
      '__proto__',
      'constructor',
    ]);
    expect(project.document.bars[0].start).toBe(-4);
    expect(project.document.bars[0]).not.toHaveProperty('color');
    expect(project.document.bars[1].color).toBe(0);
    expect(project.view.firstWeek).toBe(-3.25);
    expect(encodeProject(project)).toBe(
      encodeProject(parseProject(encodeProject(project))),
    );
  });
  it('normalizes titles and omitted weeks, and strips all unknown fields', () => {
    const raw = fixture();
    raw.title = '  ';
    delete raw.document.display;
    raw.extra = true;
    raw.document.extra = true;
    raw.document.bars[0].extra = true;
    raw.view.extra = true;
    const project = decodeProject(raw);
    expect(project.title).toBe('Untitled');
    expect(project.document.display).toBe('weeks');
    expect(encodeProject(project)).not.toContain('extra');
  });
  it('starts a fresh independent default document', () => {
    expect(newProject().document.rows).toHaveLength(1);
    expect(newProject()).toEqual(parseProject(encodeProject(newProject())));
    expect(newProject().document).not.toBe(newProject().document);
  });
  it('allows empty structure and supported coordinate bounds without a calendar', () => {
    const raw = fixture();
    raw.document = { sections: [], rows: [], bars: [], milestones: [] };
    raw.view.collapsedSectionIds = [];
    expect(decodeProject(raw).document.sections).toEqual([]);
    const extreme = fixture();
    extreme.document.bars[0].start = -1000000;
    extreme.document.bars[0].end = -999999;
    expect(() => decodeProject(extreme)).not.toThrow();
  });
  it.each([null, [], 1, 'text', true, {}, { format: 'takt', version: 2 }])(
    'rejects unknown input shape %j',
    (input) => {
      expect(() => decodeProject(input)).toThrow('Invalid .takt file');
    },
  );
  it('reports malformed JSON', () =>
    expect(() => parseProject('{')).toThrow('JSON'));
  it('rejects finite coordinates outside the supported rendering range', () => {
    for (const value of [-1_000_001, 1_000_001, 1e300]) {
      const raw = fixture();
      raw.view.firstWeek = value;
      expect(() => decodeProject(raw)).toThrow('view.firstWeek');
      raw.view.firstWeek = 0;
      raw.document.calendar.week = value;
      expect(() => decodeProject(raw)).toThrow('document.calendar.week');
      raw.document.calendar.week = 0;
      raw.document.milestones[0].boundary = value;
      expect(() => decodeProject(raw)).toThrow('boundary');
    }
  });
  it('detaches decoded arrays and records from the input', () => {
    const raw = fixture();
    const project = decodeProject(raw);
    raw.document.sections[0].name = 'Changed externally';
    raw.view.collapsedSectionIds.push('__proto__');
    expect(project.document.sections[0].name).toBe('Design');
    expect(project.view.collapsedSectionIds).toEqual(['constructor']);
  });
  const invalid: [string, (raw: ReturnType<typeof fixture>) => void][] = [
    [
      'empty ID',
      (raw) => {
        raw.document.rows[0].id = ' ';
      },
    ],
    [
      'global duplicate',
      (raw) => {
        raw.document.rows[0].id = '__proto__';
      },
    ],
    [
      'missing section',
      (raw) => {
        raw.document.rows[0].sectionId = 'missing';
      },
    ],
    [
      'missing row',
      (raw) => {
        raw.document.bars[0].rowId = 'missing';
      },
    ],
    [
      'overlap',
      (raw) => {
        raw.document.bars[1].start = -2;
      },
    ],
    [
      'zero duration',
      (raw) => {
        raw.document.bars[0].end = -4;
      },
    ],
    [
      'duplicate milestone',
      (raw) => {
        raw.document.milestones.push({
          ...raw.document.milestones[0],
          id: 'another',
        });
      },
    ],
    [
      'fractional timing',
      (raw) => {
        raw.document.bars[0].start = -4.5;
      },
    ],
    [
      'unsafe timing',
      (raw) => {
        raw.document.bars[0].start = Number.MIN_SAFE_INTEGER - 1;
      },
    ],
    [
      'impossible date',
      (raw) => {
        raw.document.calendar.date = '2026-02-30';
      },
    ],
    [
      'dates without anchor',
      (raw) => {
        delete raw.document.calendar;
      },
    ],
    [
      'invalid hue',
      (raw) => {
        raw.document.sections[0].color = 360;
      },
    ],
    [
      'infinite hue',
      (raw) => {
        raw.document.bars[0].color = Infinity;
      },
    ],
    [
      'bad record',
      (raw) => {
        raw.document.rows[0] = null;
      },
    ],
    [
      'bad name',
      (raw) => {
        raw.document.bars[0].name = 3;
      },
    ],
    [
      'bad collection',
      (raw) => {
        raw.document.rows = {};
      },
    ],
    [
      'null display',
      (raw) => {
        raw.document.display = null;
      },
    ],
    [
      'bad zoom',
      (raw) => {
        raw.view.zoom = 0.1;
      },
    ],
    [
      'infinite view',
      (raw) => {
        raw.view.firstWeek = Infinity;
      },
    ],
    [
      'negative scroll',
      (raw) => {
        raw.view.scrollTop = -1;
      },
    ],
    [
      'unknown collapse',
      (raw) => {
        raw.view.collapsedSectionIds = ['missing'];
      },
    ],
    [
      'duplicate collapse',
      (raw) => {
        raw.view.collapsedSectionIds = ['__proto__', '__proto__'];
      },
    ],
  ];
  it.each(invalid)('rejects %s', (_name, mutate) => {
    const raw = fixture();
    mutate(raw);
    expect(() => decodeProject(raw)).toThrow('Invalid .takt file');
  });
  it('distinguishes content edits from view changes and property order', () => {
    const original = newProject();
    expect(
      contentKey({
        ...original,
        view: { ...original.view, zoom: 2, firstWeek: -8, scrollTop: 9 },
      }),
    ).toBe(contentKey(original));
    expect(contentKey({ ...original, title: 'Changed' })).not.toBe(
      contentKey(original),
    );
    expect(
      contentKey({
        ...original,
        document: { ...original.document, display: undefined },
      }),
    ).toBe(contentKey(original));
    expect(
      contentKey({
        ...original,
        document: {
          ...original.document,
          sections: [{ name: '', id: 'section-1' }],
        },
      }),
    ).toBe(contentKey(original));
  });
  it('suggests portable filenames', () => {
    expect(suggestedFilename('  Launch α  ')).toBe('Launch α.takt');
    expect(suggestedFilename('  ')).toBe('Untitled.takt');
    expect(suggestedFilename('a/b:c?')).toBe('a_b_c_.takt');
    expect(suggestedFilename('CON')).toBe('_CON.takt');
  });
  it('validates published invalid fixtures', () => {
    const raw = readFileSync(
      new URL('./fixtures/invalid-overlap.takt', import.meta.url),
      'utf8',
    );
    expect(() => parseProject(raw)).toThrow('Overlapping bars');
  });
});
