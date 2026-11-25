/**
 * Scan history kept in this browser's localStorage (per device).
 * Swap this module for a backend call if a history/stats endpoint is added later;
 * dashboard.js and analytics.js only use the functions exported here.
 */
import { emptyCounts, CATEGORIES } from "./config.js";

const HISTORY_KEY = "cleansight.history.v1";
const LATEST_KEY = "cleansight.latest.v1";
const MAX_RECORDS = 500;

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export const getHistory = () => read(HISTORY_KEY, []);
export const getLatest = () => read(LATEST_KEY, null);

/** Records a real scan. Returns false if the browser refused to store it. */
export function addScan(scan) {
  try {
    const history = getHistory();
    history.push({ id: scan.id, timestamp: scan.timestamp, total: scan.total, counts: scan.counts });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_RECORDS)));
  } catch {
    return false;
  }
  try {
    localStorage.setItem(LATEST_KEY, JSON.stringify(scan));
  } catch {
    try { // storage full: keep the numbers, drop the images
      localStorage.setItem(LATEST_KEY, JSON.stringify({ ...scan, originalImage: null, annotatedImage: null }));
    } catch { /* ignore */ }
  }
  return true;
}

const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function summarize(history = getHistory()) {
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
