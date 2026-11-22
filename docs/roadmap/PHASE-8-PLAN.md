# Phase 8 Plan — Returns & pre-orders (Approved 2026-11-21)

## Context
Phase 7 is merged and the founder created the Phase 8 branch (`feature/phase8-returns-preorders`). Phase 8 was blocked by OQ-070…OQ-074. The answers are below as D-145…D-152; the founder approved the plan, and with it these decisions.

**Outcome:** the merchant can:
- return a whole order or only some pieces, choosing per line whether pieces go back to stock or are damaged
- refund money when the customer had paid
- see returns in sales, profit, COGS and customer figures
- take pre-orders with an expected delivery date (and optional time) and see them on a calendar

**Out of this phase:** a return time limit, exchanges, undoing a return, a daily pre-order capacity, a per-product pre-order flag, the dashboard (Phase 9).

**Rules:** D-106 lean verification; no Git, no migrations by Claude, no package installs. Existing approved rules apply: D-026, D-029, D-033, D-034, D-122, D-132, D-133, D-135, D-137, D-144.

---

## 0. Decisions recorded on approval
| ID | Decision | Resolves |
|---|---|---|
| D-145 | **Return eligibility:** delivered orders only; no time limit in V1; an order may be returned several times (partial returns) until every piece is back | OQ-072 |
| D-146 | **Partial returns** by line and quantity, never more than delivered − already returned. A full return = all lines. The order becomes «مرتجع» **only when every piece is returned**; otherwise it stays «تم التوصيل» and shows «مرتجع جزئي» | OQ-070 |
| D-147 | **Stock:** per line «رجعت للمخزون» (default) or «تالفة». Restocked pieces add to stock with a `return` movement. Damaged pieces change no stock (already deducted at delivery); their cost stays as a loss | OQ-071 |
| D-148 | **Returned value and refund:** returned value = pieces × unit price − their proportional share of the discount (rounded to 2 decimals on the cumulative value; found during the Backend run, so refunds can be exact); the delivery fee is not returned. Net total = total − returned value; remaining and payment status use it. **Refund** is prefilled with the minimum that leaves no customer credit (D-132) and may go up to min(paid, returned value). An unpaid order simply owes less. The refund is a «استرداد» payment with a method (never COD) and reduces cash received in the return's period | OQ-071 |
| D-149 | **Figures:** sales go down by the returned value in **the return's period** (net sales = sales − returns, D-034). COGS goes down only by the cost of restocked pieces. Customer «مجموع الشراء» and product «انباع» are net of returns | OQ-073 |
| D-150 | **A return is final in V1:** no undo; the screen asks for confirmation. Status undo (D-122) does not apply to returns, and a refund cannot be reversed alone | new |
| D-151 | **Pre-order:** any order can be marked «طلب مسبق» with an expected delivery date (today or later) and an optional time. It is saved as «جديد» even when stock is not yet available (D-029 exception); confirming it still needs available stock. No product flag | OQ-074 |
| D-152 | **Deposit and limits:** the deposit stays optional (D-135) with a «30%» shortcut and no required deposit; no daily capacity in V1; cancelling a pre-order with a deposit follows D-137 (reverse the deposit first) | OQ-074 |

---

## 1. Backend tasks (run together after `Backend`)
| ID | Task | Key details |
|---|---|---|
| 8.A1 | **Return domain** in the order aggregate | `OrderReturn` (date, reason, refund) and `OrderReturnLine` (order item, quantity, restocked). `Order.ReturnedAmount` recomputed by the aggregate (like `Total`), CHECK 0 ≤ ReturnedAmount ≤ Total. The order moves to «مرتجع» when everything is back, with a status-log row; status undo is blocked for return rows. `return` movements for restocked pieces. Exact discount-share math |
| 8.A2 | **`POST orders/{id}/returns`** (idempotent) | `{ lines[{ orderItemId, quantity, restock }], returnedOn, reason?, refund?{ amount, method } }`. One transaction: order, variants, movements and the refund (`Payment.Kind = refund` with a **negative allocation**, so paid is automatically net of refunds). 409 `return.not_delivered` · `return.quantity_too_high` · `return.refund_out_of_range`; 422 method or date. Reversing a refund alone → 409 `payment.from_return` |
| 8.A3 | **Figures** | Every remaining / status / balance / courier / finance computation uses net total (Total − ReturnedAmount). Customer spent and product sold net of returns. The finance overview gains `returns`, `netSales` and the cost of restocked pieces; cash received subtracts refunds |
| 8.A4 | **Pre-orders** | `Order.ExpectedDeliveryOn date null`, `ExpectedDeliveryTime time null` on create and edit (editable until delivery). `GET orders/preorders?from&to` for the calendar (active orders only). `isPreOrder` filter and field in the order list |
| 8.A5 | **Checkpoint** | Docs (API-DESIGN §18, DATABASE-DESIGN §12h), **migration `AddReturnsAndPreOrders`** |

