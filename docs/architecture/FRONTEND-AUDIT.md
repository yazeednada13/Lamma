# Frontend Audit — Lamma Prototype (v2.1)

**Scope:** a read-only audit of `frontend-reference/Lamma-UI-Design/`. **Date:** 2026-11-10.
**Rule (Approved):** the reference files are preserved unchanged. The React app is built separately (see FRONTEND-ARCHITECTURE.md, Proposed).

---

## 1. What the reference is
- It is a **vanilla HTML/CSS/JS clickable prototype**, not a React app. It has a single page (`app/index.html`) with a hash router (`#/route/arg`) and renders screens as template-literal HTML strings that are injected into `#root`.
- Run it with `python serve.py` (port 5180). Do not use `python -m http.server`: the README says it truncates files larger than 64 KB on this machine.
- The JS files depend on load order through globals (`Lamma`, `LammaArt`, `LammaCards`, `DB`, `App`, `App.screens`):
  `icons.js → lamma.js → illustrations.js → cards.js → data.js → data-layer.js → app.js → screens.js → screens2.js`.
- `data.js` holds the mock data for a fictional shop called "بوتيك ريم". `data-layer.js` derives every statistic from those records. It stands in for the future API, and **its formulas are a useful reference but are not authoritative** (see §8).

## 2. File inventory
| Path | Size | Role |
|---|---|---|
| `app/index.html` | 1.6 KB | Entry point. `lang="ar" dir="rtl"`, preloads fonts, links 8 stylesheets and 9 scripts |
| `app/app.js` | 36 KB | Shell (sidebar, topbar, bottom bar), router, shared helpers (`statusBadge`, `payBadge`, `stockMeter`, `orderCard`, `productCard`, `customerCard`), `setStatus` (reserve/deduct/undo), drawers (payment, expense, settlement, customer), command palette, stickers |
| `app/screens.js` | 67 KB | Auth, onboarding, dashboard, dashboard-new, orders, board, new order, order details, pre-orders |
| `app/screens2.js` | 89 KB | Products, product form and details, inventory (levels, receive, movements, expiry), categories, customers and profile, finance (overview, payments, courier, expenses), reports (hub, P&L, sales), settings, account, subscription, trial-expired, mobile hubs, states, screen index |
| `app/data.js` | 7 KB | Mock records |
| `app/data-layer.js` | 9.6 KB | Derived metrics: `metrics()`, `series()`, `channelSplit()`, `productSales()`, product sold and reserved, customer aggregates, courier held |
| `app/app.css` | 4.8 KB | App-level tweaks |
| `design-system/tokens.css` | 9.6 KB | **Design tokens**: colours, semantic colours, spacing, radii, shadows, type, motion. Names match the Figma variables |
| `design-system/lamma.css` | 53 KB | Core component classes (buttons, fields, badges, tables, board, dialogs, sidebar `.sb`, …). Uses logical properties |
| `design-system/cards.css` | 29 KB | KPI and data cards, charts, sliding tabs |
| `design-system/orders.css` | 15 KB | Order list, steps, receipt, lifecycle |
| `design-system/catalog.css` | 12 KB | Product templates, live preview, variant matrix, movements |
| `design-system/money.css` | 8 KB | Customers, finance ledger, aging, waterfall |
| `design-system/shell.css` | 12 KB | Auth, onboarding, settings, subscription, states, plus the global reduced-motion safety net |
| `design-system/extras.css` | 12.7 KB | v2.1 additions: search glow, floating table rows, banners, stickers |
| `design-system/lamma.js` | 6 KB | `Lamma.icon`, `money`/`fmt`, `toast`, `open`/`closeAll` for dialogs and drawers, `toggleMenu`, `countUp`, FLIP, `hydrate`, `reduceMotion` |
| `design-system/icons.js` + `icons/*.svg` | 10 KB + 53 SVG | Tabler icons (MIT licence in `icons/LICENSE`) |
| `design-system/illustrations.js` | 10 KB | `LammaArt.*`: product art per template, parcel, packing, delivery, gather, route, stickers |
| `design-system/cards.js` | 8 KB | `LammaCards`: sparkline and curve, donut, trend, sliding tabs |
| `design-system/components.html` | 42 KB | Live component catalogue with every state, plus the motion table |
| `assets/fonts/` | — | IBM Plex Sans Arabic 400/500/600/700 (woff2, Arabic subset), Inter variable (woff2, Latin), Readex Pro variable (ttf, brand font). OFL licences included |
| `assets/logo/` | — | favicon, mark (regular and reversed), Arabic wordmark (reversed), Arabic horizontal lockup (regular and reversed), bilingual lockup |
| `docs/` | — | `backend-features.md` (AR and EN), `decisions.md`, `ux-architecture.html` (sitemap plus 16 journeys) |
| `handoff/handoff.md` | 5.9 KB | Component→class map, motion, breakpoints, accessibility, Figma file `2maRviOSxlM4wmYzuwHaXx` |
| `serve.py`, `.claude/launch.json` | — | Local static server |

