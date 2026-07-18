// ====================================================
// ADMIN.JS — ĐĂNG NHẬP ADMIN + QUẢN LÝ SẢN PHẨM (CRUD)
// ====================================================

// ===== LOGIN ELEMENTS =====
const adminLoginToggle = document.querySelector("#admin-login-toggle");
const adminLogoutBtn = document.querySelector("#admin-logout-btn");
const gotoAdminBtn = document.querySelector("#goto-admin-btn");
const loginBox = document.querySelector("#login-box");
const adminUsernameInput = document.querySelector("#admin-username");
const adminPasswordInput = document.querySelector("#admin-password");
const adminLoginBtn = document.querySelector("#admin-login-btn");
const adminLoginCancel = document.querySelector("#admin-login-cancel");
const adminTab = document.querySelector("#admin-tab");

// ===== MAIN BUTTONS (MVC) =====
const viewDashboardBtn = document.querySelector("#view-dashboard-btn");
const viewManageBtn = document.querySelector("#view-manage-btn");
const viewSyncBtn = document.querySelector("#view-sync-btn");

// ===== MAIN VIEWS (MVC) =====
const adminDashboardView = document.querySelector("#admin-dashboard-view");
const adminManageView = document.querySelector("#admin-manage-view");
const adminSyncView = document.querySelector("#admin-sync-view");

// ===== HEADER ELEMENTS =====
const adminHeaderRow = document.querySelector(".admin-header-row");

// ===== SEARCH & SORT (in manage view) =====
const adminSearchInput = document.querySelector("#admin-search-input");
const adminSearchBtn = document.querySelector("#admin-search-btn");
const adminSortOrder = document.querySelector("#admin-sort-order");

// ===== ADD/MANAGE PRODUCT ELEMENTS =====
const newProductName = document.querySelector("#new-product-name");
const newProductCode = document.querySelector("#new-product-code");
const newProductQrCode = document.querySelector("#new-product-qr-code");
const newProductPrice = document.querySelector("#new-product-price");
const newProductCategory = document.querySelector("#new-product-category");
const newProductNotes = document.querySelector("#new-product-notes");
const addProductBtn = document.querySelector("#add-product-btn");
const addProductToggleBtn = document.querySelector("#add-product-toggle-btn");
const addCancelBtn = document.querySelector("#add-cancel-btn");

// ===== PRODUCT LIST ELEMENTS =====
const productList = document.querySelector("#product-list");
const viewAllProductsBtn = document.querySelector("#view-all-products-btn");

// ===== ADD VIEW =====
const adminAddView = document.querySelector("#admin-add-view");
const allBackBtn = document.querySelector("#all-back-btn");

// ===== EDIT VIEW =====
const adminEditView = document.querySelector("#admin-edit-view");
const editCancelBtn = document.querySelector("#edit-cancel-btn");
const editProductName = document.querySelector("#edit-product-name");
const editProductCode = document.querySelector("#edit-product-code");
const editProductQrCode = document.querySelector("#edit-product-qr-code");
const editProductPrice = document.querySelector("#edit-product-price");
const editProductCategory = document.querySelector("#edit-product-category");
const editProductNotes = document.querySelector("#edit-product-notes");
const editProductCaptureBtn = document.querySelector(
  "#edit-product-capture-btn",
);
const editProductScanBtn = document.querySelector("#edit-product-scan-btn");
const editProductSaveBtn = document.querySelector("#edit-product-save-btn");

// ===== ALL PRODUCTS VIEW =====
const adminAllView = document.querySelector("#admin-all-view");
const adminAllProductsContent = document.querySelector(
  "#admin-all-products-content",
);
const adminAllSearchInput = document.querySelector("#admin-all-search-input");
const adminAllSortOrder = document.querySelector("#admin-all-sort-order");
const adminAllPagination = document.querySelector("#admin-all-pagination");
const ALL_PRODUCTS_PAGE_SIZE = 5; // phân trang tối đa 5 sản phẩm/trang cho nhanh

// ===== DETAIL PANEL =====
const adminDetailPanel = document.querySelector("#admin-detail-panel");
const adminDetailClose = document.querySelector("#admin-detail-close");
const detailContent = document.querySelector("#detail-content");
const detailStatusLabel = document.querySelector("#detail-status-label");
const detailEditBtn = document.querySelector("#detail-edit-btn");
const detailDeleteBtn = document.querySelector("#detail-delete-btn");

