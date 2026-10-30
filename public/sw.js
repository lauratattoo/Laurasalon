const CACHE = 'laura-offline-v1';
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/offline.html','/assets/app-192.png'])).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k.startsWith('laura-offline-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', event => {
  // Never cache APIs, private records, cookies or submitted forms.
  if (event.request.mode === 'navigate' && event.request.method === 'GET') event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));
});
