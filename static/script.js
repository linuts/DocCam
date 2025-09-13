const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const ctx = overlay.getContext("2d");

const videoWrap = document.getElementById("videoWrap");
const hint = document.getElementById("hint");

const btnFullscreen = document.getElementById("btnFullscreen");
const btnInvert = document.getElementById("btnInvert");
const btnMirror = document.getElementById("btnMirror");
const btnRotate = document.getElementById("btnRotate");
const zoomSlider = document.getElementById("zoomSlider");

const btnDraw = document.getElementById("btnDraw");
const penSize = document.getElementById("penSize");
const penColor = document.getElementById("penColor");
const btnClear = document.getElementById("btnClear");

const inputSelect = document.getElementById("inputSelect");
const btnApplyInput = document.getElementById("btnApplyInput");

let currentStream = null;
let drawEnabled = false;
let drawing = false;
let last = null;
let rotation = 0;     // degrees (0, 90, 180, 270)
let zoom = 1;         // scale factor (0.25 - 3)
let mirrored = false; // horizontal flip

// ---------- Camera handling ----------
async function listVideoInputs() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cams = devices.filter(d => d.kind === "videoinput");
  inputSelect.innerHTML = "";
  cams.forEach((d, i) => {
    const opt = document.createElement("option");
    opt.value = d.deviceId;
    opt.textContent = d.label || `Camera ${i + 1}`;
    inputSelect.appendChild(opt);
  });
}

async function startStream(deviceId = undefined) {
  // Stop previous
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }

  const constraints = {
    video: deviceId ? { deviceId: { exact: deviceId } } : {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      facingMode: "environment" // prefer rear camera on mobile
    },
    audio: false
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    currentStream = stream;
    hint.style.display = "none";

    // On first permission grant, populate labels for inputs
    await listVideoInputs();

    // Resize canvas to match the rendered video area
    requestAnimationFrame(resizeCanvasToVideo);
  } catch (err) {
    console.error(err);
    hint.textContent = "Camera access failed. Check permissions or device.";
    hint.style.display = "block";
  }
}

function resizeCanvasToVideo() {
  // Match overlay to the visible video box size while preserving drawings
  const rect = video.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  // Save current drawing
  const prev = document.createElement("canvas");
  prev.width = overlay.width;
  prev.height = overlay.height;
  prev.getContext("2d").drawImage(overlay, 0, 0);

  overlay.width = Math.max(2, Math.floor(rect.width * dpr));
  overlay.height = Math.max(2, Math.floor(rect.height * dpr));
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  // Scale previous drawing to new size
  ctx.drawImage(prev, 0, 0, prev.width, prev.height, 0, 0, overlay.width, overlay.height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

// Size the drawing canvas when the stream starts and on explicit resize
// events so drawings persist through zoom/rotate/mirror transforms.

// ---------- Transform handling (rotate + zoom) ----------
function applyTransform() {
  const scaleX = mirrored ? -1 : 1;
  const t = `scaleX(${scaleX}) rotate(${rotation}deg) scale(${zoom})`;
  video.style.transform = t;
  overlay.style.transform = t;
}
zoomSlider.addEventListener("input", () => {
  zoom = parseFloat(zoomSlider.value);
  applyTransform();
});
btnRotate.addEventListener("click", () => {
  rotation = (rotation + 90) % 360;
  applyTransform();
});

// ---------- Mirror ----------
btnMirror.addEventListener("click", () => {
  mirrored = !mirrored;
  btnMirror.classList.toggle("active", mirrored);
  applyTransform();
});

// ---------- Invert ----------
btnInvert.addEventListener("click", () => {
  videoWrap.classList.toggle("inverted");
  btnInvert.classList.toggle("active", videoWrap.classList.contains("inverted"));
});

// ---------- Fullscreen ----------
btnFullscreen.addEventListener("click", async () => {
  const el = document.documentElement; // or videoWrap
  try {
    if (!document.fullscreenElement) {
      await (videoWrap.requestFullscreen?.call(videoWrap) || el.requestFullscreen());
    } else {
      await document.exitFullscreen();
    }
  } catch (e) {
    console.warn("Fullscreen not allowed:", e);
  }
});

// ---------- Draw tool ----------
function toLocalPoint(evt) {
  const rect = overlay.getBoundingClientRect();
  // Coordinates relative to center of the element
  let x = evt.clientX - (rect.left + rect.width / 2);
  let y = evt.clientY - (rect.top + rect.height / 2);

  // Undo overall zoom
  x /= zoom;
  y /= zoom;

  // Undo rotation
  switch (rotation) {
    case 90:
      [x, y] = [y, -x];
      break;
    case 180:
      x = -x; y = -y;
      break;
    case 270:
      [x, y] = [-y, x];
      break;
  }

  // Undo mirroring
  if (mirrored) x = -x;

  // Convert back to top-left origin and device pixels
  const dpr = window.devicePixelRatio || 1;
  x = (x + overlay.clientWidth / 2) * dpr;
  y = (y + overlay.clientHeight / 2) * dpr;
  return { x, y };
}
function beginDraw(evt) {
  if (!drawEnabled) return;
  drawing = true;
  last = toLocalPoint(evt);
}
function moveDraw(evt) {
  if (!drawing || !drawEnabled) return;
  const p = toLocalPoint(evt);
  const dpr = window.devicePixelRatio || 1;
  ctx.strokeStyle = penColor.value;
  ctx.lineWidth = (parseInt(penSize.value, 10) || 4) * dpr / zoom;
  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  last = p;
}
function endDraw() { drawing = false; last = null; }

btnDraw.addEventListener("click", () => {
  drawEnabled = !drawEnabled;
  btnDraw.classList.toggle("active", drawEnabled);
  overlay.style.cursor = drawEnabled ? "crosshair" : "default";
});
btnClear.addEventListener("click", () => {
  ctx.clearRect(0, 0, overlay.width, overlay.height);
});

overlay.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return; // only react to left mouse button
  e.preventDefault();
  overlay.setPointerCapture(e.pointerId);
  beginDraw(e);
});
overlay.addEventListener("pointermove", moveDraw);
overlay.addEventListener("pointerup", endDraw);
overlay.addEventListener("pointercancel", endDraw);
overlay.addEventListener("pointerleave", endDraw);

// ---------- Input selection ----------
btnApplyInput.addEventListener("click", async () => {
  const id = inputSelect.value || undefined;
  await startStream(id);
});

// On load: request camera & populate inputs
(async () => {
  // Request initial camera to populate labels
  await startStream();
  // For browsers that require enumerate after permission
  try { await listVideoInputs(); } catch {}
})();

// Keep things crisp on orientation / resize changes
window.addEventListener("resize", () => setTimeout(resizeCanvasToVideo, 50));
document.addEventListener("fullscreenchange", () => setTimeout(resizeCanvasToVideo, 50));
