// ====================================================
// UI.JS — ĐIỀU KHIỂN GIAO DIỆN: MENU, CHUYỂN MÀN HÌNH,
// ĐIỀU PHỐI TẮT CAMERA/SCANNER KHI CHUYỂN CHẾ ĐỘ
// ====================================================

const publicResult = document.querySelector("#public-result");

const homeView = document.querySelector("#home-view");
const cameraView = document.querySelector("#camera-view");
const backBtn = document.querySelector("#back-btn");

const modeScanBtn = document.querySelector("#mode-scan-btn");

const menuBtn = document.querySelector("#menu-btn");
const sideMenu = document.querySelector("#side-menu");
const menuOverlay = document.querySelector("#menu-overlay");
const closeMenuBtn = document.querySelector("#close-menu-btn");

// ====================================================
// MENU TRƯỢT
// ====================================================
function openMenu() {
  sideMenu.classList.remove("hidden");
  menuOverlay.classList.remove("hidden");
}
function closeMenu() {
  sideMenu.classList.add("hidden");
  menuOverlay.classList.add("hidden");
  loginBox.classList.add("hidden");
}
menuBtn.addEventListener("click", openMenu);
closeMenuBtn.addEventListener("click", closeMenu);
menuOverlay.addEventListener("click", closeMenu);

// ====================================================
// ĐIỀU PHỐI: TẮT HẾT CAMERA / SCANNER / PANEL ĐANG MỞ
// (dùng chung mỗi khi chuyển màn hình hoặc đổi chế độ)
// ====================================================
async function stopAllModes() {
  recognizeLoopRunning = false;
  closeCamera();
  await closeScanner();
  restoreVideoToDefault();
  restoreReaderToDefault();
  if (publicCaptureRow) publicCaptureRow.classList.add("hidden");
  if (publicScanRetryRow) publicScanRetryRow.classList.add("hidden");
  adminCapturePanel.classList.add("hidden");
  adminScanPanel.classList.add("hidden");
  if (adminCapturePreview) adminCapturePreview.classList.add("hidden");
  if (adminScanPreview) adminScanPreview.classList.add("hidden");
  // Huỷ ảnh/mã đang chờ xác nhận nếu người dùng thoát ngang giữa chừng
  if (typeof pendingSnapshot !== "undefined" && pendingSnapshot) {
    pendingSnapshot.tensor.dispose();
    pendingSnapshot = null;
  }
  if (typeof pendingScanCode !== "undefined") {
    pendingScanCode = null;
  }
  if (typeof hideResultCard === "function") hideResultCard();
  mode = "idle";
  activeProductId = null;
}

// ====================================================
// CHUYỂN QUA LẠI GIỮA HOME / CAMERA / ADMIN
// ====================================================
function showHome() {
  homeView.classList.remove("hidden");
  cameraView.classList.add("hidden");
  adminTab.classList.add("hidden");
}
function showCameraView() {
  homeView.classList.add("hidden");
  cameraView.classList.remove("hidden");
  adminTab.classList.add("hidden");
}
function showAdmin() {
  homeView.classList.add("hidden");
  cameraView.classList.add("hidden");
  adminTab.classList.remove("hidden");
  // Hiển thị dashboard view mặc định
  if (typeof showDashboardView === "function") {
    showDashboardView();
  }
  renderProductList();
}

backBtn.addEventListener("click", async () => {
  await stopAllModes();
  showHome();
});

// ====================================================
// QUÉT MÃ (nút to ở trang chủ) — dùng barcode.js
// ====================================================
modeScanBtn.addEventListener("click", async () => {
  await stopAllModes();
  showCameraView();
  publicResult.textContent = "Đang mở máy quét...";
  try {
    await startPublicScan();
  } catch (err) {
    publicResult.textContent = "";
    toast(friendlyCameraError(err), true);
    showHome();
  }
});
