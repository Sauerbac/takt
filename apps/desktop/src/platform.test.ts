import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeProject, newProject } from '../../web/src/project/format';
const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  close: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onCloseRequested: mocks.close,
    destroy: mocks.destroy,
  }),
}));
import { desktopAdapter } from './platform';
beforeEach(() => vi.resetAllMocks());
describe('native adapter boundary', () => {
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
    expect((await desktopAdapter.open('bad.takt')).status).toBe('failure');
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
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
  it('validates recovery envelopes and snapshots before session replacement', async () => {
    mocks.invoke.mockResolvedValueOnce([
      {
        version: 99,
        id: 'record',
        updatedAt: new Date().toISOString(),
        snapshot: newProject(),
        baseline: '',
      },
    ]);
    await expect(desktopAdapter.listRecovery()).rejects.toThrow(
      'Invalid recovery',
    );
    mocks.invoke.mockResolvedValueOnce([
      {
        version: 1,
        id: 'record',
        updatedAt: new Date().toISOString(),
        snapshot: {},
        baseline: '',
      },
    ]);
    await expect(desktopAdapter.listRecovery()).rejects.toThrow(
      'Invalid .takt',
    );
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
