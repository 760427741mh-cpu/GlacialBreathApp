const CACHE_NAME = 'glacial-breath-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/index.tsx',
  '/index.css',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate worker immediately
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // Take control of all clients
});

self.addEventListener('fetch', (event) => {
  // Network first, falling back to cache strategy
  // This ensures user always gets latest version if online, but app works if offline
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
});