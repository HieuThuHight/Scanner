// Service Worker - giúp app cài đặt được (PWA) và mở nhanh hơn lần sau
//
// LƯU Ý: mỗi khi deploy code mới (sửa app.js, github.js...) hãy TĂNG số ở
// cuối CACHE_NAME (v3 -> v4 -> v5...). Nếu không đổi, các thiết bị đã cài
// PWA/đã từng mở trang có thể tiếp tục chạy bản JS CŨ mãi mãi (vì chiến
// lược bên dưới có phần cache-first cho ảnh/icon), gây ra tình trạng "sửa
// code rồi mà web vẫn chạy như cũ" rất khó phát hiện.
const VERSION = "2.2.0";
const CACHE_NAME = `scanner-cache-${VERSION}`;

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
];
// Icon gần như không đổi -> vẫn cache-first cho nhẹ
const CACHE_FIRST_ASSETS = ["./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll([...APP_SHELL, ...CACHE_FIRST_ASSETS])),
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

// Chiến lược:
// - File "khung" app (HTML/CSS/JS): NETWORK-FIRST. Luôn thử lấy bản mới nhất
//   từ mạng trước; chỉ dùng bản cache khi mất mạng. Nhờ vậy sửa code (vd:
//   đổi GITHUB_OWNER/GITHUB_REPO trong app.js) sẽ có hiệu lực ngay ở lần
//   tải trang tiếp theo, không bị kẹt ở bản cũ như trước đây.
// - Icon + dữ liệu GitHub raw (index/detail/ảnh sản phẩm): CACHE-FIRST để
//   tải nhanh và dùng offline được, ít khi đổi.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const pathname = url.pathname;
  const isAppShellFile = APP_SHELL.some((f) =>
    pathname.endsWith(f.replace("./", "")),
  );
  const isCacheFirstAsset = CACHE_FIRST_ASSETS.some((f) =>
    pathname.endsWith(f.replace("./", "")),
  );
  const isGithubRawData =
    url.hostname === "raw.githubusercontent.com" &&
    (pathname.endsWith("data/products-index.json") ||
      pathname.includes("/data/products/") ||
      pathname.includes("/data/images/products/"));

  if (isAppShellFile) {
    // NETWORK-FIRST
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.status === 200 && res.type !== "opaque") {
            const resClone = res.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, resClone));
          }
          return res;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  if (isCacheFirstAsset || isGithubRawData) {
    // CACHE-FIRST
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
