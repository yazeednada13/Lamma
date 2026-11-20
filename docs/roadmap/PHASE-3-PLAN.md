# Phase 3 Plan — Inventory (Approved 2026-11-18)

## Context
Phase 2 (catalog) is merged. The founder created `feature/phase3-inventory` (gate 1) and gave `Next Phase`. Phase 3 is blocked by OQ-020…OQ-024. As in Phase 2, my recommended answers are part of this plan, and **approving the plan approves them** (recorded as D-107…D-113).

**Outcome:** the merchant can:
- see stock levels and the stock value
- receive goods from a supplier (several lines in one receipt)
- adjust stock with a reason
- browse the full movement log
- see expiry dates, nearest first

Every stock change writes a StockMovement in the same transaction (D-028, CLAUDE.md §4). Receive and adjust are idempotent (API-DESIGN §6).

**Rules:**
- Verification follows **D-106 (lean)**.
- No Git, no migrations run by me, no package installs. Everything below uses packages that are already installed.
- Orders, reservations and sales (Phase 5) are out of scope. This phase only uses `receive` and `adjustment` movements.

---

## 0. Decisions recorded on approval
| ID | Decision | Resolves |
|---|---|---|
| D-107 | **No "Purchases" expense on receive.** The prototype's checkbox «سجّلها كمصروف مشتريات» is removed. Goods received are stock (an asset). Their cost reaches P&L only as COGS when they sell (D-034), so recording them as an expense too would count the cost twice. A "purchases" cash-flow view can later be derived from receipts (Phase 10) without changing the P&L | OQ-020 |
| D-108 | **Expiry stays one date per variant in V1 (D-101), with no batch/lot tracking.** On receive, a line can carry an expiry date. If the variant had 0 on hand, its date becomes the new one. Otherwise it keeps the **earlier** date, so the warning follows the oldest stock. The expiry screen lists variants, not "batches" | OQ-021 |
| D-109 | **Cost on receive = weighted average per variant:** `(onHand × currentCost + qty × unitCost) / (onHand + qty)`, rounded to 3 dp. With 0 on hand, the new cost = the unit cost. The result is stored as the variant's cost (`CostOverride`). The product's `Cost` stays the default for new variants. Order lines will snapshot the cost at sale (D-032) | OQ-022 |
| D-110 | **Adjustment reasons** (fixed list, from the prototype): damage `تلف`, loss `فقدان`, count `جرد`, correction `تصحيح`, gift to customer `هدية للزبون`, plus an optional note (≤ 200). Decreasing: damage, loss, count, correction, gift. Increasing: count, correction. **On hand can never go below reserved** (available ≥ 0) and never below 0 | OQ-023 |
| D-111 | **Expiry warning window = 60 days**, fixed in V1 (not configurable). Status: `expired` (< 0 days), `soon` (≤ 60), `ok` | OQ-024 |
| D-112 | **Idempotency** for receive and adjust: the `Idempotency-Key` header (UUID) is required. Records live in `IdempotencyRecords(BusinessId, Key, RequestHash, ResponseJson, CreatedAt)`, unique per business. A same-key retry returns the stored response. The same key with a different body returns 422 `idempotency.key_reused`. A concurrent duplicate is caught by the unique index and gets the stored response | API-DESIGN §6 |
| D-113 | **Inventory summary** (stock value at cost, expected profit, reserved, low and out counts) is computed on the server. It also fills the products-page summary cards that Phase 2 deferred | Phase 2 note 1 |

---

