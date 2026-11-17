import assert from 'node:assert/strict';
import test from 'node:test';

test('media cache rejects invalid and future-dated savedAt timestamps', async () => {
  const previousWindow = globalThis.window;
  const name = 'Cache timestamp test 20261117';
  const key = `companion:${name.toLowerCase()}`;
  try {
    for (const [caseName, savedAt, valid] of [
      ['future', Date.now() + 86_400_000, false],
      ['ancient', 0, false],
      ['invalid', 'not a date', false],
      ['recent', Date.now() - 60_000, true],
    ]) {
      const cache = { savedAt, items: { [key]: { url: 'https://example.invalid/media.png' } } };
      globalThis.window = { localStorage: { getItem: () => JSON.stringify(cache) } };
      const { resolveFallbackRewardMedia } = await import(`../reward-media.js?cachecase=${caseName}`);
      assert.equal(Boolean(resolveFallbackRewardMedia('companion', name)), valid, caseName);
    }
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
