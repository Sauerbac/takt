import { mount } from 'svelte';
import App from '../../src/App.svelte';
import '../../src/tokens.css';
import { newProject, type ProjectSnapshot } from '../../src/project/format';
import type {
  FileIdentity,
  PlatformAdapter,
  RecoveryRecord,
  RecentFile,
  Outcome,
  OpenedProject,
  SaveOutcome,
  ProjectFileDrop,
} from '../../src/project/platform';

type Result = 'success' | 'cancelled' | 'failure' | 'conflict';
const clone = <T>(value: T): T => structuredClone(value);
const files = new Map<
  string,
  { snapshot: ProjectSnapshot; revision: string }
>();
let recents: RecentFile[] = [];
const recovery = new Map<string, RecoveryRecord>();
let counter = 1;
for (let i = 1; i <= 12; i++) {
  const path = `/projects/project-${i}.takt`;
  files.set(path, {
    snapshot: { ...newProject(), title: `Project ${i}` },
    revision: '1',
  });
  recents.push({ path, name: `project-${i}.takt`, folder: '/projects' });
}
if (new URLSearchParams(location.search).has('recovery'))
  recovery.set('interrupted-session', {
    version: 1,
    baseline: '',
    id: 'interrupted-session',
    updatedAt: '2026-10-10T08:00:00.000Z',
    snapshot: { ...newProject(), title: 'Recovered work' },
    file: { path: '/projects/project-1.takt', revision: '1' },
  });
const saves: Result[] = [],
  opens: Result[] = [];
const openPaths: string[] = [];
const saveCalls: {
  snapshot: ProjectSnapshot;
  file?: FileIdentity;
  options?: { saveAs?: boolean; overwrite?: boolean };
}[] = [];
let closeHandler: (() => Promise<boolean>) | undefined;
let dropHandler: ((event: ProjectFileDrop) => void) | undefined;
let deferredOpen = false;
let resolvePending: (() => void) | undefined;
let deferredRemove = false;
let resolveRemove: (() => void) | undefined;
const adapter: PlatformAdapter = {
  kind: 'desktop',
  onFileDrop(handler) {
    dropHandler = handler;
    return () => {
      dropHandler = undefined;
    };
  },
  async open(path): Promise<Outcome<OpenedProject>> {
    const outcome = opens.shift() ?? 'success';
    if (deferredOpen) {
      deferredOpen = false;
      await new Promise<void>((resolve) => (resolvePending = resolve));
    }
    if (outcome === 'cancelled') return { status: 'cancelled' };
    if (outcome === 'failure')
      return { status: 'failure', message: 'Could not read project file.' };
    const selected = path ?? openPaths.shift() ?? '/projects/project-1.takt';
    const file = files.get(selected);
    if (!file)
      return { status: 'failure', message: 'Project file is unavailable.' };
    if (!recents.some((item) => item.path === selected))
      recents.unshift({
        path: selected,
        name: selected.split('/').at(-1)!,
        folder: selected.substring(0, selected.lastIndexOf('/')),
      });
    return {
      status: 'success',
      value: {
        snapshot: clone(file.snapshot),
        file: { path: selected, revision: file.revision },
      },
    };
  },
  async save(snapshot, file, options): Promise<SaveOutcome> {
    saveCalls.push(clone({ snapshot, file, options }));
    const outcome = saves.shift() ?? 'success';
    if (outcome === 'cancelled') return { status: 'cancelled' };
    if (outcome === 'failure')
      return { status: 'failure', message: 'Could not save: disk is full.' };
    if (outcome === 'conflict') return { status: 'conflict' };
    const path = options?.saveAs || !file ? '/projects/copy.takt' : file.path;
    if (
      !options?.overwrite &&
      !options?.saveAs &&
      file &&
      files.get(path)?.revision !== file.revision
    )
      return { status: 'conflict' };
    const revision = String(++counter);
    files.set(path, { snapshot: clone(snapshot), revision });
    return { status: 'success', value: { path, revision } };
  },
  async listRecovery() {
    return clone([...recovery.values()]);
  },
  async writeRecovery(record) {
    recovery.set(record.id, clone(record));
  },
  async removeRecovery(id) {
    if (deferredRemove) {
      deferredRemove = false;
      await new Promise<void>((resolve) => (resolveRemove = resolve));
    }
    recovery.delete(id);
  },
  async claimRecovery(record) {
    const claimed = clone(record);
    recovery.set(claimed.id, claimed);
    return claimed;
  },
  async listRecents() {
    return clone(recents);
  },
  async removeRecent(path) {
    recents = recents.filter((item) => item.path !== path);
  },
  onCloseRequested(handler) {
    closeHandler = handler;
    return () => {
      closeHandler = undefined;
    };
  },
};
export const controls = {
  fileDrop(event: ProjectFileDrop) {
    dropHandler?.(event);
  },
  queueSave(result: Result) {
    saves.push(result);
  },
  queueOpen(result: Result, path?: string) {
    opens.push(result);
    if (path) openPaths.push(path);
  },
  external(path: string, title = 'Their version') {
    const file = files.get(path)!;
    files.set(path, {
      snapshot: { ...file.snapshot, title },
      revision: String(++counter),
    });
  },
  deleteFile(path: string) {
    files.delete(path);
  },
  deferOpen() {
    deferredOpen = true;
  },
  finishOpen() {
    resolvePending?.();
    resolvePending = undefined;
  },
  deferRemove() {
    deferredRemove = true;
  },
  finishRemove() {
    resolveRemove?.();
    resolveRemove = undefined;
  },
  requestClose() {
    return closeHandler?.();
  },
  state() {
    return clone({
      files: Object.fromEntries(files),
      recents,
      recovery: [...recovery.values()],
      saveCalls,
    });
  },
};
Object.assign(window, { __desktopFixture: controls });
mount(App, { target: document.getElementById('app')!, props: { adapter } });