// ===== BACK BUTTON (in header) =====
const adminBackBtn = document.querySelector("#admin-back-btn");

// ====================================================
// MVC: SWITCH VIEWS
// ====================================================
function showDashboardView() {
  adminDashboardView?.classList.remove("hidden");
  adminManageView?.classList.add("hidden");
  adminSyncView?.classList.add("hidden");
  viewDashboardBtn?.classList.add("active");
  viewManageBtn?.classList.remove("active");
  viewSyncBtn?.classList.remove("active");
}

function showManageView() {
  adminDashboardView?.classList.add("hidden");
  adminManageView?.classList.remove("hidden");
  adminSyncView?.classList.add("hidden");
  viewDashboardBtn?.classList.remove("active");
  viewManageBtn?.classList.add("active");
  viewSyncBtn?.classList.remove("active");
  renderProductList();
}

function showSyncView() {
  adminDashboardView?.classList.add("hidden");
  adminManageView?.classList.add("hidden");
  adminSyncView?.classList.remove("hidden");
  viewDashboardBtn?.classList.remove("active");
  viewManageBtn?.classList.remove("active");
  viewSyncBtn?.classList.add("active");
}

// ====================================================
// MANAGE VIEW: SWITCH ADD/LIST/ALL PRODUCTS
// ====================================================
function showMainView() {
  adminManageView?.classList.remove("hidden");
  adminAddView?.classList.add("hidden");
  adminEditView?.classList.add("hidden");
  adminAllView?.classList.add("hidden");
  adminDetailPanel?.classList.add("hidden");
}

function showAddView() {
  adminManageView?.classList.add("hidden");
  adminAddView?.classList.remove("hidden");
  adminEditView?.classList.add("hidden");
  adminAllView?.classList.add("hidden");
  adminDetailPanel?.classList.add("hidden");
  // Clear form
  if (newProductName) newProductName.value = "";
  if (newProductCode) newProductCode.value = "";
  if (newProductQrCode) newProductQrCode.value = "";
  if (newProductPrice) newProductPrice.value = "";
  if (newProductCategory) newProductCategory.value = "";
  if (newProductNotes) newProductNotes.value = "";
  // Focus on name input
  if (newProductName) newProductName.focus();
}

function showEditView(product) {
  if (!adminEditView) return;
  adminManageView?.classList.add("hidden");
  adminAddView?.classList.add("hidden");
  adminEditView?.classList.remove("hidden");
  adminAllView?.classList.add("hidden");
  adminDetailPanel?.classList.add("hidden");

  if (editProductName) editProductName.value = product.name || "";
  if (editProductCode) editProductCode.value = product.code || "";
  if (editProductQrCode) editProductQrCode.value = product.qrCode || "";
  if (editProductPrice) editProductPrice.value = product.price || "";
  if (editProductCategory) editProductCategory.value = product.category || "";
  if (editProductNotes) editProductNotes.value = product.notes || "";
  editProductSaveBtn?.setAttribute("data-id", product.id);
}

function showAllView() {
  adminManageView?.classList.add("hidden");
  adminAddView?.classList.add("hidden");
  adminEditView?.classList.add("hidden");
  adminAllView?.classList.remove("hidden");
  adminDetailPanel?.classList.add("hidden");
  allProductsCurrentPage = 1;
  renderAllProductsInView();
}

// ====================================================
// ĐĂNG NHẬP / ĐĂNG XUẤT ADMIN
// ====================================================
adminLoginToggle.addEventListener("click", () => {
  loginBox.classList.toggle("hidden");
});
adminLoginCancel.addEventListener("click", () => {
  loginBox.classList.add("hidden");
});

adminLoginBtn.addEventListener("click", () => {
  const u = adminUsernameInput.value.trim();
  const p = adminPasswordInput.value.trim();
  if (u === ADMIN_USERNAME && p === ADMIN_PASSWORD) {
    isAdmin = true;
    loginBox.classList.add("hidden");
    adminLoginToggle.classList.add("hidden");
    adminLogoutBtn.classList.remove("hidden");
    gotoAdminBtn.classList.remove("hidden");
    adminUsernameInput.value = "";
    adminPasswordInput.value = "";
    toast("Đăng nhập admin thành công!");
    closeMenu();
    showAdmin();
  } else {
    toast("Sai tài khoản hoặc mật khẩu!", true);
  }
});

