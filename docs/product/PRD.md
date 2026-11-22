# Product Requirements Document — Lamma V1

**Status:** Phase 0 draft for founder review · **Date:** 2026-11-10
**Sources:** the founder's master prompt (MP), `frontend-reference/Lamma-UI-Design/docs/backend-features.md`, and `decisions.md` (REF), plus the prototype audit.
**Labels:** **[A]** Approved · **[P]** Proposed · **[O]** Open (see OQ-xxx) · **[X]** Out of scope.

---

## 1. Vision & positioning
- [A] Lamma brings the daily operations of a small social-media seller into one place: orders, stock, customers, money, and reports. The brand line is "كل شغلك بمكان واحد".
- [A] Target users are small Jordanian businesses (clothing, shoes and bags, perfume, beauty, accessories, gifts, home food, handmade, electronics, kids, home decor, books, other). Many have little technical or accounting experience.
- [A] Lamma is not a marketplace, storefront, social-automation tool, or multi-vendor platform. Orders are entered manually.
- [A] Design principles:
  - Simple, intuitive, and reliable.
  - Every number derives from real records.
  - Automatic stock reservation and deduction.

## 2. Global constraints
| Item | Requirement |
|---|---|
| [A] Platform | Responsive web app (desktop ≥1280, tablet, mobile <768 with a bottom bar) |
| [A] Language | Arabic, RTL. [X] English LTR UI and the LTR-preview toggle |
| [A] Currency | JOD only; decimal precision. [O] input/display decimals (OQ-005) |
| [A] Users | One owner per business; no employees or roles. The model must allow multi-user later |
| [A] Isolation | Business ownership is derived on the server; no cross-business access |
| [P] Timezone | Asia/Amman for "today" and periods (OQ-043) |

## 3. Financial glossary (distinct concepts, never interchangeable)
| Term | Definition | Status |
|---|---|---|
| **Sales (revenue)** | Σ order totals of orders **delivered** within the period (recognized at `deliveredAt`) | [A] recognition rule; [O] whether the delivery fee is included (OQ-044) |
| **Expected sales** | Σ totals of orders in confirmed, preparing, or courier status (not revenue) | [A] |
| **Returns** | Value of returned pieces (minus their discount share), counted in the period of the return | [A] D-146, D-148, D-149 |
| **Net sales** | Sales − Returns | [A] |
| **COGS** | Σ(qty × unit cost snapshot) of delivered items, net of restocked returns | [A] D-149 |
| **Gross profit** | Net sales − COGS | [A] |
| **Expenses** | Σ active expense records in the period, by category (including automatic courier-settlement differences) | [A]; no purchases expense (D-107) |
| **Net profit** | Gross profit − Expenses | [A] |
| **Cash received** | Σ manual payments in the period (by payment date) + Σ amounts the courier actually transferred (by settlement date); excludes money the courier still holds | [A] D-144; refunds in Phase 8 |
| **Customer receivables (balance due)** | Σ(order total − payments) over delivered orders that are not courier-held (not COD) | [A] D-134 |
| **Courier receivables (money held)** | Σ remaining of delivered COD orders not yet settled | [A] D-140; the courier's fee is the settlement difference (D-140, D-141) |
| **Cash flow** | Cash received − manual expenses in the period | [A] D-144; refunds in Phase 8 |
| **Profit margin (product)** | (unit price − unit cost) / unit price | [P] |
| **Average order value** | Sales / number of delivered orders in the period | [P] |

## 4. Modules

### M1 — Account & onboarding
| Req | Status |
|---|---|
| Sign up with name, mobile **or** email, and password; password strength indicator | [A]; [O] identifier, verification, provider (OQ-003) |
| Login, password recovery, account details, change password | [A]; [O] recovery channel (OQ-003) |
| 3-step onboarding: business name → business type → sales channels | [A]; [O] the prototype has a different order and multi-select types (OQ-007) |
| 13 business types; the type sets the default product template | [A] |
| The free trial starts at onboarding (30 days) | [A] trial; [P] start = business creation |
| Account extras seen in the prototype (devices, avatar, logo) | [O] (OQ-088) |