The `screens/` folder mentioned in the README does not exist in the copy.

## 3. Screen inventory → proposed React mapping
37 routes (the `#/screens` index page is a development aid and is not ported). "Layout" refers to the shells in §5. The module column gives the roadmap phase.

| # | Prototype route | Screen (AR) | Proposed React route | Page component | Layout | Phase |
|---|---|---|---|---|---|---|
| 1 | `#/login` | الدخول | `/login` | `LoginPage` | AuthLayout | 1 |
| 2 | `#/signup` | إنشاء حساب | `/signup` | `SignupPage` | AuthLayout | 1 |
| 3 | `#/forgot` | استعادة كلمة السر | `/forgot-password` (+ `/reset-password`) | `ForgotPasswordPage` | AuthLayout | 1 |
| 4 | `#/onboarding` | التهيئة (3 خطوات) | `/onboarding` | `OnboardingPage` | OnboardingLayout | 1 |
| 5 | `#/dashboard` | الرئيسية | `/` | `DashboardPage` | AppShell | 9 (empty shell in 1) |
| 6 | `#/dashboard-new` | الرئيسية لمستخدم جديد | state of `/` | `DashboardEmptyState` | AppShell | 1 / 9 |
| 7 | `#/orders` | قائمة الطلبات | `/orders` | `OrdersListPage` | AppShell | 5 |
| 8 | `#/orders/board` | لوحة الحالات | `/orders/board` | `OrdersBoardPage` | AppShell | 5 |
| 9 | `#/orders/new` | طلب جديد | `/orders/new` | `NewOrderPage` | AppShell | 5 |
| 10 | `#/orders/:id` | تفاصيل الطلب | `/orders/:orderNumber` | `OrderDetailsPage` | AppShell | 5 (payments 6, return 8) |
| 11 | `#/preorders` | الطلبات المسبقة | `/orders/preorders` | `PreOrdersPage` | AppShell | 8 |
| 12 | `#/products` | المنتجات | `/products` | `ProductsListPage` | AppShell | 2 |
| 13 | `#/products/new` | منتج جديد | `/products/new`, `/products/:id/edit` | `ProductFormPage` | AppShell | 2 |
| 14 | `#/products/:id` | تفاصيل منتج | `/products/:id` | `ProductDetailsPage` | AppShell | 2 (stock 3, sales 5+) |
| 15 | `#/categories` | التصنيفات | `/products/categories` | `CategoriesPage` | AppShell | 2 |
| 16 | `#/inventory` | مستوى المخزون | `/inventory` | `StockLevelsPage` | AppShell | 3 |
| 17 | `#/inventory/receive` | استلام بضاعة | `/inventory/receive` | `ReceiveStockPage` | AppShell | 3 |
| 18 | `#/inventory/movements` | سجل الحركات | `/inventory/movements` | `StockMovementsPage` | AppShell | 3 |
| 19 | `#/inventory/expiry` | تواريخ الانتهاء | `/inventory/expiry` | `ExpiryPage` | AppShell | 3 |
| 20 | `#/customers` | العملاء | `/customers` | `CustomersListPage` | AppShell | 4 |
| 21 | `#/customers/:id` | ملف عميل | `/customers/:id` | `CustomerProfilePage` | AppShell | 4 (+6) |
| 22 | `#/finance` | نظرة مالية | `/finance` | `FinanceOverviewPage` | AppShell | 7 |
| 23 | `#/finance/payments` | المدفوعات والذمم | `/finance/payments` | `PaymentsReceivablesPage` | AppShell | 6 |
| 24 | `#/finance/courier` | شركة التوصيل | `/finance/courier` | `CourierPage` | AppShell | 7 |
| 25 | `#/finance/expenses` | المصاريف | `/finance/expenses` | `ExpensesPage` | AppShell | 7 |
| 26 | `#/reports` | مركز التقارير | `/reports` | `ReportsHubPage` | AppShell | 10 |
| 27 | `#/reports/pnl` | الأرباح والخسائر | `/reports/pnl` | `ProfitLossPage` | AppShell | 10 |
| 28 | `#/reports/sales` | المبيعات | `/reports/sales` | `SalesReportPage` | AppShell | 10 |
| 29 | `#/settings` | إعدادات المشروع | `/settings` | `BusinessSettingsPage` | AppShell | 1 (profile, channels, payment methods, inventory default), 2 (templates), 7 (expense categories) |
| 30 | `#/account` | الحساب | `/account` | `AccountPage` | AppShell | 1 |
| 31 | `#/subscription` | الاشتراك | `/subscription` | `SubscriptionPage` | AppShell | 11 |
| 32 | `#/trial-expired` | انتهت التجربة | — (state) | `TrialExpiredState` | AppShell | 11, **only if enforcement is approved** |
| 33 | `#/more` | المزيد (موبايل) | `/more` | `MoreHubPage` | AppShell (mobile) | 1 |
| 34 | `#/new` | إضافة جديد (موبايل) | `/new` | `QuickAddHubPage` | AppShell (mobile) | 1 (entries enabled per phase) |
| 35 | `#/loading` | التحميل | — | `PageSkeleton` component | — | 1 |
| 36 | `#/offline` | انقطاع الاتصال | — | `OfflineState` component | — | 1 (drafts: OQ-084) |
| 37 | `#/nope` (404) | 404 | `*` | `NotFoundPage` | AppShell | 1 |

