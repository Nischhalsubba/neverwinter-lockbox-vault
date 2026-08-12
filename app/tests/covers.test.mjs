import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import {
  __resetCoverMediaForTests,
  buildCoverApiUrl,
  hydrateCoverMedia,
  resolveCoverMedia,
} from '../covers.js';

const entry = {
  slug: 'nightmare-lockbox',
  name: 'Nightmare Lockbox',
  image: 'assets/images/nightmare-lockbox.svg',
  imageDiscovery: null,
};

afterEach(() => __resetCoverMediaForTests());

test('uses the generated local cover until a verified remote image is available', () => {
  const media = resolveCoverMedia(entry);
  assert.equal(media.url, entry.image);
  assert.equal(media.isPlaceholder, true);
});

test('builds a batched MediaWiki page-image request', () => {
  const url = new URL(buildCoverApiUrl([
    entry,
    { ...entry, name: 'Reborn Lockbox (CONSOLE ONLY)' },
  ]));

  assert.equal(url.origin, 'https://neverwinter.fandom.com');
  assert.equal(url.searchParams.get('origin'), '*');
  assert.match(url.searchParams.get('titles'), /Nightmare Lockbox/);
  assert.match(url.searchParams.get('titles'), /Reborn Lockbox/);
  assert.doesNotMatch(url.searchParams.get('titles'), /CONSOLE ONLY/);
});

test('hydrates a real cover from a MediaWiki response', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      query: {
        pages: [{
          title: 'Nightmare Lockbox',
          fullurl: 'https://neverwinter.fandom.com/wiki/Nightmare_Lockbox',
          thumbnail: { source: 'https://static.wikia.nocookie.net/example/nightmare.png' },
        }],
      },
    }),
  });

  const count = await hydrateCoverMedia([entry], { fetchImpl });
  const media = resolveCoverMedia(entry);

  assert.equal(count, 1);
  assert.equal(media.isPlaceholder, false);
  assert.equal(media.provider, 'Neverwinter Wiki / Fandom');
  assert.match(media.url, /^https:\/\//);
});

test('rejects unsafe image protocols and keeps the fallback', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      query: {
        pages: [{
          title: 'Nightmare Lockbox',
          thumbnail: { source: 'javascript:alert(1)' },
        }],
      },
    }),
  });

  assert.equal(await hydrateCoverMedia([entry], { fetchImpl }), 0);
  assert.equal(resolveCoverMedia(entry).isPlaceholder, true);
});
