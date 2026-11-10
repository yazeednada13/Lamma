/* Lamma UI helpers v1 — icons, money, toasts, overlays, motion. Depends on icons.js (window.LAMMA_ICONS). */
(function () {
  const L = (window.Lamma = {});
  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SHADDA = "M18 44C16 74 44 76 48 54C52 76 80 72 84 24";
  const DIR_ICONS = ["chevron-right", "chevron-left", "arrow-right", "arrow-left", "arrow-back-up"];

  L.icon = (name, cls = "") => {
    const body = (window.LAMMA_ICONS || {})[name] || "";
    const dir = DIR_ICONS.includes(name) ? " ic--dir" : "";
    return `<svg class="ic ${cls}${dir}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  };
  L.mark = (color = "#F4A261", size = 28, draw = false) =>
    `<svg class="${draw ? "shadda-draw" : ""}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><path d="${SHADDA}" fill="none" stroke="${color}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  /* Money: Latin digits, 2 decimals, JOD after the number, sign isolated so it never flips in RTL */
  L.fmt = (n, dec = 2) => Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  L.money = (n, opt = {}) => {
    const dec = opt.dec ?? 2, sign = n < 0 ? "−" : opt.plus && n > 0 ? "+" : "";
    const tone = opt.tone || (opt.colored ? (n < 0 ? "neg" : n > 0 ? "pos" : "") : "");
    return `<span class="money ${tone ? "money--" + tone : ""}"><bdi>${sign}${L.fmt(n, dec)}</bdi> د.أ</span>`;
  };

  /* Count-up for KPI numbers (skipped with reduced motion) */
  L.countUp = (root = document) => {
    root.querySelectorAll("[data-count]").forEach((el) => {
      const target = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), suffix = el.dataset.suffix || "";
      const out = (v) => (el.innerHTML = `<bdi>${v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })}</bdi>${suffix}`);
      if (reduce()) return out(target);
      const t0 = performance.now(), dur = 480;
      const step = (t) => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); out(target * e); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  };

  /* Toasts: success shows the shadda drawing itself (the "lamma" moment) */
  L.toast = (msg, opt = {}) => {
    let box = document.querySelector(".toasts");
    if (!box) { box = document.createElement("div"); box.className = "toasts"; box.setAttribute("role", "status"); document.body.appendChild(box); }
    const t = document.createElement("div");
    t.className = "toast" + (opt.type === "error" ? " toast--error" : "");
    const lead = opt.type === "error" ? L.icon("alert-triangle") : opt.type === "info" ? L.icon("info-circle") : L.mark("#F4A261", 26, true);
    t.innerHTML = `${lead}<span>${msg}</span>${opt.action ? `<button type="button">${opt.action}</button>` : ""}`;
    if (opt.action) t.querySelector("button").onclick = () => { opt.onAction && opt.onAction(); close(); };
    box.appendChild(t);
    function close() { t.classList.add("is-leaving"); setTimeout(() => t.remove(), 220); }
    setTimeout(close, opt.duration || 4200);
  };

  /* Overlays: dialog / drawer / palette share one scrim */
  let scrim;
  const getScrim = () => {
    if (!scrim) { scrim = document.createElement("div"); scrim.className = "overlay"; scrim.onclick = () => L.closeAll(); document.body.appendChild(scrim); }
    return scrim;
  };
  L.open = (el) => {
    if (typeof el === "string") el = document.querySelector(el);
    const s = getScrim(); s.style.display = "block"; requestAnimationFrame(() => { s.classList.add("is-open"); el.classList.add("is-open"); });
    el.removeAttribute("hidden"); el.setAttribute("aria-hidden", "false");
    const f = el.querySelector("input, select, textarea, button"); if (f) setTimeout(() => f.focus(), 60);
  };
  L.closeAll = () => {
    document.querySelectorAll(".dialog.is-open, .drawer.is-open, .palette.is-open").forEach((el) => { el.classList.remove("is-open"); el.setAttribute("aria-hidden", "true"); });
    if (scrim) { scrim.classList.remove("is-open"); setTimeout(() => (scrim.style.display = "none"), 220); }
  };
  L.toggleMenu = (btn, menuSel) => {
    const m = document.querySelector(menuSel), open = !m.classList.contains("is-open");
    document.querySelectorAll(".menu.is-open").forEach((x) => x.classList.remove("is-open"));
    if (open) { m.classList.add("is-open"); [...m.querySelectorAll(".menu__item")].forEach((it, i) => (it.style.transitionDelay = reduce() ? "0ms" : i * 30 + "ms")); }
  };
  document.addEventListener("click", (e) => { if (!e.target.closest(".menu, [data-menu]")) document.querySelectorAll(".menu.is-open").forEach((x) => x.classList.remove("is-open")); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { L.closeAll(); document.querySelectorAll(".menu.is-open").forEach((x) => x.classList.remove("is-open")); }
  });

  /* FLIP move: animate an element from its old box to its new parent (order status change) */
  L.flipMove = (el, newParent, before = null) => {
    const a = el.getBoundingClientRect();
    newParent.insertBefore(el, before);
    if (reduce()) return;
    const b = el.getBoundingClientRect();
    el.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" });
  };

  /* <i data-ic="name" data-cls="ic--16"></i> → inline SVG icon */
  L.hydrate = (root = document) => {
    root.querySelectorAll("i[data-ic]").forEach((i) => { i.outerHTML = L.icon(i.dataset.ic, i.dataset.cls || ""); });
    root.querySelectorAll("i[data-mark]").forEach((i) => { i.outerHTML = L.mark(i.dataset.mark || "#F4A261", +(i.dataset.size || 28), i.hasAttribute("data-draw")); });
    root.querySelectorAll("[data-money]").forEach((s) => { s.outerHTML = L.money(+s.dataset.money, { colored: s.hasAttribute("data-colored"), plus: s.hasAttribute("data-plus"), tone: s.dataset.tone }); });
  };

  L.reduceMotion = reduce;
})();
