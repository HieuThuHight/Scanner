// ====================================================
// AI.JS — NHẬN DIỆN ẢNH (MobileNet + KNN Classifier)
// ====================================================

const modeRecognizeBtn = document.querySelector("#mode-recognize-btn");

const adminCapturePanel = document.querySelector("#admin-capture-panel");
const adminCaptureTitle = document.querySelector("#admin-capture-title");
const adminVideoWrap = document.querySelector("#admin-video-wrap");
const adminCaptureStatus = document.querySelector("#admin-capture-status");
const adminCaptureBtn = document.querySelector("#admin-capture-btn");
const adminUndoBtn = document.querySelector("#admin-undo-btn");
const adminCaptureClose = document.querySelector("#admin-capture-close");

const captureCanvas = document.querySelector("#capture-canvas");
const adminCapturePreview = document.querySelector("#admin-capture-preview");
const adminCapturePreviewImg = document.querySelector("#admin-capture-preview-img");
const adminConfirmBtn = document.querySelector("#admin-confirm-btn");
const adminRetakeBtn = document.querySelector("#admin-retake-btn");
const adminCaptureControls = document.querySelector("#admin-capture-controls");
const adminThumbGrid = document.querySelector("#admin-thumb-grid");

// Ảnh vừa chụp, đang chờ admin xác nhận "Lưu" hay "Chụp lại"
let pendingSnapshot = null; // { tensor, dataUrl }

// ====================================================
// NHẬN DIỆN QUA ẢNH — KIỂU CHỤP (dành cho người dùng thường)
// Người dùng bấm "Chụp để nhận diện" -> chụp đúng 1 khung hình
// -> phân tích -> hiện kết quả. Có thể bấm chụp lại nhiều lần.
// (Trước đây quét liên tục theo từng frame bằng requestAnimationFrame,
//  dễ lỗi/tốn pin, và có bug tensor bị dispose sớm — đã bỏ cách đó.)
// ====================================================
const publicCaptureRow = document.querySelector("#public-capture-row");
const publicCaptureBtn = document.querySelector("#public-capture-btn");
const publicCaptureCanvas = document.querySelector("#public-capture-canvas");

// Bảng thông tin sản phẩm hiện ra sau khi nhận diện xong
const publicResultCard = document.querySelector("#public-result-card");
const resultCardBadge = document.querySelector("#result-card-badge");
const resultCardName = document.querySelector("#result-card-name");
const resultCardPrice = document.querySelector("#result-card-price");
const resultCardCategory = document.querySelector("#result-card-category");
const resultCardNotes = document.querySelector("#result-card-notes");
const resultCardCode = document.querySelector("#result-card-code");
const resultRetakeBtn = document.querySelector("#result-retake-btn");

function hideResultCard() {
  if (!publicResultCard) return;
  publicResultCard.classList.add("hidden");
  publicResultCard.classList.remove("low-confidence", "not-found");
}

// Đổ dữ liệu 1 sản phẩm ra bảng thông tin. status: "found" | "low" | "not-found"
function showResultCard(status, { name, product, confidence, decodedCode } = {}) {
  if (!publicResultCard) return;
  publicResultCard.classList.remove("hidden", "low-confidence", "not-found");

  if (status === "found") {
    resultCardBadge.textContent = `✅ Đã nhận diện (${confidence}%)`;
    resultCardBadge.className = "result-badge";
  } else if (status === "low") {
    publicResultCard.classList.add("low-confidence");
    resultCardBadge.textContent = `🤔 Không chắc chắn (${confidence}%)`;
    resultCardBadge.className = "result-badge low";
  } else {
    publicResultCard.classList.add("not-found");
    resultCardBadge.textContent = "❌ Không tìm thấy sản phẩm";
    resultCardBadge.className = "result-badge not-found";
  }

  resultCardName.textContent = name || "Không xác định";
  resultCardPrice.textContent = product?.price || "";
  resultCardCategory.textContent = product?.category || "";
  resultCardNotes.textContent = product?.notes || "";
  resultCardCode.textContent = (product?.code || decodedCode) || "";
}

