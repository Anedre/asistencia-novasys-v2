/* Novasys Asistencia — service worker.
 * Conservative on purpose: network-first, no aggressive precaching, so it never
 * serves stale app code or attendance data. Provides an offline fallback for
 * page navigations and makes the app installable.
 */
const SHELL_CACHE = "nova-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop old shell caches from previous versions.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never cache API or auth traffic — always hit the network.
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/_next/data")) return;

  // Page navigations: network-first, fall back to the last good page when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          const cached = await cache.match(request);
          return cached || (await cache.match("/")) || Response.error();
        }
      })()
    );
  }
});
