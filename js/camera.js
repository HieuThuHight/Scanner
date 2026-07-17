// ====================================================
// CAMERA.JS — QUẢN LÝ CAMERA DÙNG CHUNG (video stream thô)
// ====================================================

const video = document.querySelector("#video");
const videoWrap = document.querySelector("#video-wrap");
const videoWrapDefaultParent = videoWrap.parentElement; // #camera-view (vị trí gốc)

// Di chuyển khung video sống vào 1 khung khác (ví dụ khung chụp ảnh trong Admin)
// rồi trả lại đúng vị trí gốc khi đóng, để camera luôn hiện đúng chỗ đang dùng.
function moveVideoTo(container) {
  if (container) container.appendChild(videoWrap);
}
function restoreVideoToDefault() {
  if (videoWrapDefaultParent) videoWrapDefaultParent.appendChild(videoWrap);
}

async function openCamera() {
  if (cameraStream) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error(
      "Trình duyệt không hỗ trợ camera, hoặc trang đang chạy qua HTTP (không phải HTTPS/localhost).",
    );
  }
  cameraStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
    audio: false,
  });
  video.srcObject = cameraStream;
  videoWrap.classList.remove("hidden");
}

function closeCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
  videoWrap.classList.add("hidden");
}
