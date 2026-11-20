# Phase 6 Plan — Payments & receivables (Approved 2026-11-21)

## Context
Phase 5 is merged and the founder created `feature/phase6-payments`. Phase 6 is blocked by OQ-050…OQ-055. The answers are below as D-131…D-138; the founder approved the plan, and with it these decisions.

**Outcome:** the merchant can:
- record a payment against an order or against a customer
- take a deposit when creating an order
- see each order's payment status (paid, partial, unpaid, with the courier)
- see real customer balances and the "عليه مصاري" segment
- use «المدفوعات والذمم» with receivables aging and the received payments list
- reverse a payment entered by mistake

**Out of this phase:**
- courier settlement and the finance overview (Phase 7)
- refunds (Phase 8)
- the dashboard's "مستحق إلك" figure (Phase 9)

**Rules:** D-106 lean verification; no Git, no migrations by Claude, no package installs. Existing approved rules apply unchanged: D-021 (payment statuses), D-023 (payment methods), D-033 (derived values), D-038 (aging buckets), D-122 (undo as compensating entries), D-124 (Asia/Amman).

---

## 0. Decisions recorded on approval
| ID | Decision | Resolves |
|---|---|---|
| D-131 | **Customer-level payment: automatic FIFO allocation** over the customer's receivable orders, oldest delivery first (then lowest order number). Allocation rows are kept; order paid = Σ its active allocations | OQ-050 |
| D-132 | **No overpayment.** Order-level: amount ≤ the order's remaining. Customer-level: amount ≤ the customer's balance. No customer credit in V1. Amount > 0, ≤ 2 decimals | OQ-051 |
| D-133 | **Payment status is derived, never stored.** First match wins: (1) `paid` if remaining ≤ 0; (2) `courier` if the expected method is COD, the status is courier or delivered, and remaining > 0 (Phase 7 adds "not yet settled"); (3) `partial` if paid > 0; (4) `unpaid`. Cancelled orders show no payment status | OQ-052, P-012 |
| D-134 | **Receivable** = an order that is delivered, has remaining > 0 and is not courier-held. Customer balance = Σ remaining over those orders. Courier-held amounts are tracked separately (shown as info now, settled in Phase 7). Age = Amman today − Amman date of `DeliveredAt`; buckets 0–7, 8–30, >30 days (D-038) | OQ-053 |
| D-135 | **A deposit is an early payment.** Order-level payments are allowed in any open status (new … delivered). New-order step 4 gets an optional «المدفوع هلأ», saved in the order's transaction | OQ-054 |
| D-136 | **Payment date:** back-dating allowed; ≤ today (Amman) and, for an order payment, ≥ the order's creation date. **No edits, no deletes.** A mistaken payment is **reversed**: marked void with a time and an optional reason (≤ 200), kept in history, excluded from every sum. This is the «تراجع» for payments (D-122). Reversing a customer-level payment voids all its allocations | OQ-055, D-122 |
| D-137 | **Payments and cancelling:** no payments on cancelled or returned orders. Cancelling an order with active payments is blocked (409 `order.has_payments`: reverse the payments first). Refunds are Phase 8. Status undo does not touch payments | new |
| D-138 | **Recording methods:** enabled methods only, **excluding COD** (collected by the courier, recorded by the Phase 7 settlement). A manual payment on a courier-held order is allowed and lowers the held amount | new |

This replaces one proposed DATABASE-DESIGN detail: a reversal is a void flag on the payment instead of a separate row with `ReversalOfPaymentId`. The `Kind` column (refund) waits for Phase 8.

---

## 1. Backend tasks (run together after `Backend`)
| ID | Task | Key details |
|---|---|---|
| 6.A1 | **Payment domain** (`Lamma.Domain/Payments`) | `Payment` (customer, `OrderId?`, amount, method, `PaidOn` date, `RecordedAt`, note ≤ 200, `OperationId`, `ReversedAt?`, `ReversalReason?`, `ReversalOperationId?`), `PaymentAllocation` (payment, order, amount). Pure `PaymentStatusPolicy` (D-133) and `PaymentAllocator` (FIFO, exact to the fils; the last order may be partly paid). Validation for D-132, D-136, D-138 |
| 6.A2 | **Pay an order** `POST orders/{id}/payments` (`Idempotency-Key`) | `{ amount, method, paidOn, note? }`. One transaction: **UPDLOCK on the order row**, sum active allocations, validate, insert payment + allocation. Returns the order payment summary and status. 409 `payment.exceeds_remaining` · 409 `order.not_payable` · 422 `payment.method_not_allowed` / `payment.invalid_date` |
| 6.A3 | **Pay against a customer** `POST customers/{id}/payments` (idempotent) | Locks the customer's receivable orders (in Id order), FIFO allocation, returns allocations per order. 409 `payment.exceeds_balance` |
| 6.A4 | **Reverse** `POST payments/{id}/reverse` (idempotent) | `{ reason? }`. Voids the payment and its allocations. 409 `payment.already_reversed` |
| 6.A5 | **Order integration** | `POST orders` accepts an optional `payment { amount, method }`, dated today (the order is created today, so D-136 allows no other date), saved in the order's transaction (D-135). Cancel blocked with payments (D-137). Order list, board, details and counts gain `paid`, `remaining`, `paymentStatus`; details gain the order's payments (reversed flagged) and payment timeline entries |
| 6.A6 | **Queries** | `GET finance/receivables` (receivable orders with age and bucket; search by customer or number; bucket filter; oldest first; paged). `GET finance/receivables/aging` (totals and counts per bucket, overall total, courier-held total). `GET payments` (date range, method, customer, order filters; reversed included and flagged; paged). Customer stats: real `BalanceDue` (D-134), so the Owes segment and summary work. SQL projections, no N+1 |
| 6.A7 | **Checkpoint** | Wiring, docs (API-DESIGN §16, DATABASE-DESIGN §12f), **migration `AddPayments`** |