## 1. Backend tasks (run together after `Backend`)
| ID | Task | Key details |
|---|---|---|
| 3.A1 | **Inventory domain** | On `Product`, `ReceiveStock(variant, qty, unitCost, expiry?, receiptId, label, op, now)` applies D-108 and D-109 and returns a movement. `AdjustStock(variant, delta, reason, note, op, now)` enforces D-110 (≥ reserved, ≥ 0, reason allowed for the direction). The movement factories `Receive` and `Adjustment` stay internal. New `AdjustmentReason` enum, stored as a `varchar(32)` column on StockMovement |
| 3.A2 | **Idempotency infrastructure** | `IIdempotencyService.ExecuteAsync<T>(key, request, work)` in Application: SHA-256 hash of the canonical request JSON, and the work runs inside `ExecuteInTransactionAsync` together with saving the record. Infrastructure: the `IdempotencyRecord` entity, plus a repository. The API reads the header (a missing or invalid header → 422 `idempotency.key_required`) |
| 3.A3 | **Receive** `POST inventory/receipts` | Body `{ receivedOn (≤ today, Asia/Amman), supplier? ≤100, note? ≤200, lines[1..50]: { variantId, quantity 1..100000, unitCost (≥0, 2 dp), expiryDate? } }`. Variants must be active and belong to active products, with no duplicate variant per receipt. Writes a `StockReceipt` (supplier, date, pieces, total cost), plus one `receive` movement per line (reference kind `receipt`, label = supplier or «استلام بضاعة»), all in one transaction. Returns `ReceiptDto` (lines with product/variant names, line totals, new on hand, new cost) |
| 3.A4 | **Adjust** `POST inventory/adjustments` | Body `{ variantId, delta (≠0, \|delta\| ≤ 100000), reason, note? }`. Returns the updated variant levels and the movement. Errors: 409 `stock.below_reserved` (detail gives the reserved count), 422 for a reason not allowed in that direction |
| 3.A5 | **Levels & summary** | `GET inventory/levels?search&status=low\|out&categoryId&page&pageSize` returns product rows (with their variants) sorted by available/threshold ascending, as in the prototype. `GET inventory/summary` returns `{ stockValueAtCost, retailValue, expectedProfit, pieces, reserved, lowCount, outCount, lowNames[2], outNames[2] }` (D-113). Active products and variants only. Aggregation is done in SQL |
| 3.A6 | **Movement log** | `GET inventory/movements?direction=in\|out&origin=auto\|manual&productId&variantId&page&pageSize(≤100, default 50)`, newest first. Each row has the product name, variant label, type, reference kind and label, reason, delta, unit cost, automatic flag, and time. The product details' "الكل" link uses `productId` |
| 3.A7 | **Expiry** | `GET inventory/expiring` lists active variants with an expiry date and on hand > 0, nearest first, with `daysLeft` computed in the business time zone and the status from D-111 |
| 3.A8 | **Reconciliation test utility + checkpoint** | A test helper asserts Σ OnHandDelta = OnHand for every variant after the scenarios. Then wiring, configurations, docs and the API-DESIGN §13 contracts. **Migration `AddInventory`**: new tables `StockReceipts` and `IdempotencyRecords`, plus the `StockMovements.AdjustmentReason` column |

**Focused tests (D-106), one full run at the end:**
- Domain: weighted cost, the expiry rule, adjustment limits and reason/direction.
- Integration:
  - multi-line receive is atomic and its movements reconcile
  - idempotent retry (same key → same receipt, nothing duplicated; different body → 422)
  - adjusting below reserved or below 0 is blocked
  - tenant isolation: another business's `variantId` → 404
  - summary numbers on a fixed dataset
  - expiry ordering and status

## 2. Frontend tasks (run together after `Frontend`)
New feature `features/inventory` (`index.ts`, `routes.tsx`, `api/`, `components/`, `pages/`). **Edge `catalog → inventory`** for the adjust dialog and links. Inventory does not import catalog. Inventory mutations invalidate inventory keys, and catalog screens refetch on mount (the default `staleTime` is 0). The adjust dialog takes an `onDone` callback so the catalog can refresh its own product.

