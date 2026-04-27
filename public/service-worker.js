/* simple service worker para MiningSoft */

const CACHE_NAME = "miningsoft-v2";


// Rutas mínimas que queremos tener cacheadas
const URLS_TO_CACHE = [
  "/",
  "/admin",
  "/solicitudes"
];


self.addEventListener("install", (event) => {
  console.log("[SW] Install");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activate");
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      )
    )
  );
});

// Estrategia cache-first para contenido estático básico
self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // No interceptar llamadas a /api ni a otros dominios
  if (url.includes("/api/")) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => cachedResponse);
    })
  );
});
