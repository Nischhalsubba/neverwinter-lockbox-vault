import assert from 'node:assert/strict';
import { test } from 'node:test';

test('blocked localStorage does not prevent loading or updating fallback media', async () => {
  const previousWindow = globalThis.window;
  const blockedWindow = {};
  Object.defineProperty(blockedWindow, 'localStorage', {
    get() { throw new Error('Storage access denied'); },
  });
  globalThis.window = blockedWindow;
  try {
    const media = await import('../reward-media.js?blocked-storage-regression');
    assert.equal(media.resolveFallbackRewardMedia('companion', 'Unknown Reward'), null);
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({ query: { pages: [{
        title: 'Unique Blocked Storage Reward',
        thumbnail: { source: 'https://images.example.org/reward.png' },
        fullurl: 'https://neverwinter.fandom.com/wiki/Unique_Blocked_Storage_Reward',
      }] } }),
    });
    const updated = await media.hydrateFallbackRewardMedia([
      { rewards: { companions: ['Unique Blocked Storage Reward'] } },
    ], { fetchImpl });
    assert.equal(updated, 1);
    assert.equal(
      media.resolveFallbackRewardMedia('companion', 'Unique Blocked Storage Reward').url,
      'https://images.example.org/reward.png',
    );
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
