# Phase 5 Plan — Orders core (Approved 2026-11-20)

## Context
Phase 4 is merged and the founder created `feature/phase5-orders`. Phase 5 is the core business engine: orders connect customers, stock and money. It is blocked by OQ-040…OQ-049. The founder asked me to decide every question with my best recommendation («حسب خبرتك… نفّذ الأفضل وأنا موافق»). The answers are below as D-121…D-130, and **approving this plan approves them**.

**Outcome:** the merchant can:
- create an order in 4 steps from a WhatsApp/Instagram message
- move it through its life (new → confirmed → preparing → with courier → delivered, or cancelled) with stock reserved and deducted automatically
- undo a status change within 5 minutes
- see orders as a list, a board and a details page
- see real customer and product figures (orders, spent, sold)

**Out of this phase** (each has its own phase):
- recording payments and payment status (Phase 6)
- courier assignment and settlement (Phase 7)
- returns and pre-orders/deposits (Phase 8)
- dashboard (Phase 9)

Every order shows as unpaid until Phase 6.

**Rules:** D-106 lean verification; no Git, no migrations by me, no package installs. Existing approved rules apply unchanged:
- D-020/021: statuses
- D-024–D-033: reservation, delivery deduction, one transaction, movements, Available limit, revenue on delivery, totals formula, price/cost snapshots, derived values

---

