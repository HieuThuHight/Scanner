// ====================================================
// UTILS.JS — HÀM DÙNG CHUNG CHO TOÀN APP
// ====================================================

// ====== CẤU HÌNH THÔNG BÁO NHANH (TOAST) ======
// Muốn đổi VỊ TRÍ hiện thông báo: sửa TOAST_GRAVITY ("top"/"bottom")
// và TOAST_POSITION ("left"/"center"/"right").
// Muốn đổi THỜI GIAN hiện: sửa TOAST_DURATION_MS (bình thường) và
// TOAST_DURATION_ERROR_MS (khi báo lỗi) — đơn vị mili-giây (1000 = 1 giây).
const TOAST_GRAVITY = "top";
const TOAST_POSITION = "left";
const TOAST_DURATION_MS = 3000;
const TOAST_DURATION_ERROR_MS = 5000;

// Hiện toast nhanh góc màn hình
function toast(text, isError) {
  Toastify({
    text,
    gravity: TOAST_GRAVITY,
    position: TOAST_POSITION,
    style: isError ? { background: "#dc2626" } : undefined,
    duration: isError ? TOAST_DURATION_ERROR_MS : TOAST_DURATION_MS,
  }).showToast();
}

// Dịch lỗi camera của trình duyệt sang câu tiếng Việt dễ hiểu
function friendlyCameraError(err) {
  console.error(err);
  const name = err && err.name;
  if (name === "NotAllowedError")
    return "Bạn chưa cấp quyền camera cho trang này. Vào cài đặt trình duyệt để cho phép.";
  if (name === "NotFoundError")
    return "Không tìm thấy camera trên thiết bị này.";
  if (name === "NotReadableError")
    return "Camera đang được ứng dụng khác sử dụng, đóng ứng dụng đó rồi thử lại.";
  return "Không mở được camera: " + (err && err.message ? err.message : err);
}

// Chuỗi UTF-8 -> Base64 (dùng khi đẩy dữ liệu lên GitHub API)
function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function debounce(fn, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}
