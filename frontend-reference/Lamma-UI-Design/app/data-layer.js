/* ---------------------------------------------------------------------------------
   Lamma data layer v2 — stands in for the API until a backend exists.
   Every figure on screen is DERIVED from the records in data.js (no hardcoded statistics).
   --------------------------------------------------------------------------------- */
(function () {
  const db = window.DB;
  db.today = "2026-11-09";
  const D = (s) => new Date(s + "T12:00:00");
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const addDays = (s, n) => { const d = D(s); d.setDate(d.getDate() + n); return iso(d); };
  db.addDays = addDays;

  /* dates for the named recent orders */
  const at = { 1048: "2026-11-09", 1047: "2026-11-09", 1046: "2026-11-08", 1045: "2026-11-08", 1042: "2026-11-08", 1041: "2026-11-06", 1040: "2026-11-05", 1039: "2026-11-03", 1038: "2026-11-03" };
  db.orders.forEach((o) => { o.at = at[o.id]; if (["delivered", "returned"].includes(o.status)) o.deliveredAt = addDays(o.at, 1); });

  /* deterministic order history (Oct 1 → Nov 7): delivered orders that build the real totals */
  let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const catalog = [["p1", ["S · زيتي", "M · زيتي", "L · كريمي", "M · طوبي"]], ["p2", ["50 مل", "10 مل", "100 مل"]], ["p3", ["S", "M", "L"]], ["p4", [""]], ["p5", [""]], ["p6", [""]], ["p7", [""]], ["p1", ["M · كريمي"]]];
  const perfume = { "10 مل": 8, "50 مل": 24, "100 مل": 40 };
  const history = [];
  let id = 940, day = "2026-10-01";
  while (day < "2026-11-08" && id < 1038) {
    const r = rnd(), n = r < 0.25 ? 1 : r < 0.7 ? 2 : r < 0.92 ? 3 : 4;
    for (let k = 0; k < n && id < 1038; k++) {
      const [pid, vars] = pick(catalog), p = db.products.find((x) => x.id === pid), qty = rnd() < 0.8 ? 1 : 2, v = pick(vars);
      const items = [[pid, v, qty, pid === "p2" ? perfume[v] : p.price]];
      if (rnd() < 0.25) items.push(["p7", "", 1, 15]);
      const pay = rnd() < 0.2 ? "courier" : rnd() < 0.1 ? "partial" : "paid";
      const t = items.reduce((s, it) => s + it[2] * it[3], 0) + 2;
      history.push({ id: id++, c: pick(db.customers).id, items, status: "delivered", pay, paid: pay === "paid" ? t : pay === "partial" ? Math.round(t / 2) : 0, delivery: 2, channel: pick(["instagram", "instagram", "whatsapp", "facebook"]), at: day, deliveredAt: addDays(day, 1) });
    }
    day = addDays(day, 1);
  }
  /* the courier transferred everything delivered before Nov 1; later COD orders are still held */
  history.forEach((o) => { if (o.pay === "courier" && o.deliveredAt < "2026-11-01") { o.pay = "paid"; o.paid = o.items.reduce((s, it) => s + it[2] * it[3], 0) + 2; } });
  db.orders = db.orders.concat(history.reverse());

  /* dated expenses (Oct + Nov) */
  const ex = { "9 نوفمبر": "2026-11-09", "8 نوفمبر": "2026-11-08", "6 نوفمبر": "2026-11-06", "3 نوفمبر": "2026-11-03", "1 نوفمبر": "2026-11-01" };
  db.expenses.forEach((e) => (e.at = ex[e.d]));
  db.expenses.push(
    { at: "2026-10-28", cat: "إعلانات", note: "ترويج ريلز", amt: 45 }, { at: "2026-10-20", cat: "تغليف", note: "علب وشرائط", amt: 30 },
    { at: "2026-10-12", cat: "إعلانات", note: "حملة إنستغرام", amt: 70 }, { at: "2026-10-05", cat: "توصيل", note: "رسوم شركة التوصيل", amt: 22 }, { at: "2026-10-02", cat: "أخرى", note: "تصوير منتجات", amt: 20 });

  /* ------- helpers & derived figures ------- */
  const total = (o) => o.items.reduce((s, it) => s + it[2] * it[3], 0) + (o.delivery || 0);
  const cogs = (o) => o.items.reduce((s, it) => s + it[2] * (db.products.find((p) => p.id === it[0])?.cost || 0), 0);
  const inRange = (d, a, b) => !!d && d >= a && d <= b;
  const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  db.fmtDate = (s) => { if (!s) return "—"; if (s === db.today) return "اليوم"; if (s === addDays(db.today, -1)) return "أمس"; const d = D(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  db.monthName = (s = db.today) => `${MONTHS[D(s).getMonth()]} ${D(s).getFullYear()}`;
  db.prevMonthName = () => { const d = D(db.today); return MONTHS[(d.getMonth() + 11) % 12]; };
  db.range = (period) => {
    const t = db.today, d = D(t);
    if (period === "today") return [t, t, addDays(t, -1), addDays(t, -1)];
    if (period === "week") return [addDays(t, -6), t, addDays(t, -13), addDays(t, -7)];
    const first = iso(new Date(d.getFullYear(), d.getMonth(), 1, 12)), pFirst = iso(new Date(d.getFullYear(), d.getMonth() - 1, 1, 12));
    return [first, t, pFirst, addDays(pFirst, d.getDate() - 1)]; // month-to-date vs the same span last month
  };
  db.metrics = (period = "month") => {
    const [a, b, pa, pb] = db.range(period);
    const calc = (x, y) => {
      const del = db.orders.filter((o) => o.status === "delivered" && inRange(o.deliveredAt, x, y));
      const ret = db.orders.filter((o) => o.status === "returned" && inRange(o.deliveredAt, x, y));
      const sales = del.reduce((s, o) => s + total(o), 0), returns = ret.reduce((s, o) => s + total(o), 0), cost = del.reduce((s, o) => s + cogs(o), 0);
      const exps = db.expenses.filter((e) => inRange(e.at, x, y)), expTotal = exps.reduce((s, e) => s + e.amt, 0);
      const byCat = {}; exps.forEach((e) => (byCat[e.cat] = (byCat[e.cat] || 0) + e.amt));
      const received = del.filter((o) => o.pay !== "courier").reduce((s, o) => s + o.paid, 0);
      return { sales, returns, cogs: cost, gross: sales - returns - cost, expenses: expTotal, byCat, net: sales - returns - cost - expTotal, received, deliveredCount: del.length };
    };
    const cur = calc(a, b), prev = calc(pa, pb);
    const pct = (k) => (prev[k] ? Math.round(((cur[k] - prev[k]) / Math.abs(prev[k])) * 100) : null);
    const open = db.orders.filter((o) => ["confirmed", "preparing", "courier"].includes(o.status));
    const created = db.orders.filter((o) => inRange(o.at, a, b));
    const dues = db.customers.reduce((s, c) => s + c.balance, 0);
    return { ...cur, prev, delta: { sales: pct("sales"), net: pct("net"), expenses: pct("expenses"), cogs: pct("cogs"), received: pct("received") },
      expected: open.reduce((s, o) => s + total(o), 0), ordersCreated: created.length, ordersValue: created.reduce((s, o) => s + total(o), 0), dues, courierHeld: db.courier.held, range: [a, b] };
  };
  db.series = (days = 7) => Array.from({ length: days }, (_, i) => {
    const day = addDays(db.today, i - days + 1), del = db.orders.filter((o) => o.status === "delivered" && o.deliveredAt === day);
    return { day, label: i === days - 1 ? "اليوم" : ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"][D(day).getDay()], sales: del.reduce((s, o) => s + total(o), 0), profit: del.reduce((s, o) => s + total(o) - cogs(o), 0), orders: del.length };
  });
  db.channelSplit = (period = "month") => {
    const [a, b] = db.range(period), del = db.orders.filter((o) => o.status === "delivered" && inRange(o.deliveredAt, a, b));
    const t = del.reduce((s, o) => s + total(o), 0) || 1, by = {};
    del.forEach((o) => (by[o.channel] = (by[o.channel] || 0) + total(o)));
    return Object.entries(by).sort((x, y) => y[1] - x[1]).map(([k, v]) => [k, v, Math.round((v / t) * 100)]);
  };
  db.productSales = (period = "month") => {
    const [a, b] = db.range(period), del = db.orders.filter((o) => o.status === "delivered" && inRange(o.deliveredAt, a, b));
    return db.products.map((p) => { let q = 0, rev = 0; del.forEach((o) => o.items.forEach((it) => { if (it[0] === p.id) { q += it[2]; rev += it[2] * it[3]; } })); return { p, q, rev, profit: rev - q * p.cost }; }).sort((x, y) => y.rev - x.rev);
  };

  /* products: sold & reserved come from orders; variant reservations too */
  const RES = ["confirmed", "preparing", "courier"];
  db.products.forEach((p) => {
    const qtyIn = (list, match) => list.reduce((s, o) => s + o.items.filter(match).reduce((x, it) => x + it[2], 0), 0);
    p.sold = qtyIn(db.orders.filter((o) => o.status === "delivered"), (it) => it[0] === p.id);
    p.reserved = qtyIn(db.orders.filter((o) => RES.includes(o.status)), (it) => it[0] === p.id);
    if (p.variants) p.variants.forEach((v) => (v[3] = qtyIn(db.orders.filter((o) => RES.includes(o.status)), (it) => it[0] === p.id && it[1] === `${v[0]} · ${v[1]}`)));
  });
  /* customers: counts, spend and balances come from orders */
  db.customers.forEach((c) => {
    const mine = db.orders.filter((o) => o.c === c.id && o.status !== "cancelled");
    c.orders = mine.length;
    c.spent = mine.filter((o) => o.status === "delivered").reduce((s, o) => s + total(o), 0);
    c.balance = mine.filter((o) => ["unpaid", "partial"].includes(o.pay)).reduce((s, o) => s + total(o) - o.paid, 0);
    c.lastAt = mine.map((o) => o.at).sort().pop();
  });
  /* courier: held cash = delivered COD orders not yet transferred */
  const held = db.orders.filter((o) => o.pay === "courier");
  db.courier.pendingOrders = held;
  db.courier.pending = held.map((o) => o.id);
  db.courier.held = held.reduce((s, o) => s + total(o), 0);
  db.courier.expected = (o) => total(o);
  db.orders.forEach((o) => (o.date = db.fmtDate(o.at)));
  db.notifications[2].t = `شركة التوصيل عندها ${db.courier.held.toFixed(2)} د.أ إلك`;
})();
