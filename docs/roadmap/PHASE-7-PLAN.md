# Phase 7 Plan — Courier & expenses (Approved 2026-11-21)

## Context
Phase 6 is merged and the founder created `feature/phase7-courier-expenses`. Phase 7 was blocked by OQ-060…OQ-063 (OQ-020 was already resolved as D-107). The answers are below as D-139…D-144; the founder approved the plan, and with it these decisions.

**Outcome:** the merchant can:
- record expenses by category and see the month's totals
- see the money held by the courier company and record its transfers (settlements)
- have the settlement difference become a delivery expense automatically
- see a finance overview: sales, profit, cash received, cash flow, and where the money is

**Out of this phase:** returns and refunds (8), dashboard (9), reports and period comparisons (10), several courier companies, per-order courier assignment, editing expenses, receipt photos (out of V1).

**Rules:** D-106 lean verification; no Git, no migrations by Claude, no package installs. Existing approved rules apply: D-030, D-031, D-033, D-034, D-035, D-107, D-124, D-125, D-133, D-136.

---

## 0. Decisions recorded on approval
| ID | Decision | Resolves |
|---|---|---|
| D-139 | **One courier company per business** in V1: name editable (default «شركة التوصيل»); every COD order goes through it; no per-order assignment. Several companies can be added later without changing the settlement logic | OQ-060 |
| D-140 | **COD flow:** a delivered COD order's remaining amount is courier-held automatically (D-133). The fees the courier deducts before transferring are the settlement difference, recorded automatically as a delivery expense (D-035, D-125) | OQ-061 |
| D-141 | **Settlement:** the owner picks delivered courier-held orders (all selected by default). Expected = Σ their remaining; 0 ≤ received ≤ expected (more than expected is blocked in V1). Each selected order gets a COD payment covering its remaining (it becomes «مدفوع»); the difference becomes one «توصيل» expense. One transaction, idempotent; an order cannot be settled twice. Date: back-dating allowed, never the future. **Undo = reversal only:** voids its payments and its expense; the orders go back to courier-held | OQ-062 |
| D-142 | **Expense categories:** defaults إعلانات، توصيل، تغليف، إيجار، أخرى (no «مشتريات», D-107). «توصيل» is system (fixed: no rename, no archive) because settlements use it. Other defaults can be renamed or archived; the owner may add up to 30 custom categories (name ≤ 40, unique per business). Archive only, never hard delete | OQ-063 |
| D-143 | **Expenses:** amount > 0 (≤ 2 decimals), category, date (back-dating allowed, never the future), note ≤ 200. No editing; a mistake is **voided** (kept in history); the toast «تراجع» voids too. A settlement expense is removed only by reversing its settlement | new |
| D-144 | **Finance overview** for a period (default this month, Asia/Amman): **Sales** = Σ total of orders delivered in the period (delivery fee included); **COGS** = their items' cost; **Gross profit** = Sales − COGS; **Expenses** = active expenses by date (settlement differences included); **Net** = Gross − Expenses; **Cash received** = active manual payments by `paidOn` + settlement received amounts by `settledOn`; **Cash out** = active manual expenses; **Cash flow** = received − out; plus the current snapshot of customer dues and courier-held money. No previous-period comparison (Phase 10). Approves the PRD's proposed cash-received and cash-flow definitions | new |

---

## 1. Backend tasks (run together after `Backend`)
| ID | Task | Key details |
|---|---|---|
| 7.A1 | **Expense categories** | `ExpenseCategory` (`Code` for defaults, null for custom; name; archived). Defaults are created per business on first use, idempotent under concurrency (no data migration). `GET/POST expense-categories`, `PUT expense-categories/{id}` (rename), `POST …/{id}/archive`, `POST …/{id}/restore`. 409 `expense_category.system` · `expense_category.duplicate` · `expense_category.limit` |
| 7.A2 | **Expenses** | `Expense` (`Source` manual or courier_settlement, `SettlementId?`, void fields). `POST expenses` (idempotent), `POST expenses/{id}/void`, `GET expenses` (period, category, paging), `GET expenses/summary` (period total and per category). 409 `expense.from_settlement` |
| 7.A3 | **Courier** | `Businesses.CourierCompanyName`, `PUT courier/settings`. `GET courier`: held (delivered COD with remaining), on the way (COD with the courier), orders waiting for transfer, last settlement, this month's courier fees. `GET courier/settlements` (paged) |
| 7.A4 | **Settlement** `POST courier/settlements` (idempotent) | `{ orderIds[], receivedAmount, settledOn, note? }`. Locks the selected orders; each must be delivered, COD and still due. One transaction: settlement, its order lines, one COD payment per order (`Payment.SettlementId`), and the difference expense. `POST courier/settlements/{id}/reverse` voids the payments and the expense. 409 `settlement.order_not_held` · `settlement.received_too_high` · `settlement.already_reversed`. A settlement's payment cannot be reversed alone (409 `payment.from_settlement`) |
| 7.A5 | **Finance overview** `GET finance/overview?from&to` | D-144 figures plus expenses by category; SQL projections over the records |
| 7.A6 | **Checkpoint** | Wiring, docs (API-DESIGN §17, DATABASE-DESIGN §12g), **migration `AddCourierAndExpenses`** |

