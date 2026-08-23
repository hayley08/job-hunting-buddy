const CACHE_NAME = "hayley-campus-os-v2-20260823-2";
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/app/app.js",
  "/app/store.js",
  "/app/filters.js",
  "/app/styles.css",
  "/manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/data/") && url.pathname.endsWith(".json")) {
    event.respondWith(networkFirst(event.request, { bypassCache: true }));
    return;
  }

  if (event.request.mode === "navigate" || isShellAsset(url.pathname)) {
    event.respondWith(networkFirst(event.request, { bypassCache: true }));
  }
});

function isShellAsset(pathname) {
  return pathname === "/" ||
    pathname === "/index.html" ||
    pathname === "/manifest.json" ||
    pathname.startsWith("/app/");
}

async function networkFirst(request, { bypassCache = false } = {}) {
  const cache = await caches.open(CACHE_NAME);
  const cacheKey = normalizedCacheKey(request);
  try {
    const response = await fetch(request, bypassCache ? { cache: "no-store" } : undefined);
    if (response.ok) await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    throw error;
  }
}

function normalizedCacheKey(request) {
  const url = new URL(request.url);
  url.search = "";
  return new Request(url.toString(), { method: "GET" });
}
