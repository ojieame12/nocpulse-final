const STATIC_CACHE = "fieldpulse-static-v1";
const RUNTIME_CACHE = "fieldpulse-runtime-v1";
const OFFLINE_FALLBACK_URL = "/offline";
const STATIC_ASSETS = [
  OFFLINE_FALLBACK_URL,
  "/logo.svg",
  "/logo-light.svg",
  "/nocpulse-logo.png",
  "/nDwUq.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        return (await caches.match(OFFLINE_FALLBACK_URL)) || Response.error();
      }),
    );
    return;
  }

  const isStaticAsset =
    requestUrl.pathname.startsWith("/_next/static/")
    || requestUrl.pathname.startsWith("/images/")
    || requestUrl.pathname.startsWith("/fonts/")
    || STATIC_ASSETS.includes(requestUrl.pathname);

  if (!isStaticAsset) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            void caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    }),
  );
});
