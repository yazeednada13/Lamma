/* Lamma v2 · generic card & chart renderers (data in, HTML out). Uses Lamma.icon / Lamma.fmt. */
(function () {
  const C = (window.LammaCards = {});
  const I = (n, c) => Lamma.icon(n, c);
  const len = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
  /* smooth path through points (monotone-ish cubic) */
  const smooth = (pts) => pts.map((p, i) => {
    if (!i) return `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    const a = pts[i - 1], cx = (a[0] + p[0]) / 2;
    return `C${cx.toFixed(1)} ${a[1].toFixed(1)} ${cx.toFixed(1)} ${p[1].toFixed(1)} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  }).join(" ");

  /* delta pill: honest — null means nothing to compare */
  C.delta = (pct, invert) => {
    if (pct === null || pct === undefined || !isFinite(pct)) return `<span class="dpill dpill--flat">—</span>`;
    const good = invert ? pct <= 0 : pct >= 0;
    return `<span class="dpill ${good ? "dpill--up" : "dpill--down"}"><bdi>${pct >= 0 ? "↑" : "↓"} ${Math.abs(pct)}%</bdi></span>`;
  };

  /* sparkline (values ordered oldest → newest; drawn right→left in RTL so "now" sits at the reading end) */
  C.spark = (vals, { w = 240, h = 54, pad = 6 } = {}) => {
    const rtl = document.documentElement.dir === "rtl", max = Math.max(...vals, 1), min = Math.min(...vals, 0);
    const pts = vals.map((v, i) => { const x = pad + (i / Math.max(vals.length - 1, 1)) * (w - pad * 2); return [rtl ? w - x : x, h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2)]; });
    const d = smooth(pts), L = Math.ceil(len(pts) * 1.2), last = pts[pts.length - 1];
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path class="spark-area fade-up" d="${d} L${last[0]} ${h} L${pts[0][0]} ${h}Z"/><path class="spark-line draw" style="--len:${L}" d="${d}"/></svg>`;
  };

  /* metric card */
  C.metric = (m) => `<article class="card metric lift tone-${m.tone || "olive"} ${m.row ? "metric--row" : ""}" ${m.href ? `onclick="location.hash='${m.href}'" style="cursor:pointer"` : ""}>
      ${m.row ? `<span class="chipi">${I(m.icon)}</span><div style="min-width:0">` : `<div class="metric__top"><span class="chipi">${I(m.icon)}</span><span class="metric__label">${m.label}</span>${m.delta !== undefined ? `<span style="margin-inline-start:auto">${C.delta(m.delta, m.invert)}</span>` : ""}</div>`}
      ${m.row ? `<span class="metric__label">${m.label}</span>` : ""}
      <div class="metric__value"><span data-count="${m.value}" data-dec="${m.dec ?? 0}">0</span>${m.unit ? `<span class="metric__unit">${m.unit}</span>` : ""}${m.row && m.delta !== undefined ? C.delta(m.delta, m.invert) : ""}</div>
      ${m.foot ? `<div class="metric__foot">${m.foot}</div>` : ""}
      ${m.row ? "</div>" : ""}
      ${m.spark ? `<div class="metric__spark">${C.spark(m.spark, m.row ? { w: 120, h: 44 } : {})}</div>` : ""}
    </article>`;

  /* area chart with two series + hover tooltips; series: [{label, a, b}] */
  C.area = (series, { aName = "المبيعات", bName = "الربح", w = 640, h = 220 } = {}) => {
    const rtl = document.documentElement.dir === "rtl", padX = 14, padT = 14, padB = 28, max = Math.max(...series.map((s) => Math.max(s.a, s.b)), 1) * 1.15;
    const X = (i) => { const x = padX + (i / Math.max(series.length - 1, 1)) * (w - padX * 2); return rtl ? w - x : x; };
    const Y = (v) => padT + (1 - v / max) * (h - padT - padB);
    const pa = series.map((s, i) => [X(i), Y(s.a)]), pb = series.map((s, i) => [X(i), Y(s.b)]);
    const grid = [0.25, 0.5, 0.75, 1].map((f) => `<line class="grid-line" x1="0" x2="${w}" y1="${Y(max * f / 1.15)}" y2="${Y(max * f / 1.15)}"/>`).join("");
    const step = (w - padX * 2) / Math.max(series.length - 1, 1);
    const hits = series.map((s, i) => `<rect class="hit" data-i="${i}" x="${X(i) - step / 2}" y="0" width="${step}" height="${h}"/><circle class="dot" cx="${X(i)}" cy="${Y(s.a)}" r="4.5" stroke="var(--lamma-chart-1)"/>`).join("");
    const labels = series.map((s, i) => (i % Math.ceil(series.length / 7) === 0 || i === series.length - 1 ? `<text class="lbl" x="${X(i)}" y="${h - 6}" text-anchor="middle">${s.label}</text>` : "")).join("");
    const la = Math.ceil(len(pa) * 1.2), lb = Math.ceil(len(pb) * 1.2);
    return `<div class="area" data-series='${JSON.stringify(series).replace(/'/g, "&#39;")}' data-an="${aName}" data-bn="${bName}">
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${aName} و${bName}">
        <defs><linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3F4F2A" stop-opacity=".22"/><stop offset="1" stop-color="#3F4F2A" stop-opacity="0"/></linearGradient></defs>
        ${grid}
        <path class="fade-up" d="${smooth(pa)} L${pa[pa.length - 1][0]} ${h - padB} L${pa[0][0]} ${h - padB}Z" fill="url(#gA)"/>
        <path class="draw" style="--len:${la}" d="${smooth(pa)}" fill="none" stroke="var(--lamma-chart-1)" stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
        <path class="draw" style="--len:${lb};animation-delay:350ms" d="${smooth(pb)}" fill="none" stroke="var(--lamma-chart-2)" stroke-width="2.5" stroke-dasharray="0" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
        ${hits}${labels}
      </svg><div class="area__tip"></div></div>`;
  };
  C.bindArea = (root = document) => root.querySelectorAll(".area").forEach((el) => {
    const s = JSON.parse(el.dataset.series), tip = el.querySelector(".area__tip"), svg = el.querySelector("svg");
    el.querySelectorAll(".hit").forEach((r) => {
      r.addEventListener("mouseenter", () => {
        const d = s[+r.dataset.i], dot = r.nextElementSibling, bb = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
        el.querySelectorAll(".dot.is-on").forEach((x) => x.classList.remove("is-on")); dot.classList.add("is-on");
        tip.innerHTML = `<b>${d.full || d.label}</b>${el.dataset.an}: <bdi>${Lamma.fmt(d.a)}</bdi> د.أ<br>${el.dataset.bn}: <bdi>${Lamma.fmt(d.b)}</bdi> د.أ`;
        tip.style.left = ((+dot.getAttribute("cx")) / vb.width) * bb.width + "px"; tip.style.top = ((+dot.getAttribute("cy")) / vb.height) * bb.height + "px"; tip.classList.add("is-on");
      });
    });
    el.addEventListener("mouseleave", () => { tip.classList.remove("is-on"); el.querySelectorAll(".dot.is-on").forEach((x) => x.classList.remove("is-on")); });
  });

  /* donut: segs [{label, value, color}] */
  C.donut = (segs, center, sub) => {
    const r = 58, c = 2 * Math.PI * r, t = segs.reduce((s, x) => s + x.value, 0) || 1; let off = 0;
    const arcs = segs.map((x, i) => { const L = (x.value / t) * c, gap = segs.length > 1 ? 4 : 0, el = `<circle class="seg" r="${r}" cx="75" cy="75" stroke="${x.color}" stroke-dasharray="${Math.max(L - gap, 0.1)} ${c}" stroke-dashoffset="${-off}" style="animation-delay:${i * 120}ms"><title>${x.label}: ${Math.round((x.value / t) * 100)}%</title></circle>`; off += L; return el; }).join("");
    return `<div class="donut"><svg width="150" height="150" viewBox="0 0 150 150" aria-hidden="true"><circle r="${r}" cx="75" cy="75" stroke="#F1F3EA"/>${arcs}</svg><div class="donut__c"><b>${center}</b><span>${sub || ""}</span></div></div>`;
  };
  C.legend = (segs, total) => `<div class="col" style="gap:10px;flex:1">${segs.map((x) => `<div class="row" style="gap:10px"><i style="width:10px;height:10px;border-radius:3px;background:${x.color};flex:none"></i><span class="grow">${x.label}</span><b class="num" style="font:var(--lamma-type-number-table)"><bdi>${Math.round((x.value / (total || 1)) * 100)}%</bdi></b></div>`).join("")}</div>`;

  /* tabs ink: sliding underline for any .tabs */
  C.bindTabs = (root = document) => root.querySelectorAll(".tabs").forEach((tabs) => {
    let ink = tabs.querySelector(".tabs__ink"); if (!ink) { ink = document.createElement("span"); ink.className = "tabs__ink"; tabs.appendChild(ink); tabs.classList.add("has-ink"); }
    const move = () => { const a = tabs.querySelector(".tab.is-active"); if (!a) return; ink.style.width = a.offsetWidth - 16 + "px"; ink.style.transform = `translateX(${a.offsetLeft + 8 - (document.documentElement.dir === "rtl" ? 0 : 0)}px)`; ink.style.left = "0"; };
    move(); tabs.addEventListener("click", () => setTimeout(move, 0));
  });
})();
