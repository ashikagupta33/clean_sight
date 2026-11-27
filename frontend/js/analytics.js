import { loadHistory, summarize } from "./store.js";
import { renderDonut, renderTrend, renderLegend } from "./charts.js";
import { showHistoryWarning } from "./navigation.js";

const $ = (id) => document.getElementById(id);

const { history, error } = await loadHistory();
if (error) showHistoryWarning($("history-alert"));

const stats = summarize(history);
$("stat-scans").textContent = stats.scans;
$("stat-waste").textContent = stats.total;

if (stats.total > 0) {
  $("dist-empty").hidden = true;
  $("dist-filled").hidden = false;
  renderDonut($("dist-chart"), stats.counts);
  renderLegend($("dist-legend"), stats.counts, { percent: true });
}

if (stats.byDay.length > 0) {
  $("trend-empty").hidden = true;
  $("trend-filled").hidden = false;
  renderTrend($("trend-chart"), stats.byDay);
}
