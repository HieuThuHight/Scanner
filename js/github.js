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

async function getGithubFileSha(path, token) {
  const res = await fetch(githubApiUrl(path), {
    headers: { Authorization: `Bearer ${token}` },
  });
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

  const res = await fetch(githubApiUrl(path), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
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

async function buildGithubUploads(token) {
  const uploads = [];

  // index payload
  const indexPayload = buildIndexPayload();
  uploads.push({
    path: GITHUB_PATH,
    content: utf8ToBase64(JSON.stringify(indexPayload)),
    message: "Cập nhật sản phẩm - index",
  });

  // per-product details
  for (const id in products) {
    const product = products[id];
    if (!product) continue;
    const detailPayload = {
      ...getProductDetailPayload(product),
      name: product.name,
    };
    uploads.push({
      path: productDetailPath(id),
      content: utf8ToBase64(JSON.stringify(detailPayload)),
      message: `Cập nhật chi tiết sản phẩm ${product.name}`,
    });

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
  const token = githubTokenInput.value.trim();
  if (!token) {
    toast("Nhập GitHub token để đồng bộ lên!", true);
    return;
  }

  syncStatusEl.textContent = "Đang đồng bộ lên GitHub...";

  try {
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
    toast("Đồng bộ thất bại, kiểm tra token/quyền truy cập repo.", true);
  }
}

pullGithubBtn.addEventListener("click", () => pullFromGithub(true));
pushGithubBtn.addEventListener("click", () => pushToGithub());