## 0. Decisions recorded on approval
| ID | Decision | Resolves |
|---|---|---|
| D-121 | **Status transitions:** forward moves only, skipping allowed: new → confirmed/preparing/courier/delivered/cancelled; confirmed → preparing/courier/delivered/cancelled; preparing → courier/delivered/cancelled; courier → delivered/cancelled (a failed delivery releases the stock); delivered → returned (Phase 8). Cancelled and returned are final (a returning customer gets a new order). **No manual backward moves**; going back is only through Undo (D-122). A skip applies all accumulated stock effects in one transaction and needs enough available stock | OQ-040 |
| D-122 | **Undo** = a compensating transition (never a snapshot restore): it reverts the order's **latest** status change, within **5 minutes** (server clock), only if no later change exists and the reverse is valid now (e.g. undoing a cancel needs available stock to re-reserve). It writes reverse movements and a status-log row flagged undo. Undo for payments, expenses and settlements is decided in their phases as reversing entries | OQ-041, P-009 |
| D-123 | **Order number:** sequential per business from **1001**, shown `#1001`, no prefix, no yearly reset; allocated from a locked per-business counter | OQ-042, P-022 |
| D-124 | **Business time zone `Asia/Amman`** for "today", days and periods; timestamps stored in UTC | OQ-043, P-018 |
| D-125 | **The delivery fee is revenue** (part of Sales, D-031). What the courier company charges is a delivery **expense** (recorded through courier settlements in Phase 7). The order page's "ربحك من الطلب" = items − discount − cost of items (the delivery fee is shown separately, because its real cost is only known at settlement) | OQ-044 |
| D-126 | **Discount:** one fixed amount per order, 0 ≤ discount ≤ items subtotal, ≤ 2 decimals. No percentage or per-line discounts in V1. The total formula includes it (fixing the prototype bug) | OQ-045 |
| D-127 | **Order editing:** items, quantities, prices, fee and discount are editable **only while the order is `new`** (nothing is reserved yet). From `confirmed` on, items are locked (cancel and re-create instead); the address, recipient, gift message and note stay editable until delivered or cancelled | OQ-046 |
| D-128 | **Saving a new order:** as «جديد» (no reservation) or as «مؤكد» (reserves immediately; needs available stock), chosen at the last step | OQ-047 |
| D-129 | **Delivery and gift fields:** delivery address (optional, ≤ 200; prefilled from the customer's governorate · area), and a gift option with recipient name (≤ 100), recipient phone (E.164, D-116 rules) and gift message (≤ 300) | OQ-048 |
| D-130 | **Cancellation reasons:** customer changed their mind · no answer on the phone · product unavailable · other. «Other» requires a short text (≤ 200). The reason is stored on the order and in its timeline | OQ-049 |

Also approved with this plan:
- the **customer figures** of Phase 4 now come from orders (D-115 rules). Order count = non-cancelled orders; total spent = Σ total of delivered orders; last order = latest non-cancelled order.
- the **balance due stays 0 until Phase 6**.
- product **sold** = Σ quantities of delivered items.

---

## 1. Backend tasks (run together after `Backend`)
| ID | Task | Key details |
|---|---|---|
| 5.A1 | **Order domain** (`Lamma.Domain/Orders`) | `Order` (number, customer, channel, status, items, delivery fee, discount, ItemsSubtotal, Total, payment-method hint, address/recipient/gift/note, cancel reason, timestamps, rowversion), `OrderItem` (variant, name and label snapshots, qty, **unit price and unit cost snapshots**, line total), `OrderStatusLog`. `OrderStatusPolicy` (D-121), totals with a DB CHECK (Total = Subtotal + Fee − Discount) |
| 5.A2 | **`InventoryEffectCalculator`** | Implements the DATABASE-DESIGN §6 table (D-024–D-026): enter reserving → reserve; leave reserving → release; reserving → delivered → sale (on hand and reserved down); non-reserving → delivered → sale with an Available check. Writes automatic `reserve`/`release`/`sale` movements (reference kind `order`, label `#1001`) |
| 5.A3 | **Order numbers** | `BusinessCounters(BusinessId, Name, NextValue)` row updated with `UPDLOCK` inside the creating transaction (D-123) |
| 5.A4 | **Create order** `POST orders` (idempotent, D-112) | Customer and variants of the same business, active; channel enabled; qty ≥ 1; snapshots from the effective variant price and cost; discount rule; initial status new or confirmed (reserve). Optional delivery/gift fields |
| 5.A5 | **Change status** `POST orders/{id}/status` (idempotent) | Body `{ to, expectedStatus, cancelReason?, cancelNote? }`. Validated by the policy. One transaction: variants (rowversion), movements, log, timestamps. A stale `expectedStatus` gives 409 with the current status. A race for the last piece: one wins, the other gets 409 `stock.not_available` |
| 5.A6 | **Undo** `POST orders/{id}/status/undo` (idempotent) | D-122 rules; 409 `order.undo_expired` / `order.undo_not_latest` / `stock.not_available` |
| 5.A7 | **Edit order** `PUT orders/{id}` | Full edit while `new`. Delivery/gift/note-only edit afterwards (D-127). 409 `order.locked` |
| 5.A8 | **Queries** | `GET orders` (search by number, customer name or phone; status filter; date range; sort; paging) and `GET orders/status-counts`. `GET orders/{id}` (items, totals, profit, timeline, allowed next statuses, undo window). Customer orders (`customerId` filter). Product sales (`productId` filter + sold count). **Customer stats projection** switched from zeros to order aggregates |
| 5.A9 | **Checkpoint** | Wiring, docs (API-DESIGN §15, DATABASE-DESIGN §12e), **migration `AddOrders`** (`Orders`, `OrderItems`, `OrderStatusLogs`, `BusinessCounters`) |

**Focused tests (D-106), one full run:**
- Domain: every allowed and forbidden transition, totals and discount bounds, effect calculator rows, undo rules.
- Integration:
  - create (snapshots unchanged after a product price change; over-availability rejected for «مؤكد»; idempotent retry)
  - status path new → delivered with on hand and reserved correct and movements reconciled
  - skip new → delivered
  - cancel from courier releases the reservation
  - concurrent confirm of the last piece (one 409)
  - undo within and after 5 minutes, blocked after a later change
  - edit only in `new`
  - tenant isolation
  - order numbers unique under concurrency
  - customer stats from orders

## 2. Frontend tasks (run together after `Frontend`)
New feature `features/orders`. Edges: `orders → auth, settings, customers` (quick-add drawer), `catalog → orders` and `customers → orders` (history sections, through the orders public API; no cycles).

| ID | Task |
|---|---|
| 5.B1 | **Orders list** `/orders` (prototype `#/orders`): status chips with counts, search, date filter, table/cards, a "next step" button per order with an **undo toast** (5 min) |
| 5.B2 | **Board** `/orders/board` (prototype `#/orders/board`): columns per status, move cards only along allowed transitions (buttons; drag where the prototype has it), undo toast |
| 5.B3 | **New order** `/orders/new`, 4 steps (prototype `steps2`): (1) customer: search or quick add (`QuickAddCustomerDrawer`); (2) products: picker and lines with a variant select and a quantity stepper capped at available stock; (3) delivery: fee, discount, address (prefilled), gift option; (4) channel, expected payment method (enabled methods only; recording the payment comes in Phase 6), note, **save as «جديد» or «مؤكد»**. Live receipt in integer fils. Idempotent submit. No pre-order or deposit toggles (Phase 8) |
| 5.B4 | **Order details** `/orders/:id`: items, receipt with profit (D-125), lifecycle stepper, timeline, allowed next status, undo, edit (D-127), **cancel through the shared confirmation dialog** (D-120) extended with a reason picker |
| 5.B5 | **History sections:** customer profile "الطلبات" filled (cards); product details sold count and "طلبات فيها المنتج"; the disabled «طلب جديد» buttons now open `/orders/new` (customer or product preselected) |
| 5.B6 | **Checkpoint (D-106):** checks, logic tests (receipt math, transition helpers), remove the 3 order routes from the coming-soon list, **manual checklist**. STOP |

## 3. Database (migration `AddOrders`; the founder runs it)
- `Orders`:
  - money columns `decimal(19,3)`
  - `Status varchar(32)`
  - unique `(BusinessId, OrderNumber)`
  - index `(BusinessId, Status, CreatedAt DESC)`
  - index `(BusinessId, CustomerId, CreatedAt)`
  - index `(BusinessId, DeliveredAt)`
  - CHECK on Total, CHECK `0 ≤ Discount ≤ ItemsSubtotal`
  - rowversion
- `OrderItems`: FK to the order (cascade from the aggregate); `VariantId` FK Restrict; index `(VariantId)`.
- `OrderStatusLogs`: index `(OrderId, ChangedAt)`.
- `BusinessCounters`: PK `(BusinessId, Name)`.
- All tables carry the tenant filter and the write guard.

```bash
dotnet ef migrations add AddOrders --project src/Lamma.Infrastructure --startup-project src/Lamma.Api --output-dir Persistence/Migrations -- --environment Development
```
```bash
dotnet ef database update --project src/Lamma.Infrastructure --startup-project src/Lamma.Api -- --environment Development
```

## 4. Security, performance, risks
- **Money and stock correctness** is the main risk.
  - Every transition runs in one transaction over versioned variants and the order.
  - The client never sends computed totals: the server computes everything from snapshots.
  - The reconciliation test (Σ movements = on hand / reserved) covers order movements.
- **Concurrency:** rowversion on the variants and on the order, `expectedStatus`, and idempotency keys on create, status change and undo. The locked counter prevents duplicate numbers.
- **Tenancy:** customers, variants and orders all resolve through the tenant filter; a foreign id returns 404.
- **Performance:** list and counts are SQL projections with indexes; details load in a few queries; no N+1.
- **Scope risk:** this is the largest phase. Payments, courier and returns stay out, as listed above.

## 5. Docs
- DECISIONS D-121…D-130.
- OPEN-QUESTIONS: OQ-040…049 resolved.
- API-DESIGN §15.
- DATABASE-DESIGN §12e.
- PRD orders section.
- PHASE-PLANS: Phase 5 gates, and the plan saved as `docs/roadmap/PHASE-5-PLAN.md`.
- PROJECT-PROGRESS.
- FRONTEND-ARCHITECTURE: the orders feature and its edges.

## 6. Verification (D-106)
- **Backend:** build with 0 warnings, focused tests, **one** full `dotnet test` run, and a gate-4 report with the migration commands.
- **Frontend:** `tsc`, `eslint`, `check:architecture`, `vitest`, `build`.
- **Founder's checklist:**
  - create «جديد» and «مؤكد» orders and watch the reserved stock
  - deliver and check on hand and sold
  - cancel with each reason
  - undo within 5 minutes
  - skip new → delivered
  - over-stock blocked
  - edit only while «جديد»
  - board moves
  - customer and product histories
  - widths and RTL