if (resultRetakeBtn) {
  resultRetakeBtn.addEventListener("click", () => {
    hideResultCard();
    if (mode === "public-recognize") {
      publicResult.textContent = "Đưa sản phẩm vào khung hình rồi bấm Chụp";
      publicCaptureBtn.disabled = false;
      publicCaptureBtn.textContent = "📸 Chụp để nhận diện";
    } else if (mode === "public-scan" && typeof publicScanRetryBtn !== "undefined") {
      publicScanRetryBtn.click();
    }
  });
}

modeRecognizeBtn.addEventListener("click", async () => {
  await stopAllModes();
  showCameraView();
  hideResultCard();
  publicResult.textContent = "Đang mở camera...";
  try {
    mode = "public-recognize";
    await openCamera();
    publicCaptureBtn.disabled = false;
    publicCaptureBtn.textContent = "📸 Chụp để nhận diện";
    publicCaptureRow.classList.remove("hidden");
    publicResult.textContent =
      classifier.getNumClasses() > 0
        ? "Đưa sản phẩm vào khung hình rồi bấm Chụp"
        : "Chưa có sản phẩm nào được train trong Admin.";
  } catch (err) {
    publicResult.textContent = "";
    toast(friendlyCameraError(err), true);
    showHome();
  }
});

publicCaptureBtn.addEventListener("click", async () => {
  if (mode !== "public-recognize" || !cameraStream) return;

  if (classifier.getNumClasses() === 0) {
    publicResult.textContent = "Chưa có sản phẩm nào được train trong Admin.";
    return;
  }

  publicCaptureBtn.disabled = true;
  publicCaptureBtn.textContent = "⏳ Đang nhận diện...";
  publicResult.textContent = "Đang phân tích ảnh vừa chụp...";
  hideResultCard();

  try {
    // Chụp đúng 1 khung hình hiện tại của video ra canvas
    publicCaptureCanvas.width = video.videoWidth || 320;
    publicCaptureCanvas.height = video.videoHeight || 320;
    publicCaptureCanvas
      .getContext("2d")
      .drawImage(video, 0, 0, publicCaptureCanvas.width, publicCaptureCanvas.height);

    // QUAN TRỌNG: chỉ bọc tf.tidy quanh phần ĐỒNG BỘ (infer).
    // predictClass là hàm bất đồng bộ (trả Promise) nên KHÔNG được đặt trong
    // tf.tidy — nếu không tensor "activation" sẽ bị huỷ trước khi predictClass
    // kịp dùng, gây nhận diện sai/lỗi ngầm (đây là lỗi gốc của bản cũ).
    const activation = tf.tidy(() =>
      mobilenetModel.infer(publicCaptureCanvas, true),
    );
    const result = await classifier.predictClass(activation);
    activation.dispose();

    const confidence = Math.round(result.confidences[result.label] * 100);
    const product = products[result.label];
    const name = product ? product.name : result.label;

    publicResult.textContent = "";
    showResultCard(confidence < 55 ? "low" : "found", {
      name,
      product,
      confidence,
    });
  } catch (err) {
    console.error(err);
    publicResult.textContent = "Có lỗi khi nhận diện, hãy thử chụp lại.";
  } finally {
    publicCaptureBtn.disabled = false;
    publicCaptureBtn.textContent = "📸 Chụp lại";
  }
});

