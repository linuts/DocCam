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
let rotation = 0;     // degrees (0, 90, 180, 270)
let zoom = 1;         // scale factor (0.25 - 3)
let mirrored = false; // horizontal flip
let offsetX = 0, offsetY = 0; // pan offsets in px

// track active pointers for pinch/drag gestures
const activePointers = new Map();
// track last points for active drawing pointers
const drawingPointers = new Map();
let lastPan = null;
let lastPinchDist = null;

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
    // Ensure overlay matches the actual video size once metadata is ready
    video.addEventListener("loadedmetadata", resizeCanvasToVideo, { once: true });

    // On first permission grant, populate labels for inputs
    await listVideoInputs();
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
  const t = `translate(${offsetX}px, ${offsetY}px) scaleX(${scaleX}) rotate(${rotation}deg) scale(${zoom})`;
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
  drawingPointers.set(evt.pointerId, toLocalPoint(evt));
}
function moveDraw(evt) {
  const last = drawingPointers.get(evt.pointerId);
  if (!last) return;
  const p = toLocalPoint(evt);
  const dpr = window.devicePixelRatio || 1;
  ctx.strokeStyle = penColor.value;
  ctx.lineWidth = (parseInt(penSize.value, 10) || 4) * dpr / zoom;
  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  drawingPointers.set(evt.pointerId, p);
}
function endDraw(evt) {
  drawingPointers.delete(evt.pointerId);
}

btnDraw.addEventListener("click", () => {
  drawEnabled = !drawEnabled;
  btnDraw.classList.toggle("active", drawEnabled);
  overlay.style.cursor = drawEnabled ? "crosshair" : "default";
});
btnClear.addEventListener("click", () => {
  ctx.clearRect(0, 0, overlay.width, overlay.height);
});

overlay.addEventListener("pointerdown", (e) => {
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  overlay.setPointerCapture(e.pointerId);

  if (drawEnabled) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    beginDraw(e);
    return;
  }

  if (activePointers.size === 1) {
    lastPan = { x: e.clientX, y: e.clientY };
  } else if (activePointers.size === 2) {
    const pts = Array.from(activePointers.values());
    lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }
});

overlay.addEventListener("pointermove", (e) => {
  if (!activePointers.has(e.pointerId)) return;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (drawEnabled) {
    moveDraw(e);
    return;
  }

  if (!drawEnabled) {
    if (activePointers.size === 1 && lastPan) {
      const dx = e.clientX - lastPan.x;
      const dy = e.clientY - lastPan.y;
      offsetX += dx;
      offsetY += dy;
      lastPan = { x: e.clientX, y: e.clientY };
      applyTransform();
    } else if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      if (lastPinchDist) {
        let ratio = dist / lastPinchDist;
        let newZoom = Math.min(3, Math.max(0.25, zoom * ratio));
        const rect = overlay.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        offsetX += (midX - cx) * (1 - newZoom / zoom);
        offsetY += (midY - cy) * (1 - newZoom / zoom);
        zoom = newZoom;
        zoomSlider.value = zoom;
        applyTransform();
      }
      lastPinchDist = dist;
    }
  }
});

function finishPointer(e) {
  activePointers.delete(e.pointerId);
  if (drawingPointers.has(e.pointerId)) {
    endDraw(e);
  }
  if (activePointers.size < 2) {
    lastPinchDist = null;
  }
  if (!drawEnabled && activePointers.size === 1) {
    const [p] = activePointers.values();
    lastPan = { x: p.x, y: p.y };
  } else {
    lastPan = null;
  }
}
overlay.addEventListener("pointerup", finishPointer);
overlay.addEventListener("pointercancel", finishPointer);
overlay.addEventListener("pointerleave", finishPointer);

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
