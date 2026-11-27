import { loadHistory, getLatest, summarize } from "./store.js";
import { renderDonut, renderLegend } from "./charts.js";
import { showHistoryWarning } from "./navigation.js";

const $ = (id) => document.getElementById(id);

// The latest scan (with its image) is kept on this device, so it shows even if the backend is down.
const latest = getLatest();
if (latest) {
  $("latest-empty").hidden = true;
  $("latest-filled").hidden = false;
  const img = $("latest-img");
  if (latest.annotatedImage) img.src = latest.annotatedImage;
  else img.hidden = true;
  const when = new Date(latest.timestamp).toLocaleString();
  $("latest-summary").textContent = `${latest.total} ${latest.total === 1 ? "item" : "items"} detected · ${when}`;
  $("latest-details").href = "pages/scan.html?view=latest";
}

const { history, error } = await loadHistory();
if (error) showHistoryWarning($("history-alert"));

const stats = summarize(history);
$("stat-scans").textContent = stats.scans;
$("stat-waste").textContent = stats.total;
$("stat-top").textContent = stats.top || "—";

if (stats.total > 0) {
  $("breakdown-empty").hidden = true;
  $("breakdown-filled").hidden = false;
  renderDonut($("breakdown-chart"), stats.counts);
  renderLegend($("breakdown-legend"), stats.counts, { percent: true });
}
