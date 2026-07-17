// ====================================================
// STORAGE.JS — LƯU / TẢI TOÀN BỘ DỮ LIỆU
// (sản phẩm + vector đặc trưng đã train, dùng chung cho
//  lưu-file, nạp-file và đồng bộ GitHub)
// ====================================================

const saveDataBtn = document.querySelector("#save-data-btn");
const loadDataBtn = document.querySelector("#load-data-btn");
const loadDataInput = document.querySelector("#load-data-input");
const resetAllBtn = document.querySelector("#reset-all-btn");

// Đóng gói toàn bộ state hiện tại (sản phẩm + dataset đã train) thành 1 object
// có thể lưu ra file JSON hoặc đẩy lên GitHub.
function buildDataPayload() {
  const dataset = classifier.getClassifierDataset();
  const serializedDataset = {};
  for (const label in dataset) {
    serializedDataset[label] = {
      data: Array.from(dataset[label].dataSync()),
      shape: dataset[label].shape,
    };
  }
  return { products, nextProductId, classifierDataset: serializedDataset };
}

// Áp 1 payload (đọc từ file hoặc từ GitHub) ngược lại vào state đang chạy
function normalizeProduct(product) {
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
    photoCount: product.photoCount || 0,
    photos: product.photos || [],
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
  renderProductList();
  // renderProductList() ở trên gọi saveDataToLocalStorage(), việc này sẽ tự
  // bật hasUnsyncedChanges = true. Nhưng dữ liệu vừa nạp là từ GitHub/file
  // (tức đã "đồng bộ" rồi, không phải thay đổi cục bộ mới) nên phải tắt lại
  // ngay, nếu không lần tự-đồng-bộ tiếp theo sẽ bị chặn oan.
  hasUnsyncedChanges = false;
}

const LOCAL_STORAGE_KEY = "ai-product-scanner-data";
function saveDataToLocalStorage() {
  try {
    const payload = buildDataPayload();
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    hasUnsyncedChanges = true;
  } catch (err) {
    console.error("Lưu dữ liệu cục bộ thất bại:", err);
  }
}

function loadDataFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw);
    applyPayload(payload);
    toast("Đã tải dữ liệu cục bộ.");
    return true;
  } catch (err) {
    console.error("Tải dữ liệu cục bộ thất bại:", err);
    return false;
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
  toast("Đã tải dữ liệu thành công!");
});

// ====================================================
// XOÁ HẾT DỮ LIỆU
// ====================================================
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