**Focused tests (D-106), one full run:**
- Domain: category rules, expense rules, settlement math (expected, difference, received too high, received = 0).
- Integration:
  - full settlement → orders «مدفوع» and exactly one «توصيل» expense
  - idempotent retry creates nothing twice
  - two settlements racing for the same order → one wins
  - reversal restores courier-held and voids the expense
  - a settlement's payment or expense cannot be removed alone
  - overview figures exact on a fixed dataset with a fixed clock
  - defaults created once under concurrency
  - tenant isolation

## 2. Frontend tasks (run together after `Frontend`)
New feature `features/finance` (edge `finance → settings`). The expense-categories settings section is composed by the app layer (as the product templates section).

| ID | Task |
|---|---|
| 7.B1 | **`/finance/expenses`** (prototype): month total and bars per category, «ملاحظة لمّة», category filter chips, list grouped by day; **add-expense drawer** (amount, category chips with the last used preselected, date, note); void through the confirmation dialog; «تراجع» in the toast |
| 7.B2 | **`/finance/courier`** (prototype): hero with held amount, orders waiting, last transfer, month fees; waiting-orders table; transfer history with reversal; **settlement drawer** (order checklist, received prefilled with expected, live «في فرق … بينسجّل مصروف توصيل», date) |
| 7.B3 | **`/finance`** overview (prototype): net hero with sales → cost → expenses → net steps, 3 metrics, «وين مصاريك؟» cash bar (received / at customers / at the courier), category donut, link cards; buttons «دفعة» (`/finance/payments?pay=1`) and «مصروف» (`/finance/expenses?add=1`) |
| 7.B4 | **Settings:** expense categories section (add, rename, archive and restore; «توصيل» locked) and the courier company name |
| 7.B5 | **Checkpoint (D-106):** checks, logic tests (settlement difference, period ranges, shares), the 3 finance routes leave the coming-soon list, manual checklist. STOP |

## 3. Database (migration `AddCourierAndExpenses`; the founder runs it)
- `ExpenseCategories`: unique `(BusinessId, Code)` where Code is not null; unique `(BusinessId, Name)`.
- `Expenses`: `Amount` CHECK > 0, `SpentOn date`, `Source`, `SettlementId null` unique where not null, index `(BusinessId, SpentOn)`.
- `CourierSettlements`: expected, received, difference, unique `(BusinessId, OperationId)`, reversal fields.
- `CourierSettlementOrders`: order and expected amount; unique `OrderId` among non-reversed lines.
- `Payments` + `SettlementId null` (indexed). `Businesses` + `CourierCompanyName nvarchar(60) null`.

## 4. Risks
- **Money correctness, exactly once:** one transaction, unique indexes on the settlement expense and settled orders, idempotency keys, row locks.
- **D-139** is the main product choice; adding several companies later means a courier field on orders.
- **The overview** depends on the D-144 definitions.

## 5. Docs
DECISIONS D-139…D-144 · OPEN-QUESTIONS OQ-060…063 resolved · API-DESIGN §17 · DATABASE-DESIGN §12g · PRD finance rows · PHASE-PLANS gates · PROJECT-PROGRESS · FRONTEND-ARCHITECTURE (finance feature and edges).

## 6. Verification (D-106)
- **Backend:** build with 0 warnings, focused tests, **one** full `dotnet test` run, gate-4 report with the migration commands.
- **Frontend:** `tsc`, `eslint`, `check:architecture`, `vitest`, `build`.
- **Founder's checklist:**
  1. add an expense, check the category total, undo it
  2. void an expense through the dialog
  3. settle with received = expected → orders «مدفوع», no expense
  4. settle with less → a «توصيل» expense equal to the difference
  5. received more than expected is blocked
  6. reverse a settlement → orders back to courier-held, expense gone
  7. overview figures match a manual calculation
  8. categories: «توصيل» locked, others rename and archive
  9. widths 1440/1024/768/390, RTL
