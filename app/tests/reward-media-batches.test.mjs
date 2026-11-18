import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hydrateFallbackRewardMedia } from '../reward-media.js';

test('fractional media batch size is normalized to avoid duplicate or empty queries', async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    return { ok: true, json: async () => ({ query: { pages: [] } }) };
  };
  const result = await hydrateFallbackRewardMedia([
    { rewards: { companions: ['Unique Test Alpha 2026', 'Unique Test Beta 2026'] } },
  ], { fetchImpl, batchSize: 0.5 });
  assert.equal(result, 0);
  assert.equal(urls.length, 1);
  const request = new URL(urls[0]);
  assert.equal(request.searchParams.get('titles'), 'Unique Test Alpha 2026|Unique Test Beta 2026');
});