adminLogoutBtn.addEventListener("click", async () => {
  isAdmin = false;
  await stopAllModes();
  adminLoginToggle.classList.remove("hidden");
  adminLogoutBtn.classList.add("hidden");
  gotoAdminBtn.classList.add("hidden");
  closeMenu();
  showHome();
  toast("Đã đăng xuất.");
});

gotoAdminBtn.addEventListener("click", () => {
  closeMenu();
  showAdmin();
});

adminBackBtn.addEventListener("click", async () => {
  await stopAllModes();
  showHome();
});

// ====================================================
// MVC BUTTONS: SWITCH BETWEEN 3 MAIN VIEWS
// ====================================================
if (viewDashboardBtn) {
  viewDashboardBtn.addEventListener("click", showDashboardView);
}
if (viewManageBtn) {
  viewManageBtn.addEventListener("click", showManageView);
}
if (viewSyncBtn) {
  viewSyncBtn.addEventListener("click", showSyncView);
}

// ====================================================
// NÚT CHUYỂN VIEW THÊMSẢN PHẨM
// ====================================================
if (addProductToggleBtn) {
  addProductToggleBtn.addEventListener("click", showAddView);
}

if (addCancelBtn) {
  addCancelBtn.addEventListener("click", showMainView);
}

// ====================================================
// NÚT XEM TẤT CẢ
// ====================================================
if (viewAllProductsBtn) {
  viewAllProductsBtn.addEventListener("click", showAllView);
}

if (allBackBtn) {
  allBackBtn.addEventListener("click", showMainView);
}

// ====================================================
// QUẢN LÝ SẢN PHẨM (THÊM / SỬA / XOÁ)
// ====================================================
if (addProductBtn) {
  addProductBtn.addEventListener("click", () => {
    const name = newProductName.value.trim();
    const code = newProductCode.value.trim();
    const qrCode = newProductQrCode.value.trim();
    const price = newProductPrice.value.trim();
    const category = newProductCategory.value.trim();
    const notes = newProductNotes.value.trim();
    if (!name) {
      toast("Nhập tên sản phẩm đã!", true);
      return;
    }
    const id = "product_" + nextProductId++;
    products[id] = {
      id,
      name,
      code: code || "",
      qrCode: qrCode || "",
      price,
      category,
      notes,
      status: "Thêm",
      createdAt: new Date().toISOString(),
      photoCount: 0,
      photos: [],
    };
    if (typeof markProductDirty === "function") markProductDirty(id);
    renderProductList();
    toast(`Đã thêm sản phẩm "${name}"`);
    showMainView();
  });
}

