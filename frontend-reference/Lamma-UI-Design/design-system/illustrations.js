/* Lamma illustration library v1 — custom SVG, brand palette only, 1.75–2px line language.
   Story: product → packaging → label → delivery → customer → growth.
   Animated variants only play when the matching business action actually happens (caller decides). */
(function () {
  const C = { o: "#3F4F2A", o7: "#344222", d: "#1F2617", a: "#F4A261", b: "#C8553D", c: "#F7F3EA", s: "#E7E9D8", s2: "#CDD3BC", k: "#E9C9A0", k2: "#D9B286" };
  const SH = "M18 44C16 74 44 76 48 54C52 76 80 72 84 24";
  const svg = (vb, body, cls = "", label = "") => `<svg class="art ${cls}" viewBox="${vb}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>${body}</svg>`;

  /* products (used as product thumbnails when there is no photo) */
  const products = {
    clothing: `<path d="M38 14 L58 14 L62 26 L74 31 L69 86 L27 86 L22 31 L34 26Z" fill="${C.o}"/><path d="M38 14 Q48 25 58 14" fill="none" stroke="${C.c}" stroke-width="2.5"/><path d="M30 60 H66" stroke="${C.o7}" stroke-width="2"/>`,
    perfume: `<rect x="40" y="14" width="16" height="10" rx="2" fill="${C.d}"/><rect x="44" y="24" width="8" height="8" fill="${C.o7}"/><rect x="26" y="32" width="44" height="54" rx="12" fill="${C.a}"/><rect x="34" y="46" width="28" height="18" rx="3" fill="${C.c}"/><path d="M40 55h16" stroke="${C.d}" stroke-width="2"/>`,
    gift: `<rect x="22" y="40" width="52" height="46" rx="5" fill="${C.b}"/><rect x="18" y="30" width="60" height="14" rx="4" fill="#B04A35"/><rect x="44" y="30" width="8" height="56" fill="${C.a}"/><path d="M48 30 C38 16 26 22 36 30 M48 30 C58 16 70 22 60 30" fill="none" stroke="${C.a}" stroke-width="3" stroke-linecap="round"/>`,
    jewelry: `<path d="M24 20 Q48 70 72 20" fill="none" stroke="${C.s2}" stroke-width="3"/><path d="M48 58 L58 70 L48 86 L38 70Z" fill="${C.a}"/><path d="M38 70 H58" stroke="${C.c}" stroke-width="1.5"/>`,
    beauty: `<rect x="32" y="22" width="32" height="16" rx="4" fill="${C.o}"/><rect x="28" y="38" width="40" height="48" rx="10" fill="${C.c}" stroke="${C.s2}" stroke-width="2"/><path d="M38 58c4-8 16-8 20 0" fill="none" stroke="${C.o}" stroke-width="2.5" stroke-linecap="round"/>`,
    other: `<rect x="24" y="30" width="48" height="48" rx="8" fill="${C.k}"/><path d="M24 44 H72" stroke="${C.k2}" stroke-width="3"/><rect x="42" y="30" width="12" height="14" fill="${C.a}" opacity=".85"/>`,
  };
  const product = (tpl = "other", cls = "") => svg("0 0 96 96", products[tpl] || products.other, "art--product " + cls);

  /* packaging sequence: product drops in, flaps close, tape, label (class .is-playing triggers motion) */
  const packing = (tpl = "clothing", play = false) => svg("0 0 180 124", `
    <ellipse cx="90" cy="114" rx="52" ry="5" fill="${C.d}" opacity=".08"/>
    <g class="pk-whole">
      <g class="pk-prod"><g transform="translate(66 -2) scale(.5)">${products[tpl] || products.other}</g></g>
      <rect x="50" y="70" width="80" height="40" rx="4" fill="${C.k}"/>
      <path class="pk-flapL" d="M50 70 L90 70 L86 61 L54 61Z" fill="${C.k2}"/>
      <path class="pk-flapR" d="M90 70 L130 70 L126 61 L94 61Z" fill="${C.k2}"/>
      <rect class="pk-tape" x="84" y="66" width="12" height="44" fill="${C.a}" opacity=".9"/>
      <g class="pk-label"><rect x="100" y="84" width="24" height="17" rx="2" fill="#fff" stroke="${C.d}" stroke-width=".8"/><path d="M104 89h16M104 93h10M104 97h13" stroke="${C.d}" stroke-width="1"/></g>
    </g>`, "art--packing" + (play ? " is-playing" : ""), "تغليف الطلب");

  /* closed parcel (static) */
  const parcel = (cls = "") => svg("0 0 96 80", `<ellipse cx="48" cy="74" rx="34" ry="4" fill="${C.d}" opacity=".08"/><rect x="14" y="24" width="68" height="46" rx="5" fill="${C.k}"/><rect x="14" y="24" width="68" height="10" fill="${C.k2}"/><rect x="42" y="24" width="12" height="46" fill="${C.a}" opacity=".9"/><rect x="58" y="44" width="18" height="13" rx="2" fill="#fff" stroke="${C.d}" stroke-width=".8"/><path d="M61 48h12M61 52h8" stroke="${C.d}" stroke-width="1"/>`, "art--parcel " + cls);

  /* delivery: route + house + van. state: "courier" (van parked mid-route), "delivered" (drives to house + check, only when play) */
  const delivery = (state = "courier", play = false) => svg("0 0 300 120", `
    <path class="dl-route" d="M14 96 H286" stroke="${C.s2}" stroke-width="2" stroke-dasharray="6 7" fill="none"/>
    <g transform="translate(22 46)"><path d="M0 44 V20 L16 6 L32 20 V44Z" fill="${C.s}" stroke="${C.o}" stroke-width="1.75" stroke-linejoin="round"/><rect x="12" y="28" width="9" height="16" rx="1.5" fill="${C.o}"/><circle cx="16" cy="-6" r="7" fill="${C.a}"/><path d="M16 1 L16 6" stroke="${C.a}" stroke-width="2.5"/></g>
    <g class="dl-van ${state === "delivered" ? "is-arrived" : ""}"><g transform="translate(0 60)">
      <rect x="0" y="6" width="50" height="27" rx="6" fill="${C.o}"/><path d="M50 13 H63 L72 24 V33 H50Z" fill="${C.o7}"/><path d="M54 16 H62 L67 24 H54Z" fill="${C.s2}"/>
      <g transform="translate(9 3) scale(.32)"><path d="${SH}" fill="none" stroke="${C.a}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/></g>
      <circle class="dl-wheel" cx="14" cy="34" r="6.5" fill="${C.d}"/><circle cx="14" cy="34" r="2.2" fill="${C.s2}"/><circle class="dl-wheel" cx="58" cy="34" r="6.5" fill="${C.d}"/><circle cx="58" cy="34" r="2.2" fill="${C.s2}"/></g></g>
    <g class="dl-check"><circle cx="38" cy="36" r="11" fill="#3E8E5E"/><path d="M33 36l3.5 3.5 6.5-7" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`,
    `art--delivery is-${state}${play ? " is-playing" : ""}`, state === "delivered" ? "تم التوصيل" : "الطلب مع المندوب");

  /* gather: scattered chat / notebook / box pieces join into one card (onboarding & empty states) */
  const gather = (play = true) => svg("0 0 200 130", `
    <rect x="50" y="40" width="100" height="70" rx="14" fill="${C.s}" stroke="${C.s2}" stroke-width="1.5" stroke-dasharray="5 5"/>
    <g class="ga-p ga-1"><rect x="8" y="8" width="44" height="32" rx="9" fill="#fff" stroke="${C.s2}"/><path d="M18 20h24M18 28h14" stroke="${C.o}" stroke-width="2" stroke-linecap="round"/></g>
    <g class="ga-p ga-2"><rect x="150" y="12" width="40" height="34" rx="8" fill="#fff" stroke="${C.s2}"/><path d="M160 22h20M160 30h20M160 38h12" stroke="${C.o}" stroke-width="2" stroke-linecap="round"/></g>
    <g class="ga-p ga-3"><rect x="80" y="100" width="40" height="26" rx="5" fill="${C.k}"/><rect x="96" y="100" width="8" height="26" fill="${C.a}"/></g>
    <g class="ga-mark"><g transform="translate(76 52) scale(.48)"><path d="${SH}" fill="none" stroke="${C.o}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></g></g>`, "art--gather" + (play ? " is-playing" : ""));

  /* route rail used as a divider / journey motif */
  const route = (n = 6, cls = "") => svg(`0 0 ${n * 60} 24`, `<path d="M12 12 H${n * 60 - 12}" stroke="${C.a}" stroke-width="2" stroke-dasharray="5 6" opacity=".55"/>${Array.from({ length: n }, (_, i) => `<circle cx="${12 + i * ((n * 60 - 24) / (n - 1))}" cy="12" r="5" fill="${C.o}"/>`).join("")}`, "art--route " + cls);


  /* die-cut stickers: white outline + brand art (decorative, aria-hidden) */
  const cut = (shape, inner) => `<g stroke="#fff" stroke-width="9" stroke-linejoin="round" fill="#fff">${shape}</g>${inner}`;
  const STK = {
    shadda: cut(`<circle cx="50" cy="50" r="40"/>`, `<circle cx="50" cy="50" r="40" fill="${C.o}"/><g transform="translate(18 16) scale(.64)"><path d="${SH}" fill="none" stroke="${C.a}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/></g>`),
    parcel: cut(`<rect x="14" y="24" width="72" height="56" rx="8"/>`, `<rect x="14" y="24" width="72" height="56" rx="8" fill="${C.k}"/><rect x="14" y="24" width="72" height="13" fill="${C.k2}"/><rect x="44" y="24" width="12" height="56" fill="${C.a}"/><rect x="60" y="52" width="18" height="13" rx="2" fill="#fff"/>`),
    van: cut(`<rect x="8" y="30" width="84" height="44" rx="12"/>`, `<rect x="10" y="34" width="54" height="30" rx="6" fill="${C.o}"/><path d="M64 42h14l10 12v10H64Z" fill="${C.o7}"/><circle cx="26" cy="66" r="7" fill="${C.d}"/><circle cx="74" cy="66" r="7" fill="${C.d}"/><g transform="translate(22 34) scale(.28)"><path d="${SH}" fill="none" stroke="${C.a}" stroke-width="12" stroke-linecap="round"/></g>`),
    star: cut(`<path d="M50 6l11 17 20-5-3 20 17 11-17 11 3 20-20-5-11 17-11-17-20 5 3-20L5 49l17-11-3-20 20 5Z"/>`, `<path d="M50 6l11 17 20-5-3 20 17 11-17 11 3 20-20-5-11 17-11-17-20 5 3-20L5 49l17-11-3-20 20 5Z" fill="${C.a}"/><text x="50" y="57" text-anchor="middle" font-family="Lamma Arabic, sans-serif" font-weight="700" font-size="20" fill="${C.d}">جديد</text>`),
    coin: cut(`<circle cx="50" cy="50" r="38"/>`, `<circle cx="50" cy="50" r="38" fill="#E9B95A"/><circle cx="50" cy="50" r="29" fill="none" stroke="#C99434" stroke-width="3"/><text x="50" y="58" text-anchor="middle" font-family="Lamma Arabic, sans-serif" font-weight="700" font-size="22" fill="${C.d}">د.أ</text>`),
    heart: cut(`<path d="M50 84C22 64 12 50 12 36a19 19 0 0 1 38-6 19 19 0 0 1 38 6c0 14-10 28-38 48Z"/>`, `<path d="M50 84C22 64 12 50 12 36a19 19 0 0 1 38-6 19 19 0 0 1 38 6c0 14-10 28-38 48Z" fill="${C.b}"/><text x="50" y="52" text-anchor="middle" font-family="Lamma Arabic, sans-serif" font-weight="700" font-size="15" fill="#fff">شكرًا</text>`),
    check: cut(`<circle cx="50" cy="50" r="38"/>`, `<circle cx="50" cy="50" r="38" fill="#3E8E5E"/><path d="M33 51l11 11 23-24" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`),
    fire: cut(`<path d="M50 90c-20 0-32-13-32-30 0-18 14-24 16-42 10 8 14 16 14 24 6-4 8-10 8-18 14 12 26 24 26 38 0 17-12 28-32 28Z"/>`, `<path d="M50 90c-20 0-32-13-32-30 0-18 14-24 16-42 10 8 14 16 14 24 6-4 8-10 8-18 14 12 26 24 26 38 0 17-12 28-32 28Z" fill="${C.b}"/><path d="M50 86c-10 0-16-7-16-15 0-9 8-13 10-21 6 6 8 10 8 15 4-2 6-6 6-10 6 6 10 11 10 17 0 8-7 14-18 14Z" fill="${C.a}"/>`),
  };
  const sticker = (name) => `<svg viewBox="-4 -4 108 108" aria-hidden="true">${STK[name] || STK.shadda}</svg>`;

  window.LammaArt = { product, packing, parcel, delivery, gather, route, sticker, stickers: Object.keys(STK), colors: C };
})();
