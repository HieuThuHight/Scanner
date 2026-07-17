// ====================================================
// STORAGE.JS — LƯU / TẢI DỮ LIỆU CỤC BỘ
// (sản phẩm + vector đặc trưng đã train, dùng chung cho
// lưu-file, nạp-file, đồng bộ GitHub, và cache IndexedDB)
// ====================================================

const saveDataBtn = document.querySelector("#save-data-btn");
const loadDataBtn = document.querySelector("#load-data-btn");
const loadDataInput = document.querySelector("#load-data-input");
const resetAllBtn = document.querySelector("#reset-all-btn");

const LOCAL_STORAGE_KEY = "ai-product-scanner-data";
const DB_NAME = "sp-scanner-db";
const DB_VERSION = 1;
const META_STORE = "meta";
const IMAGE_STORE = "images";
const PRODUCT_DETAIL_DIR = "data/products";
let idbPromise = null;
const barcodeMap = new Map();

function productDetailPath(productId) {
  return `${PRODUCT_DETAIL_DIR}/${productId}.json`;
}

function getGithubRawResourceUrl(relativePath) {
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${relativePath}`;
}

function getRemoteImageUrl(path) {
  return getGithubRawResourceUrl(`data/${path}`);
}

function blobToBase64(blob) {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  });
}

async function fetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("fetchJson lỗi", err);
    return null;
  }
}

function openAppDatabase() {
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return idbPromise;
}

async function idbPut(storeName, key, value) {
  const db = await openAppDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.put({ key, value });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(storeName, key) {
  const db = await openAppDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result?.value);
    request.onerror = () => reject(request.error);
  });
}

async function idbDelete(storeName, key) {
  const db = await openAppDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function saveMeta(key, value) {
  try {
    await idbPut(META_STORE, key, value);
  } catch (err) {
    console.warn("Lưu meta vào IndexedDB thất bại:", err);
  }
}

async function loadMeta(key) {
  try {
    return await idbGet(META_STORE, key);
  } catch (err) {
    console.warn("Đọc meta từ IndexedDB thất bại:", err);
    return null;
  }
}

async function saveImageBlob(id, blob) {
  try {
    await idbPut(IMAGE_STORE, id, blob);
  } catch (err) {
    console.warn("Lưu ảnh vào IndexedDB thất bại:", err);
  }
}

async function getImageBlob(id) {
  try {
    return await idbGet(IMAGE_STORE, id);
  } catch (err) {
    console.warn("Đọc ảnh từ IndexedDB thất bại:", err);
    return null;
  }
}

async function deleteImageBlob(id) {
  try {
    await idbDelete(IMAGE_STORE, id);
  } catch (err) {
    console.warn("Xoá ảnh khỏi IndexedDB thất bại:", err);
  }
}

function normalizeProduct(product) {
  const photoPaths = Array.isArray(product.photoPaths)
    ? product.photoPaths.filter((item) => typeof item === "string")
    : Array.isArray(product.photos)
      ? product.photos.filter(
          (item) => typeof item === "string" && !isDataUrl(item),
        )
      : [];
  const photoCount = Number(product.photoCount || photoPaths.length || 0);
  return {
    id: product.id,
    name: product.name || "",
    code: product.code || "",
    qrCode: product.qrCode || "",
    price: product.price || "",
    category: product.category || "",
    notes: product.notes || "",
    status: product.status || "Thêm",
    createdAt: product.createdAt || new Date().toISOString(),
    photoCount,
    photoPaths,
    photos: Array.isArray(product.photos) ? product.photos : [],
  };
}

function getProductSummary(product) {
  const summary = normalizeProduct(product);
  delete summary.photoPaths;
  delete summary.photos;
  return summary;
}

function getProductDetailPayload(product) {
  return {
    id: product.id,
    photoPaths: Array.isArray(product.photoPaths) ? product.photoPaths : [],
    photoCount: Number(product.photoCount || 0),
  };
}

function buildIndexPayload() {
  const dataset = classifier.getClassifierDataset();
  const serializedDataset = {};
  for (const label in dataset) {
    serializedDataset[label] = {
      data: Array.from(dataset[label].dataSync()),
      shape: dataset[label].shape,
    };
  }

  const rawProducts = {};
  for (const id in products) {
    rawProducts[id] = getProductSummary(products[id]);
  }

  return {
    products: rawProducts,
    nextProductId,
    classifierDataset: serializedDataset,
  };
}

async function loadProductDetailFromGithub(productId) {
  const url = `${getGithubRawResourceUrl(productDetailPath(productId))}?t=${Date.now()}`;
  return await fetchJson(url);
}

async function ensureProductDetails(product) {
  if (
    !product ||
    (Array.isArray(product.photoPaths) && product.photoPaths.length)
  ) {
    return;
  }
  const detail = await loadProductDetailFromGithub(product.id);
  if (!detail) return;
  product.photoPaths = Array.isArray(detail.photoPaths)
    ? detail.photoPaths
    : [];
  product.photoCount = Number(
    detail.photoCount || product.photoPaths.length || 0,
  );
}

function updateBarcodeMap() {
  barcodeMap.clear();
  for (const id in products) {
    const product = products[id];
    if (!product) continue;
    if (product.code) barcodeMap.set(product.code, id);
    if (product.qrCode) barcodeMap.set(product.qrCode, id);
  }
}

function buildDataPayload() {
  const dataset = classifier.getClassifierDataset();
  const serializedDataset = {};
  for (const label in dataset) {
    serializedDataset[label] = {
      data: Array.from(dataset[label].dataSync()),
      shape: dataset[label].shape,
    };
  }

  const rawProducts = {};
  for (const id in products) {
    const product = normalizeProduct(products[id]);
    const outgoing = { ...product };
    outgoing.photos = Array.isArray(product.photoPaths)
      ? product.photoPaths
      : [];
    delete outgoing.photoPaths;
    rawProducts[id] = outgoing;
  }

  return {
    products: rawProducts,
    nextProductId,
    classifierDataset: serializedDataset,
  };
}

function applyPayload(payload) {
  const rawProducts = payload.products || {};
  products = {};
  for (const id in rawProducts) {
    products[id] = normalizeProduct(rawProducts[id]);
  }
  nextProductId = payload.nextProductId || 1;
  const dataset = {};
  for (const label in payload.classifierDataset || {}) {
    const { data, shape } = payload.classifierDataset[label];
    dataset[label] = tf.tensor(data, shape);
  }
  classifier.setClassifierDataset(dataset);
  updateBarcodeMap();
  renderProductList();
  hasUnsyncedChanges = false;
}

async function savePayloadToIndexedDB(payload) {
  try {
    await saveMeta(LOCAL_STORAGE_KEY, payload);
  } catch (err) {
    console.warn("Lưu payload vào IndexedDB thất bại:", err);
  }
}

async function loadPayloadFromIndexedDB() {
  try {
    return await loadMeta(LOCAL_STORAGE_KEY);
  } catch (err) {
    return null;
  }
}

async function saveDataToLocalStorage(markUnsynced = true) {
  try {
    const payload = buildDataPayload();
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    await savePayloadToIndexedDB(payload);
    if (markUnsynced) {
      hasUnsyncedChanges = true;
    }
  } catch (err) {
    console.error("Lưu dữ liệu cục bộ thất bại:", err);
  }
}

async function loadDataFromLocalStorage() {
  try {
    let payload = await loadPayloadFromIndexedDB();
    if (!payload) {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return false;
      payload = JSON.parse(raw);
    }
    applyPayload(payload);
    const migrated = await migrateAllDataUrlPhotos();
    if (migrated) await saveDataToLocalStorage(false);
    toast("Đã tải dữ liệu cục bộ.");
    return true;
  } catch (err) {
    console.error("Tải dữ liệu cục bộ thất bại:", err);
    return false;
  }
}

function dataURLToBlob(dataUrl) {
  const [metadata, raw] = dataUrl.split(",");
  const mime = metadata.match(/:(.*?);/)[1];
  const binary = atob(raw);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

async function saveProductPhoto(product, canvas) {
  if (!product) return null;
  const blob = await new Promise((resolve) => {
    canvas.toBlob(
      (b) =>
        resolve(
          b ||
            dataURLToBlob(
              canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY),
            ),
        ),
      "image/jpeg",
      PHOTO_JPEG_QUALITY,
    );
  });
  const photoPath = `images/products/${product.id}/${Date.now()}.jpg`;
  await saveImageBlob(photoPath, blob);
  product.photoPaths = product.photoPaths || [];
  product.photoPaths.push(photoPath);
  product.photoCount = product.photoPaths.length;
  product.photos = product.photos || [];
  product.photos.push(URL.createObjectURL(blob));
  return photoPath;
}

function isDataUrl(value) {
  return typeof value === "string" && value.startsWith("data:");
}

async function ensureProductPhotos(product) {
  if (!product) return [];
  await ensureProductDetails(product);
  if (Array.isArray(product.photos) && product.photos.length) {
    const hasDataUrl = product.photos.some(isDataUrl);
    if (!hasDataUrl) return product.photos;
    // Nếu còn dataURL cũ, di trú sang photoPaths trước khi dùng.
    await migrateProductDataUrls(product);
  }
  if (!Array.isArray(product.photoPaths) || product.photoPaths.length === 0) {
    return [];
  }
  const urls = [];
  for (const path of product.photoPaths) {
    const blob = await getImageBlob(path);
    if (blob) {
      urls.push(URL.createObjectURL(blob));
    } else {
      urls.push(getRemoteImageUrl(path));
    }
  }
  product.photos = urls;
  return urls;
}

async function migrateProductDataUrls(product) {
  if (!product || !Array.isArray(product.photos)) return false;
  const legacyPhotos = product.photos.filter(isDataUrl);
  if (legacyPhotos.length === 0) return false;

  product.photoRefs = product.photoRefs || [];
  for (const photo of legacyPhotos) {
    const blob = dataURLToBlob(photo);
    const photoPath = `images/products/${product.id}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.jpg`;
    await saveImageBlob(photoPath, blob);
    product.photoPaths.push(photoPath);
  }

  product.photoCount = product.photoPaths.length;
  product.photos = [];
  await ensureProductPhotos(product);
  return true;
}

async function migrateAllDataUrlPhotos() {
  let migrated = false;
  for (const id in products) {
    const product = products[id];
    if (!product || !Array.isArray(product.photos)) continue;
    const hasLegacyPhoto = product.photos.some(isDataUrl);
    if (!hasLegacyPhoto) continue;
    const changed = await migrateProductDataUrls(product);
    if (changed) migrated = true;
  }
  if (migrated) {
    updateBarcodeMap();
  }
  return migrated;
}

async function removeProductPhoto(product, index) {
  if (!product || !Array.isArray(product.photoPaths)) return;
  const path = product.photoPaths[index];
  if (!path) return;
  await deleteImageBlob(path);
  product.photoPaths.splice(index, 1);
  product.photoCount = product.photoPaths.length;
  if (Array.isArray(product.photos)) {
    product.photos.splice(index, 1);
  }
}

saveDataBtn.addEventListener("click", () => {
  const payload = buildDataPayload();
  const blob = new Blob([JSON.stringify(payload)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "du-lieu-san-pham.json";
  a.click();
  URL.revokeObjectURL(url);
  toast("Đã lưu toàn bộ dữ liệu ra file JSON!");
});

loadDataBtn.addEventListener("click", () => loadDataInput.click());

loadDataInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const payload = JSON.parse(text);
  applyPayload(payload);
  const migrated = await migrateAllDataUrlPhotos();
  if (migrated) await saveDataToLocalStorage(false);
  toast("Đã tải dữ liệu thành công!");
});

resetAllBtn.addEventListener("click", () => {
  const ok = confirm("Xoá TOÀN BỘ sản phẩm và dữ liệu đã train?");
  if (!ok) return;
  classifier.clearAllClasses();
  products = {};
  nextProductId = 1;
  lastTrainTime = null;
  renderProductList();
  toast("Đã xoá hết dữ liệu.");
});
