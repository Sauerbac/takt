import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import {
  decodeProject,
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
const INVALID = 'Invalid .takt file';
const failure = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return {
    status: 'failure' as const,
    message,
    ...(message.startsWith(INVALID) ? { invalid: true } : {}),
  };
};
/** Native recovery records are external data: validate before they can replace a session. */
function decodeRecovery(value: unknown): RecoveryRecord {
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
    snapshot: decodeProject(record.snapshot),
  };
}
export const desktopAdapter: PlatformAdapter = {
  kind: 'desktop',
  onFileDrop(handler) {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const subscription = getCurrentWebview().onDragDropEvent(({ payload }) => {
      if (disposed) return;
      if (payload.type === 'enter' || payload.type === 'drop')
        handler({ type: payload.type, paths: payload.paths });
      else if (payload.type === 'leave') handler({ type: 'leave' });
    });
    void subscription
      .then((release) => {
        if (disposed) release();
        else unlisten = release;
      })
      .catch(() => {
        if (!disposed)
          handler({
            type: 'failure',
            message:
              'Could not enable file dropping. Use Open .takt file to open your project.',
          });
      });
    return () => {
      disposed = true;
      unlisten?.();
      unlisten = undefined;
    };
  },
  async open(path) {
    try {
      const file = await invoke<NativeFile | null>('open_project', { path });
      if (!file) return { status: 'cancelled' };
      const snapshot = parseProject(file.bytes);
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
    // An unreadable record stays on disk; it must not hide the others.
    return records.flatMap((value) => {
      try {
        return [decodeRecovery(value)];
      } catch {
        return [];
      }
    });
  },
  async claimRecovery(record) {
    const claimed = await invoke<unknown>('claim_recovery', { record });
    try {
      return decodeRecovery(claimed);
    } catch (error) {
      const claimedId = (claimed as { id?: unknown } | null)?.id;
      if (typeof claimedId === 'string')
        await invoke('abandon_recovery_claim', {
          claimedId,
          sourceId: record.id,
        }).catch(() => {});
      throw error;
    }
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
  async rememberRecent(path) {
    await invoke('remember_recent', { path });
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
