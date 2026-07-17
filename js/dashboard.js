// ====================================================
// DASHBOARD.JS — THỐNG KÊ TỔNG QUAN CHO ADMIN
// (Tổng sản phẩm / Tổng ảnh AI / Sản phẩm chưa đủ ảnh / Lần train cuối
//  + mini biểu đồ số ảnh theo từng sản phẩm)
// ====================================================

let lastTrainTime = null; // cập nhật mỗi khi chụp ảnh train hoặc bấm "Huấn luyện lại"

function markTrained() {
  lastTrainTime = new Date();
}

function computeDashboardStats() {
  const list = Object.values(products);
  const totalProducts = list.length;
  const totalPhotos = list.reduce((sum, p) => sum + (p.photoCount || 0), 0);
  const notEnoughPhotos = list.filter(
    (p) => (p.photoCount || 0) < MAX_PHOTOS_PER_PRODUCT,
  ).length;
  const missingBarcode = list.filter((p) => !p.code).length;
  return { totalProducts, totalPhotos, notEnoughPhotos, missingBarcode, list };
}

function renderDashboard() {
  const el = document.querySelector("#dashboard-view");
  if (!el) return; // chưa gắn khung Dashboard vào HTML thì bỏ qua

  const stats = computeDashboardStats();
  const lastTrainText = lastTrainTime
    ? lastTrainTime.toLocaleTimeString()
    : "Chưa train lần nào";

  const barsHtml = stats.list.length
    ? stats.list
        .map((p) => {
          const pct = Math.round(
            ((p.photoCount || 0) / MAX_PHOTOS_PER_PRODUCT) * 100,
          );
          const color = pct >= 100 ? "#059669" : "#2563eb";
          return `
            <div style="margin-bottom:6px;">
              <div style="display:flex;justify-content:space-between;font-size:12px;color:#4b5563;">
                <span>${p.name}</span>
                <span>${p.photoCount || 0}/${MAX_PHOTOS_PER_PRODUCT}</span>
              </div>
              <div style="background:#e5e7eb;border-radius:6px;height:8px;overflow:hidden;">
                <div style="width:${pct}%;background:${color};height:100%;"></div>
              </div>
            </div>`;
        })
        .join("")
    : "<p style='font-size:13px;color:#6b7280;'>Chưa có sản phẩm nào.</p>";

  const attentionList = stats.list.filter(
    (p) => (p.photoCount || 0) < MAX_PHOTOS_PER_PRODUCT || !p.code,
  );
  const attentionHtml = attentionList.length
    ? attentionList
        .map((p) => {
          const reasons = [];
          if ((p.photoCount || 0) < MAX_PHOTOS_PER_PRODUCT)
            reasons.push(`mới có ${p.photoCount || 0}/${MAX_PHOTOS_PER_PRODUCT} ảnh`);
          if (!p.code) reasons.push("chưa có Barcode");
          return `<li>⚠ <strong>${p.name}</strong> — ${reasons.join(", ")}</li>`;
        })
        .join("")
    : "<li>✅ Mọi sản phẩm đều đã đủ ảnh và có Barcode.</li>";

  el.innerHTML = `
    <div class="dashboard-grid">
      <div class="dashboard-card">
        <div class="value">${stats.totalProducts}</div>
        <div class="label">Tổng sản phẩm</div>
      </div>
      <div class="dashboard-card">
        <div class="value">${stats.totalPhotos}</div>
        <div class="label">Tổng ảnh AI</div>
      </div>
      <div class="dashboard-card">
        <div class="value">${stats.notEnoughPhotos}</div>
        <div class="label">SP chưa đủ ảnh</div>
      </div>
      <div class="dashboard-card">
        <div class="value" style="font-size:15px;">${lastTrainText}</div>
        <div class="label">Lần train cuối</div>
      </div>
    </div>
    <div class="dashboard-chart">
      <h3 style="margin-top:0;">📊 Số ảnh đã train theo sản phẩm</h3>
      ${barsHtml}
    </div>
    <div class="panel">
      <h3 style="margin-top:0;">Cần chú ý</h3>
      <ul style="margin:0;padding-left:18px;font-size:13px;">${attentionHtml}</ul>
    </div>
  `;
}
