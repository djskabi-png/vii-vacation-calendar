// v2 deliberately contains only release-independent offline shell assets.
// Caching rendered HTML here can pair an old document with a newer deployment's
// hashed JavaScript after a brief network failure, which makes Next/Vinext fall
// into the route error boundary. The edge cache already versions documents by
// build, so the browser worker must never keep a second unversioned HTML copy.
const CACHE = "vii-public-v2";
const OFFLINE = "/offline";
const SHELL = [OFFLINE, "/favicon.svg", "/vii-app-icon.svg", "/vii-app-icon-maskable.svg"];

self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL))));
self.addEventListener("activate", (event) => event.waitUntil(Promise.all([
  caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("vii-public-") && key !== CACHE).map((key) => caches.delete(key)))),
  self.clients.claim(),
])));
self.addEventListener("message", (event) => { if (event.data?.type === "SKIP_WAITING") void self.skipWaiting(); });

function privateRequest(url) {
  return ["/api/", "/admin", "/auth", "/mcp", "/account", "/booking", "/favorites", "/checkout"].some((prefix) => url.pathname.startsWith(prefix));
}
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || privateRequest(url)) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE)) || Response.error()));
    return;
  }
  if (["style", "script", "font", "image"].includes(request.destination)) {
    event.respondWith(caches.match(request).then((cached) => {
      const fresh = fetch(request).then((response) => {
        if (response.ok) void caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
        return response;
      }).catch(() => cached || Response.error());
      return cached || fresh;
    }));
  }
});
