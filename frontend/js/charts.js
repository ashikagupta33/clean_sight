import { CATEGORIES } from "./config.js";

const Chart = window.Chart;
if (Chart) {
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = "#5A625C";
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) Chart.defaults.animation = false;
}

export function renderDonut(canvas, counts, previous) {
  if (previous) previous.destroy();
  return new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: CATEGORIES.map((c) => c.name),
      datasets: [{ data: CATEGORIES.map((c) => counts[c.name] || 0), backgroundColor: CATEGORIES.map((c) => c.color), borderColor: "#FBF9F4", borderWidth: 2 }],
    },
    options: { cutout: "68%", maintainAspectRatio: false, plugins: { legend: { display: false } } },
  });
}

export function renderTrend(canvas, byDay, previous) {
  if (previous) previous.destroy();
  const fmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: byDay.map((d) => fmt.format(new Date(`${d.day}T00:00:00`))),
      datasets: [{ label: "Waste detected", data: byDay.map((d) => d.total), backgroundColor: "#1F3D2B", borderRadius: 4, maxBarThickness: 48 }],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#EDE8DB" } }, x: { grid: { display: false } } },
    },
  });
}

/** Fills a <ul class="legend"> with swatch, name and count (plus percentage when asked). */
export function renderLegend(list, counts, { percent = false } = {}) {
  const total = CATEGORIES.reduce((s, c) => s + (counts[c.name] || 0), 0);
  list.replaceChildren(
    ...CATEGORIES.map((c) => {
      const li = document.createElement("li");
      li.className = "legend__item";
      const sw = document.createElement("span");
      sw.className = "legend__swatch";
      sw.style.background = c.color;
      const name = document.createElement("span");
      name.className = "legend__name";
      name.textContent = c.name;
      const val = document.createElement("span");
      val.className = "legend__value";
      const n = counts[c.name] || 0;
      val.textContent = percent && total ? `${n} · ${Math.round((n / total) * 100)}%` : String(n);
      li.append(sw, name, val);
      return li;
    })
  );
}
