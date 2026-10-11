import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeProject, newProject } from '../../web/src/project/format';
const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  close: vi.fn(),
  destroy: vi.fn(),
  drop: vi.fn(),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onCloseRequested: mocks.close,
    destroy: mocks.destroy,
  }),
}));
vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({ onDragDropEvent: mocks.drop }),
}));
import { desktopAdapter } from './platform';
beforeEach(() => vi.resetAllMocks());
describe('native adapter boundary', () => {
  it('forwards native file paths and clears hover on cancellation', async () => {
    const release = vi.fn();
    const handler = vi.fn();
    mocks.drop.mockResolvedValue(release);
    const dispose = desktopAdapter.onFileDrop!(handler);
    const dispatch = mocks.drop.mock.calls[0][0];
    dispatch({ payload: { type: 'enter', paths: ['C:\\Plans\\launch.takt'] } });
    dispatch({ payload: { type: 'over', position: { x: 80, y: 100 } } });
    dispatch({ payload: { type: 'leave' } });
    dispatch({ payload: { type: 'drop', paths: ['C:\\Plans\\launch.takt'] } });
    expect(handler.mock.calls.map(([event]) => event)).toEqual([
      { type: 'enter', paths: ['C:\\Plans\\launch.takt'] },
      { type: 'leave' },
      { type: 'drop', paths: ['C:\\Plans\\launch.takt'] },
    ]);
    await Promise.resolve();
    dispose();
    dispatch({ payload: { type: 'drop', paths: ['late.takt'] } });
    expect(handler).toHaveBeenCalledTimes(3);
    expect(release).toHaveBeenCalledTimes(1);
  });
  it('releases a drag subscription that finishes after unmount and reports subscription failures', async () => {
    let finish!: (release: () => void) => void;
    mocks.drop.mockReturnValue(
      new Promise<() => void>((resolve) => {
        finish = resolve;
      }),
    );
    const release = vi.fn();
    const dispose = desktopAdapter.onFileDrop!(vi.fn());
    dispose();
    finish(release);
    await Promise.resolve();
    expect(release).toHaveBeenCalledTimes(1);
    const handler = vi.fn();
    mocks.drop.mockRejectedValue(new Error('Listener unavailable'));
    desktopAdapter.onFileDrop!(handler);
    await vi.waitFor(() =>
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'failure' }),
      ),
    );
  });
  it('passes source and claimed IDs for native lease rollback', async () => {
    const source = {
      id: 'source',
      updatedAt: new Date().toISOString(),
      snapshot: newProject(),
    };
    mocks.invoke.mockResolvedValue(undefined);
    await desktopAdapter.abandonRecoveryClaim!(
      { ...source, id: 'fork' },
      source,
    );
    expect(mocks.invoke).toHaveBeenCalledWith('abandon_recovery_claim', {
      claimedId: 'fork',
      sourceId: 'source',
    });
  });
  it('does not expose invalid native bytes or cancelled picker results', async () => {
    mocks.invoke.mockResolvedValueOnce(null);
    expect(await desktopAdapter.open()).toEqual({ status: 'cancelled' });
    mocks.invoke.mockResolvedValueOnce({
      path: 'bad.takt',
      revision: 'hash',
      bytes: '{}',
    });
    expect(await desktopAdapter.open('bad.takt')).toMatchObject({
      status: 'failure',
      invalid: true,
    });
    mocks.invoke.mockRejectedValueOnce('The system cannot find the file.');
    expect(await desktopAdapter.open('gone.takt')).toEqual({
      status: 'failure',
      message: 'The system cannot find the file.',
    });
    // Recent history is recorded by the shell once the file replaces the session.
    expect(mocks.invoke).toHaveBeenCalledTimes(3);
    mocks.invoke.mockResolvedValueOnce(undefined);
    await desktopAdapter.rememberRecent!('opened.takt');
    expect(mocks.invoke).toHaveBeenLastCalledWith('remember_recent', {
      path: 'opened.takt',
    });
  });
  it('keeps successful save identity when incidental recent-history writing fails', async () => {
    mocks.invoke
      .mockResolvedValueOnce({
        status: 'success',
        path: 'new.takt',
        revision: 'written',
      })
      .mockRejectedValueOnce(new Error('History unavailable'));
    expect(
      await desktopAdapter.save(
        newProject(),
        { path: 'old.takt', revision: 'original' },
        { saveAs: true },
      ),
    ).toEqual({
      status: 'success',
      value: { path: 'new.takt', revision: 'written' },
    });
    expect(mocks.invoke.mock.calls[0][1]).toMatchObject({
      bytes: encodeProject(newProject()),
      path: undefined,
      expected: undefined,
      filename: 'Untitled.takt',
    });
  });
  it('preserves conflict/cancellation/failure as distinct operation outcomes', async () => {
    mocks.invoke
      .mockResolvedValueOnce({ status: 'conflict' })
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('Disk full'));
    expect(await desktopAdapter.save(newProject())).toEqual({
      status: 'conflict',
    });
    expect(await desktopAdapter.save(newProject())).toEqual({
      status: 'cancelled',
    });
    expect((await desktopAdapter.save(newProject())).status).toBe('failure');
  });
  it('lists valid recoveries and skips invalid envelopes and snapshots', async () => {
    const valid = {
      version: 1,
      id: 'valid',
      updatedAt: new Date().toISOString(),
      baseline: '',
      snapshot: newProject(),
    };
    mocks.invoke.mockResolvedValueOnce([
      { id: 'bad', updatedAt: 'now', snapshot: newProject() },
      valid,
      { ...valid, id: 'bad-snapshot', snapshot: {} },
      { ...valid, id: 'bad-file', file: { path: 1 } },
      null,
    ]);
    expect(
      (await desktopAdapter.listRecovery()).map((record) => record.id),
    ).toEqual(['valid']);
  });
  it('validates a claimed recovery and releases the claim when it is invalid', async () => {
    const source = {
      version: 1 as const,
      id: 'source',
      updatedAt: new Date().toISOString(),
      baseline: '',
      snapshot: newProject(),
    };
    mocks.invoke.mockResolvedValueOnce({ ...source, extra: true });
    expect((await desktopAdapter.claimRecovery!(source)).id).toBe('source');
    mocks.invoke
      .mockResolvedValueOnce({ ...source, id: 'fork', snapshot: {} })
      .mockResolvedValueOnce(undefined);
    await expect(desktopAdapter.claimRecovery!(source)).rejects.toThrow(
      'Invalid .takt',
    );
    expect(mocks.invoke).toHaveBeenLastCalledWith('abandon_recovery_claim', {
      claimedId: 'fork',
      sourceId: 'source',
    });
  });
  it('prevents native close and destroys only after the shared guard allows it', async () => {
    const unlisten = vi.fn();
    mocks.close.mockResolvedValue(unlisten);
    const allowed = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const dispose = desktopAdapter.onCloseRequested!(allowed);
    const listener = mocks.close.mock.calls[0][0];
    const preventDefault = vi.fn();
    await listener({ preventDefault });
    expect(mocks.destroy).not.toHaveBeenCalled();
    await listener({ preventDefault });
    expect(mocks.destroy).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledTimes(2);
    dispose();
    await Promise.resolve();
    expect(unlisten).toHaveBeenCalledOnce();
  });
});
