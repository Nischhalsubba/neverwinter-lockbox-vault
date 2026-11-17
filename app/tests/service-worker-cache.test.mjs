import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

test('activation removes only stale Lockbox Vault caches', async () => {
  const script = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const handlers = new Map();
  const deleted = [];
  const cacheKeys = [
    'lockbox-vault-v14',
    'lockbox-vault-v15',
    'unrelated-app-v1',
    'other-app-assets',
  ];

  const context = {
    self: {
      addEventListener: (name, handler) => handlers.set(name, handler),
      clients: { claim: async () => undefined },
      skipWaiting: () => undefined,
    },
    caches: {
      keys: async () => cacheKeys,
      delete: async (key) => {
        deleted.push(key);
        return true;
      },
    },
  };

  runInNewContext(script, context);
  let completion;
  handlers.get('activate')({
    waitUntil(promise) { completion = promise; },
  });
  await completion;
  assert.deepEqual(deleted, ['lockbox-vault-v14']);
});