Route naming is **Proposed**. The `:id` in the prototype is the order number (`#/orders/1042`).

## 4. Navigation map
- **Sidebar (desktop and tablet).** Items marked ▸ have a submenu.
  - الرئيسية
  - الطلبات ▸ (قائمة · لوحة الحالات · المسبقة), with a badge for the new-order count
  - المنتجات ▸ (كل المنتجات · التصنيفات)
  - المخزون ▸ (المستوى · استلام · الحركات · الانتهاء)
  - العملاء
  - المالية ▸ (نظرة · المدفوعات والذمم · شركة التوصيل · المصاريف)
  - التقارير ▸ (المركز · الأرباح والخسائر · المبيعات)
  - إعدادات المشروع
  - Business switcher card (name plus trial days, links to settings)
  - Trial card (days used / 30, link to plans)
  - User card (links to account)
  - Collapse toggle (the choice persists in localStorage; auto-collapsed below 1280 px)
  - Sliding active "pill" animation
- **Topbar:**
  - Search button that opens the **command palette** (Ctrl K, rotating hints)
  - **New** menu: order, product, customer, payment, expense, receive stock
  - **Bell** menu: notifications
  - **Me** menu: account, subscription, language (Arabic), logout
- **Mobile (<768):** sidebar hidden; **bottom bar** with Home, Orders, a FAB "+" (→ `/new`), Products, More (→ `/more`); tables become cards; drawers become bottom sheets.
- **Banners:** a "late trial" banner (≤3 days left) and an "expired" banner.
- **Edge stickers ("peek"):** a decorative brand sticker with a line of text per section. It is suppressed under reduced motion.

## 5. Shared layouts & reusable components
**Layouts:** `AuthLayout` (split brand side plus form card), `OnboardingLayout` (progress bar), `AppShell` (Sidebar + Topbar + Page + BottomBar + Toasts + Drawer/Dialog host).

**Components.** Prototype classes come from handoff.md; the React names are Proposed.

