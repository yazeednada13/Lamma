/* Screens part 1 — auth & onboarding, dashboard, orders */
(function () {
  const S = App.screens, I = App.I, M = App.M, db = window.DB;

  /* ================= AUTH v2 ================= */
  const authSide = (title, sub) => `<aside class="auth2__side"><a href="#/login"><img src="../assets/logo/lamma-wordmark-ar-reversed.svg" alt="لمّة" height="38"></a>
    <div><h2>${title}</h2><p>${sub}</p></div>
    <div class="auth2__stage" aria-hidden="true">${LammaArt.gather(true)}
      <div class="floaty" style="top:6%;inset-inline-start:4%;animation-delay:0s,.2s"><span class="chipi tone-blue">${I("brand-whatsapp", "ic--16")}</span><span><b>طلب جديد من رنا</b>فستان كتان · M زيتي</span></div>
      <div class="floaty" style="top:40%;inset-inline-end:2%;animation-delay:1.2s,.4s"><span class="chipi tone-apricot">${I("package", "ic--16")}</span><span><b>بلوزة حرير</b>ضل 2 · قرب يخلص</span></div>
      <div class="floaty" style="bottom:4%;inset-inline-start:14%;animation-delay:2.4s,.6s"><span class="chipi tone-green">${I("wallet", "ic--16")}</span><span><b>ربح الشهر</b><bdi>+12%</bdi> عن الشهر الماضي</span></div></div>
    <div class="trust"><span>${I("circle-check", "ic--16")} أول شهر مجاني</span><span>${I("lock", "ic--16")} بياناتك إلك</span><span>${I("phone", "ic--16")} بيشتغل عالموبايل</span></div></aside>`;
  const pw = (id, val = "") => `<label class="field"><span class="field__label">كلمة السر</span><span class="control">${I("lock")}<input type="password" id="${id}" value="${val}" placeholder="8 خانات على الأقل"><button type="button" class="btn btn--ghost icon-btn btn--sm" aria-label="إظهار كلمة السر" onclick="const i=document.getElementById('${id}');i.type=i.type==='password'?'text':'password'">${I("eye", "ic--16")}</button></span></label>`;
  S.login = () => `<div class="auth2">${authSide("كل شغلك <em>بمكان واحد</em>", "طلبات واتساب وإنستغرام، المخزون، الزباين والأرباح… مرتبين ومجموعين، وبيتحدّثوا لحالهم.")}
    <div class="auth2__form"><form class="auth2__card" onsubmit="event.preventDefault();this.querySelector('.btn--primary').classList.add('is-loading');setTimeout(()=>location.hash='#/dashboard',500)">
      <img src="../assets/logo/lamma-lockup-ar-horizontal.svg" alt="" height="42" style="align-self:flex-start"><h1>أهلًا فيك من جديد</h1><p class="muted">سجّل دخولك وكمّل من وين وقفت.</p>
      <label class="field"><span class="field__label">رقم الهاتف أو الإيميل</span><span class="control">${I("phone")}<input class="ltr" value="0791234567" autocomplete="username"></span></label>
      ${pw("lpw", "12345678")}
      <div class="row between"><label class="check"><input type="checkbox" checked> تذكّرني</label><a href="#/forgot" class="caption">نسيت كلمة السر؟</a></div>
      <button class="btn btn--primary btn--lg" type="submit">دخول ${I("arrow-left", "ic--16")}</button>
      <div class="divider-or">أو</div><p class="muted" style="text-align:center">جديد على لمّة؟ <a href="#/signup">ابدأ تجربتك المجانية</a></p></form></div></div>`;
  S.forgot = () => `<div class="auth2">${authSide("ولا يهمك", "بنبعتلك رابط على تلفونك تغيّر فيه كلمة السر، وبترجع لشغلك خلال دقيقة.")}
    <div class="auth2__form"><form class="auth2__card" onsubmit="event.preventDefault();Lamma.toast('بعتنالك الرابط — شيّك رسائلك')"><h1>استعادة كلمة السر</h1><p class="muted">اكتب الرقم أو الإيميل اللي سجّلت فيه.</p>
      <label class="field"><span class="field__label">رقم الهاتف أو الإيميل</span><span class="control">${I("phone")}<input class="ltr" required></span></label><button class="btn btn--primary btn--lg">أرسل الرابط</button><a href="#/login" class="muted">${I("arrow-right", "ic--16")} رجوع لتسجيل الدخول</a></form></div></div>`;
  S.signup = () => `<div class="auth2">${authSide("ابدأ <em>ببلاش</em> لمدة شهر", "سجّل، اختار نوع مشروعك، وسجّل أول طلب خلال دقايق — بدون بطاقة.")}
    <div class="auth2__form"><form class="auth2__card" onsubmit="event.preventDefault();this.querySelector('.btn--primary').classList.add('is-loading');setTimeout(()=>location.hash='#/onboarding',500)"><h1>إنشاء حساب</h1><p class="muted">3 حقول بس، وبنبلّش.</p>
      <label class="field"><span class="field__label">اسمك</span><span class="control">${I("user-circle")}<input placeholder="ريم" required></span></label>
      <label class="field"><span class="field__label">رقم الهاتف</span><span class="control ltr"><span class="control__affix">+962</span><input inputmode="tel" placeholder="7X XXX XXXX" required></span><span class="field__help">رح نبعتلك رمز تأكيد</span></label>
      ${pw("spw")}<div class="pwmeter" id="pwm"><i></i><i></i><i></i><i></i></div>
      <button class="btn btn--primary btn--lg">إنشاء الحساب ${I("arrow-left", "ic--16")}</button><p class="caption" style="text-align:center">بإنشاء الحساب بتوافق على الشروط وسياسة الخصوصية</p>
      <p class="muted" style="text-align:center">عندك حساب؟ <a href="#/login">سجّل دخول</a></p></form></div></div>`;
  S.signup.after = () => { const i = document.getElementById("spw"); i.oninput = () => { const v = i.value, s = [v.length >= 8, /\d/.test(v), /[A-Za-z]/.test(v), v.length >= 12].filter(Boolean).length; document.querySelectorAll("#pwm i").forEach((x, k) => x.classList.toggle("on", k < s)); }; };

  const TYPES = [["clothing", "ملابس وأزياء", "clothing", "مقاسات وألوان"], ["shoes", "أحذية وشنط", "other", "مقاس الحذاء"], ["perfume", "عطور", "perfume", "الحجم بالمل"], ["beauty", "تجميل وعناية", "beauty", "درجات وانتهاء"], ["jewelry", "إكسسوارات ومجوهرات", "jewelry", "خامة ووزن"], ["gift", "هدايا وبوكسات", "gift", "بوكسات وإهداء"],
    ["food", "أكل وحلويات بيتية", "other", "طلبات مسبقة"], ["handmade", "شغل يدوي", "other", "حسب الطلب وعربون"], ["electronics", "إلكترونيات", "other", "التوافق والكفالة"], ["kids", "أطفال وألعاب", "clothing", "العمر والمقاس"], ["home", "ديكور ومنزل", "other", "الأبعاد"], ["books", "كتب وقرطاسية", "other", "المؤلف"], ["other", "أخرى", "other", "حقولك الخاصة"]];
  S.onboarding = () => { const st = (App._onb = App._onb || { step: 1, types: ["clothing"], ch: ["instagram", "whatsapp"] });
    const bar = `<div class="onb__top"><img src="../assets/logo/lamma-lockup-ar-horizontal.svg" alt="لمّة" height="34"><div class="onb__bar"><i style="width:${(st.step / 3) * 100}%"></i></div><span class="caption">خطوة ${Math.min(st.step, 3)} من 3</span></div>`;
    if (st.step === 1) return `<div class="onb">${bar}<section class="onb__card"><h1>شو بتبيع؟</h1><p class="onb__sub">بنجهّزلك حقول المنتجات حسب مشروعك. بتقدر تختار أكثر من نوع وتغيّر بعدين.</p>
      <div class="btypes" id="btypes">${TYPES.map(([k, n, art, d]) => `<button class="btype ${st.types.includes(k) ? "is-on" : ""}" data-k="${k}">${LammaArt.product(art)}<b>${n}</b><span>${d}</span></button>`).join("")}</div>
      <div class="row" style="margin-top:22px"><span class="caption grow" id="tcount">${st.types.length} مختار</span><button class="btn btn--primary btn--lg" id="next1">متابعة ${I("arrow-left", "ic--16")}</button></div></section></div>`;
    if (st.step === 2) return `<div class="onb">${bar}<section class="onb__card"><h1>من وين بتجيك الطلبات؟</h1><p class="onb__sub">بنستخدمها عشان نعرفلك أكثر قناة بتبيع.</p>
      <div class="chtoggles">${Object.entries(db.channels).map(([k, v]) => `<label class="opt ${st.ch.includes(k) ? "is-on" : ""}"><span class="chipi tone-${k === "whatsapp" ? "green" : k === "facebook" ? "blue" : "apricot"}">${I(App.chIcon(k))}</span><span><b>${v}</b></span><input type="checkbox" class="toggle" data-ch="${k}" ${st.ch.includes(k) ? "checked" : ""}></label>`).join("")}</div>
      <div class="grid g-2" style="margin-top:18px"><label class="field"><span class="field__label">اسم المشروع</span><span class="control"><input value="بوتيك ريم"></span></label><label class="field"><span class="field__label">العملة</span><span class="control"><select><option>دينار أردني (د.أ)</option></select></span></label></div>
      <div class="row" style="margin-top:22px"><button class="btn btn--ghost" id="back2">${I("arrow-right", "ic--16")} رجوع</button><button class="btn btn--primary btn--lg end" id="next2">جهّز مشروعي ${I("arrow-left", "ic--16")}</button></div></section></div>`;
    return `<div class="onb">${bar}<section class="onb__card onb__done">${LammaArt.gather(true)}<h1>كل شي صار بمكانه</h1><p class="onb__sub">جهّزنا قوالب ${st.types.map((k) => TYPES.find((t) => t[0] === k)[1]).join("، ")}، وبلّشت تجربتك المجانية — 30 يوم.</p><a class="btn btn--primary btn--lg" href="#/dashboard-new" onclick="App._onb=null">ادخل على لمّة ${I("arrow-left", "ic--16")}</a></section></div>`;
  };
  S.onboarding.after = () => { const st = App._onb, $ = (i) => document.getElementById(i);
    if ($("btypes")) { $("btypes").onclick = (e) => { const b = e.target.closest(".btype"); if (!b) return; const k = b.dataset.k; st.types = st.types.includes(k) ? st.types.filter((x) => x !== k) : [...st.types, k]; b.classList.toggle("is-on"); $("tcount").textContent = `${st.types.length} مختار`; $("next1").disabled = !st.types.length; }; $("next1").onclick = () => { st.step = 2; App.render(); }; }
    if ($("next2")) { document.querySelectorAll("[data-ch]").forEach((t) => (t.onchange = () => { st.ch = t.checked ? [...st.ch, t.dataset.ch] : st.ch.filter((x) => x !== t.dataset.ch); t.closest(".opt").classList.toggle("is-on", t.checked); })); $("back2").onclick = () => { st.step = 1; App.render(); }; $("next2").onclick = () => { st.step = 3; App.render(); }; }
  };

  /* ================= DASHBOARD v2 — «مسار لمّة» (every number derived from data-layer.js) ================= */
  S.dashboard = () => {
    const LC = window.LammaCards, A = window.LammaArt;
    const mT = db.metrics("today"), mM = db.metrics("month"), ser14 = db.series(14);
    const cnt = (st) => db.orders.filter((o) => st.includes(o.status)).length;
    const newN = cnt(["new"]), prepN = cnt(["confirmed", "preparing"]), courN = cnt(["courier"]);
    const lowList = db.products.filter((p) => p.stock - p.reserved <= p.low).sort((x, y) => (x.stock - x.reserved) - (y.stock - y.reserved));
    const [mA, mB] = db.range("month");
    const activeCust = new Set(db.orders.filter((o) => o.at >= mA && o.at <= mB).map((o) => o.c)).size;
    const hour = new Date().getHours(), greet = hour < 12 ? "صباح الخير" : "مساء الخير";
    const ordersPerDay = ser14.map((s) => db.orders.filter((o) => o.at === s.day).length);
    const cashPerDay = ser14.map((s) => db.orders.filter((o) => o.deliveredAt === s.day && o.pay !== "courier").reduce((x, o) => x + o.paid, 0));

    /* journey: product → order → packing → courier → delivered → customers → profit */
    const J = [
      ["package", "المنتجات", db.products.length, `${lowList.length} قرب يخلص`, "#/products"],
      ["receipt", "طلبات جديدة", newN, "بانتظار التأكيد", "#/orders"],
      ["gift", "بالتجهيز", prepN, "مؤكدة ومحجوزة", "#/orders/board", prepN > 0],
      ["truck", "مع المندوب", courN, "بالطريق", "#/orders/board"],
      ["circle-check", "توصّلت", mM.deliveredCount, "هالشهر", "#/orders"],
      ["users", "زباين", activeCust, "اشتروا هالشهر", "#/customers"],
    ];
    const journey = `<div class="journey" id="journey"><div class="journey__line"><svg viewBox="0 0 100 6" preserveAspectRatio="none"><path d="M0 3 H100" stroke="#F4A261" stroke-opacity=".45" stroke-width="2" stroke-dasharray="1.2 1.6" vector-effect="non-scaling-stroke"/></svg></div><span class="journey__packet" id="packet"></span>
      ${J.map(([ic, t, n, s, h, hot], i) => `<a class="jnode ${hot ? "is-hot" : ""}" href="${h}" style="--i:${i}"><span class="jnode__dot">${I(ic, "ic--24")}<span class="jnode__n num">${n}</span></span><span class="jnode__t">${t}</span><span class="jnode__s">${s}</span></a>`).join("")}
      <a class="jnode jnode--end" href="#/reports/pnl" style="--i:6"><span class="jnode__dot">${I("wallet", "ic--24")}</span><span class="jnode__t">الربح</span><span class="jnode__s num">${M(mM.net)}</span></a></div>`;

    /* attention list with priorities */
    const att = [];
    if (prepN) { const old = db.orders.filter((o) => ["confirmed", "preparing"].includes(o.status)).sort((x, y) => x.at.localeCompare(y.at))[0]; att.push(["high", "gift", `${prepN} طلبات بدها تجهيز`, `أقدمها #${old.id} من ${old.date}`, "#/orders/board"]); }
    if (newN) att.push(["mid", "receipt", `${newN} طلبات جديدة بانتظار تأكيدك`, "أكّدها عشان تنحجز القطع", "#/orders"]);
    lowList.slice(0, 2).forEach((p) => att.push([p.stock ? "mid" : "high", "package", `${p.name} ${p.stock ? `· ضل ${p.stock - p.reserved}` : "· نفد"}`, `الحد ${p.low} قطع`, `#/products/${p.id}`]));
    if (db.courier.held) att.push(["low", "truck", `${Lamma.fmt(db.courier.held)} د.أ عند شركة التوصيل`, `${db.courier.pending.length} طلبات بانتظار التحويل`, "#/finance/courier"]);
    const dueC = db.customers.filter((c) => c.balance > 0).sort((a, b) => b.balance - a.balance)[0];
    if (dueC) att.push(["low", "cash", `${dueC.name} عليها ${Lamma.fmt(dueC.balance)} د.أ`, "أكبر مبلغ مستحق", `#/customers/${dueC.id}`]);

    /* insight (computed) */
    const ch = db.channelSplit("month"), topP = db.productSales("month")[0];
    const wd = {}; db.orders.filter((o) => o.status === "delivered").forEach((o) => { const k = new Date(o.deliveredAt + "T12:00:00").getDay(); wd[k] = (wd[k] || 0) + App.total(o); });
    const bestDay = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][+Object.entries(wd).sort((a, b) => b[1] - a[1])[0][0]];
    const chColors = ["var(--lamma-chart-1)", "var(--lamma-chart-2)", "var(--lamma-chart-3)", "var(--lamma-chart-4)"];
    const segs = ch.map(([k, v], i) => ({ label: db.channels[k], value: v, color: chColors[i] }));

    /* activity feed */
    const feed = [
      ...db.orders.filter((o) => o.at === db.today).map((o) => ["tone-blue", "receipt", `طلب جديد <span class="ltr">#${o.id}</span>`, `${App.cust(o.c).name} · ${Lamma.fmt(App.total(o))} د.أ`]),
      ...db.movements.slice(0, 3).map((m) => [m.qty > 0 ? "tone-green" : "tone-apricot", m.qty > 0 ? "upload" : "package", `${m.type} · ${m.p}`, `${m.d} · ${m.ref}`]),
      ...db.expenses.filter((e) => e.at === db.today).map((e) => ["tone-brick", "wallet", `مصروف ${e.cat}`, `${e.note} · ${Lamma.fmt(e.amt)} د.أ`]),
    ].slice(0, 5);

    const latest = db.orders.filter((o) => !["cancelled"].includes(o.status)).slice(0, 4);
    const topList = db.productSales("month").slice(0, 4), topMax = Math.max(...topList.map((x) => x.rev), 1);

    return `
    <section class="hero" aria-label="مسار لمّة">
      <div class="hero__row">
        <div><div class="hero__hello"><i></i>${greet}، ${db.business.owner} · ${["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][new Date(db.today + "T12:00:00").getDay()]}، ${new Date(db.today + "T12:00:00").getDate()} ${db.monthName().split(" ")[0]}</div>
          <h1>كل شغلك اليوم، بمسار واحد</h1>
          <p class="hero__lead">عندك <b>${newN} طلبات جديدة</b> و<b>${prepN} بدها تجهيز</b>${courN ? `، و${courN} مع المندوب` : ""}. ${lowList.length ? `${lowList.length} منتجات قربت تخلص.` : "المخزون تمام."}</p></div>
        <div class="hero__kpi stk-host"><span class="stk stk--sm stk--wiggle" style="top:-18px;inset-inline-start:-40px;--r:-12deg">${A.sticker("shadda")}</span><div class="overline">صافي ربح ${db.monthName().split(" ")[0]} لحد اليوم</div><div class="big"><span data-count="${mM.net}" data-dec="2">0</span> <small>د.أ</small></div><div style="margin-top:8px">${LC.delta(mM.delta.net)} <span class="caption" style="color:#B9BDA8">عن نفس الفترة من ${db.prevMonthName()}</span></div></div>
      </div>
      ${journey}
    </section>

    <div class="quick" aria-label="إجراءات سريعة">
      <a class="qa" href="#/orders/new"><span class="chipi tone-olive">${I("receipt")}</span>طلب جديد<kbd>N</kbd></a>
      <a class="qa" href="#/products/new"><span class="chipi tone-apricot">${I("package")}</span>منتج</a>
      <a class="qa" onclick="App.recordPayment()"><span class="chipi tone-green">${I("cash")}</span>دفعة</a>
      <a class="qa" onclick="App.addExpense()"><span class="chipi tone-brick">${I("wallet")}</span>مصروف</a>
      <a class="qa" href="#/inventory/receive"><span class="chipi tone-blue">${I("truck")}</span>استلام بضاعة</a>
    </div>

    <div class="dash">
      <div class="dash__a">
        <article class="card lift" style="padding:20px">
          <div class="shead"><div class="shead__t"><span class="overline">آخر 14 يوم · حسب تاريخ التوصيل</span><h2>المبيعات والربح</h2></div>
            <span class="legend" style="margin-inline-start:auto"><span><i style="background:var(--lamma-chart-1)"></i>المبيعات</span><span><i style="background:var(--lamma-chart-2)"></i>الربح قبل المصاريف</span></span></div>
          <div class="row" style="gap:28px;margin-bottom:6px"><div><span class="caption">مبيعات الشهر</span><div style="font:var(--lamma-type-number-lg)">${M(mM.sales)}</div></div><div><span class="caption">إجمالي الربح</span><div style="font:var(--lamma-type-number-lg);color:var(--lamma-apricot-700)">${M(mM.gross)}</div></div><div class="hide-sm">${LC.delta(mM.delta.sales)} <span class="caption">مبيعات</span></div></div>
          ${LC.area(ser14.map((s) => ({ label: s.label === "اليوم" ? "اليوم" : db.fmtDate(s.day), full: db.fmtDate(s.day), a: s.sales, b: s.profit })), { bName: "الربح" })}
        </article>
        <div class="dash__m">
          ${LC.metric({ row: true, tone: "blue", icon: "receipt", label: "طلبات اليوم", value: mT.ordersCreated, foot: `بقيمة ${M(mT.ordersValue)}`, spark: ordersPerDay, href: "#/orders" })}
          ${LC.metric({ row: true, tone: "green", icon: "building-bank", label: "استلمت فعليًا هالشهر", value: mM.received, dec: 2, unit: "د.أ", delta: mM.delta.received, spark: cashPerDay, href: "#/finance" })}
          ${LC.metric({ row: true, tone: "apricot", icon: "cash", label: "مستحق إلك", value: mM.dues + db.courier.held, dec: 2, unit: "د.أ", foot: `زباين ${M(mM.dues)} · شركة ${M(db.courier.held)}`, href: "#/finance/payments" })}
        </div>
      </div>

      <div class="dash__b">
        <article class="card" style="padding:18px 20px"><div class="shead"><div class="shead__t"><span class="overline">رتّبناها حسب الأهمية</span><h2>يحتاج انتباهك</h2></div><span class="count">${att.length}</span></div>
          <div class="alist">${att.map(([p, ic, t, s, h]) => `<a class="aitem" href="${h}"><span class="prio prio--${p}"></span><span class="chipi ${p === "high" ? "tone-brick" : p === "mid" ? "tone-apricot" : "tone-olive"}">${I(ic)}</span><span class="aitem__t"><b>${t}</b><span>${s}</span></span>${I("chevron-left", "ic--16")}</a>`).join("") || `<p class="muted">ما في إشي مستعجل — كل شي بمكانه.</p>`}</div></article>
        <article class="card" style="padding:18px 20px"><div class="shead"><div class="shead__t"><span class="overline">تحت الحد</span><h2>قرب يخلص</h2></div><a class="shead__more" href="#/inventory">المخزون ${I("arrow-left", "ic--16")}</a></div>
          ${lowList.slice(0, 4).map((p) => `<a class="lowrow" href="#/products/${p.id}" style="text-decoration:none;color:inherit"><span class="lowrow__thumb">${A.product(p.template)}</span><div class="grow col" style="gap:4px"><b style="font:var(--lamma-type-body-strong)">${p.name}</b>${App.stockMeter(p)}</div></a>`).join("") || `<p class="muted">كل المنتجات فوق الحد.</p>`}</article>
      </div>


      <section class="promo" id="promoA" aria-label="ميزات لمّة">
        <div class="promo__slides">
          <div class="promo__slide is-on"><span class="promo__tag">${I("layout-kanban", "ic--16")} ميزة · لوحة الحالات</span><h3>انقل طلباتك <em>بضغطة</em> — والمخزون بيتحدّث لحاله</h3><p>«مؤكد» بيحجز القطع، و«تم التوصيل» بيخصمها ويحسب المبيعة. ما في دفتر ولا نسيان.</p><div class="promo__cta"><a class="btn btn--accent" href="#/orders/board">افتح لوحة الحالات ${I("arrow-left", "ic--16")}</a><span class="caption" style="color:#B9BDA8">${prepN + newN} طلبات مستنية حركة</span></div></div>
          <div class="promo__slide"><span class="promo__tag">${I("truck", "ic--16")} ميزة · شركة التوصيل</span><h3>مصاريك عند المندوب <em>تحت عينك</em></h3><p>شوف كم إلك عند شركة التوصيل، وسوّي التسوية بضغطة — والفرق بينسجّل لحاله كمصروف.</p><div class="promo__cta"><a class="btn btn--accent" href="#/finance/courier">شوف المستحقات ${I("arrow-left", "ic--16")}</a><span class="caption" style="color:#B9BDA8"><bdi>${Lamma.fmt(db.courier.held)}</bdi> د.أ بانتظار التحويل</span></div></div>
          <div class="promo__slide"><span class="promo__tag">${I("chart-bar", "ic--16")} ميزة · شلال الربح</span><h3>اعرف وين بتروح <em>كل دينار</em></h3><p>من المبيعات للصافي خطوة بخطوة — وجملة بتشرحلك ليش الربح طلع أو نزل.</p><div class="promo__cta"><a class="btn btn--accent" href="#/reports/pnl">افتح الأرباح والخسائر ${I("arrow-left", "ic--16")}</a></div></div>
          <div class="promo__dots" role="tablist">${[0, 1, 2].map((i) => `<button class="${i ? "" : "is-on"}" data-s="${i}" aria-label="ميزة ${i + 1}"></button>`).join("")}</div>
        </div>
        <div class="promo__art" id="promoArt">${A.packing("clothing", true)}</div>
        <span class="stk stk--sm stk--wiggle" style="top:14px;inset-inline-end:${"2"}%;--r:12deg;--d:900ms">${A.sticker("star")}</span>
      </section>
      <section class="stk-host"><span class="stk stk--sm" style="top:-6px;inset-inline-start:150px;--r:10deg;--d:800ms">${A.sticker("parcel")}</span><div class="shead"><div class="shead__t"><span class="overline">ملصقات الشحن · مع مسار كل طلب</span><h2>آخر الطلبات</h2></div><a class="shead__more" href="#/orders/board">لوحة الحالات ${I("arrow-left", "ic--16")}</a></div>
        <div class="ogrid stagger">${latest.map((o, i) => App.orderCard(o, i)).join("")}</div></section>

      <div class="dash__c">
        <div class="col" style="gap:16px">
          <div class="insight"><span class="overline">ملاحظة لمّة</span><p>أكثر قناة بتبيع هالشهر <b>${segs[0] ? segs[0].label : "—"}</b>، وأقوى يوم مبيعات عندك <b>${bestDay}</b>. ${topP && topP.rev ? `منتجك الأول: <b>${topP.p.name}</b>.` : ""}</p></div>
          <article class="card" style="padding:18px 20px"><div class="shead"><div class="shead__t"><span class="overline">${db.monthName()}</span><h2>المبيعات حسب القناة</h2></div></div>
            <div class="row" style="gap:20px">${LC.donut(segs, `<bdi>${Lamma.fmt(mM.sales, 0)}</bdi>`, "د.أ")}${LC.legend(segs, segs.reduce((s, x) => s + x.value, 0))}</div></article>
        </div>
        <article class="card stk-host" style="padding:18px 20px"><span class="stk stk--sm" style="top:-14px;inset-inline-start:-10px;--r:-14deg;--d:1000ms">${A.sticker("fire")}</span><div class="shead"><div class="shead__t"><span class="overline">${db.monthName()}</span><h2>الأكثر مبيعًا</h2></div><a class="shead__more" href="#/reports/sales">التقرير ${I("arrow-left", "ic--16")}</a></div>
          <div class="col" style="gap:14px">${topList.map(({ p, q, rev }, i) => `<a href="#/products/${p.id}" style="text-decoration:none;color:inherit" class="col"><div class="row" style="gap:10px"><span class="lowrow__thumb" style="width:38px;height:38px">${A.product(p.template)}</span><span class="grow"><b style="font:var(--lamma-type-body-strong)">${p.name}</b><br><span class="caption">${q} قطعة</span></span>${M(rev, { dec: 0 })}</div><div class="flowbar" style="height:6px;margin-top:8px"><span style="width:${(rev / topMax) * 100}%;background:var(--lamma-chart-${i === 0 ? 2 : 1});animation-delay:${i * 90}ms"></span></div></a>`).join("")}</div></article>
        <article class="card" style="padding:18px 20px"><div class="shead"><div class="shead__t"><span class="overline">اليوم</span><h2>آخر النشاطات</h2></div></div>
          <ul class="feed">${feed.map(([tone, ic, t, s]) => `<li class="${tone}"><span class="feed__ic">${I(ic, "ic--16")}</span><div><b>${t}</b><span>${s}</span></div></li>`).join("")}</ul></article>
      </div>

      <section class="promo promo--warm" aria-label="الاشتراك">
        <div><span class="promo__tag">${I("credit-card", "ic--16")} تجربتك المجانية</span><h3>ضل <em>${db.business.trialDaysLeft} يوم</em> — والسنوي بيوفّرلك شهرين</h3><p>كل اللي بنيته بلمّة بيضل محفوظ. اشترك قبل ما تخلص التجربة وكمّل بدون ولا توقّف.</p>
          <div class="promo__cta"><a class="btn btn--primary" href="#/subscription">شوف الخطط ${I("arrow-left", "ic--16")}</a><a class="btn btn--glass" href="#/subscription">قارن الخطط</a></div></div>
        <div class="promo__art"><div class="promo__days" style="width:260px">${Array.from({ length: 30 }, (_, i) => { const used = db.business.trialTotal - db.business.trialDaysLeft; return `<i class="${i < used - 1 ? "used" : i === used - 1 ? "is-today" : ""}" style="animation-delay:${i * 20}ms"></i>`; }).join("")}</div></div>
        <span class="stk stk--wiggle" style="bottom:12px;inset-inline-end:280px;--r:-10deg;--d:1200ms">${A.sticker("heart")}</span>
      </section>
    </div>`;
  };
  S.dashboard.after = () => {
    window.LammaCards.bindArea(document.getElementById("page"));
    const j = document.getElementById("journey"), pk = document.getElementById("packet");
    if (j && pk) pk.style.setProperty("--run", j.offsetWidth * (6 / 7) + "px");
    /* promo A: rotates every 6.5s; each slide replays its own story art */
    const pa = document.getElementById("promoA"); if (!pa) return;
    const arts = [() => LammaArt.packing("clothing", true), () => LammaArt.delivery("delivered", true), () => `<div class="promo__mini" style="width:240px">${[90, 70, 40, 52, 26, 18].map((h, i) => `<i class="${i === 5 ? "" : i > 0 ? "hot" : ""}" style="height:${h}%;animation-delay:${i * 90}ms;${i === 5 ? "background:var(--lamma-apricot-500)" : ""}"></i>`).join("")}</div>`];
    let cur = 0; const show = (k) => { cur = k; pa.querySelectorAll(".promo__slide").forEach((s, i) => s.classList.toggle("is-on", i === k)); pa.querySelectorAll(".promo__dots button").forEach((b, i) => b.classList.toggle("is-on", i === k)); document.getElementById("promoArt").innerHTML = arts[k](); };
    pa.querySelector(".promo__dots").onclick = (e) => { const b = e.target.closest("[data-s]"); if (b) show(+b.dataset.s); };
    if (!Lamma.reduceMotion()) App._timers.push(setInterval(() => show((cur + 1) % 3), 6500));
  };

  S["dashboard-new"] = () => `${App.head("أهلًا فيك بلمّة يا ريم", "3 خطوات وبكون كل شغلك بمكانه")}
    <div class="grid g-main"><div class="card"><div class="row" style="gap:16px;margin-bottom:8px"><div class="ring" style="--p:33"><span>1/3</span></div><div><h3>ابدأ هون</h3><p class="muted">كل خطوة بتاخد أقل من دقيقة</p></div></div>
      <ul class="checklist"><li><span class="done">${I("check", "ic--16")}</span><span class="grow"><b>جهّز مشروعك</b><br><span class="caption">ملابس وأزياء · إنستغرام وواتساب</span></span></li>
      <li><span class="todo"></span><span class="grow"><b>أضف أول منتج</b><br><span class="caption">بالمقاسات والألوان وكمية كل وحدة</span></span><a class="btn btn--primary btn--sm" href="#/products/new">أضف منتج</a></li>
      <li><span class="todo"></span><span class="grow"><b>سجّل أول طلب</b><br><span class="caption">من رسالة واتساب أو إنستغرام</span></span><a class="btn btn--outline btn--sm" href="#/orders/new">سجّل طلب</a></li>
      <li><span class="todo"></span><span class="grow"><b>سجّل مصروف</b><br><span class="caption">عشان نحسبلك الربح الحقيقي</span></span><button class="btn btn--outline btn--sm" onclick="App.addExpense()">سجّل مصروف</button></li></ul></div>
    ${App.empty("هون رح تشوف «لمّة اليوم»", "أول ما تسجّل طلبات، بنجمعلك كل شي بجملة وحدة كل يوم.")}</div>`;

  /* ================= ORDERS v2 ================= */
  const NEXT = { new: "confirmed", confirmed: "preparing", preparing: "courier", courier: "delivered" };
  App.ordersTable = (list) => `<table class="tbl"><thead><tr><th>الطلب</th><th>العميل</th><th class="hide-md">المنتجات</th><th>الحالة</th><th class="hide-md">المسار</th><th class="hide-sm">الدفع</th><th class="num">المجموع</th><th class="num hide-sm"></th></tr></thead><tbody>${list.map((o) => {
    const c = App.cust(o.c), p = App.prod(o.items[0][0]), nx = NEXT[o.status];
    return `<tr class="st-${o.status}" onclick="location.hash='#/orders/${o.id}'"><td><span class="o-id"><span><b class="ltr">#${o.id}</b><br><span class="caption">${o.date}</span></span></span></td>
      <td><div class="row" style="gap:8px"><span class="avatar avatar--sm">${App.initials(c.name)}</span><span>${c.name}<br><span class="caption row" style="gap:4px">${I(App.chIcon(o.channel), "ic--16")}${db.channels[o.channel]}</span></span></div></td>
      <td class="hide-md"><div class="cell-product"><span class="lowrow__thumb" style="width:40px;height:40px">${LammaArt.product(p.template)}</span><span>${p.name}${o.items.length > 1 ? ` +${o.items.length - 1}` : ""}<br><span class="caption">${o.items[0][1] || "—"} × ${o.items[0][2]}</span></span></div></td>
      <td>${App.statusBadge(o.status)}</td><td class="hide-md">${App.track(o.status)}</td><td class="hide-sm">${App.payBadge(o.pay)}</td><td class="num">${M(App.total(o))}</td>
      <td class="num hide-sm"><span class="row-act">${nx ? `<button class="btn btn--secondary btn--sm" onclick="event.stopPropagation();App.quickNext(${o.id})" title="نقل لـ «${App.status(nx)[1]}»">${App.status(nx)[1]} ${I("arrow-left", "ic--16")}</button>` : ""}</span></td></tr>`;
  }).join("")}</tbody></table>`;
  App.quickNext = (id) => { const o = App.order(id), nx = NEXT[o.status]; const undo = App.setStatus(o, nx); App.render(); Lamma.toast(App.statusMsg(o, nx), { action: "تراجع", onAction: () => { undo(); App.render(); } }); };

  S.orders = () => {
    const counts = Object.fromEntries(db.statuses.map((s) => [s[0], db.orders.filter((o) => o.status === s[0]).length]));
    const mT = db.metrics("today"), unpaid = db.orders.filter((o) => ["unpaid", "partial"].includes(o.pay) && o.status !== "cancelled");
    const open = db.orders.filter((o) => ["new", "confirmed", "preparing", "courier"].includes(o.status));
    const LC = window.LammaCards;
    return `${App.head("الطلبات", `${db.orders.length} طلب · ${open.length} مفتوحة لهلّق`, `<a class="btn btn--outline" href="#/orders/board">${I("layout-kanban")} لوحة الحالات</a><a class="btn btn--primary" href="#/orders/new">${I("plus")} طلب جديد</a>`)}
    <div class="grid g-3">
      ${LC.metric({ row: true, tone: "blue", icon: "receipt", label: "طلبات اليوم", value: mT.ordersCreated, foot: `بقيمة ${M(mT.ordersValue)}` })}
      ${LC.metric({ row: true, tone: "apricot", icon: "gift", label: "مفتوحة (لسا ما توصّلت)", value: open.length, foot: `مبيعات متوقعة ${M(open.reduce((s, o) => s + App.total(o), 0))}` })}
      ${LC.metric({ row: true, tone: "brick", icon: "cash", label: "غير مدفوعة أو جزئية", value: unpaid.length, foot: `متبقي ${M(unpaid.reduce((s, o) => s + App.total(o) - o.paid, 0))}` })}
    </div>
    <div class="srail" id="srail" role="tablist"><button class="sopt sopt--all is-active" data-s=""><i></i>الكل <b>${db.orders.length}</b></button>${db.statuses.map((s) => `<button class="sopt st-${s[0]}" data-s="${s[0]}"><i></i>${s[1]} <b>${counts[s[0]]}</b></button>`).join("")}</div>
    <div class="table-wrap"><div class="toolbar"><span class="control control--search" style="height:40px;width:min(300px,100%)">${I("search")}<input placeholder="رقم الطلب أو اسم العميل" id="oq"></span>
      <button class="chip">${I("calendar", "ic--16")} كل الفترات</button><button class="chip" id="fUnpaid">${I("cash", "ic--16")} غير مدفوع</button>
      <div class="vtoggle end" id="ov"><button class="is-active" data-v="table" aria-label="جدول">${I("list", "ic--16")}</button><button data-v="cards" aria-label="ملصقات">${I("layout-grid", "ic--16")}</button></div></div>
      <div id="olist"></div><div class="pagination"><span id="ocount"></span><span class="caption">رتّبنا الأحدث أول</span></div></div>`;
  };
  S.orders.after = () => {
    let st = "", q = "", unpaidOnly = false, view = "table";
    const draw = () => {
      const list = db.orders.filter((o) => (!st || o.status === st) && (!unpaidOnly || ["unpaid", "partial"].includes(o.pay)) && (!q || String(o.id).includes(q) || App.cust(o.c).name.includes(q)));
      const shown = list.slice(0, 25), el = document.getElementById("olist");
      el.innerHTML = !list.length ? App.empty("ما في طلبات هون", "جرّب تغيّر الفلتر أو البحث.", "") : view === "table" ? App.ordersTable(shown) : `<div class="ogrid stagger" style="padding:16px">${shown.map((o, i) => App.orderCard(o, i)).join("")}</div>`;
      document.getElementById("ocount").textContent = `عرض ${shown.length} من ${list.length}`;
    };
    document.getElementById("srail").onclick = (e) => { const b = e.target.closest(".sopt"); if (!b) return; document.querySelectorAll("#srail .sopt").forEach((x) => x.classList.toggle("is-active", x === b)); st = b.dataset.s; draw(); };
    document.getElementById("oq").oninput = (e) => { q = e.target.value.trim(); draw(); };
    document.getElementById("fUnpaid").onclick = (e) => { unpaidOnly = !unpaidOnly; e.currentTarget.classList.toggle("is-selected", unpaidOnly); draw(); };
    document.getElementById("ov").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; view = b.dataset.v; document.querySelectorAll("#ov button").forEach((x) => x.classList.toggle("is-active", x === b)); draw(); };
    draw();
  };

  /* Board: change status with motion; reserve on confirm, deduct on delivery */
  const FLOW = ["new", "confirmed", "preparing", "courier", "delivered"];
  const cardHtml = (o) => { const next = FLOW[FLOW.indexOf(o.status) + 1];
    return App.orderCard(o).replace('<a class="ocard', `<div data-id="${o.id}" class="order-card ocard`).replace(/ href="[^"]*"/, "").replace(/<\/a>$/,
      `${next ? `<button class="btn btn--secondary btn--sm" data-next="${next}" style="margin-top:2px">${I(next === "preparing" ? "gift" : next === "courier" ? "truck" : next === "delivered" ? "circle-check" : "check", "ic--16")} ${App.status(next)[1]}</button>` : ""}</div>`); };
  const colCount = (s) => db.orders.filter((o) => o.status === s).length;
  const colCards = (s) => { const list = db.orders.filter((o) => o.status === s); const show = s === "delivered" ? list.slice(0, 5) : list;
    return show.map(cardHtml).join("") + (list.length > show.length ? `<a class="btn btn--ghost btn--sm" href="#/orders" data-more>+ ${list.length - show.length} طلب · عرض الكل</a>` : "") +
      (list.length ? "" : `<div class="board__empty">${s === "preparing" ? LammaArt.parcel() : s === "courier" ? LammaArt.delivery("courier") : ""}<span class="caption">ما في طلبات هون</span></div>`); };
  S["orders/board"] = () => `${App.head("لوحة الحالات", "انقل الطلب لحالته الجاية من الزر — الحجز والخصم بيصيروا لحالهم", `<a class="btn btn--outline" href="#/orders">${I("list")} جدول</a><a class="btn btn--primary" href="#/orders/new">${I("plus")} طلب جديد</a>`, `<a href="#/orders">الطلبات</a> / لوحة الحالات`)}
    <div class="board" id="board">${FLOW.map((s) => `<div class="board__col st-${s}" data-col="${s}"><div class="board__head">${App.statusBadge(s)}<span class="board__n" data-n>${colCount(s)}</span></div>${colCards(s)}</div>`).join("")}</div>
    <p class="caption">تلقائي: عند «مؤكد» القطع بتنحجز · عند «قيد التجهيز» بيتغلّف · عند «تم التوصيل» بتنخصم من المخزون وبتنحسب المبيعة.</p>`;
  S["orders/board"].after = () => {
    const board = document.getElementById("board");
    const recount = () => board.querySelectorAll(".board__col").forEach((c) => (c.querySelector("[data-n]").textContent = colCount(c.dataset.col)));
    /* the story art plays ONLY because the status really changed */
    const playStory = (nc, st, o) => {
      if (Lamma.reduceMotion() || !["preparing", "delivered"].includes(st)) return;
      const art = document.createElement("div"); art.className = "ocard__art";
      art.innerHTML = st === "preparing" ? LammaArt.packing(App.prod(o.items[0][0]).template, true) : LammaArt.delivery("delivered", true);
      nc.appendChild(art); setTimeout(() => art.classList.add("is-done"), st === "preparing" ? 2500 : 2300); setTimeout(() => art.remove(), 2900);
    };
    const place = (o, st, from) => { const col = board.querySelector(`[data-col="${st}"]`); col.querySelector(".board__empty")?.remove();
      const f = document.createElement("div"); f.innerHTML = cardHtml(o); const nc = f.firstElementChild; from.replaceWith(nc); Lamma.flipMove(nc, col, col.children[1] || null); recount(); return nc; };
    board.addEventListener("click", (e) => {
      const b = e.target.closest("[data-next]"); if (!b) return;
      const card = b.closest(".order-card"), o = App.order(card.dataset.id), prev = o.status, next = b.dataset.next;
      const undo = App.setStatus(o, next); const nc = place(o, next, card); playStory(nc, next, o);
      Lamma.toast(App.statusMsg(o, next), { action: "تراجع", onAction: () => { undo(); place(o, prev, board.querySelector(`[data-id="${o.id}"]`)); } });
    });
  };

  /* ================= NEW ORDER v2 — 4 steps + live receipt ================= */
  const PAYM = [["paid", "مدفوع", "circle-check", "green"], ["partial", "جزئي", "cash", "apricot"], ["unpaid", "غير مدفوع", "clock", "brick"], ["cod", "عند الاستلام", "truck", "blue"]];
  const availOf = (p, v) => { if (p.variants && v) { const x = p.variants.find((a) => `${a[0]} · ${a[1]}` === v); return x ? x[2] - x[3] : 0; } return p.stock - p.reserved; };
  const variantsOf = (p) => p.variants ? p.variants.map((a) => `${a[0]} · ${a[1]}`) : p.sizes ? p.sizes : [""];
  const priceOf = (p, v) => (p.id === "p2" ? { "10 مل": 8, "50 مل": 24, "100 مل": 40 }[v] || p.price : p.price);
  S["orders/new"] = () => {
    const F = (App._draft = App._draft || { c: "c1", ch: "instagram", lines: [["p1", "L · زيتي", 1]], fee: 2, disc: 0, gift: false, pre: false, dep: false, pay: "partial", paid: 20, method: "CliQ", q: "" });
    return `${App.head("طلب جديد", "من رسالة واتساب أو إنستغرام… لطلب مرتب بأربع خطوات", "", `<a href="#/orders">الطلبات</a> / طلب جديد`)}
    <nav class="steps2" id="steps2" aria-label="خطوات الطلب"><span class="steps2__line"></span><span class="steps2__fill" id="sfill"></span>
      ${[["users", "العميل", "s1"], ["package", "المنتجات", "s2"], ["truck", "التوصيل", "s3"], ["cash", "الدفع", "s4"]].map(([ic, t, id]) => `<button class="step2" data-go="${id}"><span>${I(ic)}</span>${t}</button>`).join("")}</nav>
    <div class="grid g-main" style="gap:20px">
      <div class="col" style="gap:16px">
        <section class="card osec" id="s1"><div class="osec__h"><span class="osec__n">1</span><h2>العميل</h2></div><div id="custBox"></div></section>
        <section class="card osec" id="s2"><div class="osec__h"><span class="osec__n">2</span><h2>المنتجات</h2><span class="caption end">اضغط على منتج لتضيفه</span></div>
          <span class="control" style="margin-bottom:12px">${I("search")}<input placeholder="دوّر على منتج…" id="pq" aria-label="منتج"></span><div class="picker" id="picker"></div><div id="lines" style="margin-top:6px"></div></section>
        <section class="card osec" id="s3"><div class="osec__h"><span class="osec__n">3</span><h2>التوصيل والإضافات</h2></div>
          <div class="grid g-2"><label class="field"><span class="field__label">رسوم التوصيل (على الزبون)</span><span class="control"><input class="ltr" id="fee" value="${Lamma.fmt(F.fee)}" inputmode="decimal"><span class="control__affix">د.أ</span></span></label>
            <label class="field"><span class="field__label">خصم</span><span class="control"><input class="ltr" id="disc" value="${Lamma.fmt(F.disc)}" inputmode="decimal"><span class="control__affix">د.أ</span></span></label></div>
          <label class="field" style="margin-top:12px"><span class="field__label">العنوان</span><span class="control">${I("map-pin")}<input id="addr"></span></label>
          <div class="opts" style="margin-top:14px">
            <label class="opt ${F.gift ? "is-on" : ""}"><span class="chipi tone-brick">${I("gift")}</span><span><b>هدية</b><span>مستلم ورسالة إهداء</span></span><input type="checkbox" class="toggle" data-opt="gift" ${F.gift ? "checked" : ""}></label>
            <label class="opt ${F.pre ? "is-on" : ""}"><span class="chipi tone-blue">${I("calendar")}</span><span><b>طلب مسبق</b><span>تاريخ ووقت تسليم</span></span><input type="checkbox" class="toggle" data-opt="pre" ${F.pre ? "checked" : ""}></label>
            <label class="opt ${F.dep ? "is-on" : ""}"><span class="chipi tone-apricot">${I("wallet")}</span><span><b>عربون</b><span>دفعة مقدّمة</span></span><input type="checkbox" class="toggle" data-opt="dep" ${F.dep ? "checked" : ""}></label></div>
          <div id="optFields"></div></section>
        <section class="card osec" id="s4"><div class="osec__h"><span class="osec__n">4</span><h2>الدفع</h2></div>
          <div class="paycards" id="paycards">${PAYM.map(([k, t, ic, tone]) => `<button class="paycard tone-${tone} ${F.pay === k ? "is-active" : ""}" data-pay="${k}"><span class="chipi">${I(ic)}</span>${t}</button>`).join("")}</div>
          <div id="payFields" style="margin-top:14px"></div></section>
      </div>
      <aside class="receipt-wrap"><div class="receipt" id="receipt"></div>
        <div class="col" style="gap:8px"><button class="btn btn--primary btn--lg" id="saveC">${I("check")} حفظ كـ «مؤكد»</button><button class="btn btn--outline" id="saveN">حفظ كـ «جديد»</button>
          <p class="caption">«مؤكد» بيحجز القطع تلقائيًا. بتنخصم من المخزون لما يصير «تم التوصيل».</p></div></aside>
    </div>`;
  };
  S["orders/new"].after = () => {
    const F = App._draft, $ = (id) => document.getElementById(id);
    const sub = () => F.lines.reduce((s, [pid, v, q]) => s + q * priceOf(App.prod(pid), v), 0);
    const cost = () => F.lines.reduce((s, [pid, , q]) => s + q * App.prod(pid).cost, 0);
    const total = () => Math.max(0, sub() + F.fee - F.disc);
    const progress = () => {
      const done = [!!F.c, F.lines.length > 0 && F.lines.every(([pid, v, q]) => q <= availOf(App.prod(pid), v)), true, F.pay !== "partial" || F.paid > 0];
      document.querySelectorAll(".step2").forEach((s, i) => { s.classList.toggle("is-done", done[i]); s.classList.toggle("is-now", !done[i] && done.slice(0, i).every(Boolean)); });
      document.querySelectorAll(".osec").forEach((s, i) => s.classList.toggle("is-done", done[i]));
      const n = done.filter(Boolean).length; $("sfill").style.setProperty("--p", Math.max(0, (n - 1) / 3));
    };
    const drawCust = () => {
      const c = App.cust(F.c);
      $("custBox").innerHTML = c ? `<div class="selcust"><span class="ring-av" style="--p:70"><span>${App.initials(c.name)}</span></span><div class="grow"><b>${c.name}</b><div class="caption"><span class="ltr">${c.phone}</span> · ${c.city} · ${c.orders} طلبات</div></div>${c.balance ? `<span class="selcust__warn">${I("alert-triangle", "ic--16")} عليها ${Lamma.fmt(c.balance)} د.أ</span>` : ""}<button class="btn btn--ghost btn--sm" id="chg">تغيير</button></div>
        <div class="row wrap" style="margin-top:12px" id="chs">${Object.entries(db.channels).map(([k, v]) => `<button class="chip ${F.ch === k ? "is-selected" : ""}" data-ch="${k}">${I(App.chIcon(k), "ic--16")} ${v}</button>`).join("")}</div>`
        : `<span class="control">${I("search")}<input id="cq" placeholder="اسم العميل أو رقمه" value="${F.q}"></span><div class="select-list" style="box-shadow:none;margin-top:8px" id="cres"></div>`;
      if (c) { $("chg").onclick = () => { F.c = null; drawCust(); progress(); }; $("chs").onclick = (e) => { const b = e.target.closest("[data-ch]"); if (b) { F.ch = b.dataset.ch; drawCust(); } }; }
      else { const res = () => { const list = db.customers.filter((x) => !F.q || x.name.includes(F.q) || x.phone.includes(F.q)); $("cres").innerHTML = list.map((x) => `<div class="select-list__item" data-c="${x.id}"><span class="avatar avatar--sm">${App.initials(x.name)}</span>${x.name}<span class="caption ltr end">${x.phone}</span></div>`).join("") + `<div class="select-list__item select-list__item--create" onclick="App.addCustomer()">${I("plus", "ic--16")} عميل جديد${F.q ? ` «${F.q}»` : ""}</div>`; };
        res(); $("cq").oninput = (e) => { F.q = e.target.value; res(); }; $("cres").onclick = (e) => { const it = e.target.closest("[data-c]"); if (it) { F.c = it.dataset.c; drawCust(); progress(); drawReceipt(); } }; $("cq").focus(); }
    };
    const drawPicker = () => { const q = ($("pq").value || "").trim();
      $("picker").innerHTML = db.products.filter((p) => !q || p.name.includes(q)).map((p) => { const av = p.stock - p.reserved, added = F.lines.some((l) => l[0] === p.id);
        return `<button class="ptile ${added ? "is-added" : ""} ${av <= 0 ? "is-out" : ""}" data-p="${p.id}" ${av <= 0 ? 'aria-disabled="true"' : ""}>${LammaArt.product(p.template)}<b>${p.name}</b><small>${av <= 0 ? "نفد" : `${M(p.price)} · ${av} متوفر`}</small></button>`; }).join(""); };
    const drawLines = () => {
      $("lines").innerHTML = F.lines.map(([pid, v, q], i) => { const p = App.prod(pid), av = availOf(p, v), over = q > av;
        return `<div class="line2"><span class="line2__art">${LammaArt.product(p.template)}</span>
          <div class="col" style="gap:6px;min-width:0"><b>${p.name}</b>${variantsOf(p)[0] ? `<div class="row wrap" style="gap:6px">${variantsOf(p).map((x) => { const a = availOf(p, x); return `<button class="swatch ${x === v ? "is-selected" : ""} ${a <= 0 ? "is-out" : ""}" data-line="${i}" data-v="${x}" ${a <= 0 ? 'title="نفد"' : ""}>${x}</button>`; }).join("")}</div>` : ""}
            <span class="${over ? "field__error" : "caption"}">${over ? `${I("alert-triangle", "ic--16")} متوفر ${av} بس${v ? " من " + v : ""}` : `متوفر ${av}`}</span></div>
          <span class="stepper"><button data-inc="${i}" ${q >= av ? "disabled" : ""} aria-label="زيادة">+</button><input class="ltr" value="${q}" aria-label="الكمية" readonly><button data-dec="${i}" aria-label="نقص">−</button></span>
          ${M(priceOf(p, v) * q)}<button class="btn btn--ghost icon-btn btn--sm" data-rm="${i}" aria-label="حذف">${I("trash", "ic--16")}</button></div>`; }).join("") || `<p class="muted" style="padding:12px 0">لسا ما ضفت منتجات.</p>`;
    };
    const drawOpts = () => { $("optFields").innerHTML = `${F.gift ? `<div class="grid g-2" style="margin-top:12px"><label class="field"><span class="field__label">اسم المستلم</span><span class="control"><input></span></label><label class="field"><span class="field__label">رسالة الإهداء</span><span class="control"><input placeholder="كل سنة وإنتِ بخير"></span></label></div>` : ""}
      ${F.pre ? `<label class="field" style="margin-top:12px"><span class="field__label">تاريخ ووقت التسليم</span><span class="control">${I("calendar")}<input value="12 نوفمبر · 5 مساءً"></span></label>` : ""}
      ${F.dep ? `<label class="field" style="margin-top:12px"><span class="field__label">العربون</span><span class="control"><input class="ltr" value="${Lamma.fmt(Math.round(total() * 0.3))}"><span class="control__affix">د.أ</span></span><span class="field__help">30% من المجموع</span></label>` : ""}`; };
    const drawPay = () => { $("payFields").innerHTML = F.pay === "partial" ? `<div class="grid g-2"><label class="field"><span class="field__label">المدفوع هلّق</span><span class="control"><input class="ltr" id="paid" value="${Lamma.fmt(F.paid)}"><span class="control__affix">د.أ</span></span></label>
        <div class="field"><span class="field__label">الطريقة</span><div class="row wrap">${db.payMethods.slice(0, 4).map((m) => `<button class="chip ${F.method === m ? "is-selected" : ""}" data-m="${m}">${m}</button>`).join("")}</div></div></div>`
      : F.pay === "paid" ? `<div class="field"><span class="field__label">الطريقة</span><div class="row wrap">${db.payMethods.map((m) => `<button class="chip ${F.method === m ? "is-selected" : ""}" data-m="${m}">${m}</button>`).join("")}</div></div>`
      : F.pay === "cod" ? `<p class="caption">${I("truck", "ic--16")} شركة التوصيل بتجمع المبلغ، وبيظهر عند «مستحقات شركة التوصيل» لحد ما تحوّله.</p>` : `<p class="caption">بيضل المبلغ كامل كذمّة على العميل.</p>`;
      const pi = $("paid"); if (pi) pi.oninput = () => { F.paid = parseFloat(pi.value.replace(/,/g, "")) || 0; drawReceipt(); progress(); }; };
    const drawReceipt = () => { const c = App.cust(F.c), t = total(), paid = F.pay === "paid" ? t : F.pay === "partial" ? Math.min(F.paid, t) : 0;
      $("receipt").innerHTML = `<div class="receipt__head">${LammaArt.parcel()}<div><span class="overline">ملخّص الطلب</span><b style="display:block;font:var(--lamma-type-h3)">${c ? c.name : "اختار عميل"}</b><span class="caption">${db.channels[F.ch]} · اليوم</span></div></div>
        ${F.lines.map(([pid, v, q]) => { const p = App.prod(pid); return `<div class="receipt__row"><span>${p.name}${v ? ` · ${v}` : ""} × ${q}</span>${M(priceOf(p, v) * q)}</div>`; }).join("")}
        <div class="receipt__row"><span>التوصيل</span>${M(F.fee)}</div>${F.disc ? `<div class="receipt__row"><span>خصم</span>${M(-F.disc)}</div>` : ""}
        <div class="receipt__total"><b>المجموع</b>${M(t)}</div>
        <div class="receipt__row"><span>المدفوع</span>${M(paid)}</div><div class="receipt__row"><span>المتبقي</span><b>${M(t - paid)}</b></div>
        <div class="receipt__profit"><span>${I("wallet", "ic--16")} ربحك المتوقع</span><b>${M(sub() - cost() - F.disc)}</b></div><div class="receipt__barcode" aria-hidden="true"></div>`;
      const ok = !!F.c && F.lines.length && F.lines.every(([pid, v, q]) => q <= availOf(App.prod(pid), v)); $("saveC").disabled = !ok; $("saveN").disabled = !ok; };
    const all = () => { drawLines(); drawPicker(); drawReceipt(); progress(); };
    drawCust(); drawOpts(); drawPay(); all();
    $("pq").oninput = drawPicker;
    $("picker").onclick = (e) => { const t = e.target.closest(".ptile"); if (!t || t.classList.contains("is-out")) return; const p = App.prod(t.dataset.p); if (F.lines.some((l) => l[0] === p.id)) return;
      const v = variantsOf(p).find((x) => availOf(p, x) > 0) ?? ""; F.lines.push([p.id, v, 1]); all(); };
    $("lines").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; const d = b.dataset;
      if (d.inc) F.lines[+d.inc][2]++; else if (d.dec) F.lines[+d.dec][2] = Math.max(1, F.lines[+d.dec][2] - 1); else if (d.rm) F.lines.splice(+d.rm, 1); else if (d.v !== undefined && !b.classList.contains("is-out")) F.lines[+d.line][1] = d.v; else return; all(); };
    document.querySelectorAll("[data-opt]").forEach((t) => (t.onchange = () => { F[t.dataset.opt] = t.checked; t.closest(".opt").classList.toggle("is-on", t.checked); drawOpts(); }));
    $("paycards").onclick = (e) => { const b = e.target.closest("[data-pay]"); if (!b) return; F.pay = b.dataset.pay; document.querySelectorAll(".paycard").forEach((x) => x.classList.toggle("is-active", x === b)); drawPay(); drawReceipt(); progress(); };
    $("payFields").onclick = (e) => { const b = e.target.closest("[data-m]"); if (b) { F.method = b.dataset.m; drawPay(); } };
    ["fee", "disc"].forEach((k) => ($(k).oninput = (e) => { F[k] = parseFloat(e.target.value.replace(/,/g, "")) || 0; drawReceipt(); }));
    $("steps2").onclick = (e) => { const b = e.target.closest("[data-go]"); if (b) $(b.dataset.go).scrollIntoView({ behavior: Lamma.reduceMotion() ? "auto" : "smooth" }); };
    const save = (st) => (e) => { const btn = e.currentTarget; btn.classList.add("is-loading");
      setTimeout(() => { const id = Math.max(...db.orders.map((o) => o.id)) + 1, t = total();
        const o = { id, c: F.c, items: F.lines.map(([pid, v, q]) => [pid, v, q, priceOf(App.prod(pid), v)]), status: "new", pay: F.pay === "cod" ? "unpaid" : F.pay, paid: F.pay === "paid" ? t : F.pay === "partial" ? Math.min(F.paid, t) : 0, delivery: F.fee, channel: F.ch, at: db.today, date: "اليوم", payMethod: F.pay === "cod" ? "عند الاستلام" : F.method, gift: F.gift ? "هدية" : undefined };
        db.orders.unshift(o); if (st === "confirmed") App.setStatus(o, "confirmed"); App._draft = null; App._justChanged = null;
        App.saved(st === "confirmed" ? `انحفظ الطلب #${id} وانحجزت القطع — كل شي بمكانه` : `انحفظ الطلب #${id}`, `#/orders/${id}`); }, 450); };
    $("saveC").onclick = save("confirmed"); $("saveN").onclick = save("new");
  };

  /* ================= ORDER DETAILS v2 — label hero, lifecycle, story art ================= */
  const LIFE = [["new", "جديد", "receipt"], ["confirmed", "مؤكد", "check"], ["preparing", "قيد التجهيز", "gift"], ["courier", "مع المندوب", "truck"], ["delivered", "تم التوصيل", "circle-check"]];
  S["orders/:id"] = (id) => {
    const o = App.order(id) || App.order(1042), c = App.cust(o.c), tot = App.total(o), rem = tot - o.paid, k = LIFE.findIndex((l) => l[0] === o.status);
    const play = App._justChanged === o.id; App._justChanged = null;
    const tpl = App.prod(o.items[0][0]).template;
    const art = o.status === "courier" ? LammaArt.delivery("courier") : o.status === "delivered" ? LammaArt.delivery("delivered", play) : o.status === "preparing" ? LammaArt.packing(tpl, play) : ["cancelled", "returned"].includes(o.status) ? `<div style="filter:grayscale(1);opacity:.6">${LammaArt.parcel()}</div>` : LammaArt.parcel();
    const nx = NEXT[o.status], qty = o.items.reduce((s, it) => s + it[2], 0);
    const lifeDates = { new: o.date, confirmed: k >= 1 ? "تلقائي: حجز" : "", preparing: "", courier: "", delivered: o.deliveredAt ? db.fmtDate(o.deliveredAt) : "" };
    return `${App.head("", "", `<button class="btn btn--outline icon-btn" data-menu onclick="Lamma.toggleMenu(this,'#oMenu')" aria-label="المزيد">${I("dots-vertical")}</button><div class="menu" id="oMenu" style="top:60px;inset-inline-end:0"><a class="menu__item" href="#/orders/new">${I("pencil")} تعديل الطلب</a>${k >= 0 && o.status !== "delivered" ? `<a class="menu__item menu__item--danger" onclick="App.cancelOrder(${o.id})">${I("x")} إلغاء الطلب</a>` : ""}${o.status === "delivered" ? `<a class="menu__item" onclick="App.returnOrder(${o.id})">${I("arrow-back-up")} إرجاع</a>` : ""}</div>${nx ? `<button class="btn btn--primary" onclick="App.detailsNext(${o.id})">${I(LIFE[k + 1][2])} نقل لـ «${App.status(nx)[1]}»</button>` : ""}`, `<a href="#/orders">الطلبات</a> / <span class="ltr">#${o.id}</span>`)}
    <section class="ohero st-${o.status}">
      <div><span class="ohero__stamp">${I("receipt", "ic--16")}<span class="ltr">#${o.id}</span></span>
        <h1>${c.name} ${App.statusBadge(o.status, true)}</h1>
        <div class="ohero__meta"><span>${I("calendar", "ic--16")} ${o.date}</span><span>${I(App.chIcon(o.channel), "ic--16")} ${db.channels[o.channel]}</span><span>${I("package", "ic--16")} ${qty} قطعة</span><span>${App.payBadge(o.pay)}</span></div>
        ${k >= 0 ? `<div class="life" style="--p:${Math.max(0, k) / 4}"><span class="life__line"></span><span class="life__fill"></span>${LIFE.map(([s, t, ic], i) => `<div class="life__n ${i < k || (i === k && s === "delivered") ? "is-done" : i === k ? "is-now" : ""}"><span>${I(ic)}</span><b>${t}</b><small>${lifeDates[s] || "&nbsp;"}</small>${s === "confirmed" && i <= k ? '<em>انحجزت القطع</em>' : s === "delivered" && i === k ? '<em>انخصمت من المخزون</em>' : ""}</div>`).join("")}</div>` : `<p class="muted" style="margin-top:12px">${o.status === "cancelled" ? "الطلب ملغي — رجعت القطع للمتوفر." : "الطلب مرتجع — رجعت القطع للمخزون."}</p>`}
      </div><div class="ohero__art">${art}</div></section>
    <div class="grid g-main" style="gap:20px">
      <div class="col" style="gap:16px">
        <article class="card"><div class="shead"><div class="shead__t"><span class="overline">${o.items.length} منتجات</span><h2>محتوى الطرد</h2></div></div>
          ${o.items.map(([pid, v, q, pr]) => { const p = App.prod(pid); return `<a class="line2" href="#/products/${p.id}" style="text-decoration:none;color:inherit;grid-template-columns:56px minmax(0,1fr) auto auto"><span class="line2__art">${LammaArt.product(p.template)}</span><span><b>${p.name}</b><br><span class="caption">${v || "—"}</span></span><span class="caption">× ${q} · ${M(pr)}</span>${M(pr * q)}</a>`; }).join("")}
          <div class="receipt__row" style="border-top:1.5px dashed #E4E2D3;margin-top:6px;padding-top:12px"><span>التوصيل</span>${M(o.delivery)}</div>
          <div class="receipt__total"><b>المجموع</b>${M(tot)}</div>
          <div class="receipt__profit"><span>${I("wallet", "ic--16")} ربحك من الطلب</span><b>${M(tot - o.delivery - App.cost(o))}</b></div></article>
        ${o.gift ? `<div class="giftcard"><span class="overline" style="color:var(--lamma-brick-700)">${I("gift", "ic--16")} هدية</span><q>${o.gift}</q></div>` : ""}
        <article class="card"><div class="shead"><div class="shead__t"><span class="overline">كل شي صار على الطلب</span><h2>الخيط</h2></div></div>
          <ul class="feed">
            <li class="tone-blue"><span class="feed__ic">${I("receipt", "ic--16")}</span><div><b>تم إنشاء الطلب</b><span>من ${db.channels[o.channel]} · ${o.date}</span></div></li>
            ${k >= 1 ? `<li class="tone-olive"><span class="feed__ic">${I("lock", "ic--16")}</span><div><b>تلقائي: انحجزت ${qty} قطعة</b><span>عند التأكيد</span></div></li>` : ""}
            ${o.paid ? `<li class="tone-green"><span class="feed__ic">${I("cash", "ic--16")}</span><div><b>دفعة ${M(o.paid)}</b><span>${o.payMethod || "CliQ"} · المتبقي ${M(rem)}</span></div></li>` : ""}
            ${k >= 2 ? `<li class="tone-apricot"><span class="feed__ic">${I("gift", "ic--16")}</span><div><b>تغلّف الطلب</b><span>قيد التجهيز</span></div></li>` : ""}
            ${k >= 3 ? `<li class="tone-blue"><span class="feed__ic">${I("truck", "ic--16")}</span><div><b>طلع مع المندوب</b><span>${o.payMethod === "عند الاستلام" ? "المندوب بيجمع المتبقي" : "بانتظار التوصيل"}</span></div></li>` : ""}
            ${k >= 4 ? `<li class="tone-green"><span class="feed__ic">${I("circle-check", "ic--16")}</span><div><b>تم التوصيل — انخصم من المخزون</b><span>${db.fmtDate(o.deliveredAt)} · تلقائي</span></div></li>` : ""}
          </ul></article>
      </div>
      <div class="col" style="gap:16px">
        <article class="card"><div class="shead"><div class="shead__t"><span class="overline">الدفع</span><h2>${rem > 0 ? "باقي " + Lamma.fmt(rem) + " د.أ" : "مدفوع بالكامل"}</h2></div>${App.payBadge(o.pay)}</div>
          <div class="row" style="gap:18px"><div class="payring" style="--p:${Math.round((o.paid / tot) * 100)}"><span><b class="num">${Math.round((o.paid / tot) * 100)}%</b>مدفوع</span></div>
            <dl class="dl grow"><dt>المجموع</dt><dd>${M(tot)}</dd><dt>المدفوع</dt><dd>${M(o.paid)}</dd><dt>المتبقي</dt><dd><b>${M(rem)}</b></dd></dl></div>
          ${rem > 0 ? `<button class="btn btn--primary btn--block" style="margin-top:14px" onclick="App.recordPayment(${o.id})">${I("cash")} تسجيل دفعة</button>` : ""}</article>
        ${App.customerCard(c)}
        ${c.note ? `<div class="insight"><span class="overline">ملاحظة عن العميل</span><p>${c.note}</p></div>` : ""}
      </div>
    </div>`;
  };
  App.detailsNext = (id) => { const o = App.order(id), nx = NEXT[o.status]; const undo = App.setStatus(o, nx); App._justChanged = o.id; App.render();
    Lamma.toast(App.statusMsg(o, nx), { action: "تراجع", onAction: () => { undo(); App.render(); } }); };
  App.cancelOrder = (id) => App.dialog(`<h3>إلغاء الطلب <span class="ltr">#${id}</span>؟</h3><p class="muted" style="margin-top:8px">القطع المحجوزة رح ترجع للمتوفر تلقائيًا.</p><label class="field" style="margin-top:14px"><span class="field__label">السبب</span><span class="control"><select><option>الزبون غيّر رأيه</option><option>ما رد على التلفون</option><option>المنتج مش متوفر</option><option>أخرى</option></select></span></label><div class="dialog__actions"><button class="btn btn--secondary" onclick="Lamma.closeAll()">رجوع</button><button class="btn btn--danger" onclick="App.doCancel(${id})">إلغاء الطلب</button></div>`);
  App.doCancel = (id) => { const o = App.order(id), undo = App.setStatus(o, "cancelled"); Lamma.closeAll(); App.render(); Lamma.toast(App.statusMsg(o, "cancelled"), { action: "تراجع", onAction: () => { undo(); App.render(); } }); };
  App.returnOrder = (id) => App.dialog(`<h3>إرجاع الطلب <span class="ltr">#${id}</span></h3><p class="muted" style="margin-top:8px">القطع بترجع للمخزون، والمبلغ بينطرح من المبيعات.</p><label class="check" style="margin-top:12px"><input type="checkbox" checked> رجّع القطع للمخزون (بحالة جيدة)</label><label class="field" style="margin-top:12px"><span class="field__label">المبلغ المسترد</span><span class="control"><input class="ltr" value="${Lamma.fmt(App.total(App.order(id)))}"><span class="control__affix">د.أ</span></span></label><div class="dialog__actions"><button class="btn btn--secondary" onclick="Lamma.closeAll()">رجوع</button><button class="btn btn--primary" onclick="Lamma.closeAll();Lamma.toast('انسجّل المرتجع ورجعت القطع للمخزون')">تأكيد الإرجاع</button></div>`);

  S.preorders = () => {
    const days = Array.from({ length: 14 }, (_, i) => i + 9);
    const ev = { 10: ["كيكة عيد ميلاد · لين", "بوكس هدايا · هبة"], 12: ["سلة «لمّة» × 3"], 14: ["الحد اليومي اكتمل"], 16: ["شمع معطّر · سارة"] };
    return `${App.head("الطلبات المسبقة", "طلبات بتاريخ تسليم محدد (أكل بيتي، هدايا، صنع حسب الطلب)", `<a class="btn btn--primary" href="#/orders/new">${I("plus")} طلب مسبق</a>`, `<a href="#/orders">الطلبات</a> / المسبقة`)}
    <div class="row between"><div class="segmented" data-seg><button class="is-active">أسبوعين</button><button>الشهر</button></div><span class="caption">الحد اليومي: 4 طلبات · العربون: 30%</span></div>
    <div class="cal">${["سبت", "أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"].map((d) => `<b class="caption" style="text-align:center">${d}</b>`).join("")}${days.map((d) => `<div class="${d === 9 ? "is-today" : ""}"><b>${d} نوفمبر</b>${(ev[d] || []).map((e) => `<span class="ev ${e.includes("اكتمل") ? "full" : ""}">${e}</span>`).join("")}</div>`).join("")}</div>`;
  };

})();
