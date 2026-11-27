/**
 * Scan history.
 *
 * The history itself lives on the backend (SQLite, GET /history), so every browser and
 * every device sees the same Dashboard and Analytics. The backend records a scan as part
 * of POST /detect, so the frontend never has to send it separately.
 *
 * The browser still keeps the LATEST scan in localStorage, including its images, because
 * the backend deliberately does not store images. That copy powers "View Details" and the
 * Latest Detection card on this device.
 */
import { emptyCounts, CATEGORIES, categoryFor } from "./config.js";
import { fetchHistory } from "./api.js";

const LATEST_KEY = "cleansight.latest.v1";

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export const getLatest = () => read(LATEST_KEY, null);

/**
 * Loads the scan history from the backend.
 * Resolves to { history, error }. `history` is [] and `error` is set if the backend failed,
 * so pages can show an empty state with a warning instead of breaking.
 * Each record: { id, timestamp, total, counts } with counts grouped by display category.
 */
export async function loadHistory() {
  try {
    const scans = await fetchHistory();
    return { history: scans.map(toCategoryRecord), error: null };
  } catch (error) {
    console.warn("CleanSight: could not load history from the backend", error);
    return { history: [], error };
  }
}

/** Server counts use model labels ("bottle", "can", ...); the UI groups them into categories. */
function toCategoryRecord(scan) {
  const counts = emptyCounts();
  for (const [label, n] of Object.entries(scan.counts || {})) {
    if (Number.isFinite(n)) counts[categoryFor(label)] += n;
  }
  return { id: scan.id, timestamp: scan.timestamp, total: scan.total, counts };
}

/**
 * Keeps the latest real scan (with images) on this device. The backend already stored the
 * numbers during POST /detect. Returns false if the browser refused to store it.
 */
export function addScan(scan) {
  try {
    localStorage.setItem(LATEST_KEY, JSON.stringify(scan));
    return true;
  } catch {
    try { // storage full: keep the numbers, drop the images
      localStorage.setItem(LATEST_KEY, JSON.stringify({ ...scan, originalImage: null, annotatedImage: null }));
      return true;
    } catch {
      return false;
    }
  }
}

const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function summarize(history) {
  const counts = emptyCounts();
  const days = new Map();
  let total = 0;
  for (const r of history) {
    total += r.total;
    CATEGORIES.forEach((c) => (counts[c.name] += r.counts?.[c.name] || 0));
    const k = dayKey(r.timestamp);
    days.set(k, (days.get(k) || 0) + r.total);
  }
  const top = total > 0 ? CATEGORIES.map((c) => c.name).reduce((a, b) => (counts[b] > counts[a] ? b : a)) : null;
  const byDay = [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, n]) => ({ day, total: n }));
  return { scans: history.length, total, counts, top, byDay };
}
