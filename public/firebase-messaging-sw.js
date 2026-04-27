// Firebase Cloud Messaging retirado. Service worker no-op temporal.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