function renderProductList() {
  productList.innerHTML = "";
  renderDashboard();
  const searchTerm = (adminSearchInput?.value || "").trim().toLowerCase();
  let entries = Object.values(products).map(normalizeProduct);

  if (searchTerm) {
    entries = entries.filter((product) => {
      const haystack =
        `${product.name} ${product.code} ${product.qrCode || ""} ${product.category} ${product.notes}`.toLowerCase();
      return haystack.includes(searchTerm);
    });
  }

  const sortOrder = adminSortOrder?.value === "asc" ? 1 : -1;
  entries.sort((a, b) =>
    a.createdAt === b.createdAt
      ? 0
      : a.createdAt > b.createdAt
        ? sortOrder
        : -sortOrder,
  );

  const totalCount = entries.length;
  const visibleProducts = entries.slice(0, 5);

  if (visibleProducts.length === 0) {
    productList.innerHTML =
      "<li>Chưa có sản phẩm nào hoặc không có kết quả tìm kiếm.</li>";
    return;
  }

  for (const product of visibleProducts) {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="info">
        <strong>${product.name}</strong>
        <div style="margin-top:4px;font-size:13px;color:#374151;">
          ${product.price ? `Giá: ${product.price} • ` : ""}
          ${product.code ? `Mã: ${product.code}` : "Mã: (chưa có)"}
          ${product.qrCode ? ` • Barcode: ${product.qrCode}` : ""}
        </div>
        <div style="margin-top:4px;font-size:13px;color:#4b5563;">
          ${product.category || "Danh mục: chưa có"} • Ảnh: ${product.photoCount || 0}/${MAX_PHOTOS_PER_PRODUCT}
        </div>
      </div>
      <div class="actions">
        <button class="small secondary" data-action="detail" data-id="${product.id}">🔍 Chi tiết</button>
        <button class="small secondary" data-action="edit" data-id="${product.id}">✏️ Sửa</button>
        <button class="small danger" data-action="delete" data-id="${product.id}">🗑️ Xoá</button>
      </div>
    `;
    productList.appendChild(li);
  }

  if (totalCount > 5) {
    const more = document.createElement("li");
    more.className = "more-note";
    more.textContent = `Hiển thị 5 trên ${totalCount} sản phẩm. Nhấn Xem tất cả để mở trang đầy đủ.`;
    productList.appendChild(more);
  }

  if (typeof saveDataToLocalStorage === "function") saveDataToLocalStorage();
}

productList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;
  const product = products[id];
  if (!product) return;

  if (action === "capture") {
    await startAdminCapture(product);
  } else if (action === "scan") {
    await startAdminScan(product);
  } else if (action === "edit") {
    showEditView(product);
  } else if (action === "delete") {
    deleteProduct(product);
  } else if (action === "detail") {
    showProductDetail(product);
  }
});

if (adminAllProductsContent) {
  adminAllProductsContent.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const { action, id } = btn.dataset;
    const product = products[id];
    if (!product) return;

    if (action === "edit") {
      showEditView(product);
    } else if (action === "delete") {
      deleteProduct(product);
    }
  });
}

if (adminSearchInput) {
  adminSearchInput.addEventListener(
    "input",
    debounce(() => renderProductList(), 300),
  );
}
if (adminSearchBtn) adminSearchBtn.addEventListener("click", renderProductList);
if (adminSortOrder)
  adminSortOrder.addEventListener("change", renderProductList);

if (adminDetailClose)
  adminDetailClose.addEventListener("click", () =>
    adminDetailPanel.classList.add("hidden"),
  );
if (detailEditBtn)
  detailEditBtn.addEventListener("click", () => {
    const product = products[detailEditBtn.dataset.productId];
    if (product) {
      showEditView(product);
    }
  });
if (detailDeleteBtn)
  detailDeleteBtn.addEventListener("click", () => {
    const product = products[detailDeleteBtn.dataset.productId];
    if (product) deleteProduct(product);
  });

if (editCancelBtn) {
  editCancelBtn.addEventListener("click", () => {
    showMainView();
  });
}

if (editProductCaptureBtn) {
  editProductCaptureBtn.addEventListener("click", async () => {
    const productId = editProductSaveBtn?.dataset.id;
    if (!productId) return;
    const product = products[productId];
    if (!product) return;
    await startAdminCapture(product);
  });
}

if (editProductScanBtn) {
  editProductScanBtn.addEventListener("click", async () => {
    const productId = editProductSaveBtn?.dataset.id;
    if (!productId) return;
    const product = products[productId];
    if (!product) return;
    await startAdminScan(product);
  });
}

if (editProductSaveBtn) {
  editProductSaveBtn.addEventListener("click", () => {
    const productId = editProductSaveBtn.dataset.id;
    if (!productId) return;
    const product = products[productId];
    if (!product) return;
    product.name = editProductName.value.trim() || product.name;
    product.code = editProductCode.value.trim();
    product.qrCode = editProductQrCode.value.trim();
    product.price = editProductPrice.value.trim();
    product.category = editProductCategory.value.trim();
    product.notes = editProductNotes.value.trim();
    if (typeof markProductDirty === "function") markProductDirty(productId);
    renderProductList();
    toast(`Đã cập nhật sản phẩm "${product.name}"`);
    showMainView();
  });
}

function showProductDetail(product) {
  if (!product) return;
  product.status = "Xem chi tiết";
  detailStatusLabel.textContent = `Trạng thái: ${product.status}`;
  detailContent.innerHTML = `
    <p><strong>Tên:</strong> ${product.name}</p>
    <p><strong>Mã sản phẩm:</strong> ${product.code || "(chưa có)"}</p>
    <p><strong>Barcode:</strong> ${product.qrCode || "(chưa có)"}</p>
    <p><strong>Giá:</strong> ${product.price || "(chưa có)"}</p>
    <p><strong>Danh mục:</strong> ${product.category || "(chưa có)"}</p>
    <p><strong>Ghi chú:</strong> ${product.notes || "(không có)"}</p>
    <p><strong>Ảnh đã train:</strong> ${product.photoCount || 0}/${MAX_PHOTOS_PER_PRODUCT}</p>
    <p><strong>Thời gian gửi:</strong> ${new Date(product.createdAt).toLocaleString()}</p>
  `;
  detailEditBtn.dataset.productId = product.id;
  detailDeleteBtn.dataset.productId = product.id;
  adminDetailPanel.classList.remove("hidden");
}

function deleteProduct(product) {
  const ok = confirm(
    `Xoá sản phẩm "${product.name}"? Toàn bộ ảnh đã train của sản phẩm này cũng sẽ bị xoá.`,
  );
  if (!ok) return;

  const dataset = classifier.getClassifierDataset();
  if (dataset[product.id]) {
    dataset[product.id].dispose();
    delete dataset[product.id];
    classifier.setClassifierDataset(dataset);
  }

  if (typeof markProductDeleted === "function")
    markProductDeleted(product.id);
  delete products[product.id];
  adminDetailPanel.classList.add("hidden");
  renderProductList();
  if (adminAllView && !adminAllView.classList.contains("hidden")) {
    renderAllProductsInView();
  }
  toast("Đã xoá sản phẩm.");
}

// ====================================================
// RENDER ALL PRODUCTS IN VIEW (Xem tất cả)
// ====================================================
let allProductsCurrentPage = 1;
// Cache danh sách đã lọc + sắp xếp, chỉ tính lại khi search/sort/data đổi
// thay vì tính lại mỗi lần chuyển trang -> đỡ tốn CPU khi danh sách dài.
let allProductsFilteredEntries = [];

function isProductUntrained(product) {
  return (product.photoCount || 0) < MAX_PHOTOS_PER_PRODUCT;
}

function statusBadgeHtml(product) {
  return isProductUntrained(product)
    ? `<span class="status-badge untrained">⏳ Chưa training</span>`
    : `<span class="status-badge trained">✅ Đã training</span>`;
}

function recomputeAllProductsEntries() {
  const searchTerm = (adminAllSearchInput?.value || "").trim().toLowerCase();
  let entries = Object.values(products).map(normalizeProduct);

  if (searchTerm) {
    entries = entries.filter((product) => {
      const haystack =
        `${product.name} ${product.code} ${product.qrCode || ""} ${product.category} ${product.notes}`.toLowerCase();
      return haystack.includes(searchTerm);
    });
  }

  const sortValue = adminAllSortOrder?.value || "desc";
  if (sortValue === "untrained") {
    // Sản phẩm CHƯA train đủ ảnh lên đầu (ít ảnh nhất trước), phần còn lại
    // xếp theo thời gian mới nhất.
    entries.sort((a, b) => {
      const aUntrained = isProductUntrained(a);
      const bUntrained = isProductUntrained(b);
      if (aUntrained !== bUntrained) return aUntrained ? -1 : 1;
      const aCount = a.photoCount || 0;
      const bCount = b.photoCount || 0;
      if (aCount !== bCount) return aCount - bCount;
      return a.createdAt === b.createdAt
        ? 0
        : a.createdAt > b.createdAt
          ? -1
          : 1;
    });
  } else {
    const sortOrder = sortValue === "asc" ? 1 : -1;
    entries.sort((a, b) =>
      a.createdAt === b.createdAt
        ? 0
        : a.createdAt > b.createdAt
          ? sortOrder
          : -sortOrder,
    );
  }

  allProductsFilteredEntries = entries;
}

function renderAllProductsInView() {
  if (!adminAllProductsContent) return;

  recomputeAllProductsEntries();
  const entries = allProductsFilteredEntries;

  if (entries.length === 0) {
    adminAllProductsContent.innerHTML =
      "<p>Chưa có sản phẩm nào hoặc không có kết quả tìm kiếm.</p>";
    if (adminAllPagination) adminAllPagination.innerHTML = "";
    return;
  }

  const totalPages = Math.max(
    1,
    Math.ceil(entries.length / ALL_PRODUCTS_PAGE_SIZE),
  );
  if (allProductsCurrentPage > totalPages) allProductsCurrentPage = totalPages;
  if (allProductsCurrentPage < 1) allProductsCurrentPage = 1;

  const start = (allProductsCurrentPage - 1) * ALL_PRODUCTS_PAGE_SIZE;
  // Chỉ render đúng 5 sản phẩm của trang hiện tại ra DOM thay vì "nhồi" toàn
  // bộ danh sách -> giảm hẳn số node HTML phải dựng/parse, mở nhanh hơn hẳn
  // khi dữ liệu nhiều.
  const pageEntries = entries.slice(start, start + ALL_PRODUCTS_PAGE_SIZE);

  let html = `
    <table class="product-table">
      <thead>
        <tr>
          <th>Tên</th>
          <th>Mã/Barcode</th>
          <th>Giá</th>
          <th>Danh mục</th>
          <th>Ghi chú</th>
          <th>Trạng thái</th>
          <th>Ảnh train</th>
          <th>Thời gian gửi</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const product of pageEntries) {
    const createdDate = new Date(product.createdAt).toLocaleString();
    html += `
      <tr>
        <td><strong>${product.name}</strong></td>
        <td>Mã: ${product.code || "(chưa có)"}<br>Barcode: ${product.qrCode || "(chưa có)"}</td>
        <td>${product.price || "(chưa có)"}</td>
        <td>${product.category || "(chưa có)"}</td>
        <td>${product.notes || "(không có)"}</td>
        <td>${statusBadgeHtml(product)}</td>
        <td>${product.photoCount || 0}/${MAX_PHOTOS_PER_PRODUCT}</td>
        <td>${createdDate}</td>
        <td>
          <button class="small secondary" data-action="edit" data-id="${product.id}">✏️ Sửa</button>
          <button class="small danger" data-action="delete" data-id="${product.id}">🗑️ Xoá</button>
        </td>
      </tr>
    `;
  }

  html += `
      </tbody>
    </table>
  `;

  adminAllProductsContent.innerHTML = html;
  renderAllProductsPagination(totalPages, entries.length);
}