// ====================================================
// ADMIN - CHỤP ẢNH TRAIN CHO 1 SẢN PHẨM
// ====================================================
async function startAdminCapture(product) {
  await stopAllModes();
  mode = "admin-capture";
  activeProductId = product.id;
  if (!product.photos) product.photos = []; // ảnh thumbnail để xem lại (không phải vector AI)
  adminCapturePanel.classList.remove("hidden");
  adminCaptureTitle.textContent = `Chụp ảnh cho: ${product.name}`;
  moveVideoTo(adminVideoWrap);
  hideCapturePreview();
  updateAdminCaptureBtn();
  renderThumbGrid();
  try {
    await openCamera();
  } catch (err) {
    toast(friendlyCameraError(err), true);
    adminCapturePanel.classList.add("hidden");
    mode = "idle";
  }
}

// Trạng thái + khoá/mở nút chụp tuỳ đã đủ ảnh hay chưa
function updateAdminCaptureBtn() {
  const product = products[activeProductId];
  if (!product) return;
  adminCaptureBtn.textContent = `📸 Chụp (${product.photoCount}/${MAX_PHOTOS_PER_PRODUCT})`;
  adminCaptureBtn.disabled = product.photoCount >= MAX_PHOTOS_PER_PRODUCT;
  adminUndoBtn.disabled = product.photoCount <= 0;
  adminCaptureStatus.textContent =
    product.photoCount >= MAX_PHOTOS_PER_PRODUCT
      ? `✅ Đã đủ ${MAX_PHOTOS_PER_PRODUCT}/${MAX_PHOTOS_PER_PRODUCT} ảnh`
      : `Đã chụp ${product.photoCount}/${MAX_PHOTOS_PER_PRODUCT} ảnh`;
}

// Vẽ lưới thumbnail các ảnh đã chụp cho sản phẩm đang mở, có nút xoá từng ảnh
function renderThumbGrid() {
  const product = products[activeProductId];
  if (!product || !adminThumbGrid) return;
  const photos = product.photos || [];
  if (photos.length === 0) {
    adminThumbGrid.innerHTML =
      "<small style='color:#6b7280;'>Chưa có ảnh nào, bấm Chụp để bắt đầu.</small>";
    return;
  }
  adminThumbGrid.innerHTML = photos
    .map(
      (src, i) => `
      <div class="thumb">
        <img src="${src}" alt="Ảnh ${i + 1}" />
        <button class="small danger" data-thumb-index="${i}"
          style="position:absolute;top:2px;right:2px;padding:2px 6px;">✕</button>
      </div>`,
    )
    .join("");
}

adminThumbGrid.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-thumb-index]");
  if (!btn) return;
  const product = products[activeProductId];
  if (!product) return;
  removePhotoAt(product, Number(btn.dataset.thumbIndex));
  updateAdminCaptureBtn();
  renderThumbGrid();
  renderProductList();
  renderDashboard();
});

function hideCapturePreview() {
  adminCapturePreview.classList.add("hidden");
  adminCaptureControls.classList.remove("hidden");
}

// ====================================================
// BƯỚC 1: CHỤP -> hiện ảnh vừa chụp để xem trước
// (chưa lưu vào classifier, chưa tính vào photoCount)
// ====================================================
adminCaptureBtn.addEventListener("click", () => {
  const product = products[activeProductId];
  if (!product || product.photoCount >= MAX_PHOTOS_PER_PRODUCT) return;

  // Chụp khung hình hiện tại của video ra ảnh xem trước (thumbnail)
  captureCanvas.width = 240;
  captureCanvas.height = (video.videoHeight / video.videoWidth) * 240 || 240;
  const ctx = captureCanvas.getContext("2d");
  ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
  const dataUrl = captureCanvas.toDataURL("image/jpeg", 0.7);

  // Tính vector đặc trưng AI ngay tại thời điểm chụp (giữ tensor chờ xác nhận)
  const tensor = tf.tidy(() => mobilenetModel.infer(video, true));

  pendingSnapshot = { tensor, dataUrl };
  adminCapturePreviewImg.src = dataUrl;
  adminCapturePreview.classList.remove("hidden");
  adminCaptureControls.classList.add("hidden");
});

