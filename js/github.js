// ====================================================
// GITHUB.JS — ĐỒNG BỘ DỮ LIỆU QUA GITHUB (đọc công khai, ghi cần token)
// ====================================================

const githubTokenInput = document.querySelector("#github-token");
const pullGithubBtn = document.querySelector("#pull-github-btn");
const pushGithubBtn = document.querySelector("#push-github-btn");
const syncStatusEl = document.querySelector("#sync-status");

function githubRawUrl() {
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_PATH}`;
}
function githubApiUrl() {
  return `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`;
}

async function pullFromGithub(notifyIfEmpty = true) {
  if (!GITHUB_CONFIGURED) {
    if (notifyIfEmpty) toast("Chưa cấu hình repo GitHub trong js/app.js!", true);
    return;
  }
  // Nếu admin bấm nút "Tải mới nhất" thủ công nhưng đang có thay đổi cục bộ
  // chưa đẩy lên GitHub thì hỏi lại trước, tránh bấm nhầm làm mất dữ liệu.
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
    if (syncStatusEl)
      syncStatusEl.textContent =
        "Đã tải dữ liệu mới nhất lúc " + new Date().toLocaleTimeString();
    if (notifyIfEmpty) toast("Đã đồng bộ dữ liệu mới nhất từ GitHub!");
  } catch (err) {
    console.error(err);
    if (notifyIfEmpty) toast("Lỗi khi tải dữ liệu từ GitHub.", true);
  }
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

  const payload = buildDataPayload();
  const content = utf8ToBase64(JSON.stringify(payload));

  try {
    let sha;
    const getRes = await fetch(githubApiUrl(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (getRes.ok) {
      const info = await getRes.json();
      sha = info.sha;
    }

    const putRes = await fetch(githubApiUrl(), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Cập nhật dữ liệu sản phẩm",
        content,
        sha,
        branch: GITHUB_BRANCH,
      }),
    });

    if (putRes.ok) {
      syncStatusEl.textContent =
        "Đã đồng bộ lên GitHub lúc " + new Date().toLocaleTimeString();
      toast("Đồng bộ lên GitHub thành công!");
      // Dữ liệu cục bộ giờ đã khớp với GitHub -> không còn thay đổi "chưa đồng bộ" nữa.
      hasUnsyncedChanges = false;
    } else {
      const errData = await putRes.json();
      syncStatusEl.textContent =
        "Lỗi đồng bộ: " + (errData.message || putRes.status);
      toast("Đồng bộ thất bại, kiểm tra token/quyền truy cập repo.", true);
    }
  } catch (err) {
    console.error(err);
    syncStatusEl.textContent = "Lỗi kết nối tới GitHub.";
    toast("Lỗi kết nối tới GitHub.", true);
  }
}

pullGithubBtn.addEventListener("click", () => pullFromGithub(true));
pushGithubBtn.addEventListener("click", () => pushToGithub());
