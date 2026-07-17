// ====================================================
// GITHUB.JS — ĐỒNG BỘ DỮ LIỆU QUA GITHUB (đọc công khai, ghi cần token)
// ====================================================

const githubTokenInput = document.querySelector("#github-token");
const pullGithubBtn = document.querySelector("#pull-github-btn");
const pushGithubBtn = document.querySelector("#push-github-btn");
const syncStatusEl = document.querySelector("#sync-status");

const GITHUB_SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 phút
const GITHUB_LOCAL_LAST_SYNC_KEY = "githubLastSyncAt";

function githubRawUrl(path = GITHUB_PATH) {
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${path}`;
}

function githubApiUrl(path = GITHUB_PATH) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodedPath}`;
}

function githubLastSyncAt() {
  return Number(localStorage.getItem(GITHUB_LOCAL_LAST_SYNC_KEY) || 0);
}
function setGithubLastSyncAt(timestamp) {
  localStorage.setItem(GITHUB_LOCAL_LAST_SYNC_KEY, String(timestamp));
}

// Bọc riêng lỗi "String contains non ISO-8859-1 code point" (token dính ký tự
// lạ khi copy-paste) thành thông báo tiếng Việt dễ hiểu thay vì để crash thô.
function rethrowIfBadTokenChars(err) {
  if (
    err instanceof TypeError &&
    /ISO-8859-1|Headers|headers/i.test(err.message)
  ) {
    throw new Error(
      "Token GitHub chứa ký tự không hợp lệ (thường do copy dính khoảng trắng đặc biệt hoặc ký tự lạ). Hãy xoá ô token và dán lại token gốc.",
    );
  }
  throw err;
}