| Group | React component(s) | Prototype source |
|---|---|---|
| Primitives | `Button` (primary, secondary, outline, ghost, accent, danger; sm, lg; loading), `IconButton`, `Icon` | `.btn`, `Lamma.icon`, `icons.js` |
| Form | `TextField` (affix: د.أ, +962; error; disabled), `PasswordField` + `PasswordStrength`, `SearchField` (+ `Kbd`), `Select`, `Combobox` (with quick-create), `Stepper` (max = available), `Checkbox`, `Radio`, `Toggle`, `MoneyInput`, `PhoneInput` | `.field`, `.control`, `.select-list`, `.stepper`, `.check`, `.toggle`, `.pwmeter` |
| Display | `Badge` (success, warning, danger, info, attention, outline, dot), `OrderStatusBadge`, `PaymentStatusBadge`, `Money` (colored, plus, tone), `StockMeter` (low, out, reserved segment), `Avatar` / `RingAvatar`, `Swatch`, `Chip`, `Tag` | `.badge`, `App.statusBadge`, `App.payBadge`, `Lamma.money`, `App.stockMeter` |
| Navigation | `Tabs`, `SlidingTabs`, `Segmented`, `Breadcrumbs`, `PageHeader` | `.tabs`, `LammaCards.bindTabs`, `.segmented`, `App.head` |
| Data | `DataTable` (responsive to cards; `.num` alignment; hide-md and hide-sm), `Toolbar`, `KanbanBoard` / `BoardColumn` / `OrderCard`, `Timeline` / `Lifecycle`, `Feed` | `.table-wrap`, `.tbl`, `.board`, `.timeline`, `.life`, `.feed` |
| Cards | `KpiCard`, `AttentionCard`, `TodayJourney`, `ProductCard`, `CustomerCard`, `InsightCard` | `cards.css`, `.kpi`, `.attention`, `.today`, `App.productCard`, `App.customerCard` |
| Charts | `BarsChart`, `CurveChart` / `Sparkline`, `DonutChart`, `WaterfallChart`, `Legend` (max 4 series), `ProgressRing` | `.bars`, `LammaCards`, `money.css` |
| Overlays | `Dialog`, `Drawer` (bottom sheet on mobile), `Menu`, `CommandPalette` [O], `Toast` (with action, e.g. Undo) | `.dialog`, `.drawer`, `.menu`, `.palette`, `Lamma.toast` |
| Feedback | `EmptyState` (`.gather` art), `Skeleton`, `ErrorState`, `OfflineState`, `TrialBanner` (late, expired) | `.empty`, `.skel`, `.state`, `.trial` |
| Order flow | `OrderSteps`, `Receipt` (live), `ProductPicker`, `OrderLine`, `PayMethodCards`, `GiftCard` | `orders.css` |
| Catalog | `TemplatePicker`, `VariantMatrix`, `LiveProductPreview`, `MovementRow` | `catalog.css` |
| Brand art | `LammaMark`, `Illustration` (product per template, parcel, packing, delivery, gather, route), `Sticker` | `lamma.js`, `illustrations.js` |
| Drawers (feature) | `RecordPaymentDrawer`, `AddExpenseDrawer`, `CourierSettlementDrawer`, `QuickAddCustomerDrawer`, `StockAdjustDialog`, `CancelOrderDialog`, `ReturnOrderDialog` | `app.js` / `screens*.js` |

## 6. Interactions found (implemented in prototype JS)
- **Status change** through the "next step" button, the board, or the details page. It shows a toast with **Undo**, and the details page plays an animation.
- **Reserve on confirm, deduct on deliver, release on cancel** in `App.setStatus`. Undo restores a snapshot, which is not acceptable for production (OQ-041).
- **Record payment** drawer. The amount defaults to the remaining balance and is validated to be between 0 and the remaining amount. COD is excluded from the methods list. Undo is available.
- **Add expense** drawer. The amount must be > 0; the last-used category is preselected; Undo is available.
- **Courier settlement** drawer. It lists the pending orders, shows any difference live, and has a checkbox to record the difference as a "Delivery" expense. All pending orders are settled together.
- **Quick-add customer** drawer: name, +962 phone, channel, address.
- **New order:** customer picker with quick-add; product picker with a variant select and a stepper limited by available stock; delivery fee, discount, address; toggles for gift, pre-order, and deposit; payment method cards; a live receipt; save as "confirmed" or as "new".
- **New product:** template picker (6 templates), basics with a live margin, template-specific fields, a size × colour variant matrix with per-variant quantities, "fill all with 3", a live preview card, and a low-stock threshold. Opening quantity is recorded as a movement.
- **Receive stock:** product tile picker; lines of variant, qty, and cost; supplier; date; a receipt; a "record as Purchases expense" checkbox (OQ-020).
- **Movements** filter: all, in, out, automatic, manual, grouped by day.
- **Cancel** dialog with a reason select. **Return** dialog with a restock checkbox and an editable refund amount.
- **Settings:** section nav (scroll-spy) and a "dirty bar" for unsaved changes.
- **Global:** Ctrl K palette, rotating search hints, collapsible sidebar, count-up numbers, FLIP animations, and `prefers-reduced-motion` support throughout.

## 7. Responsive, RTL & accessibility (from handoff.md)
- Breakpoints:
  - ≥1280: full sidebar. The handoff says 240 px, and v2.1 widened it to 276 px.
  - 1024–1279: 72 px icon rail.
  - 768–1023: rail, with the side columns stacked.
  - <768: bottom bar, tables shown as cards, drawers as bottom sheets.
