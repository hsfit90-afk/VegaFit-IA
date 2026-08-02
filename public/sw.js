const CACHE_NAME = 'vegafit-v1';

// Install event
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Fetch event (minimal requirement for PWA)
self.addEventListener('fetch', (event) => {
  // Let the browser handle all network requests normally, 
  // we just need the fetch listener for the PWA install prompt.
});
