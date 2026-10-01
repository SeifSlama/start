/* Design by Seif — app shell cache for offline use (platform pages only).
 * Static assets: cache-first. Platform pages: network-first, cached fallback, then /offline.html.
 * The API, media, sign-in and every store (/<slug>) are never cached here. */
const VERSION = 'dbs-__V__';
const SHELL = ['/', '/dashboard', '/pricing', '/offline.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-180.png'];
const PAGES = /^\/(dashboard(\/.*)?|pricing|design|terms|privacy|contact)?$/;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
const isStatic = (url) => url.pathname.startsWith('/icons/') || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/ds/') || url.pathname.startsWith('/sf/') || url.pathname.startsWith('/demo/') || /\.(png|svg|ico|woff2?|webp)$/.test(url.pathname);
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/m/') || url.pathname.startsWith('/__/')) return;
  if (isStatic(url)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (req.mode === 'navigate' && PAGES.test(url.pathname)) {
    event.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(url.pathname, copy)); }
      return res;
    }).catch(async () => (await caches.match(url.pathname)) || (await caches.match('/offline.html'))));
  }
});