function renderAllProductsPagination(totalPages, totalCount) {
  if (!adminAllPagination) return;

  if (totalPages <= 1) {
    adminAllPagination.innerHTML = `<span class="pagination-info">Tổng cộng ${totalCount} sản phẩm</span>`;
    return;
  }

  const buttons = [];
  buttons.push(
    `<button data-page="${allProductsCurrentPage - 1}" ${allProductsCurrentPage === 1 ? "disabled" : ""}>‹</button>`,
  );

  // Hiển thị tối đa 7 nút số trang, có "…" khi danh sách trang dài
  const pageNumbers = [];
  for (let p = 1; p <= totalPages; p++) {
    if (
      p === 1 ||
      p === totalPages ||
      (p >= allProductsCurrentPage - 1 && p <= allProductsCurrentPage + 1)
    ) {
      pageNumbers.push(p);
    }
  }
  let lastShown = 0;
  pageNumbers.forEach((p) => {
    if (lastShown && p - lastShown > 1) {
      buttons.push(
        `<span class="pagination-info" style="width:auto;">…</span>`,
      );
    }
    buttons.push(
      `<button data-page="${p}" class="${p === allProductsCurrentPage ? "active" : ""}">${p}</button>`,
    );
    lastShown = p;
  });

  buttons.push(
    `<button data-page="${allProductsCurrentPage + 1}" ${allProductsCurrentPage === totalPages ? "disabled" : ""}>›</button>`,
  );

  adminAllPagination.innerHTML =
    buttons.join("") +
    `<span class="pagination-info">Trang ${allProductsCurrentPage}/${totalPages} • Tổng ${totalCount} sản phẩm</span>`;

  adminAllPagination.querySelectorAll("button[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = Number(btn.dataset.page);
      if (
        !page ||
        page < 1 ||
        page > totalPages ||
        page === allProductsCurrentPage
      )
        return;
      allProductsCurrentPage = page;
      renderAllProductsInView();
      adminAllProductsContent.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  });
}

if (adminAllSearchInput) {
  adminAllSearchInput.addEventListener("input", () => {
    allProductsCurrentPage = 1;
    renderAllProductsInView();
  });
}
if (adminAllSortOrder) {
  adminAllSortOrder.addEventListener("change", () => {
    allProductsCurrentPage = 1;
    renderAllProductsInView();
  });
}
