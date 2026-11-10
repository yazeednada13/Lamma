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
| **Returns** | Value of returned items, counted in the period of the return | [A] concept; [O] partial returns and refunds (OQ-070–073) |
| **Net sales** | Sales − Returns | [A] |
| **COGS** | Σ(qty × unit cost snapshot) of delivered items, net of restocked returns | [A] formula; [O] return reversal (OQ-073) |
| **Gross profit** | Net sales − COGS | [A] |
| **Expenses** | Σ expense records in the period, by category (including automatic courier-settlement differences) | [A]; [O] purchases (OQ-020) |
| **Net profit** | Gross profit − Expenses | [A] |
| **Cash received** | Σ payments actually received by the business in the period (by payment date), minus refunds; it excludes money the courier still holds | [P] definition; refunds [O] |
| **Customer receivables (balance due)** | Σ(order total − payments) for qualifying orders that are not courier-held | [P]; [O] which statuses qualify (OQ-053) |
| **Courier receivables (money held)** | Σ amounts collected by a courier on delivered COD orders that have not yet been settled | [A] concept; [O] courier fee deduction (OQ-061) |
| **Cash flow** | Cash in (payments and settlements) − cash out (expenses and refunds) per period | [P] definition |
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
| Today's order journey (count per lifecycle stage) | [A]; [O] definition (OQ-080) |
| Profit for the period plus % change versus the previous period; daily sales chart over 7 or 30 days | [A] |
| Cards: Sales, Open orders, Cash received, Receivables | [A] |
| Needs attention: new orders, low-stock products, customers who owe money, money held by the courier | [A] |
| Sales by channel, top-selling products, recent activity | [A] |
| Trial banner with days remaining; new-user empty state with getting-started steps | [A] |
| Sidebar indicators: new-order count, low-stock count, an owed-money dot | [A] |
| Notifications bell and Ctrl K palette (prototype only) | [O] (OQ-082, OQ-083) |

### M3 — Orders
| Req | Status |
|---|---|
| List: search, status filter with counts, table and card views, quick next-step action | [A] |
| Kanban board: move between valid statuses, with Undo for a limited time | [A]; [O] matrix and undo semantics (OQ-040, OQ-041) |
| Create order in 4 steps: customer (pick or quick-add) → products (variant, qty ≤ available) → delivery and payment (fee, discount, method, amount paid, channel, note, gift message) → review with a live receipt | [A]; [O] address and recipient fields (OQ-048), discount rules (OQ-045), save as new or confirmed (OQ-047) |
| Details: items, customer, total, paid, remaining, timeline, change status, record payment, cancel with reason, return | [A]; [O] cancel reasons (OQ-049), editing (OQ-046) |
| Pre-orders: out-of-stock or made-to-order products, deposit, expected delivery date | [A]; [O] all rules (OQ-074) |
| 7 order statuses and 4 payment statuses, with Arabic labels | [A] |
| Channels: Instagram, WhatsApp, Facebook, Other | [A] |

Arabic labels: جديد · مؤكد · قيد التجهيز · مع المندوب · تم التوصيل · ملغي · مرتجع. Payment: مدفوع · مدفوع جزئيًا · غير مدفوع · عند شركة التوصيل.

### M4 — Products & categories
| Req | Status |
|---|---|
| List: search, category filter, stock indicator | [A] |
| Create: name, category, price, cost, image, low-stock threshold (default 5), template | [A]; [O] image storage (OQ-013) |
| Templates with descriptive fields; a product may use a different template from the business type | [A]; [O] catalogue and editability (OQ-011, OQ-012) |
| Variants (size × colour etc.), each with its own stock | [A]; [P] default-variant rule (OQ-010) |
| Template behaviours: expiry, gift box, pre-order, deposit | [A] to evaluate; [O] details (OQ-011, OQ-074) |
| Details: sales, profit margin, stock by variant, movement history, adjustment with reason | [A] |
| Categories: create, edit, delete, product count | [A]; [O] delete rule (OQ-014) |

### M5 — Inventory
| Req | Status |
|---|---|
| Per variant: on hand, reserved, available (= on hand − reserved) | [A] |
| Status: in stock, running low (available ≤ threshold), out of stock (available = 0) | [A]; [P] the running-low test uses available, not on hand |
| Receive stock: product, variant, qty, cost, supplier or note; increases on hand and logs a movement | [A]; [O] cost update (OQ-022), purchases expense (OQ-020) |
| Movements: reserve, release, sale, receive, adjustment, return, each with qty, reference, auto/manual flag, timestamp | [A] |
| Expiry: products with expiry, sorted nearest first | [A]; [O] batch versus product (OQ-021), warning window (OQ-024) |

### M6 — Customers
| Req | Status |
|---|---|
| List with search and automatic segments: VIP, Owes Money, New (≤2 orders), Dormant (>14 days) | [A]; [O] VIP thresholds and counting rules (OQ-030, OQ-031) |
| Fields: name, mobile, channel, city, area, notes | [A]; [O] uniqueness and city list (OQ-032, OQ-033) |
| Profile: order count, total spent, balance due, last order (computed); order history; record payment | [A] |
| Quick add from the new-order flow | [A] |

### M7 — Finance
| Req | Status |
|---|---|
| Overview: sales, cash received, profit, receivables, courier receivables, cash flow | [A] |
| Record a payment against an order or a customer: amount, method, date | [A]; [O] allocation (OQ-050), editing (OQ-055) |
| Receivables aging: 0–7, 8–30, >30 days | [A]; [P] the age is counted from `deliveredAt` (prototype behaviour) |
| Courier: money held for delivered COD orders; settlement (expected, received, difference); the difference becomes a delivery expense automatically | [A]; [O] edge cases (OQ-060–062) |
| Expenses: date, category, amount, note; totals by category | [A]; [O] categories (OQ-063) |
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
| Plans: monthly and yearly (yearly saves two months); prices undecided | [A]; [O] the prototype shows 3 plans (OQ-085) |
| Trial expiration: data viewable, new operations blocked | **[O] proposal only, not approved. Do not implement enforcement** |
| General states: loading, offline, 404 | [A] (UI) |

## 5. Out of scope (V1)
[X] Multiple users, employees, permissions · WhatsApp order sharing · data export · expense receipt photos · dark mode · customer invoices · English LTR UI and the LTR toggle · subscription enforcement (until approved) · invented prices · any feature not listed here.

## 6. Missing requirements identified (all tracked in OPEN-QUESTIONS)
- Delivery-fee treatment (OQ-044).
- Purchases-versus-COGS double counting (OQ-020).
- Partial returns and refunds (OQ-070–073).
- The full transition matrix (OQ-040).
- Undo semantics (OQ-041).
- Customer payment allocation (OQ-050).
- Courier assignment and fees (OQ-060–061).
- Pre-order rules (OQ-074).
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
