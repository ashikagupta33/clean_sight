/**
 * Compare Cleanup page: detects waste in a "before" and an "after" photo of the same place
 * and shows the change per category. Both images go through the same POST /detect call as
 * the Scan page, so both scans are also recorded in the history.
 */
import { CATEGORIES } from "./config.js";
import { detectWaste, checkHealth } from "./api.js";
import { validateImageFile, detectionErrorMessage } from "./upload.js";
import { loadImage, renderToDataUrl } from "./imaging.js";
import { icon } from "./navigation.js";

const IMAGE_MAX_SIDE = 1400; // annotated images are shown at most this large
const $ = (id) => document.getElementById(id);

let busy = false;

/** One entry per side: its DOM nodes and the currently chosen file. */
const slots = Object.fromEntries(
  [...document.querySelectorAll(".slot")].map((el) => [
    el.dataset.side,
    {
      el,
      input: el.querySelector('input[type="file"]'),
      drop: el.querySelector(".slot__drop"),
      figure: el.querySelector(".slot__figure"),
      img: el.querySelector(".slot__img"),
      name: el.querySelector(".slot__name"),
      total: el.querySelector(".slot__total"),
      file: null,
      objectUrl: null,
    },
  ])
);

// ---------------------------------------------------------------- alerts

function showAlert(type, message, retry) {
  const box = $("compare-alert");
  const wrap = document.createElement("div");
  wrap.className = `alert alert--${type}`;
  wrap.insertAdjacentHTML("afterbegin", icon(type === "success" ? "circle-check" : "circle-alert"));
  const body = document.createElement("div");
  body.className = "alert__body";
  body.textContent = message;
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
const clearAlert = () => { $("compare-alert").hidden = true; $("compare-alert").replaceChildren(); };

// ---------------------------------------------------------------- file selection

function setFile(slot, files) {
  if (!files || !files.length || busy) return;
  clearAlert();
  if (files.length > 1) return showAlert("error", "Choose one image per side.");
  // Keep a reference first: clearSlot() resets the input, which empties its live FileList.
  const file = files[0];
  const error = validateImageFile(file);
  if (error) return showAlert("error", error);

  clearSlot(slot);
  slot.file = file;
  slot.objectUrl = URL.createObjectURL(slot.file);
  slot.img.src = slot.objectUrl;
  slot.name.textContent = slot.file.name;
  slot.drop.hidden = true;
  slot.figure.hidden = false;
  hideResults();
  updateButton();
}

function clearSlot(slot) {
  if (slot.objectUrl) URL.revokeObjectURL(slot.objectUrl);
  Object.assign(slot, { file: null, objectUrl: null });
  slot.img.removeAttribute("src");
  slot.input.value = "";
  slot.total.hidden = true;
  slot.drop.hidden = false;
  slot.figure.hidden = true;
}

function updateButton() {
  $("compare-btn").disabled = busy || !slots.before.file || !slots.after.file;
}

function setBusy(on) {
  busy = on;
  updateButton();
  $("reset-btn").disabled = on;
  document.querySelectorAll('[data-action="remove"], [data-action="choose"]').forEach((b) => (b.disabled = on));
  $("compare-spinner").hidden = !on;
  $("compare-label").textContent = on ? "Detecting…" : "Compare Images";
}

function hideResults() {
  $("results").hidden = true;
}

function reset() {
  clearSlot(slots.before);
  clearSlot(slots.after);
  clearAlert();
  hideResults();
  updateButton();
}

// ---------------------------------------------------------------- detection

async function detectSide(slot) {
  const original = await loadImage(slot.objectUrl);
  const result = await detectWaste(slot.file, { width: original.naturalWidth, height: original.naturalHeight });
  return { result, annotated: renderToDataUrl(original, IMAGE_MAX_SIDE, result.detections) };
}

async function runComparison() {
  if (busy || !slots.before.file || !slots.after.file) return;
  clearAlert();
  setBusy(true);
  try {
    // Both requests run at the same time; if either fails, the comparison is not shown.
    const [before, after] = await Promise.all([detectSide(slots.before), detectSide(slots.after)]);

    for (const [slot, side] of [[slots.before, before], [slots.after, after]]) {
      slot.img.src = side.annotated;
      slot.total.textContent = `${side.result.total} ${side.result.total === 1 ? "item" : "items"}`;
      slot.total.hidden = false;
    }
    renderResults(before.result, after.result);
    if (before.result.isMock) showAlert("warning", "Demo data generated locally for layout testing. This is not a real detection.");
  } catch (err) {
    console.error(err);
    showAlert("error", detectionErrorMessage(err), runComparison);
  } finally {
    setBusy(false);
  }
}

// ---------------------------------------------------------------- results

/** Percentage change from `before` to `after`, or null when there is nothing to compare against. */
const percentChange = (before, after) => (before > 0 ? ((after - before) / before) * 100 : null);

function changeCell(before, after) {
  const td = document.createElement("td");
  td.className = "num";
  const pct = percentChange(before, after);
  if (pct === null) {
    td.textContent = after > 0 ? `+${after}` : "—";
    if (after > 0) td.classList.add("change--up");
  } else {
    td.textContent = `${pct > 0 ? "+" : ""}${Math.round(pct)}%`;
    if (pct < 0) td.classList.add("change--down");
    if (pct > 0) td.classList.add("change--up");
  }
  return td;
}

function row(cells, swatchColor) {
  const tr = document.createElement("tr");
  cells.forEach((value, i) => {
    if (value instanceof HTMLElement) return tr.append(value);
    const td = document.createElement("td");
    if (i === 0) {
      const wrap = document.createElement("span");
      wrap.className = "compare-table__cat";
      if (swatchColor) {
        const sw = document.createElement("span");
        sw.className = "legend__swatch";
        sw.style.background = swatchColor;
        wrap.append(sw);
      }
      wrap.append(document.createTextNode(value));
      td.append(wrap);
    } else {
      td.className = "num";
      td.textContent = value;
    }
    tr.append(td);
  });
  return tr;
}

function renderResults(before, after) {
  $("before-total").textContent = before.total;
  $("after-total").textContent = after.total;

  const pct = percentChange(before.total, after.total);
  if (pct === null) {
    $("change-label").textContent = "Waste reduction";
    $("change-value").textContent = "—";
  } else if (pct <= 0) {
    $("change-label").textContent = "Waste reduction";
    $("change-value").textContent = `${Math.round(-pct)}%`;
  } else {
    $("change-label").textContent = "Waste increase";
    $("change-value").textContent = `${Math.round(pct)}%`;
  }

  const rows = CATEGORIES.map((c) =>
    row([c.name, before.counts[c.name] || 0, after.counts[c.name] || 0, changeCell(before.counts[c.name] || 0, after.counts[c.name] || 0)], c.color)
  );
  const totalRow = row(["Total", before.total, after.total, changeCell(before.total, after.total)]);
  totalRow.classList.add("compare-table__total");
  $("category-rows").replaceChildren(...rows, totalRow);

  let note;
  if (before.total === 0 && after.total === 0) note = "No waste was detected in either image.";
  else if (before.total === 0) note = "No waste was detected in the before image, so a percentage change can't be calculated.";
  else if (after.total === 0) note = "No waste was detected after the cleanup.";
  else note = "Detections are counted the same way as on the Scan page. Both scans were added to the history.";
  $("compare-note").textContent = note;

  $("results").hidden = false;
  $("results").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

// ---------------------------------------------------------------- wiring

for (const slot of Object.values(slots)) {
  slot.el.querySelector('[data-action="choose"]').addEventListener("click", () => slot.input.click());
  slot.el.querySelector('[data-action="remove"]').addEventListener("click", () => { clearSlot(slot); hideResults(); updateButton(); });
  slot.input.addEventListener("change", (e) => setFile(slot, e.target.files));
  slot.img.addEventListener("error", () => {
    if (!slot.file) return;
    clearSlot(slot);
    updateButton();
    showAlert("error", "This file couldn't be read as an image. Choose a different one.");
  });

  ["dragenter", "dragover"].forEach((t) => slot.drop.addEventListener(t, (e) => { e.preventDefault(); slot.drop.classList.add("is-dragover"); }));
  ["dragleave", "drop"].forEach((t) => slot.drop.addEventListener(t, (e) => { e.preventDefault(); slot.drop.classList.remove("is-dragover"); }));
  slot.drop.addEventListener("drop", (e) => setFile(slot, e.dataTransfer.files));
}
["dragover", "drop"].forEach((t) => window.addEventListener(t, (e) => e.preventDefault())); // stop the browser opening a missed drop

$("compare-btn").addEventListener("click", runComparison);
$("reset-btn").addEventListener("click", reset);

checkHealth().then((ok) => {
  if (!ok && $("compare-alert").hidden) showAlert("warning", "The detection service isn't reachable right now. Comparison will fail until it is.");
});
