// Keeps Between Sets working with no internet.
// App files: try the network first (so updates show up right away), fall back to the saved copy
// after 3 seconds or when offline. Fonts: saved copy first, since they never change.
const CACHE = 'between-sets-v2';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

const timeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (url.origin !== self.location.origin) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    })));
    return;
  }

  const key = e.request.mode === 'navigate' ? './index.html' : url.pathname;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await timeout(fetch(url.href, { cache: 'no-store' }), 3000);
      if (res.ok) await cache.put(key, res.clone());
      return res;
    } catch {
      return (await cache.match(key, { ignoreSearch: true })) || (await cache.match(e.request, { ignoreSearch: true })) || Response.error();
    }
  })());
});