**Focused tests (D-106), one full run:**
- discount share exact; partial then the rest → «مرتجع» only at the end; over-quantity rejected
- restocked vs damaged: stock and movements reconcile
- refund minimum and maximum; an unpaid order just owes less; refund reversal blocked
- overview figures exact (returns in their own period, COGS reduced only by restocked pieces)
- customer and product figures
- a pre-order over available stock is saved «جديد»; confirming it is refused until stock arrives
- calendar range; tenant isolation

## 2. Frontend tasks (run together after `Frontend`)
| ID | Task |
|---|---|
| 8.B1 | **Return drawer** on order details (prototype `App.returnOrder`): per line a quantity stepper up to what is still returnable and a «رجعت للمخزون / تالفة» switch; live returned value; refund prefilled with the required minimum, its allowed range, method chips when above 0; date and reason; confirmation (final). Timeline return entries, «مرتجع جزئي» on the hero and lines, returned quantity per item |
| 8.B2 | **New order:** «طلب مسبق» option in step 3 with a date (today or later) and an optional time; when on, the quantity cap is lifted for «جديد» («مؤكد» stays capped at available); «30%» deposit shortcut; «مسبق» badge with the date in the order list |
| 8.B3 | **`/orders/preorders`** (prototype `#/preorders`): two weeks / month switch, calendar grid, each day's orders (customer · product, linking to the order), today highlighted. Leaves the coming-soon list |
| 8.B4 | **Finance overview:** sales after returns, with a «مرتجعات» line when there are any |
| 8.B5 | **Checkpoint (D-106):** checks, logic tests (discount share, refund range, calendar grouping), manual checklist. STOP |

**Deviations from the reference:** per-line returns with a refund range instead of one checkbox and a free amount; no «الحد اليومي: 4 طلبات»; the 30% deposit is a shortcut, not a default.

## 3. Database (migration `AddReturnsAndPreOrders`; the founder runs it)
- `OrderReturns`: order, return date, reason, refund payment id, operation id unique per business.
- `OrderReturnLines`: return, order item, quantity (CHECK > 0), restocked flag.
- `Orders` + `ReturnedAmount` (default 0, CHECK 0 ≤ … ≤ Total), `ExpectedDeliveryOn`, `ExpectedDeliveryTime`, index `(BusinessId, ExpectedDeliveryOn)`.
- `Payments` + `Kind` (payment / refund, default payment). `PaymentAllocations` CHECK changes from `> 0` to `<> 0` (refunds are negative).

## 4. Risks
- **Net total touches many queries:** every remaining computation switches from `Total` to `Total − ReturnedAmount`; the existing tests guard it.
- **Negative allocations:** customer FIFO, courier-held and remaining each get a test.
- **D-150 (no undo):** a wrong return cannot be fixed in V1; the confirmation says so clearly.

## 5. Docs
DECISIONS D-145…D-152 · OPEN-QUESTIONS OQ-070…074 resolved · API-DESIGN §18 · DATABASE-DESIGN §12h · PRD rows · PHASE-PLANS gates · PROJECT-PROGRESS · FRONTEND-ARCHITECTURE.

## 6. Verification (D-106)
- **Backend:** build with 0 warnings, focused tests, **one** full `dotnet test` run, gate-4 report with the migration commands.
- **Frontend:** `tsc`, `eslint`, `check:architecture`, `vitest`, `build`.
- **Founder's checklist:**
  1. partial return with restock: stock goes up, order stays «تم التوصيل» with «مرتجع جزئي»
  2. return the rest: «مرتجع»
  3. a damaged piece does not go back to stock
  4. fully paid order: refund forced to the minimum; unpaid order: refund 0
  5. the overview shows returns in today's period
  6. a pre-order above stock is saved «جديد»; confirming it is refused
  7. the calendar shows the pre-order on its day
  8. the 30% shortcut
  9. widths and RTL