async function getGithubFileSha(path, token) {
  let res;
  try {
    res = await fetch(githubApiUrl(path), {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    rethrowIfBadTokenChars(err);
  }
  if (!res.ok) return null;
  const info = await res.json();
  return info.sha;
}

async function uploadGithubFile(path, contentBase64, message, token, sha) {
  const body = {
    message,
    content: contentBase64,
    branch: GITHUB_BRANCH,
  };
  if (sha) body.sha = sha;

  let res;
  try {
    res = await fetch(githubApiUrl(path), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    rethrowIfBadTokenChars(err);
  }
  return res;
}

async function githubFileExists(path, token) {
  const sha = await getGithubFileSha(path, token);
  return sha !== null;
}

async function pullFromGithubIfNeeded(notifyIfEmpty = true) {
  if (Date.now() - githubLastSyncAt() < GITHUB_SYNC_INTERVAL_MS) {
    if (notifyIfEmpty) {
      const timeText = new Date(githubLastSyncAt()).toLocaleTimeString();
      syncStatusEl.textContent = `Dữ liệu GitHub đã cập nhật lúc ${timeText}`;
    }
    return;
  }
  await pullFromGithub(notifyIfEmpty);
}

async function pullFromGithub(notifyIfEmpty = true) {
  if (!GITHUB_CONFIGURED) {
    if (notifyIfEmpty)
      toast("Chưa cấu hình repo GitHub trong js/app.js!", true);
    return;
  }
  if (notifyIfEmpty && isAdmin && hasUnsyncedChanges) {
    const ok = confirm(
      "Bạn có thay đổi chưa đồng bộ lên GitHub. Tải bản trên GitHub về sẽ XOÁ MẤT các thay đổi này. Vẫn tiếp tục?",
    );
    if (!ok) return;
  }

  try {
    const res = await fetch(`${githubRawUrl()}?t=${Date.now()}`);
    if (!res.ok) {
      if (notifyIfEmpty)
        toast("Chưa có dữ liệu trên GitHub (repo/file mới tạo?).", true);
      return;
    }
    const payload = await res.json();
    applyPayload(payload);
    const migrated = await migrateAllDataUrlPhotos();
    if (migrated) {
      await saveDataToLocalStorage(false);
    }
    setGithubLastSyncAt(Date.now());
    if (syncStatusEl)
      syncStatusEl.textContent =
        "Đã tải dữ liệu mới nhất lúc " + new Date().toLocaleTimeString();
    if (notifyIfEmpty) toast("Đã đồng bộ dữ liệu mới nhất từ GitHub!");
  } catch (err) {
    console.error(err);
    if (notifyIfEmpty) toast("Lỗi khi tải dữ liệu từ GitHub.", true);
  }
}

// Bảo vệ: đảm bảo JSON đẩy lên GitHub KHÔNG BAO GIỜ chứa base64 ảnh
// (đây chính là nguyên nhân khiến products.json từng nặng tới ~6MB).
// Ảnh phải luôn là file .jpg riêng ở data/images/..., JSON chỉ chứa path.
// Hàm này dọn phòng hờ nếu có dữ liệu base64 sót lại (dữ liệu cũ, bug khác...).
function stripBase64Fields(obj) {
  const clone = { ...obj };
  for (const key of ["photos", "photoUrls", "images"]) {
    if (Array.isArray(clone[key])) {
      delete clone[key]; // các field này chỉ dùng tạm trong bộ nhớ, không đẩy lên GitHub
    }
  }
  return clone;
}

function assertNoBase64(payload, label) {
  const json = JSON.stringify(payload);
  if (json.includes("data:image")) {
    throw new Error(
      `${label} vẫn còn dính ảnh base64 (data:image...) — đã CHẶN đẩy lên GitHub để tránh làm phình repo. Báo lại cho người sửa code.`,
    );
  }
}

async function buildGithubUploads(token) {
  const uploads = [];

  // index payload — chỉ chứa thông tin sản phẩm + dữ liệu AI, KHÔNG chứa ảnh
  const indexPayload = stripBase64Fields(buildIndexPayload());
  assertNoBase64(indexPayload, "File index sản phẩm");
  uploads.push({
    path: GITHUB_PATH,
    content: utf8ToBase64(JSON.stringify(indexPayload)),
    message: "Cập nhật sản phẩm - index",
  });

  // per-product details — chỉ chứa photoPaths (đường dẫn), KHÔNG chứa ảnh
  for (const id in products) {
    const product = products[id];
    if (!product) continue;
    const detailPayload = stripBase64Fields({
      ...getProductDetailPayload(product),
      name: product.name,
    });
    assertNoBase64(detailPayload, `Chi tiết sản phẩm "${product.name}"`);
    uploads.push({
      path: productDetailPath(id),
      content: utf8ToBase64(JSON.stringify(detailPayload)),
      message: `Cập nhật chi tiết sản phẩm ${product.name}`,
    });

    // Ảnh thật luôn được đẩy như FILE NHỊ PHÂN RIÊNG tại data/images/products/<id>/...
    // — nội dung base64 ở đây là để gửi lên GitHub Contents API (bắt buộc phải encode
    // base64 khi gọi API), KHÔNG PHẢI lưu base64 vào JSON.
    if (Array.isArray(product.photoPaths)) {
      for (const photoPath of product.photoPaths) {
        const blob = await getImageBlob(photoPath);
        if (!blob) continue;
        uploads.push({
          path: `data/${photoPath}`,
          content: await blobToBase64(blob),
          message: `Upload ảnh sản phẩm ${product.name}`,
        });
      }
    }
  }

  return uploads;
}

async function pushToGithub() {
  if (!GITHUB_CONFIGURED) {
    toast("Chưa cấu hình repo GitHub trong js/app.js!", true);
    return;
  }
  const { token, error: tokenError } = sanitizeGithubToken(
    githubTokenInput.value,
  );
  if (!token) {
    toast("Nhập GitHub token để đồng bộ lên!", true);
    return;
  }
  if (tokenError) {
    toast(tokenError, true);
    syncStatusEl.textContent = "Lỗi đồng bộ: token không hợp lệ.";
    return;
  }
  // Đưa token đã làm sạch trở lại ô nhập, để lần bấm sau không bị lỗi lại
  githubTokenInput.value = token;

  syncStatusEl.textContent = "Đang đồng bộ lên GitHub...";

  try {
    // Phòng hờ: nếu còn sản phẩm nào giữ ảnh base64 cũ (dữ liệu từ trước khi
    // có hệ thống lưu ảnh riêng file), chuyển hết sang file + photoPaths
    // TRƯỚC khi build danh sách upload, để không bao giờ đẩy base64 lên GitHub.
    const migrated = await migrateAllDataUrlPhotos();
    if (migrated) {
      await saveDataToLocalStorage(false);
    }

    const uploads = await buildGithubUploads(token);
    for (const item of uploads) {
      const sha = await getGithubFileSha(item.path, token);
      const putRes = await uploadGithubFile(
        item.path,
        item.content,
        item.message,
        token,
        sha,
      );
      if (!putRes.ok) {
        const errData = await putRes.json();
        throw new Error(
          `Upload ${item.path} thất bại: ${errData.message || putRes.status}`,
        );
      }
    }

    setGithubLastSyncAt(Date.now());
    syncStatusEl.textContent =
      "Đã đồng bộ lên GitHub lúc " + new Date().toLocaleTimeString();
    toast("Đồng bộ lên GitHub thành công!");
    hasUnsyncedChanges = false;
  } catch (err) {
    console.error(err);
    syncStatusEl.textContent = "Lỗi đồng bộ: " + err.message;
    toast(err.message || "Đồng bộ thất bại, kiểm tra token/quyền truy cập repo.", true);
  }
}

pullGithubBtn.addEventListener("click", () => pullFromGithub(true));
pushGithubBtn.addEventListener("click", () => pushToGithub());
