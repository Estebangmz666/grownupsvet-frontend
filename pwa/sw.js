import { isApiPath, isCacheableAssetRequest } from "./pwa/policy.mjs";

const CACHE_PREFIX = "grownupsvet-pwa-shell-";
const CACHE_NAME = `${CACHE_PREFIX}__PWA_CACHE_VERSION__`;
const PRECACHE_URL = "/pwa-precache.json";
const OFFLINE_DOCUMENT = "/index.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const response = await fetch(PRECACHE_URL, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`No se pudo cargar la lista PWA (${response.status}).`);
      }

      const urls = await response.json();
      if (
        !Array.isArray(urls) ||
        urls.some((value) => {
          if (typeof value !== "string") return true;
          const url = new URL(value, self.location.origin);
          return (
            url.origin !== self.location.origin ||
            url.search !== "" ||
            isApiPath(url.pathname)
          );
        })
      ) {
        throw new Error(
          "La lista de precarga PWA contiene rutas no permitidas.",
        );
      }

      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(urls);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(
            (cacheName) =>
              cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME,
          )
          .map((cacheName) => caches.delete(cacheName)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    isApiPath(url.pathname)
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedShell = await caches.match(OFFLINE_DOCUMENT);
        if (!cachedShell) {
          throw new Error(
            "El shell offline de GrownupsVet no está disponible.",
          );
        }
        return cachedShell;
      }),
    );
    return;
  }

  if (isCacheableAssetRequest(request, self.location.origin)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;

        const response = await fetch(request);
        if (
          response.ok &&
          response.type === "basic" &&
          !response.headers.get("cache-control")?.includes("no-store")
        ) {
          await cache.put(request, response.clone());
        }
        return response;
      })(),
    );
  }
});
