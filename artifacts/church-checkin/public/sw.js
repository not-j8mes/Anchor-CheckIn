// Installability-only service worker. It deliberately does not intercept fetches
// or cache authenticated application/API data.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
