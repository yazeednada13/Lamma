/* Lamma prototype — shell, router and shared helpers. Screens live in screens.js. */
(function () {
  const I = (n, c) => Lamma.icon(n, c), M = Lamma.money;
  const App = (window.App = { screens: {}, I, M });
  const db = window.DB;

  /* ---------- lookups ---------- */
  App.cust = (id) => db.customers.find((c) => c.id === id);
  App.prod = (id) => db.products.find((p) => p.id === id);
  App.order = (id) => db.orders.find((o) => String(o.id) === String(id));
  App.total = (o) => o.items.reduce((s, it) => s + it[2] * it[3], 0) + (o.delivery || 0);
  App.cost = (o) => o.items.reduce((s, it) => s + it[2] * (App.prod(it[0])?.cost || 0), 0);
  App.status = (k) => db.statuses.find((s) => s[0] === k);
  App.statusBadge = (k, lg) => {
    const s = App.status(k), brick = s[2] === "brick";
    return `<span class="badge badge--dot ${lg ? "badge--lg" : ""} ${s[2] && !brick ? "badge--" + s[2] : ""}" ${brick ? 'style="background:var(--lamma-brick-100);color:var(--lamma-brick-700)"' : ""}>${s[1]}</span>`;
  };
  App.payBadge = (p) => ({ paid: '<span class="badge badge--success">مدفوع</span>', partial: '<span class="badge badge--warning">جزئي</span>', unpaid: '<span class="badge badge--danger badge--outline">غير مدفوع</span>', courier: '<span class="badge badge--info">عند الشركة</span>' }[p]);
  /* comparison line: ↑/↓ with honest wording; null when there is nothing to compare */
  App.delta = (pct, label, invert) => {
    if (pct === null || pct === undefined || !isFinite(pct)) return `<div class="kpi__trend muted">ما في فترة سابقة للمقارنة</div>`;
    const good = invert ? pct <= 0 : pct >= 0;
    return `<div class="kpi__trend ${good ? "trend-up" : "trend-down"}"><bdi>${pct >= 0 ? "↑" : "↓"} ${Math.abs(pct)}%</bdi> ${label}</div>`;
  };
  App.initials =(name) => name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  App.chIcon = (ch) => ({ instagram: "brand-instagram", whatsapp: "brand-whatsapp", facebook: "brand-facebook" }[ch] || "phone");
  /* ---------- status change: the single place where business rules run ----------
     confirm → reserve stock · delivered → deduct stock + recognise the sale · cancel → release.
     Returns an undo function that restores the exact previous state. */
  const RESERVING = ["confirmed", "preparing", "courier"];
  App.setStatus = (o, next) => {
    const snap = { status: o.status, deliveredAt: o.deliveredAt, prods: o.items.map(([pid]) => { const p = App.prod(pid); return [p, p.stock, p.reserved, p.sold]; }) };
    const was = RESERVING.includes(o.status), will = RESERVING.includes(next);
    o.items.forEach(([pid, , q]) => {
      const p = App.prod(pid);
      if (!was && will) p.reserved += q;
      if (was && !will) p.reserved = Math.max(0, p.reserved - q);
      if (next === "delivered") { p.stock = Math.max(0, p.stock - q); p.sold += q; }
    });
    if (next === "delivered") o.deliveredAt = db.today;
    o.status = next;
    return () => { o.status = snap.status; o.deliveredAt = snap.deliveredAt; snap.prods.forEach(([p, s, r, so]) => { p.stock = s; p.reserved = r; p.sold = so; }); };
  };
  App.statusMsg = (o, next) => ({ confirmed: "الطلب صار «مؤكد» وانحجزت القطع تلقائيًا", preparing: `الطلب #${o.id} بيتغلّف هلّق`, courier: `الطلب #${o.id} طلع مع المندوب`, delivered: "تم التوصيل — انخصمت القطع من المخزون وانحسبت المبيعة", cancelled: "انلغى الطلب ورجعت القطع للمتوفر" }[next] || `الطلب #${o.id} صار «${App.status(next)[1]}»`);

  /* ---------- v2 cards (data-driven) ---------- */
  const FLOW = ["new", "confirmed", "preparing", "courier", "delivered"];
  const ST_IC = { new: "receipt", confirmed: "check", preparing: "gift", courier: "truck", delivered: "circle-check", cancelled: "x", returned: "arrow-back-up" };
  App.track = (status) => { const k = FLOW.indexOf(status); return `<div class="track" aria-label="مرحلة ${k + 1} من 5">${FLOW.map((_, i) => `<i class="${k < 0 ? "" : i < k ? "done" : i === k ? (status === "delivered" ? "done" : "now") : ""}"></i>`).join("")}</div>`; };
  App.orderCard = (o, i = 0) => {
    const c = App.cust(o.c), p = App.prod(o.items[0][0]), qty = o.items.reduce((s, it) => s + it[2], 0);
    return `<a class="ocard st-${o.status}" href="#/orders/${o.id}" style="--i:${i}"><span class="ocard__stamp">${I(ST_IC[o.status], "ic--16")}</span>
      <div class="row" style="gap:8px"><span class="ocard__id ltr">#${o.id}</span>${App.statusBadge(o.status)}</div>
      <div class="ocard__who"><span class="avatar avatar--sm">${App.initials(c.name)}</span>${c.name}${I(App.chIcon(o.channel), "ic--16")}</div>
      <div class="ocard__meta"><span class="caption">${p.name}${o.items.length > 1 ? ` +${o.items.length - 1}` : ""} · ${qty} قطعة</span>${M(App.total(o))}</div>
      ${App.track(o.status)}<div class="track__lbl"><span>${o.date}</span>${App.payBadge(o.pay)}</div></a>`;
  };
  App.productCard = (p, i = 0) => {
    const avail = p.stock - p.reserved, out = !p.stock, low = !out && avail <= p.low;
    const top = p.sold > 0 && p.sold === Math.max(...db.products.map((x) => x.sold));
    return `<div class="pcard ${out ? "is-out" : low ? "is-low" : ""}" style="--i:${i}"><div class="pcard__stage">${LammaArt.product(p.template)}${top ? `<span class="stk stk--sm stk--wiggle" style="bottom:10px;inset-inline-start:12px;--r:-10deg;--d:700ms" title="الأكثر مبيعًا">${LammaArt.sticker("fire")}</span>` : ""}
        <span class="pcard__ribbon">${out ? '<span class="badge badge--danger">نفد</span>' : low ? '<span class="badge badge--attention badge--dot is-live">قرب يخلص</span>' : p.reserved ? `<span class="badge badge--info">${p.reserved} محجوز</span>` : ""}</span>
        <span class="pcard__actions"><button aria-label="تعديل" onclick="location.hash='#/products/new'">${I("pencil", "ic--16")}</button><button aria-label="تعديل المخزون" onclick="App.adjustStock('${p.id}')">${I("adjustments", "ic--16")}</button><button aria-label="طلب جديد" onclick="location.hash='#/orders/new'">${I("plus", "ic--16")}</button></span></div>
      <a class="pcard__body" href="#/products/${p.id}" style="text-decoration:none;color:inherit"><span class="pcard__cat">${p.cat}${p.sizes ? " · " + p.sizes.length + (p.template === "perfume" ? " أحجام" : " مقاسات") : ""}</span><span class="pcard__name">${p.name}</span>
        <div class="pcard__price">${M(p.price)}<span class="pcard__margin">ربح ${Lamma.fmt(p.price - p.cost)} · <bdi>${Math.round(((p.price - p.cost) / p.price) * 100)}%</bdi></span></div>${App.stockMeter(p)}</a></div>`;
  };
  App.customerCard = (c, i = 0) => {
    const maxO = Math.max(...db.customers.map((x) => x.orders), 1);
    return `<a class="ccard" href="#/customers/${c.id}" style="--i:${i}"><div class="ccard__top"><span class="ring-av" style="--p:${Math.round((c.orders / maxO) * 100)}"><span>${App.initials(c.name)}</span></span><div class="grow"><b style="font:var(--lamma-type-body-strong)">${c.name}</b><div class="caption row" style="gap:6px">${I(App.chIcon(c.channel), "ic--16")}${c.city}</div></div></div>
      <div class="ccard__stats"><div><b>${c.orders}</b><span>طلبات</span></div><div><b><bdi>${Lamma.fmt(c.spent, 0)}</bdi></b><span>د.أ شراء</span></div><div><b>${c.lastAt ? db.fmtDate(c.lastAt) : "—"}</b><span>آخر طلب</span></div></div>
      ${c.balance ? `<div class="ccard__due"><span>عليها</span>${M(c.balance)}</div>` : ""}</a>`;
  };
  App.stockMeter = (p) => {
    const avail = p.stock - (p.reserved || 0), cls = p.stock === 0 ? "stock--out" : avail <= p.low ? "stock--low" : "";
    const max = Math.max(p.stock, p.low * 4, 1);
    const txt = p.stock === 0 ? "<b>نفد</b>" : avail <= p.low ? `<b>${avail}</b> متوفر · قرب يخلص` : `<b>${avail}</b> متوفر`;
    return `<div class="stock ${cls}"><div class="stock__bar"><span class="stock__avail" style="width:${(avail / max) * 100}%"></span><span class="stock__res" style="width:${((p.reserved || 0) / max) * 100}%"></span></div><span class="stock__txt">${txt}${p.reserved ? ` · ${p.reserved} محجوز` : ""}</span></div>`;
  };
  App.head = (title, sub, actions = "", crumbs = "") =>
    `<div class="page__head"><div>${crumbs ? `<div class="crumbs">${crumbs}</div>` : ""}${title ? `<h1>${title}</h1>` : ""}${sub ? `<p>${sub}</p>` : ""}</div>${actions ? `<div class="page__actions">${actions}</div>` : ""}</div>`;
  App.empty = (title, text, cta) => `<div class="card empty"><div class="gather"><div class="gather__card"></div><div class="gather__piece">${I("brand-whatsapp", "ic--16")}</div><div class="gather__piece">${I("receipt", "ic--16")}</div><div class="gather__piece">${I("package", "ic--16")}</div></div><div class="empty__title">${title}</div><p class="muted">${text}</p>${cta || ""}</div>`;

  /* ---------- overlays ---------- */
  App.dialog = (html) => { const d = document.getElementById("dlg"); d.innerHTML = html; Lamma.hydrate(d); Lamma.open(d); };
  App.drawer = (title, body, foot) => {
    const d = document.getElementById("drw");
    d.innerHTML = `<div class="drawer__head"><h3>${title}</h3><button class="btn btn--ghost icon-btn" onclick="Lamma.closeAll()" aria-label="إغلاق">${I("x")}</button></div><div class="drawer__body">${body}</div><div class="drawer__foot">${foot}</div>`;
    Lamma.hydrate(d); Lamma.open(d);
  };
  App.saved = (msg, go) => { Lamma.closeAll(); Lamma.toast(msg); if (go) setTimeout(() => (location.hash = go), 250); };

  /* ---------- navigation model ---------- */
  const NAV = [
    ["home", "الرئيسية", "#/dashboard", "dashboard"],
    ["receipt", "الطلبات", "#/orders", "orders", [["قائمة الطلبات", "#/orders"], ["لوحة الحالات", "#/orders/board"], ["الطلبات المسبقة", "#/preorders"]], 2],
    ["package", "المنتجات", "#/products", "products", [["كل المنتجات", "#/products"], ["التصنيفات", "#/categories"]]],
    ["building-warehouse", "المخزون", "#/inventory", "inventory", [["مستوى المخزون", "#/inventory"], ["استلام بضاعة", "#/inventory/receive"], ["سجل الحركات", "#/inventory/movements"], ["تواريخ الانتهاء", "#/inventory/expiry"]]],
    ["users", "العملاء", "#/customers", "customers"],
    ["wallet", "المالية", "#/finance", "finance", [["نظرة مالية", "#/finance"], ["المدفوعات والذمم", "#/finance/payments"], ["شركة التوصيل", "#/finance/courier"], ["المصاريف", "#/finance/expenses"]]],
    ["chart-bar", "التقارير", "#/reports", "reports", [["مركز التقارير", "#/reports"], ["الأرباح والخسائر", "#/reports/pnl"], ["المبيعات", "#/reports/sales"]]],
  ];
  App.NAV = NAV;
  const section = (r) => (["categories"].includes(r) ? "products" : r === "preorders" ? "orders" : ["account", "subscription", "trial-expired"].includes(r) ? "settings" : r);

  function shell(route, hash) {
    const sec = section(route), t = db.business;
    const late = t.trialDaysLeft <= 3, expired = route === "trial-expired";
    /* live badges — computed from data, never hardcoded */
    const badges = {
      orders: [db.orders.filter((o) => o.status === "new").length, "hot"],
      inventory: [db.products.filter((p) => p.stock - p.reserved <= p.low).length, ""],
      finance: [db.customers.some((c) => c.balance > 0) || db.courier.held > 0 ? 1 : 0, "dot"],
    };
    let i = 0;
    const item = ([ic, label, href, key, subs]) => {
      const on = sec === key, b = badges[key];
      const badge = b && b[0] ? (b[1] === "dot" ? `<span class="sb__badge sb__badge--dot" aria-label="في مستحقات"></span>` : `<span class="sb__badge ${b[1] === "hot" ? "sb__badge--hot" : ""}">${b[0]}</span>`) : "";
      return `<a class="sb__item ${on ? "is-active" : ""} ${on && subs ? "is-open" : ""}" href="${href}" data-tip="${label}" style="--i:${i++}" ${on ? 'aria-current="page"' : ""}><span class="sb__ic">${I(ic)}</span><span class="sb__label">${label}</span>${badge}${subs ? I("chevron-left", "ic--16 sb__chev") : ""}</a>` +
        (subs ? `<div class="sb__sub ${on ? "is-open" : ""}" data-sub="${key}"><div><ul>${subs.map(([l, h]) => `<li><a href="${h}" class="${h === hash ? "is-active" : ""}">${l}</a></li>`).join("")}</ul></div></div>` : "");
    };
    const daily = NAV.slice(0, 4).map(item).join(""), business = NAV.slice(4).map(item).join("");
    const used = t.trialTotal - t.trialDaysLeft;
    return `
<div class="app" id="app">
  <aside class="sb ${App._sbShown ? "sb--static" : ""}" aria-label="القائمة الرئيسية">
    <div class="sb__top"><a class="sb__brand" href="#/dashboard" aria-label="لمّة — الرئيسية">${Lamma.mark("#F4A261", 30, !App._sbShown)}<img src="../assets/logo/lamma-wordmark-ar-reversed.svg" alt=""></a>
      <button class="sb__toggle" id="collapseBtn" aria-label="تصغير القائمة">${I("chevron-right", "ic--16")}</button></div>
    <a class="sb__biz" href="#/settings" data-tip="${t.name}"><span class="sb__logo">${Lamma.mark("#3F4F2A", 24)}</span><span class="sb__biz-txt"><b>${t.name}</b><small>${expired ? "انتهت التجربة" : `تجربة مجانية · ضل ${t.trialDaysLeft} يوم`}</small></span>${I("chevron-down", "ic--16 sb__chev")}</a>
    <nav class="sb__nav" id="sbNav"><span class="sb__pill" id="sbPill"></span>
      <div class="sb__group">اليومي</div>${daily}
      <div class="sb__group">إدارة المشروع</div>${business}
      ${item(["settings", "إعدادات المشروع", "#/settings", "settings"])}
    </nav>
    <div class="sb__foot">
      ${expired ? "" : `<div class="sb__trial">${LammaArt.route(5)}<b>${used} من ${t.trialTotal} يوم تجربة</b><span>كل الميزات مفتوحة لحد ما تخلص</span><div class="sb__meter"><i style="width:${(used / t.trialTotal) * 100}%"></i></div><a href="#/subscription">${I("credit-card", "ic--16")} شوف الخطط</a></div>`}
      <a class="sb__user" href="#/account" data-tip="${t.owner}"><span class="avatar">ري</span><span class="sb__user-txt"><b>${t.owner}</b><span>صاحبة المشروع</span></span>${I("settings", "ic--16 sb__chev")}</a>
    </div>
  </aside>
  <div class="main">
    ${expired ? `<div class="trial trial--expired">${I("lock", "ic--16")} انتهت تجربتك المجانية. بياناتك محفوظة وبتقدر تشوفها، والإضافة بترجع لما تشترك. <a href="#/subscription">اشترك الآن</a></div>` : late ? `<div class="trial trial--late">${I("clock", "ic--16")} ضل ${t.trialDaysLeft} يوم بس من التجربة <a href="#/subscription">اشترك</a></div>` : ""}
    <header class="topbar">
      <a class="show-sm" href="#/dashboard">${Lamma.mark("#3F4F2A", 30)}</a>
      <button class="qsearch hide-sm" id="searchBtn" aria-label="بحث وأوامر (Ctrl K)"><span class="qsearch__ic">${I("search", "ic--16")}</span><span class="qsearch__hint" id="qhint"><span>دوّر على <b>طلب</b>، عميل، أو منتج</span></span><span class="qsearch__kbd"><kbd>Ctrl</kbd><kbd>K</kbd></span></button>
      <div class="end row" style="gap:6px;position:relative">
        <button class="btn btn--ghost icon-btn show-sm" aria-label="بحث" onclick="App.openPalette()">${I("search")}</button>
        <button class="btn btn--primary hide-sm" data-menu id="newBtn">${I("plus")} جديد</button>
        <div class="menu" id="newMenu" style="top:48px;inset-inline-end:96px">
          <a class="menu__item" href="#/orders/new">${I("receipt")} طلب</a><a class="menu__item" href="#/products/new">${I("package")} منتج</a><a class="menu__item" onclick="App.addCustomer()">${I("users")} عميل</a>
          <div class="menu__sep"></div><a class="menu__item" onclick="App.recordPayment()">${I("cash")} دفعة</a><a class="menu__item" onclick="App.addExpense()">${I("wallet")} مصروف</a><a class="menu__item" href="#/inventory/receive">${I("truck")} استلام بضاعة</a></div>
        <button class="btn btn--ghost icon-btn" data-menu id="bellBtn" aria-label="الإشعارات" style="position:relative">${I("bell")}<span style="position:absolute;top:8px;inset-inline-end:9px;width:8px;height:8px;border-radius:50%;background:var(--lamma-action-accent)"></span></button>
        <div class="menu" id="bellMenu" style="top:48px;inset-inline-end:44px;width:340px"><div class="palette__label">الإشعارات</div>${db.notifications.map((n) => `<a class="menu__item" style="align-items:flex-start">${I(n.ic)}<span class="grow">${n.unread ? "<b>" : ""}${n.t}${n.unread ? "</b>" : ""}<br><span class="caption">${n.d}</span></span></a>`).join("")}</div>
        <button class="btn btn--ghost" data-menu id="meBtn" style="padding-inline:4px" aria-label="الحساب"><span class="avatar">ري</span></button>
        <div class="menu" id="meMenu" style="top:48px;inset-inline-end:0"><div class="palette__label">${t.name} · ${t.owner}</div><a class="menu__item" href="#/account">${I("user-circle")} الحساب</a><a class="menu__item" href="#/subscription">${I("credit-card")} الاشتراك</a><a class="menu__item" href="#/account">${I("language")} اللغة: العربية</a><div class="menu__sep"></div><a class="menu__item menu__item--danger" href="#/login">${I("logout")} تسجيل الخروج</a></div>
      </div>
    </header>
    <main class="page" id="page"></main>
  </div>
  <nav class="bottombar" aria-label="تنقّل الموبايل">
    <a href="#/dashboard" class="${sec === "dashboard" ? "is-active" : ""}">${I("home")}الرئيسية</a>
    <a href="#/orders" class="${sec === "orders" ? "is-active" : ""}">${I("receipt")}الطلبات</a>
    <a href="#/new" aria-label="جديد"><span class="fab">${I("plus", "ic--24")}</span></a>
    <a href="#/products" class="${sec === "products" ? "is-active" : ""}">${I("package")}المنتجات</a>
    <a href="#/more" class="${["inventory", "customers", "finance", "reports", "settings", "more"].includes(sec) ? "is-active" : ""}">${I("dots-vertical")}المزيد</a>
  </nav>
</div>
<div class="dialog" id="dlg" role="dialog" aria-modal="true" aria-hidden="true"></div>
<aside class="drawer" id="drw" role="dialog" aria-modal="true" aria-hidden="true"></aside>
<div class="palette" id="pal" role="dialog" aria-hidden="true"></div>`;
  }

  App.openPalette = () => {
    const p = document.getElementById("pal");
    const orders = db.orders.slice(0, 4).map((o) => `<a class="menu__item" style="opacity:1;transform:none" href="#/orders/${o.id}" onclick="Lamma.closeAll()"><b class="ltr">#${o.id}</b> ${App.cust(o.c).name} <span class="end">${App.statusBadge(o.status)}</span></a>`).join("");
    const prods = db.products.slice(0, 3).map((x) => `<a class="menu__item" style="opacity:1;transform:none" href="#/products/${x.id}" onclick="Lamma.closeAll()">${I("package")} ${x.name}</a>`).join("");
    p.innerHTML = `<input placeholder="دوّر أو اكتب أمر… مثلًا «طلب جديد»" aria-label="بحث"><div class="palette__group"><div class="palette__label">أوامر سريعة</div>
      <a class="menu__item" style="opacity:1;transform:none" href="#/orders/new" onclick="Lamma.closeAll()">${I("plus")} طلب جديد <span class="kbd end">N</span></a>
      <a class="menu__item" style="opacity:1;transform:none" onclick="Lamma.closeAll();App.addExpense()">${I("wallet")} تسجيل مصروف</a>
      <a class="menu__item" style="opacity:1;transform:none" onclick="Lamma.closeAll();App.recordPayment()">${I("cash")} تسجيل دفعة</a>
      <div class="palette__label">طلبات</div>${orders}<div class="palette__label">منتجات</div>${prods}</div>`;
    Lamma.open(p);
  };

  /* ---------- global quick actions (drawers) ---------- */
  /* ---------- quick actions that change real data (payment, expense, courier settlement) ---------- */
  const chipPick = (sel) => (e) => { const b = e.target.closest(".chip"); if (!b) return; b.parentNode.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-selected", c === b)); };
  App.recordPayment = (orderId) => {
    const o = (orderId && App.order(orderId)) || db.orders.find((x) => ["unpaid", "partial"].includes(x.pay) && x.status !== "cancelled");
    if (!o) return Lamma.toast("ما في ذمم مستحقة — كل شي مدفوع", { type: "info" });
    const rem = App.total(o) - o.paid;
    App.drawer("تسجيل دفعة", `
      <div class="selcust"><span class="avatar avatar--lg">${App.initials(App.cust(o.c).name)}</span><div class="grow"><b>${App.cust(o.c).name}</b><div class="caption"><span class="ltr">#${o.id}</span> · المتبقي ${M(rem)}</div></div>${App.payBadge(o.pay)}</div>
      <label class="field"><span class="field__label">المبلغ</span><span class="control"><input class="ltr" id="payAmt" value="${Lamma.fmt(rem)}" inputmode="decimal"><span class="control__affix">د.أ</span></span><span class="field__help" id="payHelp">افتراضيًا: المبلغ المتبقي كامل</span></label>
      <div class="field"><span class="field__label">طريقة الدفع</span><div class="row wrap" id="payM">${db.payMethods.filter((m) => m !== "عند الاستلام").map((m, i) => `<button class="chip ${i === 1 ? "is-selected" : ""}">${m}</button>`).join("")}</div></div>
      <label class="field"><span class="field__label">التاريخ</span><span class="control">${I("calendar")}<input value="اليوم"></span></label>`,
      `<button class="btn btn--primary" id="payOk">حفظ الدفعة</button><button class="btn btn--ghost" onclick="Lamma.closeAll()">إلغاء</button>`);
    document.getElementById("payM").onclick = chipPick();
    const amt = document.getElementById("payAmt"), help = document.getElementById("payHelp"), ok = document.getElementById("payOk");
    amt.oninput = () => { const v = parseFloat(amt.value.replace(/,/g, "")) || 0, bad = v <= 0 || v > rem + 0.001; help.className = bad ? "field__error" : "field__help"; help.textContent = bad ? `المبلغ لازم يكون بين 0 و ${Lamma.fmt(rem)}` : v < rem ? `بيضل عليه ${Lamma.fmt(rem - v)} د.أ` : "الطلب بيصير مدفوع بالكامل"; ok.disabled = bad; };
    ok.onclick = () => { const v = parseFloat(amt.value.replace(/,/g, "")) || 0, before = { paid: o.paid, pay: o.pay, m: o.payMethod }, c = App.cust(o.c), cb = c.balance;
      o.paid += v; o.pay = o.paid >= App.total(o) - 0.001 ? "paid" : "partial"; o.payMethod = document.querySelector("#payM .is-selected").textContent; c.balance = Math.max(0, c.balance - v);
      Lamma.closeAll(); App.render(); Lamma.toast(o.pay === "paid" ? `انسجّلت الدفعة وصار الطلب #${o.id} «مدفوع»` : `انسجّلت ${Lamma.fmt(v)} د.أ — بيضل ${Lamma.fmt(App.total(o) - o.paid)}`, { action: "تراجع", onAction: () => { o.paid = before.paid; o.pay = before.pay; o.payMethod = before.m; c.balance = cb; App.render(); } }); };
  };
  App.addExpense = () => { App.drawer("مصروف جديد", `
      <label class="field"><span class="field__label">المبلغ <span class="req">*</span></span><span class="control"><input class="ltr" id="exAmt" placeholder="0.00" inputmode="decimal"><span class="control__affix">د.أ</span></span><span class="field__error" id="exErr" hidden>اكتب مبلغ أكبر من صفر</span></label>
      <div class="field"><span class="field__label">التصنيف</span><div class="row wrap" id="exCat">${["إعلانات", "توصيل", "تغليف", "مشتريات", "أخرى"].map((c, i) => `<button class="chip ${i === 0 ? "is-selected" : ""}">${c}</button>`).join("")}</div><span class="field__help">آخر تصنيف استخدمته مختار تلقائي</span></div>
      <label class="field"><span class="field__label">ملاحظة</span><span class="control"><input id="exNote" placeholder="مثلًا: ترويج ريلز"></span></label>`,
    `<button class="btn btn--primary" id="exOk">حفظ</button><button class="btn btn--ghost" onclick="Lamma.closeAll()">إلغاء</button>`);
    document.getElementById("exCat").onclick = chipPick();
    document.getElementById("exOk").onclick = () => { const v = parseFloat(document.getElementById("exAmt").value.replace(/,/g, "")) || 0; if (v <= 0) { document.getElementById("exErr").hidden = false; return; }
      const e = { at: db.today, d: "اليوم", cat: document.querySelector("#exCat .is-selected").textContent, note: document.getElementById("exNote").value || "مصروف", amt: v }; db.expenses.unshift(e);
      Lamma.closeAll(); App.render(); Lamma.toast(`انسجّل مصروف ${e.cat} ${Lamma.fmt(v)} د.أ`, { action: "تراجع", onAction: () => { db.expenses.splice(db.expenses.indexOf(e), 1); App.render(); } }); };
    document.getElementById("exAmt").oninput = () => (document.getElementById("exErr").hidden = true);
  };
  App.settle = () => { const exp = db.courier.held, pend = db.courier.pendingOrders.slice();
    if (!pend.length) return Lamma.toast("ما في مستحقات عند الشركة", { type: "info" });
    App.drawer("تسجيل تحويل من شركة التوصيل", `<label class="field"><span class="field__label">المبلغ اللي وصلك</span><span class="control"><input class="ltr" id="setAmt" value="${Lamma.fmt(exp)}"><span class="control__affix">د.أ</span></span></label>
      <div class="field"><span class="field__label">الطلبات المشمولة</span>${pend.map((o) => `<label class="check"><input type="checkbox" checked disabled> <span class="ltr">#${o.id}</span> · ${App.cust(o.c).name} · ${M(App.total(o))}</label>`).join("")}</div>
      <div class="attention" id="setDiff" style="padding:10px 12px" hidden></div><label class="check"><input type="checkbox" id="setExp" checked> سجّل أي فرق كمصروف «توصيل»</label>`,
      `<button class="btn btn--primary" id="setOk">تأكيد التسوية</button><button class="btn btn--ghost" onclick="Lamma.closeAll()">إلغاء</button>`);
    const inp = document.getElementById("setAmt"), diff = document.getElementById("setDiff");
    inp.oninput = () => { const d = exp - (parseFloat(inp.value.replace(/,/g, "")) || 0); diff.hidden = Math.abs(d) < 0.005; diff.innerHTML = `${I("alert-triangle")} <span>المتوقع ${M(exp)} — في فرق ${M(d)}.</span>`; };
    document.getElementById("setOk").onclick = () => { const got = parseFloat(inp.value.replace(/,/g, "")) || 0, d = exp - got;
      pend.forEach((o) => { o.pay = "paid"; o.paid = App.total(o); }); db.courier.transfers.unshift(["اليوم", got, `${pend.length} طلبات`]);
      if (d > 0.005 && document.getElementById("setExp").checked) db.expenses.unshift({ at: db.today, d: "اليوم", cat: "توصيل", note: "فرق تسوية شركة التوصيل", amt: d });
      db.courier.pendingOrders = []; db.courier.pending = []; db.courier.held = 0; App.saved(`تمت التسوية — ${pend.length} طلبات صارت «مدفوع»`); App.render(); };
  };
  App.addCustomer = () => App.drawer("عميل جديد", `
      <label class="field"><span class="field__label">الاسم <span class="req">*</span></span><span class="control"><input placeholder="الاسم زي ما بتعرفه"></span></label>
      <label class="field"><span class="field__label">رقم الهاتف</span><span class="control ltr"><span class="control__affix">+962</span><input inputmode="tel" placeholder="7X XXX XXXX"></span></label>
      <div class="field"><span class="field__label">من وين إجى؟</span><div class="row wrap">${Object.entries(db.channels).map(([k, v], i) => `<button class="chip ${i === 0 ? "is-selected" : ""}">${I(App.chIcon(k), "ic--16")} ${v}</button>`).join("")}</div></div>
      <label class="field"><span class="field__label">العنوان</span><span class="control"><input placeholder="المدينة والمنطقة"></span></label>`,
    `<button class="btn btn--primary" onclick="App.saved('انضاف العميل')">حفظ</button><button class="btn btn--ghost" onclick="Lamma.closeAll()">إلغاء</button>`);

  /* ---------- edge stickers: a friendly brand sticker peeks in now and then, with a line about this screen ---------- */
  const PEEK = {
    dashboard: [["shadda", "صباحك لمّة! كل شي بمكانه"], ["star", "جرّبت لوحة الحالات؟"]], orders: [["parcel", "طلباتك مرتبة ومغلّفة"], ["van", "المندوب بالطريق!"]], products: [["fire", "منتجك الأول عم يطير"], ["star", "أضف صور لمنتجاتك"]],
    inventory: [["parcel", "عيونك على المخزون"]], customers: [["heart", "زباينك بيحبوك"]], finance: [["coin", "كل دينار بمكانه"]], reports: [["coin", "أرقامك بتحكي قصة"]], settings: [["check", "إعداداتك محفوظة"]],
  };
  App.peek = (route) => {
    let el = document.getElementById("peek"); if (!el) { el = document.createElement("div"); el.id = "peek"; el.className = "peek"; el.setAttribute("aria-hidden", "true"); document.body.appendChild(el); }
    el.classList.remove("is-on"); const sec = { "orders/board": "orders", preorders: "orders", categories: "products" }[route] || route.split("/")[0];
    const list = PEEK[sec]; if (!list || Lamma.reduceMotion()) return;
    const [s, txt] = list[Math.floor(Math.random() * list.length)];
    el.innerHTML = `<span class="peek__stk">${LammaArt.sticker(s)}</span><span class="peek__bubble">${txt}</span>`;
    App._timers.push(setTimeout(() => el.classList.add("is-on"), 2200), setTimeout(() => el.classList.remove("is-on"), 7200));
  };

  /* ---------- router ---------- */
  const AUTH = ["login", "signup", "onboarding", "forgot"];
  App.render = () => {
    const hash = location.hash || "#/dashboard";
    const parts = hash.replace(/^#\//, "").split("/");
    let key = parts[0] || "dashboard", arg = parts[1];
    let fnKey = arg && App.screens[key + "/" + arg] ? key + "/" + arg : arg && App.screens[key + "/:id"] ? key + "/:id" : key;
    (App._timers || []).forEach((h) => { clearInterval(h); clearTimeout(h); }); App._timers = [];
    const fallback = () => `<div class="empty" style="padding:64px 16px;text-align:center"><h1>صار خلل بتحميل الصفحة</h1><p>اعمل تحديث للصفحة (Ctrl + Shift + R).</p><a class="btn btn--primary" href="#/dashboard">الرئيسية</a></div>`;
    let fn = App.screens[fnKey] || App.screens["404"]; if (typeof fn !== "function") fn = fallback;
    const root = document.getElementById("root");
    if (AUTH.includes(key)) { root.innerHTML = `<div id="page"></div>`; }
    else { root.innerHTML = shell(key, hash.split("?")[0]); bindShell(); }
    const page = document.getElementById("page");
    try { page.innerHTML = fn(arg); } catch (e) { console.error("[Lamma] render", fnKey, e); page.innerHTML = fallback(); }
    try { Lamma.hydrate(page); Lamma.countUp(page); if (window.LammaCards) LammaCards.bindTabs(page); if (fn.after) fn.after(arg); } catch (e) { console.error("[Lamma] after", fnKey, e); }
    document.title = (page.querySelector("h1")?.textContent || "لمّة") + " · لمّة";
    window.scrollTo(0, 0);
  };
  function bindShell() {
    const app = document.getElementById("app");
    /* collapse: user choice on wide screens, automatic rail below 1280px */
    let pref = "0"; try { pref = localStorage.getItem("lamma-collapsed") || "0"; } catch (e) {}
    const applyCollapse = (place = true) => { app.classList.toggle("is-collapsed", innerWidth < 1280 || pref === "1"); if (place) placePill(false); };
    document.getElementById("collapseBtn").onclick = () => { pref = pref === "1" ? "0" : "1"; try { localStorage.setItem("lamma-collapsed", pref); } catch (e) {} applyCollapse(); setTimeout(() => placePill(false), 340); };
    window.onresize = () => applyCollapse();

    /* sliding active pill: starts where the previous active item was, then glides to the new one */
    const nav = document.getElementById("sbNav"), pill = document.getElementById("sbPill");
    function placePill(animate) {
      const act = nav.querySelector(".sb__item.is-active"); if (!act) { pill.style.opacity = 0; return; }
      const y = act.offsetTop, h = act.offsetHeight;
      if (!animate) pill.style.transition = "none";
      pill.style.height = h + "px"; pill.style.transform = `translateY(${y}px)`; pill.style.opacity = 1;
      App._pillY = y;
      if (!animate) { pill.getBoundingClientRect(); pill.style.transition = ""; } // commit without animating, then re-enable
    }
    /* collapse first so positions are final, then glide from the previous item (reflow commits the start point) */
    applyCollapse(false);
    const openSub = nav.querySelector(".sb__sub.is-open"), newSection = openSub && App._openSec !== openSub.dataset.sub;
    if (newSection && !Lamma.reduceMotion()) openSub.classList.remove("is-open");
    const prevY = App._pillY;
    if (prevY !== undefined && !Lamma.reduceMotion()) {
      pill.style.transition = "none"; pill.style.opacity = 1; pill.style.transform = `translateY(${prevY}px)`;
      pill.getBoundingClientRect(); pill.style.transition = ""; placePill(true);
    } else placePill(false);
    /* submenu of a newly entered section unfolds (no replay when staying inside the section) */
    if (newSection && !Lamma.reduceMotion()) { openSub.getBoundingClientRect(); openSub.classList.add("is-open"); }
    App._openSec = openSub ? openSub.dataset.sub : null;
    /* items animate in only on the very first load */
    if (App._sbShown) nav.querySelectorAll(".sb__item").forEach((a) => (a.style.animation = "none", a.style.opacity = 1, a.style.transform = "none"));
    App._sbShown = true;
    document.getElementById("searchBtn").onclick = App.openPalette;
    /* rotating search hints (stops with reduced motion) */
    const HINTS = ["دوّر على <b>طلب</b>، عميل، أو منتج", "جرّب: <b>#1042</b>", "اكتب <b>طلب جديد</b> وابدأ فورًا", "دوّر على <b>رنا</b> أو أي عميل", "اكتب <b>مصروف</b> لتسجّل بسرعة", "دوّر على <b>فستان كتان</b>"];
    let hi = 0; const qh = document.getElementById("qhint");
    if (qh && !Lamma.reduceMotion()) App._timers.push(setInterval(() => { const old = qh.firstElementChild; old.classList.add("is-out"); hi = (hi + 1) % HINTS.length; const n = document.createElement("span"); n.innerHTML = HINTS[hi]; qh.appendChild(n); setTimeout(() => old.remove(), 380); }, 3200));
    App.peek((location.hash || "#/dashboard").replace(/^#\//, "").split("?")[0] || "dashboard");
    document.getElementById("newBtn").onclick = (e) => Lamma.toggleMenu(e.currentTarget, "#newMenu");
    document.getElementById("bellBtn").onclick = (e) => Lamma.toggleMenu(e.currentTarget, "#bellMenu");
    document.getElementById("meBtn").onclick = (e) => Lamma.toggleMenu(e.currentTarget, "#meMenu");
  }
  document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (document.getElementById("pal")) App.openPalette(); } });
  App.start = () => { window.addEventListener("hashchange", App.render); App.render(); };
})();
