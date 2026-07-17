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
    caches
      .keys()
      .then((keys) =>
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
// Ngoài ra cache thêm index/detail/image từ GitHub raw để tải nhanh và offline tốt hơn.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const pathname = url.pathname;
  const isAppShellFile = APP_SHELL.some((f) =>
    pathname.endsWith(f.replace("./", "")),
  );
  const isGithubRawData =
    url.hostname === "raw.githubusercontent.com" &&
    (pathname.endsWith("data/products-index.json") ||
      pathname.includes("/data/products/") ||
      pathname.includes("/data/images/products/"));

  if (isAppShellFile || isGithubRawData) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((res) => {
            if (!res || res.status !== 200 || res.type === "opaque") {
              return res;
            }
            const resClone = res.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, resClone));
            return res;
          })
          .catch(() => cached || Promise.reject("Network error"));
      }),
    );
  }
});