// ====================================================
// BƯỚC 2a: XÁC NHẬN -> mới thật sự lưu vào classifier + thumbnail
// ====================================================
adminConfirmBtn.addEventListener("click", () => {
  const product = products[activeProductId];
  if (!product || !pendingSnapshot) return;

  classifier.addExample(pendingSnapshot.tensor, product.id);
  pendingSnapshot.tensor.dispose();
  if (!product.photos) product.photos = [];
  product.photos.push(pendingSnapshot.dataUrl);
  product.photoCount++;
  pendingSnapshot = null;

  hideCapturePreview();
  updateAdminCaptureBtn();
  renderThumbGrid();
  renderProductList();
  markTrained();
  addNotification(`📸 Đã lưu ảnh cho "${product.name}"`, "success");
  if (product.photoCount >= MAX_PHOTOS_PER_PRODUCT) {
    addNotification(`🤖 Train thành công cho "${product.name}"`, "success");
  }
  renderDashboard();
  toast(
    `Đã lưu ảnh cho "${product.name}" (${product.photoCount}/${MAX_PHOTOS_PER_PRODUCT})`,
  );
});

// ====================================================
// BƯỚC 2b: CHỤP LẠI -> huỷ ảnh vừa chụp, quay lại camera để chụp tiếp
// ====================================================
adminRetakeBtn.addEventListener("click", () => {
  if (pendingSnapshot) {
    pendingSnapshot.tensor.dispose();
    pendingSnapshot = null;
  }
  hideCapturePreview();
  toast("Đã huỷ ảnh, chụp lại nhé!");
});

// Xoá 1 ảnh bất kỳ (theo vị trí) khỏi classifier + danh sách thumbnail của sản phẩm
function removePhotoAt(product, index) {
  const dataset = classifier.getClassifierDataset();
  const tensor = dataset[product.id];
  if (!tensor) return;

  const total = tensor.shape[0];
  if (index < 0 || index >= total) return;

  if (total <= 1) {
    tensor.dispose();
    delete dataset[product.id];
  } else {
    const parts = [];
    if (index > 0) parts.push(tensor.slice([0, 0], [index, tensor.shape[1]]));
    if (index < total - 1)
      parts.push(
        tensor.slice([index + 1, 0], [total - index - 1, tensor.shape[1]]),
      );
    const merged = tf.tidy(() => tf.concat(parts, 0));
    parts.forEach((p) => p.dispose());
    tensor.dispose();
    dataset[product.id] = merged;
  }
  classifier.setClassifierDataset(dataset);

  if (product.photos) product.photos.splice(index, 1);
  product.photoCount = Math.max(0, product.photoCount - 1);
  toast(`Đã xoá 1 ảnh của "${product.name}"`);
}

// Nút "Hoàn tác ảnh vừa chụp" = xoá nhanh tấm ảnh cuối cùng
adminUndoBtn.addEventListener("click", () => {
  const product = products[activeProductId];
  if (!product || product.photoCount <= 0) return;
  removePhotoAt(product, product.photoCount - 1);
  updateAdminCaptureBtn();
  renderThumbGrid();
  renderProductList();
  renderDashboard();
});

adminCaptureClose.addEventListener("click", async () => {
  const product = products[activeProductId];
  if (pendingSnapshot) {
    pendingSnapshot.tensor.dispose();
    pendingSnapshot = null;
  }
  await stopAllModes();
  checkProductWarnings(product);
});

// ====================================================
// HUẤN LUYỆN LẠI (làm mới model từ dữ liệu ảnh đang có)
// ====================================================
const retrainBtn = document.querySelector("#retrain-btn");
if (retrainBtn) {
  retrainBtn.addEventListener("click", () => {
    if (classifier.getNumClasses() === 0) {
      toast("Chưa có ảnh nào để train!", true);
      return;
    }
    markTrained();
    addNotification("🤖 Train thành công", "success");
    renderDashboard();
    toast("Đã huấn luyện lại model thành công!");
  });
}
