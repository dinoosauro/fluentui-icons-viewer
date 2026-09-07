const cacheName = 'fluentuiiconviewer-cache';
const filestoCache = [
    './',
    './index.html',
    './favicon.svg',
    './favicon-light.svg',
    './assets/index.css',
    './assets/index.js',
    './assets/jszip.min.js'
];
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(cacheName)
            .then(cache => cache.addAll(filestoCache))
    );
});
self.addEventListener('activate', e => self.clients.claim());
self.addEventListener('fetch', event => {
    const req = event.request;
    if (new URL(req.url).origin !== self.location.origin) { // The webpage will handle the fetch request normally
        return; 
    } else {
        event.respondWith(networkFirst(req));
    }
});
async function networkFirst(req) {
    try {
        const networkResponse = await fetch(req);
        const cache = await caches.open(cacheName);
        await cache.delete(req);
        await cache.put(req, networkResponse.clone());
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(req);
        return cachedResponse;
    }
}