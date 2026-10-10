import { describe, expect, it } from 'vitest';
import {
  BrowserRecoveryOwnership,
  type RecoveryLocks,
} from './browser-ownership';

function locks(): RecoveryLocks {
  const held = new Set<string>();
  return {
    async request(name, _options, callback) {
      if (held.has(name)) return callback(null);
      held.add(name);
      try {
        return await callback({});
      } finally {
        held.delete(name);
      }
    },
  };
}
describe('browser recovery ownership', () => {
  it('retains ownership across writes and denies another live instance even without timers', async () => {
    const manager = locks(),
      first = new BrowserRecoveryOwnership(manager),
      second = new BrowserRecoveryOwnership(manager);
    expect(await first.acquire('draft')).toBe(true);
    expect(await first.acquire('draft')).toBe(true);
    expect(await second.acquire('draft')).toBe(false);
    expect(first.owns('draft')).toBe(true);
    first.releaseAll();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await second.acquire('draft')).toBe(true);
    second.releaseAll();
  });
  it('released abandoned ownership can be claimed under the same record ID', async () => {
    const manager = locks(),
      original = new BrowserRecoveryOwnership(manager),
      recovered = new BrowserRecoveryOwnership(manager);
    await original.acquire('abandoned');
    original.release('abandoned');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await recovered.acquire('abandoned')).toBe(true);
    recovered.release('abandoned');
    expect(recovered.owns('abandoned')).toBe(false);
  });
  it('unavailable or rejected ownership fails safely', async () => {
    expect(await new BrowserRecoveryOwnership().acquire('draft')).toBe(false);
    const rejected = new BrowserRecoveryOwnership({
      request: async () => {
        throw new Error('denied');
      },
    });
    expect(await rejected.acquire('draft')).toBe(false);
    expect(rejected.owns('draft')).toBe(false);
  });
  it('page exit cancels a pending request rather than acquiring it later', async () => {
    let deliver!: (lock: object | null) => Promise<void> | void;
    const owner = new BrowserRecoveryOwnership({
      request: (_name, _options, callback) => {
        deliver = callback;
        return Promise.resolve();
      },
    });
    const acquiring = owner.acquire('draft');
    owner.releaseAll();
    await deliver({});
    expect(await acquiring).toBe(false);
    expect(owner.owns('draft')).toBe(false);
  });
});
