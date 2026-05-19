// Service worker. Exists so the app meets the PWA install criteria and
// so it can receive Web Push notifications. No offline caching — this is
// a live review tool, always online.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // Pass-through: let the browser handle every request normally.
});

// ---- Web Push ----
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* non-JSON payload — ignore */
  }
  const title = data.title || 'Shuffl';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: data.videoId || undefined,
      data: { url: '/' },
    }),
  );
});

// Focus the app (or open it) when a notification is tapped.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const c of list) {
          if ('focus' in c) return c.focus();
        }
        return self.clients.openWindow ? self.clients.openWindow(url) : null;
      }),
  );
});
