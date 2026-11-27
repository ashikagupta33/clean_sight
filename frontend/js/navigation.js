/**
 * Shared navigation. Renders the navbar into <div id="navbar"></div>
 * so the markup lives in one place. Page depth comes from <body data-root>.
 */
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "layout-dashboard", path: "index.html" },
  { id: "scan", label: "Scan & Detect", icon: "scan", path: "pages/scan.html" },
  { id: "analytics", label: "Analytics", icon: "chart-column", path: "pages/analytics.html" },
  { id: "compare", label: "Compare", icon: "columns-2", path: "pages/compare.html" },
];

export function icon(name, cls = "") {
  const root = document.body.dataset.root || "";
  return `<svg class="icon ${cls}" aria-hidden="true"><use href="${root}assets/icons/sprite.svg#${name}"></use></svg>`;
}

export function renderNavbar() {
  const mount = document.getElementById("navbar");
  if (!mount) return;
  const root = document.body.dataset.root || "";
  const active = document.body.dataset.page;

  const links = NAV_ITEMS.map(
    (i) => `<li><a class="navbar__link" href="${root}${i.path}"${i.id === active ? ' aria-current="page"' : ""}>${icon(i.icon)}<span>${i.label}</span></a></li>`
  ).join("");

  mount.innerHTML = `
    <header class="navbar">
      <div class="container navbar__inner">
        <a class="navbar__brand" href="${root}index.html"><img src="${root}assets/logo/logo.svg" alt="" width="32" height="32"><span>CleanSight</span></a>
        <button class="navbar__toggle" type="button" aria-expanded="false" aria-controls="nav-links" aria-label="Toggle menu">
          ${icon("menu", "icon-open")}${icon("x", "icon-close")}
        </button>
        <nav aria-label="Main"><ul class="navbar__links" id="nav-links">${links}</ul></nav>
      </div>
    </header>`;

  const toggle = mount.querySelector(".navbar__toggle");
  const list = mount.querySelector(".navbar__links");
  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    list.classList.toggle("is-open", open);
  };
  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  document.addEventListener("keydown", (e) => e.key === "Escape" && setOpen(false));
  window.matchMedia("(min-width:769px)").addEventListener("change", () => setOpen(false));
}

/** Shows the shared "history unavailable" warning inside the given container. */
export function showHistoryWarning(box) {
  if (!box) return;
  const wrap = document.createElement("div");
  wrap.className = "alert alert--warning";
  wrap.insertAdjacentHTML("afterbegin", icon("circle-alert"));
  const body = document.createElement("div");
  body.className = "alert__body";
  body.textContent = "Scan history couldn't be loaded because the backend isn't reachable. The numbers below will fill in once it is running.";
  wrap.append(body);
  box.replaceChildren(wrap);
  box.hidden = false;
}
