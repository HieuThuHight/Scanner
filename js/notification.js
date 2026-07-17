// ====================================================
// NOTIFICATION.JS — DANH SÁCH THÔNG BÁO RIÊNG
// (⚠ thiếu ảnh, thiếu barcode, train thành công, đã lưu ảnh...)
// Khác với toast() trong utils.js (chỉ hiện thoáng qua), file này
// lưu lại lịch sử thông báo để xem lại trong mục "🔔 Thông báo".
// ====================================================

let notifications = [];

const notifMarkReadBtn = document.querySelector("#notif-mark-read-btn");
const notifClearBtn = document.querySelector("#notif-clear-btn");

function addNotification(text, type = "warning") {
  // Chống spam: nếu thông báo y hệt vừa mới thêm (chưa đọc) thì bỏ qua
  const isDuplicate = notifications[0] && notifications[0].text === text && !notifications[0].read;
  if (isDuplicate) return;

  notifications.unshift({
    id: Date.now(),
    text,
    type, // "warning" | "success"
    time: new Date().toLocaleTimeString(),
    read: false,
  });
  renderNotifications();
}

function markAllNotificationsRead() {
  notifications.forEach((n) => (n.read = true));
  renderNotifications();
}

function clearAllNotifications() {
  notifications = [];
  renderNotifications();
}

function renderNotifications() {
  const el = document.querySelector("#notification-list");
  if (!el) return;

  if (notifications.length === 0) {
    el.innerHTML = "<p style='font-size:13px;color:#6b7280;'>Không có thông báo nào.</p>";
    return;
  }
  el.innerHTML = notifications
    .map(
      (n) => `
      <div class="notification-item ${n.type} ${n.read ? "" : "unread"}">
        <span>${n.text}</span>
        <span class="time">${n.time}</span>
      </div>
    `,
    )
    .join("");
}

// ====================================================
// TỰ ĐỘNG SINH CẢNH BÁO CHO 1 SẢN PHẨM
// (gọi mỗi khi đóng khung chụp ảnh hoặc gán mã cho sản phẩm)
// ====================================================
function checkProductWarnings(product) {
  if (!product) return;
  if ((product.photoCount || 0) < MAX_PHOTOS_PER_PRODUCT) {
    addNotification(
      `⚠ ${product.name} — mới có ${product.photoCount || 0}/${MAX_PHOTOS_PER_PRODUCT} ảnh`,
      "warning",
    );
  }
  if (!product.code) {
    addNotification(`⚠ ${product.name} — Chưa có Barcode`, "warning");
  }
}

if (notifMarkReadBtn) {
  notifMarkReadBtn.addEventListener("click", markAllNotificationsRead);
}
if (notifClearBtn) {
  notifClearBtn.addEventListener("click", clearAllNotifications);
}