### M2 — Dashboard (all figures computed from records)
| Req | Status |
|---|---|
| Today's order journey (count per lifecycle stage) | [A]; open orders by stage now (D-154) |
| Profit for the period plus % change versus the previous period; daily sales chart over 7 or 30 days | [A] |
| Cards: Sales, Open orders, Cash received, Receivables | [A] |
| Needs attention: new orders, low-stock products, customers who owe money, money held by the courier | [A] |
| Sales by channel, top-selling products, recent activity | [A] |
| Trial banner with days remaining; new-user empty state with getting-started steps | [A] |
| Sidebar indicators: new-order count, low-stock count, an owed-money dot | [A] |
| Notifications bell and Ctrl K palette (prototype only) | [X] not in V1 (D-155, D-156) |

### M3 — Orders
| Req | Status |
|---|---|
| List: search, status filter with counts, table and card views, quick next-step action | [A] |
| Kanban board: move between valid statuses, with Undo for a limited time | [A]; matrix D-121, undo D-122 |
| Create order in 4 steps: customer (pick or quick-add) → products (variant, qty ≤ available) → delivery and payment (fee, discount, method, amount paid, channel, note, gift message) → review with a live receipt | [A]; address and gift fields D-129, discount D-126, save as new or confirmed D-128; amount paid is Phase 6 |
| Details: items, customer, total, paid, remaining, timeline, change status, record payment, cancel with reason, return | [A]; cancel reasons D-130, editing D-127; paid, remaining and payments are Phase 6, returns Phase 8 |
| Pre-orders: out-of-stock or made-to-order products, deposit, expected delivery date | [A]; D-151, D-152 |
| 7 order statuses and 4 payment statuses, with Arabic labels | [A] |
| Channels: Instagram, WhatsApp, Facebook, Other | [A] |

Arabic labels: جديد · مؤكد · قيد التجهيز · مع المندوب · تم التوصيل · ملغي · مرتجع. Payment: مدفوع · مدفوع جزئيًا · غير مدفوع · عند شركة التوصيل.

### M4 — Products & categories
| Req | Status |
|---|---|
| List: search, category filter, stock indicator | [A] |
| Create: name, category (optional, D-098), price, cost (required, D-097), image, low-stock threshold (default 5), template | [A]; image per D-094 |
| Templates with descriptive fields; a product may use a different template from the business type | [A]; catalogue D-091, custom fields D-092 |
| Variants (size × colour etc.), each with its own stock | [A]; default variant D-090, axes D-093 |
| Template behaviours: expiry, gift box, pre-order, deposit | [A] to evaluate; expiry D-101; gift box, pre-order and deposit not in Phase 2 (D-102, OQ-074) |
| Details: sales, profit margin, stock by variant, movement history, adjustment with reason | [A] |
| Categories: create, edit, delete, product count | [A]; delete rule D-095 |

### M5 — Inventory
| Req | Status |
|---|---|
| Per variant: on hand, reserved, available (= on hand − reserved) | [A] |
| Status: in stock, running low (available ≤ threshold), out of stock (available = 0) | [A]; [P] the running-low test uses available, not on hand |
| Receive stock: product, variant, qty, cost, supplier or note; increases on hand and logs a movement | [A]; weighted-average cost (D-109); no purchases expense (D-107) |
| Movements: reserve, release, sale, receive, adjustment, return, each with qty, reference, auto/manual flag, timestamp | [A] |
| Expiry: products with expiry, sorted nearest first | [A]; one date per variant (D-108), 60-day window (D-111) |

