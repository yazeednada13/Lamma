# لمّة · التسليم للمبرمج (Handoff v1)

## المصدر
| الملف | شو فيه |
|---|---|
| `design-system/tokens.css` | كل المتغيرات: الألوان الأساسية، المعاني، المسافات، الزوايا، الظلال، الخطوط، الحركة. **نفس أسماء متغيرات Figma** |
| `design-system/lamma.css` | كل المكونات كـ CSS classes، بخصائص منطقية (logical properties) |
| `design-system/lamma.js` | الأيقونات، تنسيق المبالغ، رسائل التنبيه، النوافذ، العدّاد، حركة FLIP |
| `design-system/icons.js` | 53 أيقونة Tabler (رخصة MIT) |
| `design-system/components.html` | مرجع حي لكل مكوّن وحالاته |
| `design-system/cards.css` · `cards.js` | v2: بطاقات الأرقام، الرسوم (منحنى، دائري، رسمة اتجاه)، التبويب المنزلق |
| `design-system/orders.css` · `catalog.css` · `money.css` · `shell.css` | v2: أنماط كل وحدة (الطلبات، المنتجات والمخزون، العملاء والمالية، الدخول والإعدادات والحالات) |
| `design-system/illustrations.js` | v2: رسومات لمّة (منتجات، تغليف، طرد، توصيل، لمّة، مسار) |
| `app/data-layer.js` | v2: كل الأرقام والإحصائيات محسوبة من السجلات — بديل مؤقت للـ API |
| `app/` | بروتوتايب كامل لكل الشاشات، مع بيانات تجريبية بـ `data.js` |

## ربط المكونات بالـ classes
| المكوّن | الـ class | النسخ |
|---|---|---|
| Button | `.btn` + `--primary --secondary --outline --ghost --accent --danger` | الأحجام `--sm` و`--lg`، والحالات `[disabled]` و`.is-loading` |
| Icon Button | `.btn .icon-btn` | لازم `aria-label` |
| Text Field | `.field > .field__label + .control > input` | `.control.is-error` و`.is-disabled`، ومعه `.control__affix` للبادئة واللاحقة (د.أ و+962) |
| Search | `.control.control--search` | مع `.kbd` |
| Select / Combobox | `.select-list > .select-list__item` | `--create` للإضافة السريعة |
| Stepper | `.stepper` | زر «+» معطّل لما توصل للمتوفر |
| Checkbox / Radio / Toggle | `.check > input` · `input.toggle` | |
| Badge | `.badge` + `--success --warning --danger --info --attention --outline --dot --lg` | |
| Order Status | `App.statusBadge(key)` | 7 حالات |
| Payment Status | `App.payBadge(key)` | مدفوع، جزئي، غير مدفوع، عند الشركة |
| Tabs / Segmented / Chip | `.tabs .tab.is-active` · `.segmented` · `.chip.is-selected` | |
| Swatch | `.swatch` · `.swatch--color` | `.is-selected` و`.is-out` |
| Money | `Lamma.money(n, {colored, plus, tone})` | `--pos --neg --exp` |
| Stock Meter | `App.stockMeter(product)` | `.stock--low` و`.stock--out`، مع جزء «محجوز» |
| KPI / Attention / Today | `.card .kpi__*` · `.attention` · `.today` | |
| Table | `.table-wrap .toolbar table.tbl` | `.num` لنهاية الخلية، و`.hide-md` و`.hide-sm` للإخفاء حسب الشاشة |
| Board | `.board .board__col .order-card` | |
| Timeline | `.timeline li.is-done / .is-auto` | |
| Charts | `.bars .bars__b` · donut SVG · `.legend` | أقصى 4 سلاسل |
| Empty / Skeleton | `.empty .gather` · `.skel` | |
| Dialog / Drawer / Menu / Palette | `.dialog` · `.drawer` · `.menu` · `.palette` بيفتحوا بـ `Lamma.open()` و`Lamma.toggleMenu()` | Esc بيسكّر |
| Toast | `Lamma.toast(msg, {type, action, onAction})` | النجاح بيرسم الشدّة |
| Trial Banner | `.trial` · `--late` · `--expired` | |
| Shell | `.app .sidebar .nav .topbar .page .bottombar` | `.app.is-collapsed` |

## الحركة
- **المدد:** 120 / 200 / 320 / 480ms، والفرق بين عناصر القائمة 30ms.
- **المنحنيات:** الدخول `cubic-bezier(.2,.8,.2,1)`، والخروج `cubic-bezier(.4,0,1,1)`.
- **تقليل الحركة:** `prefers-reduced-motion` بيصفّر كل المدد، والعدّاد بيطلع الرقم مباشرة.
- **التفاصيل:** جدول الحركات بـ `components.html#motion`.

## الشاشات المتجاوبة
| العرض | الشريط الجانبي | باقي التغييرات |
|---|---|---|
| ≥1280 | كامل 240px | — |
| 1024 لـ 1279 | أيقونات بس 72px | — |
| 768 لـ 1023 | أيقونات بس 72px | الأعمدة الجانبية بتنزل تحت |
| <768 | بيختفي | شريط سفلي، الجداول بتصير بطاقات، اللوحات الجانبية بتطلع من تحت |

## إمكانية الوصول
- **التباين:** موثّق بـ `Lamma-Brand-Identity/tokens/contrast.md`.
- **التركيز:** حلقة تركيز مشمشية على كل عنصر تفاعلي.
- **الأيقونات:** كلها `aria-hidden`، وأزرار الأيقونات إلها `aria-label`.
- **منطقة اللمس بالموبايل:** 44px أو أكثر.
- **الأرقام بالجداول:** أرقام Readex Pro مش بعرض ثابت، فالمبالغ دايمًا بتنصفّ على نهاية الخلية.

## Figma (للشاشات بس)
- **الملف:** https://www.figma.com/design/2maRviOSxlM4wmYzuwHaXx
- **الموجود فيه:** المتغيرات والأنماط (المرحلة 2)، الهيكلة والرحلات، ومرجع الهوية.
- **نقل الشاشات:** كل شاشة بالبروتوتايب إلها رابط (فهرسها بـ `app/index.html#/screens`). بتنتقل لصفحة «03 — Screens & Prototype» بأداة الالتقاط، **طلب واحد لكل شاشة**، وبعدين بتنربط ببعض كبروتوتايب.
