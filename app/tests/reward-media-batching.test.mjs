import assert from 'node:assert/strict';
import test from 'node:test';
import { hydrateFallbackRewardMedia } from '../reward-media.js';

test('invalid batch sizes fall back to a finite request chunk', async () => {
  const entries = [{ rewards: { companions: ['Unique media lookup fixture 20261117'] } }];
  for (const batchSize of [0, -1, NaN]) {
    let requests = 0;
    const result = await hydrateFallbackRewardMedia(entries, {
      batchSize,
      fetchImpl: async () => {
        requests += 1;
        return { ok: true, json: async () => ({ query: { pages: [] } }) };
      },
    });
    assert.equal(requests, 1);
    assert.equal(result, 0);
  }
});
