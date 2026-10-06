// Service worker mínimo: guarda la "cáscara" de la app para que abra rápido.
// Los datos del viaje siempre se piden en línea (nunca se guardan aquí).
const CACHE = 'mi-viaje-v2';
const SHELL = ['/', '/index.html', '/assets/app.css', '/assets/app.js', '/config.js', '/assets/logo-on-red.png', '/assets/logo-white.png', '/assets/logo.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/panel')) return;
  // red primero, caché como respaldo
  e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('/'))));
});
