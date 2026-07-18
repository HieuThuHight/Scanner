// ====================================================
// GITHUB.JS — ĐỒNG BỘ DỮ LIỆU QUA GITHUB (đọc công khai, ghi cần token)
// ====================================================

const githubTokenInput = document.querySelector("#github-token");
const pullGithubBtn = document.querySelector("#pull-github-btn");
const pushGithubBtn = document.querySelector("#push-github-btn");
const syncStatusEl = document.querySelector("#sync-status");

const GITHUB_SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 phút
const GITHUB_LOCAL_LAST_SYNC_KEY = "githubLastSyncAt";

// ====================================================
// TRẠNG THÁI ĐỒNG BỘ "THÔNG MINH" — chỉ đẩy phần đã đổi
// ====================================================
// dirtyProductIds: id sản phẩm có thay đổi cục bộ (thêm/sửa/thêm-xoá ảnh)
// CHƯA được đẩy lên GitHub. Lúc đồng bộ, chỉ những sản phẩm này (+ file
// index tổng) mới được đóng gói upload — sản phẩm không đổi thì bỏ qua
// hoàn toàn, kể cả ảnh của nó.
//
// githubShaCache: path -> sha nội dung ĐÃ BIẾT là đang nằm trên GitHub (do
// lần trước tự tay đẩy lên). Dùng để: (1) khỏi phải GET lấy sha trước mỗi
// lần PUT, và (2) so sánh với sha1 tính từ nội dung cục bộ để biết file có
// thực sự đổi không — giống hệt sha mà GitHub dùng cho blob (git object sha1)
// nên so được trực tiếp, không cần gọi API.
const GITHUB_SHA_CACHE_KEY = "githubShaCacheV1";
const GITHUB_DIRTY_IDS_KEY = "githubDirtyProductIdsV1";
const GITHUB_MIGRATED_KEY = "githubSyncMigratedV1";
const GITHUB_UPLOAD_BATCH_SIZE = 5; // upload song song tối đa 5 file/đợt

let githubShaCache = new Map();
let dirtyProductIds = new Set();
let syncStateLoadedPromise = null;

function persistDirtyState() {
  return saveMeta(GITHUB_DIRTY_IDS_KEY, Array.from(dirtyProductIds));
}

function persistShaCache() {
  return saveMeta(GITHUB_SHA_CACHE_KEY, Object.fromEntries(githubShaCache));
}

// Gọi 1 lần lúc khởi động app (xem app.js). Idempotent — gọi nhiều lần chỉ
// nạp/migrate đúng 1 lần nhờ cache promise.
function ensureSyncStateLoaded() {
  if (syncStateLoadedPromise) return syncStateLoadedPromise;
  syncStateLoadedPromise = (async () => {
    const [savedSha, savedDirty, migrated] = await Promise.all([
      loadMeta(GITHUB_SHA_CACHE_KEY),
      loadMeta(GITHUB_DIRTY_IDS_KEY),
      loadMeta(GITHUB_MIGRATED_KEY),
    ]);
    githubShaCache = new Map(Object.entries(savedSha || {}));
    dirtyProductIds = new Set(savedDirty || []);

    if (!migrated) {
      // Nâng cấp từ bản cũ (chưa có cơ chế dirty-tracking): đánh dấu TOÀN BỘ
      // sản phẩm hiện có là "dirty" đúng 1 lần duy nhất, để lần đồng bộ tới
      // đẩy đủ dữ liệu lên (khỏi bỏ sót sản phẩm cũ chưa có sha cache). Từ
      // lần đồng bộ SAU đó trở đi mới thực sự chỉ đẩy phần thay đổi.
      for (const id in products) dirtyProductIds.add(id);
      await saveMeta(GITHUB_MIGRATED_KEY, true);
      await persistDirtyState();
    }
  })();
  return syncStateLoadedPromise;
}

// Gọi mỗi khi sản phẩm được thêm/sửa/đổi ảnh — đánh dấu để lần đồng bộ tới
// chắc chắn đẩy sản phẩm này lên (không phụ thuộc phải nhớ gọi ở đúng chỗ,
// cứ gọi thừa cũng không sao, tốn kém duy nhất là 1 lần upload lại).
function markProductDirty(productId) {
  if (!productId) return;
  dirtyProductIds.add(productId);
  persistDirtyState();
}

// Gọi khi xoá hẳn 1 sản phẩm — không cần đẩy sản phẩm này lên nữa.
// (Lưu ý: file cũ của sản phẩm này trên GitHub, nếu đã từng đồng bộ trước
// đó, sẽ không tự bị xoá theo — hành vi này giống hệt bản trước khi tối ưu.)
function markProductDeleted(productId) {
  if (!productId) return;
  dirtyProductIds.delete(productId);
  persistDirtyState();
}