**Focused tests (D-106), one full run:**
- Domain: every payment status case; FIFO exactness (3 orders, partial fils amounts, allocations sum exactly); amount, date and method bounds.
- Integration:
  - partial then rest → `paid`; overpayment rejected
  - two concurrent payments for the last remaining amount → exactly one 409
  - idempotent retry not duplicated
  - customer FIFO across orders
  - reversal restores remaining and balance; a second reversal → 409
  - COD and disabled methods rejected; future date rejected
  - deposit at creation
  - cancel with payments blocked
  - aging boundaries 7/8/30/31 with a fixed `IClock`
  - balance excludes courier-held and undelivered orders
  - tenant isolation (foreign order, customer, payment → 404)

## 2. Frontend tasks (run together after `Frontend`)
New feature `features/payments`. Edges: `payments → auth, settings` (enabled methods); `orders → payments` and `customers → payments` (embed its drawer through its public `index.ts`). `payments` never imports `orders` or `customers` (links and its own API only); no cycles.

| ID | Task |
|---|---|
| 6.B1 | **Record-payment drawer** (prototype `App.recordPayment`): modes order (amount = remaining), customer (amount = balance; shows the server's FIFO result) and pick (global «دفعة» menu and quick action; search a receivable). Method chips (enabled minus COD), date (today, back-dating), note, live help text («بيضل عليه…» / «بيصير مدفوع بالكامل»). Idempotent save. Success toast with «تراجع» → reverse |
| 6.B2 | **`/finance/payments`** (prototype `#/finance/payments`): aging card (agebar + legend, D-038 buckets); tab «الذمم المستحقة» (due cards with age chip and «دفعة», bucket filter, search, paging); tab «الدفعات المستلمة» (table; reversed rows struck through; «إلغاء الدفعة» via the shared confirmation dialog, D-120). Removed from the coming-soon list |
| 6.B3 | **Orders:** payment card on details (payring, total/paid/remaining, «تسجيل دفعة», payments with reverse); payment entries in the timeline; payment badges in list, cards and board; new-order step 4 «المدفوع هلأ» (optional, ≤ total, live receipt); clear message when cancel is blocked by payments |
| 6.B4 | **Customers:** profile «المستحق» metric real, «تسجيل دفعة» (customer mode), «الدفعات» section; list «المستحق» column and row «دفعة»; Owes segment and summary figures |
| 6.B5 | **Checkpoint (D-106):** `tsc`, `lint`, `check:architecture`, `vitest` (logic tests: drawer amount rules and fils math, aging labels), build, **manual checklist**. STOP |

## 3. Database (migration `AddPayments`; the founder runs it)
- `Payments`: `Amount decimal(19,3)` CHECK > 0; `Method varchar(16)`; `PaidOn date`; FK Restrict to Customers and Orders; unique `(BusinessId, OperationId)`; indexes `(BusinessId, PaidOn)`, `(BusinessId, CustomerId)`; tenant filter and write guard.
- `PaymentAllocations`: FK to the payment (cascade from the aggregate); FK Restrict to the order; CHECK Amount > 0; index `(OrderId) INCLUDE (Amount, PaymentId)`.

```bash
dotnet ef migrations add AddPayments --project src/Lamma.Infrastructure --startup-project src/Lamma.Api --output-dir Persistence/Migrations -- --environment Development
```
```bash
dotnet ef database update --project src/Lamma.Infrastructure --startup-project src/Lamma.Api -- --environment Development
```

## 4. Security, performance, risks
- **Money correctness** is the main risk: paid, remaining and balance are computed on the server from allocations; row locks stop concurrent overpayment; idempotency keys stop double entries; nothing is deleted.
- **Tenancy:** order, customer and payment ids resolve through the tenant filter; a foreign id returns 404.
- **Performance:** the customer-list balance is a correlated subquery over indexed allocations (fine at V1 scale; revisit in Phase 12 if needed).
- **Scope risk:** COD orders show `courier` and add to the courier-held total until Phase 7 settlement. A manual payment still clears them (D-138).

## 5. Docs
DECISIONS D-131…D-138 · OPEN-QUESTIONS OQ-050…055 resolved · API-DESIGN §16 · DATABASE-DESIGN §12f · PRD finance rows · PHASE-PLANS gates · PROJECT-PROGRESS · FRONTEND-ARCHITECTURE (payments feature and edges).

## 6. Verification (D-106)
- **Backend:** build with 0 warnings, focused tests, **one** full `dotnet test` run, gate-4 report with the migration commands.
- **Frontend:** `tsc`, `eslint`, `check:architecture`, `vitest`, `build`.
- **Founder's checklist:**
  1. partial then rest: unpaid → partial → paid
  2. overpayment blocked
  3. customer payment across 3 orders (FIFO)
  4. reverse from the toast and from the list
  5. deposit at order creation
  6. cancel blocked by a payment
  7. COD order with the courier shows «مع شركة التوصيل» and is not in receivables
  8. back-dating allowed, future date blocked
  9. aging buckets and the "عليه مصاري" segment
  10. widths 1440/1024/768/390, RTL
