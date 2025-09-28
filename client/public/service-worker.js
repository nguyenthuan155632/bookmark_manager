/* eslint-disable no-restricted-globals */
/* global self, clients, URL, console */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const registration = await self.registration.pushManager.getSubscription();
        let payload = null;
        if (registration) {
          const endpointParam = encodeURIComponent(registration.endpoint);
          const response = await self.fetch(`/api/push/articles/latest?endpoint=${endpointParam}`, {
            credentials: 'include',
          });
          if (response.ok) {
            payload = await response.json();
          }
        }

        const title = payload?.title || 'New AI article available';
        const body = payload?.body || 'Open Memorize Vault to read the latest article.';
        const url = payload?.url || '/ai-feed-management#articles';

        await self.registration.showNotification(title, {
          body,
          data: { url },
          icon: '/favicon.png',
          badge: '/favicon.png',
        });
      } catch (error) {
        console.error('Service worker push handling failed', error);
      }
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        const clientUrl = new URL(client.url);
        if (clientUrl.pathname === new URL(url, self.location.origin).pathname) {
          client.focus();
          return;
        }
      }
      await clients.openWindow(url);
    })(),
  );
});