// sha1("blob " + length + "\0" + content) — chính là công thức GitHub dùng
// để tính sha cho mỗi file (content.sha trong Contents API). Tính được sha
// này từ nội dung cục bộ cho phép so sánh trực tiếp với sha cache mà KHÔNG
// cần gọi API để biết file có đổi hay không.
async function gitBlobSha1FromBase64(base64Content) {
  const binary = atob(base64Content);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
  const combined = new Uint8Array(header.length + bytes.length);
  combined.set(header, 0);
  combined.set(bytes, header.length);
  const digest = await crypto.subtle.digest("SHA-1", combined);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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

// Chỉ đóng gói upload cho: file index (luôn nhẹ, luôn cần cập nhật) + những
// sản phẩm đang "dirty". Sản phẩm không đổi bị bỏ qua hoàn toàn — kể cả
// việc đọc ảnh của nó — nên từ ~600 file mỗi lần đồng bộ giờ chỉ còn vài file.
async function buildGithubUploads(dirtyIds) {
  const uploads = [];

  // index payload — chỉ chứa thông tin sản phẩm + dữ liệu AI, KHÔNG chứa ảnh
  const indexPayload = stripBase64Fields(buildIndexPayload());
  assertNoBase64(indexPayload, "File index sản phẩm");
  uploads.push({
    path: GITHUB_PATH,
    content: utf8ToBase64(JSON.stringify(indexPayload)),
    message: "Cập nhật sản phẩm - index",
  });

  for (const id of dirtyIds) {
    const product = products[id];
    if (!product) continue; // đã bị xoá cục bộ trước khi kịp đồng bộ

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
        const githubPath = `data/${photoPath}`;

        // Dùng base64 đã cache sẵn lúc chụp ảnh nếu có — khỏi đọc lại Blob
        // từ IndexedDB rồi encode lại từ đầu.
        let base64 = pendingPhotoBase64.get(photoPath);
        if (!base64) {
          const blob = await getImageBlob(photoPath);
          if (!blob) continue;
          base64 = await blobToBase64(blob);
        }

        // Ảnh chụp xong không đổi nội dung nữa — nếu sha1 nội dung trùng với
        // sha đã biết là đang có trên GitHub thì bỏ qua hẳn, không upload lại.
        const contentSha = await gitBlobSha1FromBase64(base64);
        if (githubShaCache.get(githubPath) === contentSha) continue;

        uploads.push({
          path: githubPath,
          content: base64,
          message: `Upload ảnh sản phẩm ${product.name}`,
          contentSha,
        });
      }
    }
  }

  return uploads;
}

// Đẩy 1 file lên GitHub, tận dụng sha đã cache để KHÔNG cần gọi GET trước —
// chỉ khi PUT thất bại (sha cache lệch/thiếu, ví dụ lần đồng bộ đầu tiên hay
// file bị đổi từ nơi khác) mới lấy sha mới nhất rồi thử lại đúng 1 lần.
async function pushOneUpload(item, token) {
  const cachedSha = githubShaCache.get(item.path);
  let res = await uploadGithubFile(
    item.path,
    item.content,
    item.message,
    token,
    cachedSha,
  );

  if (!res.ok) {
    const freshSha = await getGithubFileSha(item.path, token);
    if (freshSha !== cachedSha) {
      res = await uploadGithubFile(
        item.path,
        item.content,
        item.message,
        token,
        freshSha,
      );
    }
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      `Upload ${item.path} thất bại: ${errData.message || res.status}`,
    );
  }

  const resultJson = await res.json().catch(() => null);
  const newSha = resultJson?.content?.sha || item.contentSha;
  if (newSha) githubShaCache.set(item.path, newSha);
}

// Upload song song theo nhóm (mặc định 5 file/đợt) thay vì GET->PUT tuần tự
// từng file một — nhanh hơn nhiều mà vẫn không vượt giới hạn rate-limit.
async function pushUploadsInBatches(uploads, token) {
  for (let i = 0; i < uploads.length; i += GITHUB_UPLOAD_BATCH_SIZE) {
    const batch = uploads.slice(i, i + GITHUB_UPLOAD_BATCH_SIZE);
    await Promise.all(batch.map((item) => pushOneUpload(item, token)));
  }
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

    await ensureSyncStateLoaded();

    // Chốt danh sách sản phẩm cần đẩy TẠI THỜI ĐIỂM BẮT ĐẦU — nếu người dùng
    // sửa thêm sản phẩm khác trong lúc đang đồng bộ, sản phẩm đó sẽ KHÔNG bị
    // xoá dirty ở cuối, nên vẫn còn nguyên để lần đồng bộ sau đẩy tiếp.
    const dirtyIdsSnapshot = new Set(dirtyProductIds);

    const uploads = await buildGithubUploads(dirtyIdsSnapshot);
    await pushUploadsInBatches(uploads, token);
    await persistShaCache();

    for (const id of dirtyIdsSnapshot) dirtyProductIds.delete(id);
    await persistDirtyState();
    pendingPhotoBase64.clear();

    setGithubLastSyncAt(Date.now());
    syncStatusEl.textContent =
      "Đã đồng bộ lên GitHub lúc " + new Date().toLocaleTimeString();
    toast("Đồng bộ lên GitHub thành công!");
    hasUnsyncedChanges = dirtyProductIds.size > 0;
  } catch (err) {
    console.error(err);
    syncStatusEl.textContent = "Lỗi đồng bộ: " + err.message;
    toast(err.message || "Đồng bộ thất bại, kiểm tra token/quyền truy cập repo.", true);
  }
}

pullGithubBtn.addEventListener("click", () => pullFromGithub(true));
pushGithubBtn.addEventListener("click", () => pushToGithub());
