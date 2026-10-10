import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  encodeProject,
  parseProject,
  suggestedFilename,
} from '../../web/src/project/format';
import type {
  PlatformAdapter,
  RecoveryRecord,
  RecentFile,
} from '../../web/src/project/platform';

interface NativeFile {
  path: string;
  bytes: string;
  revision: string;
}
const failure = (error: unknown) => ({
  status: 'failure' as const,
  message: String(error),
});
export const desktopAdapter: PlatformAdapter = {
  kind: 'desktop',
  async open(path) {
    try {
      const file = await invoke<NativeFile | null>('open_project', { path });
      if (!file) return { status: 'cancelled' };
      const snapshot = parseProject(file.bytes);
      await invoke('remember_recent', { path: file.path }).catch(() => {});
      return {
        status: 'success',
        value: { snapshot, file: { path: file.path, revision: file.revision } },
      };
    } catch (error) {
      return failure(error);
    }
  },
  async save(snapshot, file, options) {
    try {
      const result = await invoke<
        | { status: 'success'; path: string; revision: string }
        | { status: 'conflict' }
        | null
      >('save_project', {
        bytes: encodeProject(snapshot),
        path: options?.saveAs ? undefined : file?.path,
        expected: options?.saveAs ? undefined : file?.revision,
        overwrite: options?.overwrite ?? false,
        filename: suggestedFilename(snapshot.title),
      });
      if (!result) return { status: 'cancelled' };
      if (result.status === 'conflict') return result;
      await invoke('remember_recent', { path: result.path }).catch(() => {});
      return {
        status: 'success',
        value: { path: result.path, revision: result.revision },
      };
    } catch (error) {
      return failure(error);
    }
  },
  async listRecovery() {
    const records = await invoke<unknown[]>('list_recovery');
    return records.map((value): RecoveryRecord => {
      if (!value || typeof value !== 'object')
        throw new Error('Invalid recovery record');
      const record = value as Record<string, unknown>;
      if (
        record.version !== 1 ||
        typeof record.id !== 'string' ||
        !/^[a-zA-Z0-9-]+$/.test(record.id) ||
        typeof record.updatedAt !== 'string' ||
        !Number.isFinite(Date.parse(record.updatedAt)) ||
        typeof record.baseline !== 'string'
      )
        throw new Error('Invalid recovery record');
      if (
        record.file &&
        (typeof record.file !== 'object' ||
          typeof (record.file as Record<string, unknown>).path !== 'string' ||
          typeof (record.file as Record<string, unknown>).revision !== 'string')
      )
        throw new Error('Invalid recovery file identity');
      return {
        ...(record as unknown as RecoveryRecord),
        snapshot: parseProject(JSON.stringify(record.snapshot)),
      };
    });
  },
  async claimRecovery(record) {
    return invoke<RecoveryRecord>('claim_recovery', { record });
  },
  async abandonRecoveryClaim(claimedRecord, sourceRecord) {
    await invoke('abandon_recovery_claim', {
      claimedId: claimedRecord.id,
      sourceId: sourceRecord.id,
    });
  },
  async writeRecovery(record) {
    await invoke('write_recovery', { record });
  },
  async removeRecovery(id) {
    await invoke('remove_recovery', { id });
  },
  async listRecents() {
    return invoke<RecentFile[]>('list_recents');
  },
  async removeRecent(path) {
    await invoke('remove_recent', { path });
  },
  onCloseRequested(handler) {
    let disposed = false;
    let pending = false;
    const subscription = getCurrentWindow().onCloseRequested(async (event) => {
      event.preventDefault();
      if (pending) return;
      pending = true;
      try {
        if (await handler()) await getCurrentWindow().destroy();
      } finally {
        pending = false;
      }
    });
    void subscription.then((unlisten) => {
      if (disposed) unlisten();
    });
    return () => {
      disposed = true;
      void subscription.then((unlisten) => unlisten());
    };
  },
};
