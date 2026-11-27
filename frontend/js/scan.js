import { CATEGORIES } from "./config.js";
import { detectWaste, checkHealth } from "./api.js";
import { validateImageFile, detectionErrorMessage } from "./upload.js";
import { loadImage, renderToDataUrl } from "./imaging.js";
import { addScan, getLatest } from "./store.js";
import { generateReport } from "./reports.js";
import { icon } from "./navigation.js";

const $ = (id) => document.getElementById(id);
const sections = { upload: $("upload-section"), preview: $("preview-section"), results: $("results-section") };
const IMAGE_MAX_SIDE = 1000; // downscale stored/PDF images to keep localStorage and the PDF small

let file = null, objectUrl = null, busy = false, currentScan = null;

const show = (name) => Object.entries(sections).forEach(([k, el]) => (el.hidden = k !== name));

function showAlert(type, message, retry) {
  const box = $("scan-alert");
  const wrap = document.createElement("div");
  wrap.className = `alert alert--${type}`;
  const body = document.createElement("div");
  body.className = "alert__body";
  body.textContent = message;
  wrap.insertAdjacentHTML("afterbegin", icon(type === "success" ? "circle-check" : "circle-alert"));
  wrap.append(body);
  if (retry) {
    const btn = document.createElement("button");
    btn.className = "btn btn--secondary";
    btn.type = "button";
    btn.textContent = "Try again";
    btn.addEventListener("click", retry);
    wrap.append(btn);
  }
  box.replaceChildren(wrap);
  box.hidden = false;
}
const clearAlert = () => { $("scan-alert").hidden = true; $("scan-alert").replaceChildren(); };


function handleFiles(files) {
  if (!files || !files.length || busy) return;
  clearAlert();
  if (files.length > 1) return showAlert("error", "Choose one image at a time.");
  const error = validateImageFile(files[0]);
  if (error) return showAlert("error", error);

  file = files[0];
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  $("preview-img").src = objectUrl;
  $("preview-name").textContent = file.name;
  $("preview-size").textContent = `${(file.size / 1048576).toFixed(2)} MB`;
  show("preview");
}

function reset() {
  file = null;
  currentScan = null;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = null;
  $("file-input").value = "";
  clearAlert();
  show("upload");
  if (location.search) history.replaceState(null, "", location.pathname);
}


function setBusy(on) {
  busy = on;
  $("detect-btn").disabled = on;
  $("remove-btn").disabled = on;
  $("replace-btn").disabled = on;
  $("detect-spinner").hidden = !on;
  $("detect-label").textContent = on ? "Detecting…" : "Run Detection";
}

async function runDetection() {
  if (busy || !file) return;
  clearAlert();
  setBusy(true);
  try {
    const original = await loadImage(objectUrl);
    const result = await detectWaste(file, { width: original.naturalWidth, height: original.naturalHeight });

    let annotatedImage = null;
    if (result.annotatedSrc) {
      try { annotatedImage = renderToDataUrl(await loadImage(result.annotatedSrc, true), IMAGE_MAX_SIDE); } catch { /* fall through */ }
    }
    annotatedImage = annotatedImage || renderToDataUrl(original, IMAGE_MAX_SIDE, result.detections);

    currentScan = {
      id: result.scanId || `${Date.now()}`,
      timestamp: result.timestamp || new Date().toISOString(),
      fileName: file.name,
      total: result.total,
      counts: result.counts,
      detections: result.detections,
      originalImage: renderToDataUrl(original, IMAGE_MAX_SIDE),
      annotatedImage,
      isMock: result.isMock,
    };
    if (!result.isMock && !addScan(currentScan)) console.warn("CleanSight: could not keep the latest scan in localStorage");
    renderResults(currentScan);
  } catch (err) {
    console.error(err);
    showAlert("error", detectionErrorMessage(err), runDetection);
  } finally {
    setBusy(false);
  }
}

function renderResults(scan) {
  $("annotated-img").src = scan.annotatedImage || scan.originalImage || "";
  $("results-total").textContent = scan.total;
  $("results-time").textContent = `Inspected ${new Date(scan.timestamp).toLocaleString()}`;

  $("results-categories").replaceChildren(
    ...CATEGORIES.map((c) => {
      const li = document.createElement("li");
      li.className = "legend__item";
      li.innerHTML = '<span class="legend__swatch"></span><span class="legend__name"></span><span class="legend__value"></span>';
      li.firstChild.style.background = c.color;
      li.children[1].textContent = c.name;
      li.children[2].textContent = scan.counts[c.name] || 0;
      return li;
    })
  );

  $("results-detections").replaceChildren(
    ...scan.detections.map((d) => {
      const li = document.createElement("li");
      li.className = "det-list__row";
      const a = document.createElement("span");
      a.textContent = d.label;
      const b = document.createElement("span");
      b.className = "num text-muted";
      b.textContent = d.confidence == null ? "" : `${Math.round(d.confidence * 100)}%`;
      li.append(a, b);
      return li;
    })
  );

  show("results");
  if (scan.isMock) showAlert("warning", "Demo data generated locally for layout testing. This is not a real detection and was not saved.");
  else if (scan.total === 0) showAlert("success", "No waste detected in this image.");
}

async function downloadReport() {
  if (!currentScan) return;
  const btn = $("report-btn");
  btn.disabled = true;
  try {
    await generateReport(currentScan);
  } catch (err) {
    console.error(err);
    showAlert("error", "The PDF report couldn't be created. Try again.");
  } finally {
    btn.disabled = false;
  }
}

// --- wiring ---
$("choose-btn").addEventListener("click", () => $("file-input").click());
$("replace-btn").addEventListener("click", () => $("file-input").click());
$("file-input").addEventListener("change", (e) => { handleFiles(e.target.files); e.target.value = ""; });
$("remove-btn").addEventListener("click", reset);
$("again-btn").addEventListener("click", reset);
$("detect-btn").addEventListener("click", runDetection);
$("report-btn").addEventListener("click", downloadReport);
$("preview-img").addEventListener("error", () => { reset(); showAlert("error", "This file couldn't be read as an image. Choose a different one."); });

const dz = $("dropzone");
["dragenter", "dragover"].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.add("is-dragover"); }));
["dragleave", "drop"].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.remove("is-dragover"); }));
dz.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));
["dragover", "drop"].forEach((t) => window.addEventListener(t, (e) => e.preventDefault())); // stop the browser opening a missed drop

// --- initial state ---
if (new URLSearchParams(location.search).get("view") === "latest") {
  const latest = getLatest();
  if (latest) { currentScan = latest; renderResults(latest); }
  else showAlert("warning", "No saved scan found. Upload an image to run one.");
} else {
  checkHealth().then((ok) => {
    if (!ok && !file && $("scan-alert").hidden) showAlert("warning", "The detection service isn't reachable right now. Detection will fail until it is.");
  });
}
