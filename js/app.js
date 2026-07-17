// ====================================================
// APP.JS — CẤU HÌNH, STATE DÙNG CHUNG & KHỞI ĐỘNG HỆ THỐNG
// (Các file js/khác.js đều dựa vào state khai báo ở đây)
// ====================================================

// ====== CẤU HÌNH ======
const MAX_PHOTOS_PER_PRODUCT = 10; // mỗi sản phẩm train tối đa 10 ảnh
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123"; // DEMO ONLY - không dùng cho sản phẩm thật

// ====== CẤU HÌNH ĐỒNG BỘ GITHUB ======
const GITHUB_OWNER = "HieuThuHight";
const GITHUB_REPO = "Scanner";
const GITHUB_PATH = "data/products.json";
const GITHUB_BRANCH = "main";
const GITHUB_CONFIGURED =
  GITHUB_OWNER !== "ten-tai-khoan-github-cua-ban" &&
  GITHUB_REPO !== "ten-repo-luu-du-lieu";

// ====== STATE DÙNG CHUNG (các module khác đọc/ghi trực tiếp biến này) ======
let products = {};
let nextProductId = 1;
let isAdmin = false;
// true = có thay đổi cục bộ (thêm/sửa/xoá sản phẩm, train ảnh...) CHƯA được
// đẩy lên GitHub. Dùng để chặn việc tự động tải (pull) dữ liệu cũ từ GitHub
// đè mất các thay đổi này trước khi admin kịp bấm "Đồng bộ lên GitHub"
// (đây chính là nguyên nhân gây mất sạch dữ liệu ở cả local lẫn GitHub).
let hasUnsyncedChanges = false;
let mobilenetModel;
let classifier;
let html5QrCode;

// mode: "idle" | "public-recognize" | "public-scan" | "admin-capture" | "admin-scan"
let mode = "idle";
let activeProductId = null;
let recognizeLoopRunning = false;
let cameraStream = null;

// ====== DOM DÙNG Ở NHIỀU NƠI ======
const loadingScreen = document.querySelector("#loading-screen");
const loadingText = document.querySelector("#loading-text");
const statusBanner = document.querySelector("#status-banner");

// ====================================================
// KHỞI ĐỘNG: MÀN HÌNH LOADING -> TẢI MODEL -> HIỆN APP
// ====================================================
// Tải mobilenet có thử lại (retry) vì host model mặc định của thư viện
// (storage.googleapis.com -> redirect sang link ký sẵn trên Kaggle) thỉnh
// thoảng bị đóng kết nối giữa chừng (ERR_CONNECTION_CLOSED), không phải lỗi
// từ code của app. Thử lại vài lần với độ trễ tăng dần thường sẽ qua được.
async function loadMobilenetWithRetry(config, maxAttempts = 4) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        loadingText.textContent = `Đang tải model nhận diện... (thử lại lần ${attempt}/${maxAttempts})`;
      }
      return await mobilenet.load(config);
    } catch (err) {
      lastErr = err;
      console.warn(`Tải mobilenet thất bại (lần ${attempt}/${maxAttempts}):`, err);
      if (attempt < maxAttempts) {
        // Chờ tăng dần: 1s, 2s, 4s... để tránh spam ngay lúc mạng/host đang lỗi
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)));
      }
    }
  }
  throw lastErr;
}

async function init() {
  try {
    classifier = knnClassifier.create();

    loadingText.textContent = "Đang tải model nhận diện...";
    // Trước đây dùng alpha:0.25 (bản siêu nhẹ) để chạy vừa mọi khung hình liên tục.
    // Giờ chỉ suy luận 1 lần mỗi khi bấm "Chụp" nên dùng bản alpha:1 để nhận diện chính xác hơn.
    try {
      mobilenetModel = await loadMobilenetWithRetry({ version: 1, alpha: 1 });
    } catch (err) {
      // Host model chính (qua Kaggle) vẫn lỗi sau nhiều lần thử -> thử bản
      // alpha nhỏ hơn, vì nó được lưu ở một model id/host khác trên Kaggle
      // nên có thể không gặp cùng sự cố.
      console.warn("Không tải được mobilenet alpha:1, thử alpha:0.75...", err);
      loadingText.textContent = "Model chính đang lỗi, đang thử bản dự phòng...";
      mobilenetModel = await loadMobilenetWithRetry({ version: 1, alpha: 0.75 });
    }

    loadingText.textContent = "Đang tải dữ liệu cục bộ...";
    loadDataFromLocalStorage();

    if (GITHUB_CONFIGURED) {
      loadingText.textContent = "Đang lấy dữ liệu mới nhất...";
      await pullFromGithub(false);
    }

    // Render (và lưu lại) SAU khi dữ liệu thật (local hoặc GitHub) đã nạp
    // xong — không được gọi sớm hơn, nếu không sẽ vô tình lưu đè một bản
    // dữ liệu rỗng vào localStorage/GitHub trước khi kịp tải dữ liệu thật.
    renderProductList();

    loadingScreen.classList.add("hidden");
    modeRecognizeBtn.disabled = false;
  } catch (err) {
    console.error(err);
    loadingText.textContent =
      "Lỗi khi tải model nhận diện (máy chủ model của Google/Kaggle đang chập chờn). " +
      "Vui lòng kiểm tra kết nối mạng rồi bấm F5 để tải lại trang. Nếu vẫn lỗi, đợi vài phút rồi thử lại.";
  }
}

