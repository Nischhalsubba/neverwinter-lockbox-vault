import assert from 'node:assert/strict';
import test from 'node:test';
import { hydrateFallbackRewardMedia, resolveFallbackRewardMedia } from '../reward-media.js';

test('same-titled rewards in different categories both receive fetched artwork', async () => {
  const title = 'Shared media fixture 20261117';
  const url = 'https://example.invalid/shared-media.png';
  const entries = [{ rewards: { companions: [title], mounts: [title] } }];
  let requests = 0;
  const updated = await hydrateFallbackRewardMedia(entries, {
    fetchImpl: async () => {
      requests += 1;
      return { ok: true, json: async () => ({ query: { pages: [{ title, thumbnail: { source: url } }] } }) };
    },
  });
  assert.equal(requests, 1);
  assert.equal(updated, 2);
  assert.equal(resolveFallbackRewardMedia('companion', title)?.url, url);
  assert.equal(resolveFallbackRewardMedia('mount', title)?.url, url);
});
