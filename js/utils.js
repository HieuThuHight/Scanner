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

// "Làm sạch" GitHub token trước khi dùng để gọi API.
// Header HTTP (Authorization) chỉ được chứa ký tự ISO-8859-1 (Latin-1, mã <= 255).
// Khi copy token từ nơi khác (Zalo, Notes, Word...) đôi khi dính thêm:
// - khoảng trắng đặc biệt (non-breaking space, zero-width space)
// - dấu ngoặc kiểu chữ “ ” ‘ ’
// - ký tự tiếng Việt có dấu, emoji...
// Những ký tự này làm fetch() ném lỗi:
//   "String contains non ISO-8859-1 code point"
// và khiến việc đồng bộ lên GitHub thất bại ngay từ bước đầu.
// Hàm này trim khoảng trắng thường + xoá các ký tự ẩn hay gặp khi copy-paste,
// đồng thời kiểm tra phần còn lại có phải mã Latin-1 hợp lệ không.
function sanitizeGithubToken(rawToken) {
  if (!rawToken) return { token: "", error: null };

  // Xoá các ký tự khoảng trắng ẩn/đặc biệt hay gặp khi copy-paste
  let cleaned = rawToken
    .replace(/[\u200B-\u200D\uFEFF\u00A0\u2028\u2029]/g, "") // zero-width, NBSP, line/paragraph sep
    .trim();

  // Kiểm tra còn ký tự nào ngoài ISO-8859-1 (mã > 255) không
  const hasInvalidChar = [...cleaned].some((ch) => ch.codePointAt(0) > 255);

  if (hasInvalidChar) {
    return {
      token: cleaned,
      error:
        "Token GitHub chứa ký tự không hợp lệ (có thể do dính khoảng trắng đặc biệt, dấu ngoặc kiểu chữ, hoặc ký tự lạ khi copy). Vui lòng xoá ô token và dán lại token gốc (chỉ gồm chữ/số, dạng ghp_... hoặc github_pat_...).",
    };
  }

  return { token: cleaned, error: null };
}

function debounce(fn, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}
