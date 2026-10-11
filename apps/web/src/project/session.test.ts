import { describe, expect, it, vi } from 'vitest';
import { newProject } from './format';
import { ProjectSession, VIEW_PERSIST_DELAY } from './session';
import type { PlatformAdapter, RecoveryRecord, SaveOutcome } from './platform';

function fake() {
  const records = new Map<string, RecoveryRecord>();
  const adapter: PlatformAdapter = {
    kind: 'web',
    open: async () => ({ status: 'cancelled' }),
    save: async () => ({ status: 'success', value: undefined }),
    listRecovery: async () => [...records.values()],
    writeRecovery: async (record) => {
      records.set(record.id, record);
    },
    removeRecovery: async (id) => {
      records.delete(id);
    },
  };
  return { adapter, records, session: new ProjectSession(adapter) };
}
describe('document lifecycle', () => {
  it('guard downloads defer the saved baseline until explicit retained-file acknowledgement', async () => {
    const { session } = fake();
    session.create();
    session.update({ ...session.snapshot!, title: 'Unconfirmed work' });
    const snapshot = session.snapshot!,
      generation = session.generation;
    await session.save({ acknowledge: false });
    expect(session.modified).toBe(true);
    expect(session.acknowledge(snapshot, generation)).toBe(true);
    expect(session.modified).toBe(false);
    session.update({ ...snapshot, title: 'Newer edits' });
    expect(session.modified).toBe(true);
    session.create();
    expect(session.acknowledge(snapshot, generation)).toBe(false);
  });
  it('a deferred failed recovery claim preserves the retained chart and associated recovery', async () => {
    const { adapter, session, records } = fake();
    session.create();
    session.update({ ...session.snapshot!, title: 'Retained work' });
    await session.persist();
    const id = session.recoveryId;
    let reject!: (error: Error) => void;
    adapter.claimRecovery = () =>
      new Promise((_resolve, fail) => (reject = fail));
    const resuming = session.resume({
      id: 'invalid',
      updatedAt: '2026-10-10T10:00:00Z',
      snapshot: newProject(),
    });
    reject(new Error('Invalid recovery'));
    await expect(resuming).rejects.toThrow('Invalid recovery');
    expect(session.snapshot!.title).toBe('Retained work');
    expect(records.get(id)!.snapshot.title).toBe('Retained work');
  });
  it('a deferred recovery claim cannot replace a newer document or a newer recovery request', async () => {
    const { adapter, session } = fake();
    let finish!: (record: RecoveryRecord) => void;
    adapter.claimRecovery = () => new Promise((resolve) => (finish = resolve));
    const record: RecoveryRecord = {
      id: 'old',
      updatedAt: '2026-10-10T10:00:00Z',
      snapshot: { ...newProject(), title: 'Old recovery' },
    };
    const resuming = session.resume(record);
    const abandoned: string[] = [];
    adapter.abandonRecoveryClaim = async (claimed) => {
      abandoned.push(claimed.id);
    };
    session.create();
    session.update({ ...session.snapshot!, title: 'New edits' });
    finish(record);
    expect(await resuming).toBe(false);
    expect(abandoned).toEqual(['old']);
    expect(session.snapshot!.title).toBe('New edits');
  });
  it('pristine and navigation-only projects are clean; content changes and undo compare with saved baseline', async () => {
    const { session } = fake();
    session.create();
    const initial = session.snapshot!;
    expect(session.modified).toBe(false);
    session.update({
      ...initial,
      view: { ...initial.view, firstWeek: -7, zoom: 2, scrollTop: 50 },
    });
    expect(session.modified).toBe(false);
    session.update({ ...session.snapshot!, title: 'Delivery' });
    expect(session.modified).toBe(true);
    session.update(initial);
    expect(session.modified).toBe(false);
  });
  it('download acknowledges the requested snapshot, preserving newer edits and latest view', async () => {
    const { adapter, session } = fake();
    session.create();
    session.update({ ...session.snapshot!, title: 'Before' });
    let finish!: (result: SaveOutcome) => void;
    adapter.save = () => new Promise((resolve) => (finish = resolve));
    const saving = session.save();
    session.update({ ...session.snapshot!, title: 'During' });
    finish({ status: 'success', value: undefined });
    await saving;
    expect(session.snapshot!.title).toBe('During');
    expect(session.modified).toBe(true);
  });
  it('stale save results never acknowledge a replacement document', async () => {
    const { adapter, session } = fake();
    session.create();
    let finish!: (result: SaveOutcome) => void;
    adapter.save = () => new Promise((resolve) => (finish = resolve));
    const saving = session.save();
    session.replace({ snapshot: { ...newProject(), title: 'Replacement' } });
    finish({ status: 'success', value: { path: 'old.takt', revision: 'old' } });
    expect((await saving).status).toBe('cancelled');
    expect(session.file).toBeUndefined();
    expect(session.snapshot!.title).toBe('Replacement');
  });
  it.each(['cancelled', 'failure', 'conflict'] as const)(
    'save %s retains modified state and recovery',
    async (status) => {
      const { adapter, session, records } = fake();
      session.create();
      session.update({ ...session.snapshot!, title: 'Work' });
      await session.persist();
      adapter.save = async () =>
        status === 'failure' ? { status, message: 'Disk full' } : { status };
      await session.save();
      expect(session.modified).toBe(true);
      expect(records.get(session.recoveryId)!.snapshot.title).toBe('Work');
    },
  );
  it('thrown save and recovery errors keep editing available and retry repairs recovery', async () => {
    const { adapter, session } = fake();
    session.create();
    adapter.writeRecovery = async () => {
      throw new Error('quota');
    };
    session.update({ ...session.snapshot!, title: 'Editing' });
    await session.persist();
    expect(session.recoveryWarning).toContain('unavailable');
    session.update({ ...session.snapshot!, title: 'Still editing' });
    adapter.save = async () => {
      throw new Error('Disk full');
    };
    expect((await session.save()).status).toBe('failure');
    expect(session.snapshot!.title).toBe('Still editing');
    adapter.writeRecovery = async () => {};
    await session.persist();
    expect(session.recoveryWarning).toBe('');
  });
  it('resume is modified, keeps native original revision, and discard removes its associated recovery', async () => {
    const { session, records } = fake();
    const record: RecoveryRecord = {
      id: 'recovered',
      updatedAt: '2026-10-10T10:00:00Z',
      snapshot: newProject(),
      file: { path: 'original.takt', revision: 'original' },
    };
    await session.resume(record);
    await session.persist();
    expect(session.modified).toBe(true);
    expect(session.file?.revision).toBe('original');
    expect(await session.discard()).toBe(true);
    expect(records.has('recovered')).toBe(false);
  });
  it('discard captures its recovery ID and cannot delete a newer document during pending writes', async () => {
    const { session, adapter } = fake();
    let finish!: () => void;
    adapter.writeRecovery = () =>
      new Promise<void>((resolve) => (finish = resolve));
    session.create();
    session.update({ ...session.snapshot!, title: 'Edited' });
    await Promise.resolve();
    const discarding = session.discard();
    session.replace({ snapshot: { ...newProject(), title: 'New' } });
    finish();
    expect(await discarding).toBe(false);
    expect(session.snapshot!.title).toBe('New');
  });
  it('writes edits to recovery immediately and coalesces view-only changes', async () => {
    vi.useFakeTimers();
    try {
      const { adapter, session, records } = fake();
      let writes = 0;
      const write = adapter.writeRecovery;
      adapter.writeRecovery = async (record) => {
        writes++;
        await write(record);
      };
      session.create();
      session.update({ ...session.snapshot!, title: 'Edited' });
      await session.persist();
      expect(records.get(session.recoveryId)!.snapshot.title).toBe('Edited');
      writes = 0;
      for (const scrollTop of [10, 20, 30])
        session.update({
          ...session.snapshot!,
          view: { ...session.snapshot!.view, scrollTop },
        });
      await vi.advanceTimersByTimeAsync(VIEW_PERSIST_DELAY - 1);
      expect(writes).toBe(0);
      await vi.advanceTimersByTimeAsync(1);
      expect(writes).toBe(1);
      expect(records.get(session.recoveryId)!.snapshot.view.scrollTop).toBe(30);
      session.update({
        ...session.snapshot!,
        view: { ...session.snapshot!.view, zoom: 2 },
      });
      await session.flush();
      expect(writes).toBe(2);
      expect(records.get(session.recoveryId)!.snapshot.view.zoom).toBe(2);
      await session.persist();
      await vi.advanceTimersByTimeAsync(VIEW_PERSIST_DELAY);
      expect(writes).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
  it('an invalid view never breaks the modified check', () => {
    const { session } = fake();
    session.create();
    session.update({
      ...session.snapshot!,
      view: { ...session.snapshot!.view, scrollTop: -5 },
    });
    expect(session.modified).toBe(false);
  });
  it('an untouched project has no recovery record until its first edit', async () => {
    const { adapter, session, records } = fake();
    let removals = 0;
    const remove = adapter.removeRecovery;
    adapter.removeRecovery = async (id) => {
      removals++;
      await remove(id);
    };
    session.create();
    session.update({
      ...session.snapshot!,
      view: { ...session.snapshot!.view, zoom: 2 },
    });
    await session.flush();
    await session.persist();
    expect(records.size).toBe(0);
    expect(await session.discard()).toBe(true);
    expect(removals).toBe(0);
    session.replace({
      snapshot: { ...newProject(), title: 'Opened' },
      file: { path: 'opened.takt', revision: '1' },
    });
    await session.persist();
    expect(records.size).toBe(0);
    session.update({ ...session.snapshot!, title: 'Edited' });
    await session.persist();
    expect(records.get(session.recoveryId)!.snapshot.title).toBe('Edited');
    session.update({ ...session.snapshot!, title: 'Opened' });
    await session.persist();
    expect(session.modified).toBe(false);
    expect(records.get(session.recoveryId)!.snapshot.title).toBe('Opened');
    expect(await session.discard()).toBe(true);
    expect(removals).toBe(1);
    expect(records.size).toBe(0);
  });
});
