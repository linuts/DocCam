const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const ctx = overlay.getContext("2d");

const videoWrap = document.getElementById("videoWrap");
const hint = document.getElementById("hint");

const btnFullscreen = document.getElementById("btnFullscreen");
const btnFreeze = document.getElementById("btnFreeze");
const btnInvert = document.getElementById("btnInvert");
const btnFlip = document.getElementById("btnFlip");
const btnRotate = document.getElementById("btnRotate");
const zoomSlider = document.getElementById("zoomSlider");
const btnToggleMenu = document.getElementById("btnToggleMenu");

const btnDraw = document.getElementById("btnDraw");
const btnErase = document.getElementById("btnErase");
const penSize = document.getElementById("penSize");
const penColor = document.getElementById("penColor");
const btnClear = document.getElementById("btnClear");
const colorPalette = document.getElementById("colorPalette");

const activeSwatch = colorPalette.querySelector(".color-swatch.active");
if (activeSwatch) penColor.value = activeSwatch.dataset.color;

const inputSelect = document.getElementById("inputSelect");

let currentStream = null;
let currentDeviceId = null;
let drawEnabled = false;
let eraserMode = false;
let rotation = 0;     // degrees (0, 90, 180, 270)
let zoom = 1;         // scale factor (0.25 - 3)
let mirrored = false; // horizontal flip
let frozen = false;
let offsetX = 0, offsetY = 0; // pan offsets in px

function updateRotateButton() {
  btnRotate.textContent = `Rotate - ${rotation}°`;
  btnRotate.classList.toggle("active", rotation !== 0);
}
updateRotateButton();

// track active pointers for pinch/drag gestures
const activePointers = new Map();
// track last points for active drawing pointers
const drawingPointers = new Map();
let lastPan = null;
let lastPinchDist = null;

function saveSettings(id) {
  if (!id) return;
  const settings = {
    rotation,
    zoom,
    mirrored,
    inverted: videoWrap.classList.contains("inverted"),
    offsetX,
    offsetY,
  };
  localStorage.setItem(`camSettings-${id}`, JSON.stringify(settings));
}

function loadSettings(id) {
  const data = localStorage.getItem(`camSettings-${id}`);
  if (data) {
    try {
      const s = JSON.parse(data);
      rotation = s.rotation || 0;
      zoom = s.zoom || 1;
      mirrored = s.mirrored || false;
      offsetX = s.offsetX || 0;
      offsetY = s.offsetY || 0;
      zoomSlider.value = zoom;
      btnFlip.classList.toggle("active", mirrored);
      updateRotateButton();
      if (s.inverted) videoWrap.classList.add("inverted");
      else videoWrap.classList.remove("inverted");
      btnInvert.classList.toggle("active", videoWrap.classList.contains("inverted"));
      applyTransform();
      return;
    } catch (e) {
      console.warn("Failed to load settings", e);
    }
  }
  rotation = 0;
  zoom = 1;
  mirrored = false;
  offsetX = 0;
  offsetY = 0;
  zoomSlider.value = 1;
  btnFlip.classList.remove("active");
  videoWrap.classList.remove("inverted");
  btnInvert.classList.remove("active");
  updateRotateButton();
  applyTransform();
}

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
  if (currentDeviceId) inputSelect.value = currentDeviceId;
}

async function startStream(deviceId = undefined) {
  if (currentDeviceId) saveSettings(currentDeviceId);
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
    // Determine the actual device ID of the stream
    const track = stream.getVideoTracks()[0];
    currentDeviceId = track.getSettings().deviceId || deviceId || null;
    inputSelect.value = currentDeviceId || "";
    localStorage.setItem("lastCamera", currentDeviceId || "");
    loadSettings(currentDeviceId);
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
  saveSettings(currentDeviceId);
});
btnRotate.addEventListener("click", () => {
  rotation = (rotation + 90) % 360;
  updateRotateButton();
  applyTransform();
  saveSettings(currentDeviceId);
});

// ---------- Flip ----------
btnFlip.addEventListener("click", () => {
  mirrored = !mirrored;
  btnFlip.classList.toggle("active", mirrored);
  applyTransform();
  saveSettings(currentDeviceId);
});

// ---------- Invert ----------
btnInvert.addEventListener("click", () => {
  videoWrap.classList.toggle("inverted");
  btnInvert.classList.toggle("active", videoWrap.classList.contains("inverted"));
  saveSettings(currentDeviceId);
});

// ---------- Fullscreen ----------
btnFullscreen.addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (e) {
    console.warn("Fullscreen not allowed:", e);
  }
});

// ---------- Freeze ----------
btnFreeze.addEventListener("click", () => {
  frozen = !frozen;
  if (frozen) {
    video.pause();
  } else {
    video.play();
  }
  btnFreeze.classList.toggle("active", frozen);
});

// ---------- Menu toggle ----------
btnToggleMenu.addEventListener("click", () => {
  document.body.classList.toggle("menu-collapsed");
  btnToggleMenu.textContent = document.body.classList.contains("menu-collapsed") ? "»" : "«";
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
  ctx.globalCompositeOperation = eraserMode ? "destination-out" : "source-over";
  ctx.strokeStyle = eraserMode ? "rgba(0,0,0,1)" : penColor.value;
  ctx.lineWidth = (parseInt(penSize.value, 10) || 4) * dpr / zoom;
  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
  drawingPointers.set(evt.pointerId, p);
}
function endDraw(evt) {
  drawingPointers.delete(evt.pointerId);
}

btnDraw.addEventListener("click", () => {
  const active = btnDraw.classList.toggle("active");
  btnErase.classList.remove("active");
  eraserMode = false;
  drawEnabled = active;
  overlay.style.cursor = active ? "crosshair" : "default";
});
btnErase.addEventListener("click", () => {
  const active = btnErase.classList.toggle("active");
  btnDraw.classList.remove("active");
  eraserMode = active;
  drawEnabled = active;
  overlay.style.cursor = active ? "crosshair" : "default";
});
btnClear.addEventListener("click", () => {
  ctx.clearRect(0, 0, overlay.width, overlay.height);
});

colorPalette.querySelectorAll(".color-swatch").forEach(btn => {
  btn.addEventListener("click", () => {
    penColor.value = btn.dataset.color;
    colorPalette.querySelectorAll(".color-swatch").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
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
  if (!drawEnabled && activePointers.size === 0) {
    saveSettings(currentDeviceId);
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
inputSelect.addEventListener("change", async () => {
  const id = inputSelect.value || undefined;
  await startStream(id);
});

// On load: request camera & populate inputs
(async () => {
  const last = localStorage.getItem("lastCamera");
  await startStream(last || undefined);
  try { await listVideoInputs(); } catch {}
})();

// Keep things crisp on orientation / resize changes
window.addEventListener("resize", () => setTimeout(resizeCanvasToVideo, 50));
document.addEventListener("fullscreenchange", () => setTimeout(resizeCanvasToVideo, 50));
