// Minimal service worker. It exists so the app meets the PWA install
// criteria on Android / Chrome (a registered SW with a fetch handler).
// No offline caching — this is a live review tool, always online.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // Pass-through: let the browser handle every request normally.
});