- RTL: `dir="rtl"`, CSS logical properties, directional icons flipped, numbers in `<bdi>`/`.ltr`.
- Accessibility: apricot focus ring, decorative icons `aria-hidden`, `aria-label` on icon buttons, touch targets ≥44 px, contrast documented (in the external brand-identity folder, which is **not present** in this repo).
- Motion: durations 120/200/320/480 ms, 30 ms stagger, enter curve `cubic-bezier(.2,.8,.2,1)`, exit curve `cubic-bezier(.4,0,1,1)`, all disabled under reduced motion.

## 8. Gaps, inconsistencies & missing pieces
**Functional gaps (the prototype only fakes these):**
- No real authentication, validation, or session.
- No API.
- Quick-add customer doesn't persist.
- Product save, settings save, and password change only show a toast.
- No product edit, customer edit, or category CRUD flows beyond the list.
- No reset-password page (the link flow is missing).
- No error states for API failures beyond a generic fallback.
- No pagination anywhere: all lists render fully.

**Prototype formula and data bugs (do not port):**
1. `total()` ignores the **discount**. The approved formula subtracts it.
2. Stock is held at product level, and only one product has variants. The approved model keeps stock per variant (default-variant proposal OQ-010).
3. Reservation lookup matches variants by a `"S · زيتي"` label string. This must become variant IDs.
4. Mock order 1039 is `pay: "paid"` with `paid: 0`. Payment status must be derived (P-012).
5. The return total includes the full order (delivery fee included), with no partial returns (OQ-070).
6. "Order profit" excludes the delivery fee while sales include it, which is inconsistent (OQ-044).
7. Undo is a snapshot restore (OQ-041).
8. The settlement settles all pending orders and uses the full order total as "expected", ignoring partial prepayments (OQ-061, OQ-062).
9. Customer balance includes `unpaid`/`partial` orders in any status except cancelled, including new orders (OQ-053).
10. Category product counts are hard-coded in `data.js`.

**Prototype features beyond the spec (scope decisions needed):** notifications bell and settings (OQ-082), command palette (OQ-083), offline drafts (OQ-084), registered devices, avatar, and business logo (OQ-088), order editing (OQ-046), order address and gift recipient (OQ-048), pre-order daily capacity and default deposit (OQ-074), batch expiry (OQ-021), purchases expense on receive (OQ-020), 3 subscription plans and an invoices list (OQ-085), multi-select business types (OQ-007).

**Approved exclusion:** the "LTR preview" toggle in Account is **not ported** (D-006). The disabled "English · soon" segment is also not ported.

**Not ported:** the `#/screens` developer index and the decorative "peek" stickers. The stickers are brand flavour, and keeping them is a founder choice. **Proposed:** keep them as an optional component, off under reduced motion.

## 9. React migration strategy (Proposed; no work before Phase 1 Frontend approval)
1. **Copy, don't move.** Copy fonts, logos, icon SVGs, and `tokens.css` into the React app's `src/styles` and `public` folders. The reference stays untouched.
2. **Styles first.** Import `tokens.css` and the existing component CSS files globally at first, so the visual identity is identical from day one. Migrate a file to co-located CSS Modules only when a component is converted and its styles are fully isolated. Class names are kept, so the visual output matches the prototype pixel for pixel.
3. **Shell next.** Build AuthLayout, OnboardingLayout, AppShell (sidebar, topbar, bottom bar), the Toast host, and the Dialog/Drawer host as React components that reproduce the prototype's markup, classes, and behaviour (collapse, sliding pill, Esc to close, focus trap).
4. **Primitive and display components** come from the §5 table, each verified against `components.html`.
5. **Pages per phase**, following the roadmap. Each page is built only after its backend phase is approved, and data comes from real APIs via TanStack Query (Proposed).
6. **Port the logic out of the UI.** Business calculations such as totals, reservations, and segments move to the backend. The frontend displays server-computed figures, and only **previews** a live receipt, with the server staying authoritative.
7. **Icons.** Convert the 53 Tabler SVGs into a typed `<Icon name>` component, with icons inlined via an SVG import (no icon package).
8. **Illustrations.** Port `illustrations.js` SVG generators into React components.
9. **Verification per page:** compare side by side with the prototype at 1440, 1024, 768, and 390 widths, check RTL, check reduced motion, and check keyboard navigation.
