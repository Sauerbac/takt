import {
  decodeProject,
  encodeProject,
  parseProject,
  suggestedFilename,
} from './format';
import type { PlatformAdapter, RecoveryRecord } from './platform';
import { BrowserRecoveryOwnership } from './browser-ownership';

const prefix = 'takt.draft.v1.';
const ownership = new BrowserRecoveryOwnership(navigator.locks);
window.addEventListener('pagehide', () => ownership.releaseAll());
// Metadata identifies the originating tab; held Web Locks decide live ownership.
let owner: string = crypto.randomUUID();
try {
  if (
    (
      performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming
    )?.type === 'reload'
  )
    owner = sessionStorage.getItem('takt.owner') ?? owner;
  sessionStorage.setItem('takt.owner', owner);
} catch {
  /* Recovery errors are reported by the adapter operations. */
}
function readLatest(record: RecoveryRecord): RecoveryRecord {
  const stored = localStorage.getItem(prefix + record.id);
  if (!stored)
    throw new Error(
      'This draft is no longer available. Return Home to refresh the list.',
    );
  const current = JSON.parse(stored);
  if (
    current.version !== 1 ||
    current.id !== record.id ||
    typeof current.updatedAt !== 'string'
  )
    throw new Error(
      'This recovery copy could not be read. Your current project is still available.',
    );
  return {
    ...record,
    updatedAt: current.updatedAt,
    baseline: current.baseline,
    snapshot: decodeProject(current.snapshot),
    owner,
  };
}
export const browserAdapter: PlatformAdapter = {
  kind: 'web',
  open() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.takt,application/json';
      input.addEventListener('cancel', () => resolve({ status: 'cancelled' }));
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve({ status: 'cancelled' });
          return;
        }
        resolve(await browserAdapter.openFile!(file));
      });
      input.click();
    });
  },
  async openFile(file) {
    try {
      return {
        status: 'success',
        value: { snapshot: parseProject(await file.text()) },
      };
    } catch (error) {
      return {
        status: 'failure',
        message:
          error instanceof Error ? error.message : 'Could not open file.',
      };
    }
  },
  async save(snapshot) {
    try {
      const url = URL.createObjectURL(
        new Blob([encodeProject(snapshot)], { type: 'application/json' }),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = suggestedFilename(snapshot.title);
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return { status: 'success', value: undefined };
    } catch {
      return {
        status: 'failure',
        message:
          'Could not download this project. Your edits are still available.',
      };
    }
  },
  async listRecovery() {
    browserAdapter.recoveryWarning = '';
    const records: RecoveryRecord[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      try {
        const record = JSON.parse(localStorage.getItem(key)!);
        if (
          record.version !== 1 ||
          typeof record.id !== 'string' ||
          typeof record.updatedAt !== 'string'
        )
          throw new Error('Invalid draft');
        records.push({
          version: 1,
          baseline: record.baseline,
          owner: record.owner,
          id: record.id,
          updatedAt: record.updatedAt,
          snapshot: decodeProject(record.snapshot),
        });
      } catch {
        browserAdapter.recoveryWarning =
          'A recovery copy could not be read. Other drafts and file operations are still available.';
      }
    }
    return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async claimRecovery(record) {
    const acquired =
      (await ownership.acquire(record.id)) && ownership.owns(record.id);
    try {
      const latest = readLatest(record);
      return acquired ? latest : { ...latest, id: crypto.randomUUID(), owner };
    } catch (error) {
      if (acquired) ownership.release(record.id);
      throw error;
    }
  },
  async abandonRecoveryClaim(claimed, source) {
    if (claimed.id !== source.id && ownership.owns(claimed.id))
      localStorage.removeItem(prefix + claimed.id);
    ownership.release(claimed.id);
  },
  async writeRecovery(record) {
    if (!(await ownership.acquire(record.id)) || !ownership.owns(record.id))
      throw new Error('Recovery ownership is unavailable.');
    localStorage.setItem(
      prefix + record.id,
      JSON.stringify({ ...record, owner }),
    );
  },
  async removeRecovery(id) {
    if (localStorage.getItem(prefix + id) === null) {
      ownership.release(id);
      return;
    }
    if (!(await ownership.acquire(id)) || !ownership.owns(id))
      throw new Error('Recovery ownership is unavailable.');
    localStorage.removeItem(prefix + id);
    ownership.release(id);
  },
};
