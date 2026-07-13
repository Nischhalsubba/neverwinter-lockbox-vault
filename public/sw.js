const CACHE = 'lockbox-vault-v3';
const APP_SHELL = ['./', './manifest.webmanifest', './assets/app-icon.svg', './runtime-media.js'];

const shouldPreferNetwork = (request) => (
  request.mode === 'navigate'
  || ['document', 'script', 'style'].includes(request.destination)
);

const injectRuntimeMedia = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const html = await response.text();
  if (html.includes('runtime-media.js')) {
    return new Response(html, response);
  }

  const injected = html.replace(
    '</body>',
    '<script type="module" src="./runtime-media.js"></script></body>',
  );

  return new Response(injected, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();

    const clients = await self.clients.matchAll({ type: 'window' });
    await Promise.all(clients.map((client) => client.navigate(client.url)));
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (!shouldPreferNetwork(event.request)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })),
    );
    return;
  }

  event.respondWith((async () => {
    try {
      let response = await fetch(event.request, { cache: 'no-store' });
      if (event.request.mode === 'navigate') response = await injectRuntimeMedia(response);

      if (response && response.status === 200 && response.type !== 'opaque') {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    } catch {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') return caches.match('./');
      return Response.error();
    }
  })());
});
