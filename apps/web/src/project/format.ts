import {
  assertDocument,
  emptyDocument,
  type ChartDocument,
} from '../model/document';
import { isColor } from '../model/palette';

export interface ProjectView {
  readonly zoom: number;
  readonly firstWeek: number;
  readonly scrollTop: number;
  readonly collapsedSectionIds: readonly string[];
}
export interface ProjectSnapshot {
  readonly format: 'takt';
  readonly version: 1;
  readonly title: string;
  readonly document: ChartDocument;
  readonly view: ProjectView;
}
export const defaultProjectView = (): ProjectView => ({
  zoom: 1,
  firstWeek: -2,
  scrollTop: 0,
  collapsedSectionIds: [],
});
export const newProject = (): ProjectSnapshot => ({
  format: 'takt',
  version: 1,
  title: 'Untitled',
  document: { ...emptyDocument(), display: 'weeks' },
  view: defaultProjectView(),
});

function fail(path: string, message: string): never {
  throw new Error(`Invalid .takt file: ${path} ${message}`);
}
function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    fail(path, 'must be an object');
  return value as Record<string, unknown>;
}
function string(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'must be a string');
  return value;
}
function id(value: unknown, path: string): string {
  const result = string(value, path);
  if (!result.trim()) fail(path, 'must be nonempty');
  return result;
}
function number(value: unknown, path: string, integer = false): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    (integer && !Number.isSafeInteger(value))
  )
    fail(path, integer ? 'must be a safe integer' : 'must be finite');
  return value;
}
function week(value: unknown, path: string, integer = true): number {
  const result = number(value, path, integer);
  if (Math.abs(result) > 1_000_000)
    fail(path, 'must be between -1000000 and 1000000');
  return result;
}
function array<T>(
  value: unknown,
  path: string,
  decode: (item: unknown, path: string) => T,
): T[] {
  if (!Array.isArray(value)) fail(path, 'must be an array');
  return Array.from(value, (item, index) => decode(item, `${path}[${index}]`));
}
function colored(
  record: Record<string, unknown>,
  path: string,
): { color?: number } {
  if (record.color === undefined) return {};
  if (!isColor(record.color))
    fail(
      `${path}.color`,
      'must be a hue from 0 (inclusive) to 360 (exclusive)',
    );
  return { color: record.color };
}

/** Title and chart only: the fields that decide whether a project is modified. */
function decodeContent(root: Record<string, unknown>) {
  if (root.format !== 'takt') fail('format', 'must be "takt"');
  if (root.version !== 1)
    fail('version', 'is unsupported; this application supports version 1');
  const title = string(root.title, 'title').trim() || 'Untitled';
  const data = object(root.document, 'document');
  const sections = array(data.sections, 'document.sections', (item, path) => {
    const record = object(item, path);
    return {
      id: id(record.id, `${path}.id`),
      name: string(record.name, `${path}.name`),
      ...colored(record, path),
    };
  });
  const rows = array(data.rows, 'document.rows', (item, path) => {
    const record = object(item, path);
    return {
      id: id(record.id, `${path}.id`),
      sectionId: id(record.sectionId, `${path}.sectionId`),
      name: string(record.name, `${path}.name`),
    };
  });
  const bars = array(data.bars, 'document.bars', (item, path) => {
    const record = object(item, path);
    return {
      id: id(record.id, `${path}.id`),
      rowId: id(record.rowId, `${path}.rowId`),
      start: week(record.start, `${path}.start`),
      end: week(record.end, `${path}.end`),
      name: string(record.name, `${path}.name`),
      ...colored(record, path),
    };
  });
  const milestones = array(
    data.milestones,
    'document.milestones',
    (item, path) => {
      const record = object(item, path);
      return {
        id: id(record.id, `${path}.id`),
        rowId: id(record.rowId, `${path}.rowId`),
        boundary: week(record.boundary, `${path}.boundary`),
        name: string(record.name, `${path}.name`),
        ...colored(record, path),
      };
    },
  );
  const display = data.display === undefined ? 'weeks' : data.display;
  if (display !== 'weeks' && display !== 'dates')
    fail('document.display', 'must be "weeks" or "dates"');
  let calendar;
  if (data.calendar !== undefined) {
    const record = object(data.calendar, 'document.calendar');
    calendar = {
      week: week(record.week, 'document.calendar.week'),
      date: string(record.date, 'document.calendar.date'),
    };
  }
  const document: ChartDocument = {
    display,
    ...(calendar ? { calendar } : {}),
    sections,
    rows,
    bars,
    milestones,
  };
  const allIds = [...sections, ...rows, ...bars, ...milestones].map(
    (item) => item.id,
  );
  if (new Set(allIds).size !== allIds.length)
    fail('document', 'IDs must be globally unique');
  try {
    assertDocument(document);
  } catch (error) {
    fail('document', error instanceof Error ? error.message : 'is invalid');
  }
  return { title, document };
}

/** Validate unknown external data and construct an independent, stripped snapshot. */
export function decodeProject(input: unknown): ProjectSnapshot {
  const root = object(input, 'project');
  const { title, document } = decodeContent(root);
  const rawView = object(root.view, 'view');
  const zoom = number(rawView.zoom, 'view.zoom');
  if (zoom < 0.125 || zoom > 2)
    fail('view.zoom', 'must be between 0.125 and 2');
  const scrollTop = number(rawView.scrollTop, 'view.scrollTop');
  if (scrollTop < 0) fail('view.scrollTop', 'must be nonnegative');
  const collapsedSectionIds = array(
    rawView.collapsedSectionIds,
    'view.collapsedSectionIds',
    id,
  );
  const sectionIds = new Set(document.sections.map((section) => section.id));
  if (collapsedSectionIds.some((value) => !sectionIds.has(value)))
    fail('view.collapsedSectionIds', 'must reference existing sections');
  if (new Set(collapsedSectionIds).size !== collapsedSectionIds.length)
    fail('view.collapsedSectionIds', 'must not contain duplicates');
  return {
    format: 'takt',
    version: 1,
    title,
    document,
    view: {
      zoom,
      firstWeek: week(rawView.firstWeek, 'view.firstWeek', false),
      scrollTop,
      collapsedSectionIds,
    },
  };
}
export function parseProject(text: string): ProjectSnapshot {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    fail('JSON', 'could not be parsed');
  }
  return decodeProject(input);
}
export const encodeProject = (snapshot: ProjectSnapshot): string =>
  JSON.stringify(decodeProject(snapshot), null, 2) + '\n';
// Documents are immutable values, so a normalized chart is serialized once per document.
const documentKeys = new WeakMap<ChartDocument, string>();
/** Compares title and chart only; the view never affects the key, valid or not. */
export function contentKey(snapshot: ProjectSnapshot): string {
  let document = documentKeys.get(snapshot.document);
  if (document === undefined) {
    document = JSON.stringify(
      decodeContent(snapshot as unknown as Record<string, unknown>).document,
    );
    documentKeys.set(snapshot.document, document);
  }
  const title = snapshot.title.trim() || 'Untitled';
  return `{"title":${JSON.stringify(title)},"document":${document}}`;
}
export function suggestedFilename(title: string): string {
  let stem = (title.trim() || 'Untitled')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '');
  if (!stem) stem = 'Untitled';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem))
    stem = '_' + stem;
  return stem + '.takt';
}
