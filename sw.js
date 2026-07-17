// Service Worker - giúp app cài đặt được (PWA) và mở nhanh hơn lần sau
const CACHE_NAME = "sp-nha-cache-v2";
const APP_SHELL = [
  "./index.html",
  "./style.css",
  "./css/home.css",
  "./css/camera.css",
  "./css/admin.css",
  "./css/dashboard.css",
  "./css/notification.css",
  "./js/utils.js",
  "./js/storage.js",
  "./js/camera.js",
  "./js/barcode.js",
  "./js/ai.js",
  "./js/github.js",
  "./js/dashboard.js",
  "./js/notification.js",
  "./js/admin.js",
  "./js/ui.js",
  "./js/app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

// Chỉ cache các file "khung" của app (HTML/CSS/JS/icon).
// Các request khác (model AI, GitHub API, camera...) luôn lấy từ mạng.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isAppShellFile = APP_SHELL.some((f) =>
    url.pathname.endsWith(f.replace("./", "")),
  );

  if (isAppShellFile) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return (
          cached ||
          fetch(event.request).then((res) => {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
            return res;
          })
        );
      }),
    );
  }
  // các request khác: để mặc định đi thẳng ra mạng
});
