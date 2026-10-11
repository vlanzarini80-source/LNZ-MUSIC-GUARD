
const CACHE = 'lnz-music-guard-shell-v03';

const FILES = [
  './',
  './index.html',
  './manifest.json',
  './asr-worker.js',
  './icon-192.svg',
  './icon-512.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k =>
            k.startsWith('lnz-music-guard-') &&
            k !== CACHE
          )
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const u = new URL(req.url);

  if (req.method !== 'GET' ||
      u.origin !== self.location.origin) {
    return;
  }

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(resp => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE)
              .then(c => c.put('./index.html', copy))
              .catch(() => {});
          }
          return resp;
        })
        .catch(() => caches.match('./index.html'))
    );
  } else {
    e.respondWith(
      caches.match(req)
        .then(cached => cached || fetch(req))
    );
  }
});