// ====================================================
// PWA - CÀI ĐẶT APP TỪ TRÌNH DUYỆT
// ====================================================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .catch((err) => console.error("Lỗi đăng ký service worker:", err));
  });
}

let deferredInstallPrompt = null;
const installAppBtn = document.querySelector("#install-app-btn");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  installAppBtn.classList.remove("hidden");
});

installAppBtn.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === "accepted") toast("Đã cài đặt app!");
  deferredInstallPrompt = null;
  installAppBtn.classList.add("hidden");
});

window.addEventListener("appinstalled", () => {
  installAppBtn.classList.add("hidden");
  toast("Cài đặt thành công! Mở app từ màn hình chính nhé.");
});

// Cảnh báo nếu đóng tab / tải lại trang khi admin còn thay đổi chưa đẩy lên
// GitHub — dữ liệu lúc này chỉ nằm trong localStorage của trình duyệt này.
window.addEventListener("beforeunload", (e) => {
  if (isAdmin && hasUnsyncedChanges) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// ====================================================
// TỰ ĐỘNG ĐỒNG BỘ LẠI KHI: (1) quay lại tab đang mở sẵn,
// (2) trình duyệt vừa có mạng trở lại — không cần F5.
// ====================================================
let isAutoSyncing = false;
let lastAutoSyncAt = 0;
const AUTO_SYNC_MIN_INTERVAL_MS = 10000; // tránh gọi dồn dập nhiều lần liên tiếp

async function autoSyncFromGithub(showToast) {
  if (!GITHUB_CONFIGURED) return;
  if (isAutoSyncing) return; // đang có 1 lượt đồng bộ chạy rồi, không chạy chồng
  if (Date.now() - lastAutoSyncAt < AUTO_SYNC_MIN_INTERVAL_MS) return;

  // An toàn: nếu admin đang chụp/train ảnh dở dang thì không tự ý ghi đè
  // dữ liệu local bằng bản trên GitHub, tránh mất dữ liệu chưa lưu.
  if (isAdmin && mode !== "idle") return;

  // An toàn (quan trọng): nếu admin vừa thêm/sửa/xoá sản phẩm nhưng CHƯA bấm
  // "Đồng bộ lên GitHub" thì tuyệt đối không tự tải bản cũ từ GitHub về đè
  // lên — vì renderProductList() sẽ tự lưu đè bản cũ đó vào localStorage
  // ngay, xoá mất thay đổi vừa làm trước khi kịp đẩy lên GitHub, rồi lần đẩy
  // sau sẽ đẩy luôn bản rỗng/cũ đó lên GitHub -> mất dữ liệu ở cả 2 nơi.
  if (isAdmin && hasUnsyncedChanges) {
    if (showToast) {
      toast(
        "Bạn có thay đổi chưa đồng bộ lên GitHub — hãy bấm ☁️ Đồng bộ lên GitHub trước để không bị mất.",
        true,
      );
    }
    return;
  }

  isAutoSyncing = true;
  lastAutoSyncAt = Date.now();
  try {
    if (showToast) toast("Đã có mạng trở lại, đang đồng bộ dữ liệu...");
    await pullFromGithub(showToast);
  } finally {
    isAutoSyncing = false;
  }
}

// Quay lại tab/app đang mở sẵn (không load lại trang) -> âm thầm đồng bộ,
// không cần toast để khỏi làm phiền nếu không có gì mới.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && navigator.onLine) {
    autoSyncFromGithub(false);
  }
});

// Trình duyệt tự phát hiện có mạng trở lại -> đồng bộ ngay + báo cho biết.
window.addEventListener("online", () => {
  autoSyncFromGithub(true);
});

// ====================================================
// CHẠY HỆ THỐNG (đặt cuối cùng, sau khi mọi module đã tải)
// ====================================================
// Lưu ý: KHÔNG gọi renderProductList() ở đây nữa — init() đã tự render
// sau khi dữ liệu thật được nạp xong (xem cuối hàm init() phía trên).
// Gọi renderProductList() ngay tại đây (trước khi init() nạp xong dữ liệu)
// chính là nguyên nhân gây mất dữ liệu: nó render với "products = {}" rỗng
// ban đầu rồi tự lưu đè bản rỗng đó vào localStorage ngay lập tức.
init();
