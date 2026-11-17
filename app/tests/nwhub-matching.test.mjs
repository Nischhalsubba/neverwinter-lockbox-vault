import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeMediaText, mediaSlug, scoreMediaCandidate } from '../nwhub.js';

test('NW Hub names match regardless of accents and punctuation', () => {
  assert.equal(normalizeMediaText('Ébon’s Triumph'), 'ebon s triumph');
  assert.equal(mediaSlug('Ébon’s Triumph'), 'ebon-s-triumph');
});

test('an unaccented media title matches the same accented reward name', () => {
  const match = scoreMediaCandidate(
    { name: 'Élite Dragon', type: 'mount' },
    { title: 'Elite Dragon', type: 'mount', url: 'https://nw-hub.com/mounts/elite-dragon' },
  );
  assert.ok(match >= 1200, `Expected exact normalized match, got ${match}`);
});
