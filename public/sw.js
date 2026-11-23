const cacheName = "mesa-real-offline-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(cacheName)
      .then((cache) => cache.add("/offline.html"))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate" && event.request.method === "GET") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline.html")),
    );
  }
});
