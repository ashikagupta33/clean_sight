import { getHistory, getLatest, summarize } from "./store.js";
import { renderDonut, renderLegend } from "./charts.js";

const $ = (id) => document.getElementById(id);
const stats = summarize(getHistory());

$("stat-scans").textContent = stats.scans;
$("stat-waste").textContent = stats.total;
$("stat-top").textContent = stats.top || "—";

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

if (stats.total > 0) {
  $("breakdown-empty").hidden = true;
  $("breakdown-filled").hidden = false;
  renderDonut($("breakdown-chart"), stats.counts);
  renderLegend($("breakdown-legend"), stats.counts, { percent: true });
}