### M6 — Customers
| Req | Status |
|---|---|
| List with search and automatic segments: VIP, Owes Money, New (≤2 orders), Dormant (>14 days) | [A]; VIP = top third by spend (D-114), counting rules (D-115) |
| Fields: name, mobile, channel, city, area, notes | [A]; E.164 mobile unique per business (D-116), governorate list (D-117) |
| Profile: order count, total spent, balance due, last order (computed); order history; record payment | [A] |
| Quick add from the new-order flow | [A] |

### M7 — Finance
| Req | Status |
|---|---|
| Overview: sales, cash received, profit, receivables, courier receivables, cash flow | [A] |
| Record a payment against an order or a customer: amount, method, date | [A]; FIFO allocation (D-131), no overpayment (D-132), deposits (D-135), back-dating and reversal only (D-136), no COD by hand (D-138) |
| Receivables aging: 0–7, 8–30, >30 days | [A]; age counted from the business-local delivery date (D-134) |
| Courier: money held for delivered COD orders; settlement (expected, received, difference); the difference becomes a delivery expense automatically | [A]; one company (D-139), picked orders, received ≤ expected, reversal only (D-141) |
| Expenses: date, category, amount, note; totals by category | [A]; categories D-142, void only (D-143) |
| Payment methods are enabled per business | [A] |

### M8 — Reports
| Req | Status |
|---|---|
| Hub with overview and navigation | [A] |
| P&L for a period versus the previous period, a waterfall chart, and a short "what changed" explanation | [A]; [O] wording rule (OQ-081) |
| Sales by day, channel, and product (quantity and amount); average order value | [A] |
| Periods: this month, last month, last 7 days, custom | [A] |

### M9 — Settings & subscription
| Req | Status |
|---|---|
| Business profile, channels, payment methods, default low-stock threshold, expense categories, templates and fields | [A] |
| Trial: first month free, full features, days remaining | [A] |
| Plans: monthly and yearly (yearly saves two months) | [A]; prices D-165 (9 / 90 د.أ); two plans, not the prototype's three |
| Trial expiration: data viewable, new operations blocked | **[A] D-162** (read-only mode; built in Phase 11) |
| General states: loading, offline, 404 | [A] (UI) |

## 5. Out of scope (V1)
[X] Multiple users, employees, permissions · WhatsApp order sharing · data export · expense receipt photos · dark mode · customer invoices · English LTR UI and the LTR toggle · subscription enforcement (until approved) · invented prices · any feature not listed here.

## 6. Missing requirements identified (all tracked in OPEN-QUESTIONS)
- Delivery-fee treatment (OQ-044).
- Purchases-versus-COGS double counting (OQ-020).
- The full transition matrix (OQ-040).
- Undo semantics (OQ-041).
- Template catalogue (OQ-011).
- Sign-up verification provider (OQ-003).
- Hosting (OQ-086).
- Image storage (OQ-013).
- Timezone (OQ-043).

## 7. Conflicts between the prototype and the spec (resolution needed or noted)
| # | Prototype | Spec | Tracking |
|---|---|---|---|
| 1 | Receive stock can create a "Purchases" expense | COGS-based P&L | OQ-020 |
| 2 | Expiry per batch/lot | Expiry per product | OQ-021 |
| 3 | Onboarding: multi-select types first | Name → single type → channels | OQ-007 |
| 4 | Sign-up uses phone only with an OTP | Mobile or email | OQ-003 |
| 5 | Order total ignores the discount | Total includes −discount | Spec wins [A]; prototype bug |
| 6 | Order profit excludes the delivery fee | Total includes the fee | OQ-044 |
| 7 | Undo restores snapshots | Undo must not reverse unrelated later operations | OQ-041 |
| 8 | 3 subscription plans | 2 plans | OQ-085 |
| 9 | Pre-order daily capacity and a default 30% deposit | Not specified | OQ-074 |
| 10 | Stock stored on the product for products without variants | Stock per variant | OQ-010 |
| 11 | Mock payment status inconsistent with amounts | Derived values | P-012 / OQ-052 |
| 12 | Notifications, palette, offline drafts, devices | Not specified | OQ-082–084, OQ-088 |