| ID | Task |
|---|---|
| 3.B1 | **Stock levels** `/inventory` (prototype `#/inventory`): `invhero` summary, search, filter chips with counts, stock rows with variants, links to receive and movements |
| 3.B2 | **Receive** `/inventory/receive` (prototype receive screen): product tiles → lines (variant select, quantity stepper, unit cost prefilled with the current cost, expiry when supported), supplier and date, live receipt (totals in integer fils), confirm with an `Idempotency-Key` that is kept across retries. **No purchases checkbox** (D-107). `?productId=` preselects a product |
| 3.B3 | **Adjust stock dialog** (prototype `App.adjustStock`): decrease/increase, stepper, reason chips by direction, before → after preview, below-reserved message. Opened from the product card action and the product details |
| 3.B4 | **Movement log** `/inventory/movements`: in/out/auto/manual chips, grouped by day (Asia/Amman), paging, product filter from the query string |
| 3.B5 | **Expiry** `/inventory/expiry`: `xcard`/`xring` per variant, days left, status badge, "بننبهك قبل 60 يوم" |
| 3.B6 | **Catalog wiring**: enable "تعديل المخزون" and "استلام" (→ `/inventory/receive?productId=`) on the details page; add the adjust action to the product card; add a "الكل" link from recent movements; add the products-page summary cards from `inventory/summary`; remove the 4 inventory routes from the planned (coming-soon) routes |
| 3.B7 | **Checkpoint (D-106)**: `tsc`, `lint`, `check:architecture`, all tests, `build`; unit tests for pure logic only (receipt totals, day grouping, reason rules); deliver the **manual checklist** to the founder. STOP |

## 3. Database (migration `AddInventory`; the founder runs it)
- `StockReceipts`:
  - `Id`, `BusinessId` (FK Restrict)
  - `ReceivedOn date`, `Supplier nvarchar(100) null`, `Note nvarchar(200) null`
  - `Pieces int`, `TotalCost decimal(19,3)`, `CreatedAt`
  - index `(BusinessId, ReceivedOn DESC)`
- `IdempotencyRecords`:
  - `Id`, `BusinessId`, `Key uniqueidentifier`
  - `RequestHash char(64)`, `ResponseJson nvarchar(max)`, `CreatedAt`
  - **unique `(BusinessId, Key)`**
- `StockMovements` gets `AdjustmentReason varchar(32) null`.
- Both new tables are business-owned, with the tenant filter and the write guard.

```bash
dotnet ef migrations add AddInventory --project src/Lamma.Infrastructure --startup-project src/Lamma.Api --output-dir Persistence/Migrations -- --environment Development
```
```bash
dotnet ef database update --project src/Lamma.Infrastructure --startup-project src/Lamma.Api -- --environment Development
```

## 4. Security, performance, risks
- **Tenancy:** every `variantId` is loaded through the tenant filter, so another business's id returns 404. The idempotency key is scoped per business.
- **Atomicity:** receipt, movements, cost, expiry and the idempotency record are written in **one transaction**. Variant `RowVersion` conflicts (for example two adjustments at once) return 409 `concurrency.conflict`, and the client retries with the same key.
- **Performance:** levels, summary and movements are SQL projections with paging. Existing indexes are used (movements by business/time and by product).
- **Risk: the cost display changes after a receive.** With D-109 each variant can carry its own cost. The details page shows cost per variant, and the product's cost is labelled as the default for new variants.

## 5. Docs
- DECISIONS D-107…D-113.
- OPEN-QUESTIONS: OQ-020…024 resolved.
- API-DESIGN §13 (inventory contracts).
- DATABASE-DESIGN §12c.
- PRD M5.
- PHASE-PLANS: Phase 3 tasks and gates, and the plan saved as `docs/roadmap/PHASE-3-PLAN.md`.
- PROJECT-PROGRESS.
- FRONTEND-ARCHITECTURE: the inventory feature and the `catalog → inventory` edge.

## 6. Verification (D-106)
- **Backend:**
  - `dotnet build` with 0 warnings.
  - Focused tests per task.
  - **One** full `dotnet test` run at the end (summary only).
  - Report at gate 4 with the migration commands.
- **Frontend:**
  - `tsc`, `eslint`, `check:architecture`, `vitest` (the existing 73 tests plus the logic tests), `build`.
  - **The founder verifies in the browser** with the checklist from 3.B7: receive multi-line → levels and summary; adjust with each reason, including the below-reserved block; movements filters; expiry; widths 1440/1024/768/390; RTL.
