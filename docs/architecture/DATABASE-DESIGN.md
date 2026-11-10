# Database Design — Lamma (Proposal)

**Status:** Phase 0 proposal. **The schema is not final.** No migrations exist. The founder creates and applies all migrations.
**Labels:** **[A]** Approved · **[P]** Proposed · **[O]** Open (OQ-xxx). Everything not marked [A] is [P].

---

## 1. Principles
- [A] SQL Server + EF Core code-first. Entities live in Domain; mappings live in Infrastructure configurations.
- [A] Every business-owned row carries `BusinessId`. Isolation follows MASTER-ARCHITECTURE §6.
- [A] Derived values (sold, reserved-by-order, customer totals, courier held) are computed from records and never edited by hand.
- [A] Every stock change writes a `StockMovement`. Inventory history is append-only.
- [A] `OrderItem` snapshots unit price and unit cost.
- [P] Stored running quantities `OnHand` and `Reserved` on `ProductVariant` are the **single exception**: they are an operational cache that always changes in the same transaction as the movement that justifies it. A reconciliation query (`Σ movements = OnHand / Reserved`) is tested and can be run as a check. Without this cache, the availability check on every order would have to re-sum the whole movement history, and concurrency control would need a single row to lock or version.

## 2. Conventions [P]
| Item | Convention |
|---|---|
| Keys | `Guid` PKs generated sequentially (`NEWSEQUENTIALID()` or EF sequential GUIDs) to avoid index fragmentation. User-facing numbers (order number) are separate ints |
| Tenancy | `BusinessId uniqueidentifier NOT NULL` + FK to `Businesses`, and every index starts with `BusinessId` |
| Money | `decimal(19,3)` (§3) |
| Quantities | `int`. Stock quantities are whole pieces |
| Timestamps | `CreatedAt`, `UpdatedAt` as `datetime2(3)` in UTC, set by an interceptor |
| Business dates | `date` (`DateOnly`): expense date, payment date, expiry, expected delivery |
| Enums | Stored as `nvarchar(32)` strings (`"confirmed"`) for readability and stable codes matching the spec |
| Text | `nvarchar` with explicit max lengths (Arabic). The collation is the default server collation [O]: confirm Arabic-friendly case and accent insensitivity for search |
| Concurrency | `rowversion` column `RowVersion` on `ProductVariant`, `Order` (§9) |
| Soft-archive | `IsArchived bit` + `ArchivedAt` (§10) |
| Naming | Plural table names, PascalCase columns |

## 3. Money representation (one rule for every layer) [P]
- **Fact:** ISO 4217 gives JOD **3** minor-unit decimals (1 JOD = 1000 fils).
- **SQL Server:** every money column is `decimal(19,3)`. That allows up to 16 integer digits, and `money`, `float`, and `real` are never used.
- **C#:** `decimal` everywhere. One EF convention applies it to all decimal money properties:
  `configurationBuilder.Properties<decimal>().HavePrecision(19, 3);`
  Percentages, if ever stored, use an explicit `decimal(9,4)` override.
- **Rounding rule:** `Math.Round(x, 3, MidpointRounding.AwayFromZero)`. It is applied
  1. to each line total (`qty × unitPrice`; already exact with 3-dp prices),
  2. to every **stored** computed amount (order total, settlement difference, allocation amounts),
  3. never only at display time.

  Averages and percentages (AOV, margin, % change) are computed in `decimal` and rounded only in the response DTO (money to 3 dp, percentages to 1 dp [P]).
- **Domain:** a `Money` value object (or a static `MoneyMath` helper) centralizes rounding, non-negativity guards, and currency (always JOD in V1). Currency is **not** stored per row in V1. `Business.Currency = 'JOD'` is fixed.
- **API:** money is serialized as a **JSON string with exactly 3 decimals** (`"38.000"`). Requests accept the same format, reject more than 3 decimals, and reject negative values where they are not allowed. This avoids IEEE-754 precision loss in JavaScript.
- **Frontend:** never use JS `number` arithmetic on money strings for authoritative values. Live-receipt previews convert to integer fils (`"38.500"` → `38500`), compute in integers, and format back. The server always recomputes and returns authoritative totals. Display goes through a single `formatMoney()` (Latin digits, `د.أ` after the number, the sign kept inside `<bdi>`). Display precision: **[O] OQ-005**, with a recommendation of 2 dp for input and display in V1 while storage and the API stay at 3.

## 4. Entity overview
```
AspNetUsers (ApplicationUser) 1──1 BusinessMembership *──1 Business                   [P membership: OQ-004]
Business 1──* Category, Product, Customer, Order, Payment, Expense, ExpenseCategory, Courier, CourierSettlement,
             BusinessSalesChannel, BusinessPaymentMethod, ProductTemplateField (custom)
ProductTemplate (system) 1──* ProductTemplateField (system)
Product *──1 Category (nullable) · Product *──1 ProductTemplate · Product 1──* ProductVariant
ProductVariant 1──* StockMovement · ProductVariant 1──* OrderItem
Customer 1──* Order · Customer 1──* Payment (customer-level)
Order 1──* OrderItem · Order 1──* OrderStatusLog · Order 1──0..1 OrderPreOrderInfo
Order 1──* PaymentAllocation *──1 Payment
Order 1──* OrderReturn 1──* OrderReturnLine *──1 OrderItem                             [O OQ-070]
Courier 1──* Order (COD assignment) · CourierSettlement 1──* CourierSettlementOrder *──1 Order
CourierSettlement 0..1──1 Expense (difference)
Expense *──1 ExpenseCategory
```

## 5. Entities

### 5.1 Identity & business
**ApplicationUser** (Identity): `Id`, `FullName nvarchar(100)`, `Email` (unique when present), `PhoneNumber` (E.164, unique when present) [O OQ-003], plus the Identity columns.

**Business**
| Column | Type | Notes |
|---|---|---|
| Id | guid | PK |
| Name | nvarchar(100) | required |
| BusinessType | nvarchar(32) | one of 13 codes [A]; single value [O OQ-007] |
| Currency | char(3) | `'JOD'` fixed [A] |
| DefaultLowStockThreshold | int | default 5 [A], ≥ 0 |
| TimeZone | nvarchar(64) | `'Asia/Amman'` [P] |
| LogoPath | nvarchar(400) null | [O OQ-088] |
| TrialStartsAt, TrialEndsAt | datetime2 | 30 days [A] |
| SubscriptionPlan | nvarchar(16) | `trial` / `monthly` / `yearly`; no enforcement [A D-011] |
| CreatedAt, UpdatedAt | datetime2 | |

**BusinessMembership** [P]: `Id`, `UserId` (FK, **unique in V1**), `BusinessId` (FK), `Role nvarchar(16)='Owner'`, `CreatedAt`.

**BusinessSalesChannel**: `(BusinessId, Channel)` PK, `IsEnabled`. Channel ∈ instagram, whatsapp, facebook, other [A].
**BusinessPaymentMethod**: `(BusinessId, Method)` PK, `IsEnabled`. Method ∈ cash, cliq, bank_transfer, cod, zain_cash, orange_money [A].
These are tables rather than a CSV or JSON column so they can be validated and queried. **Alternative:** a flags column.

**RefreshToken** (only for auth option B): `Id`, `UserId`, `TokenHash`, `FamilyId`, `ExpiresAt`, `RevokedAt`, `ReplacedById`, `CreatedAt`.

### 5.2 Catalog
**Category**: `Id`, `BusinessId`, `Name nvarchar(60)`, `IsArchived`. Unique `(BusinessId, Name)` among non-archived rows (filtered index). Product count is computed. Delete rule [O OQ-014].

**ProductTemplate** (system seed data, not business-owned) [P]: `Code` PK (`clothing`, `perfume`, `beauty`, `jewelry`, `gift`, `other`, …), `NameAr`, `SupportsExpiry`, `SupportsGiftBox`, `SupportsPreOrder`, `SupportsDeposit`, `VariantAxes` (e.g. size, colour). Catalogue [O OQ-011].
**ProductTemplateField** [P]: `Id`, `TemplateCode`, `BusinessId null` (null = system field; set = the business's custom field [O OQ-012]), `Key`, `LabelAr`, `FieldType` (text, number, select, date), `OptionsJson null`, `IsRequired`, `SortOrder`.
**BusinessTypeTemplateMap** (seed): business type → default template code. Mapping [O OQ-011].

**Product**
| Column | Type | Notes |
|---|---|---|
| Id, BusinessId | guid | |
| Name | nvarchar(120) | required |
| CategoryId | guid null | FK, same business |
| TemplateCode | nvarchar(32) | defaults from the business type, overridable [A] |
| SellingPrice | decimal(19,3) | ≥ 0. Default price for variants |
| Cost | decimal(19,3) | ≥ 0. Current cost; update rule [O OQ-022] |
| ImagePath | nvarchar(400) null | storage [O OQ-013] |
| LowStockThreshold | int | default = business default [A] |
| HasExpiry | bit | from the template |
| AttributesJson | nvarchar(max) | descriptive template fields (fabric, cut…); validated against the template fields in Application |
| IsPreOrderAllowed, IsMadeToOrder | bit | [O OQ-074] |
| IsArchived | bit | |
| CreatedAt, UpdatedAt | | |

The descriptive fields are a JSON column [P] because they vary per template and are not filtered on in V1. Fields that need filtering would be promoted to columns.

**ProductVariant**
| Column | Type | Notes |
|---|---|---|
| Id, BusinessId, ProductId | guid | |
| OptionsJson | nvarchar(400) | e.g. `{"size":"M","color":"زيتي"}`. The **default variant** has `{}` [P OQ-010] |
| OptionsKey | nvarchar(200) | normalized "M\|زيتي" for uniqueness and display |
| PriceOverride | decimal(19,3) null | e.g. perfume 10 ml versus 50 ml. [P] Needed because the prototype prices perfume sizes differently |
| CostOverride | decimal(19,3) null | [P] |
| OnHand | int | ≥ 0, operational cache (§1) |
| Reserved | int | ≥ 0, ≤ OnHand except for pre-orders [O OQ-074] |
| ExpiryDate | date null | if the product has expiry; granularity [O OQ-021] |
| IsArchived | bit | |
| RowVersion | rowversion | [P] |

Constraints: `CHECK (OnHand >= 0)`, `CHECK (Reserved >= 0)`, unique `(ProductId, OptionsKey)`.
Computed (not stored): `Available = OnHand − Reserved`; `StockStatus` = Out (Available ≤ 0), Low (Available ≤ LowStockThreshold), In.

**Default-variant rule [P, OQ-010]:** every product has ≥1 variant. A product with no options gets one default variant automatically, so stock, movements, and order items always reference a variant and there is a single code path.

### 5.3 Inventory
**StockMovement** (append-only)
| Column | Type | Notes |
|---|---|---|
| Id, BusinessId, VariantId | guid | |
| Type | nvarchar(16) | reserve, release, sale, receive, adjustment, return [A]; `opening` [O OQ-015] |
| QuantityDelta | int | signed effect on the affected bucket |
| Bucket | nvarchar(8) | `onhand` or `reserved` [P]: which quantity changed. A sale affects both, so it writes two rows, or one row with `OnHandDelta` and `ReservedDelta` (preferred, below) |
| OnHandDelta, ReservedDelta | int | [P preferred over Bucket]: one row per event per variant |
| ReferenceType | nvarchar(16) null | order, receipt, adjustment, return |
| ReferenceId | guid null | |
| ReferenceLabel | nvarchar(60) null | e.g. "#1042" or the supplier name |
| UnitCost | decimal(19,3) null | for receive |
| Reason | nvarchar(200) null | adjustment reason [O OQ-023] |
| IsAutomatic | bit | [A] |
| CreatedAt | datetime2 | [A] timestamp |
| OperationId | guid | groups the movements of one business operation, used for idempotency and undo |

**StockReceipt** [P]: `Id`, `BusinessId`, `ReceivedOn date`, `Supplier nvarchar(100) null`, `Note`, `TotalCost`, plus lines expressed as movements of type `receive` referencing the receipt. Whether this creates an expense: **[O OQ-020]**.

### 5.4 Customers
**Customer**: `Id`, `BusinessId`, `Name nvarchar(100)`, `PhoneE164 nvarchar(20) null` (unique per business when present [O OQ-032]), `Channel`, `City nvarchar(60)`, `Area nvarchar(60)`, `Notes nvarchar(500)`, `IsArchived`, `CreatedAt`.
Computed via queries: `OrderCount`, `TotalSpent`, `BalanceDue`, `LastOrderAt`, segments (definitions in §8).

### 5.5 Orders
**Order**
| Column | Type | Notes |
|---|---|---|
| Id, BusinessId | guid | |
| OrderNumber | int | unique `(BusinessId, OrderNumber)`, sequential from 1001 [P OQ-042]. Allocated in a transaction with `UPDLOCK` on a per-business counter row (`BusinessCounters`) [P] |
| CustomerId | guid | FK, same business |
| Channel | nvarchar(16) | must be enabled for the business |
| Status | nvarchar(16) | 7 statuses [A] |
| DeliveryFee | decimal(19,3) | ≥ 0. Revenue treatment [O OQ-044] |
| Discount | decimal(19,3) | 0 ≤ discount ≤ item subtotal [P OQ-045] |
| ItemsSubtotal | decimal(19,3) | stored snapshot = Σ line totals (immutable after confirmation unless editing is approved) |
| Total | decimal(19,3) | stored snapshot = ItemsSubtotal + DeliveryFee − Discount [A formula]. It is stored because it is a historical fact of the order; a DB check enforces the formula |
| PaymentMethodHint | nvarchar(16) null | the method chosen at creation (e.g. cod) |
| CourierId | guid null | for COD [O OQ-060] |
| DeliveryAddress, RecipientName, RecipientPhone | nvarchar null | [O OQ-048] |
| GiftMessage | nvarchar(300) null | [A] |
| Note | nvarchar(500) null | [A] |
| CancelReason | nvarchar(200) null | [A] |
| CreatedAt | datetime2 | |
| ConfirmedAt, DeliveredAt, CancelledAt | datetime2 null | `DeliveredAt` is required for revenue [A] |
| RowVersion | rowversion | [P] |

**OrderItem**: `Id`, `OrderId`, `BusinessId`, `VariantId`, `ProductNameSnapshot`, `VariantLabelSnapshot`, `Quantity int > 0`, `UnitPrice decimal(19,3)` [A snapshot], `UnitCost decimal(19,3)` [A snapshot], `LineTotal` (stored = qty × UnitPrice). Name snapshots keep history readable after a product is renamed or archived.

**OrderStatusLog** [A]: `Id`, `OrderId`, `BusinessId`, `FromStatus null`, `ToStatus`, `ChangedAt`, `OperationId`, `IsUndo bit`, `UndoOfLogId null`, `Reason null`.

**OrderPreOrderInfo** [P extension, OQ-074]: `OrderId` PK/FK, `ExpectedDeliveryDate date`, `ExpectedDeliveryTime time null`, `DepositRequired decimal(19,3) null`. The deposit itself is a Payment, so it is not a duplicate amount.

**OrderReturn / OrderReturnLine** [P, OQ-070–073]: `OrderReturn(Id, OrderId, BusinessId, ReturnedAt, Reason, RefundAmount, RestockedAll)` and `OrderReturnLine(Id, ReturnId, OrderItemId, Quantity, Restock bit)`. The order status becomes `returned` only when everything has been returned, or on every return: [O].

### 5.6 Finance
**Payment**: `Id`, `BusinessId`, `CustomerId`, `OrderId null` (set for order-level), `Amount decimal(19,3) > 0`, `Method`, `PaidOn date`, `RecordedAt datetime2`, `Kind` (payment, deposit, refund [P]), `ReversalOfPaymentId null`, `OperationId`, `Note`.
**PaymentAllocation** [P, OQ-050]: `Id`, `PaymentId`, `OrderId`, `Amount`. An order-level payment gets one allocation, and a customer-level payment gets FIFO allocations. Order paid amount = Σ allocations.
**Courier** [P, OQ-060]: `Id`, `BusinessId`, `Name`, `IsDefault`.
**CourierSettlement**: `Id`, `BusinessId`, `CourierId`, `SettledOn date`, `ExpectedAmount`, `ReceivedAmount`, `Difference` (stored = Expected − Received, rounded), `DifferenceExpenseId null` (unique → prevents a double expense [A D-035]), `OperationId` (unique → idempotent).
**CourierSettlementOrder**: `(SettlementId, OrderId)` PK, `ExpectedAmount` (that order's courier-held amount). Unique `OrderId` → an order can be settled only once.
**ExpenseCategory**: `Id`, `BusinessId`, `Name`, `IsSystem` (e.g. Delivery, used by settlements [P]), `IsArchived`.
**Expense**: `Id`, `BusinessId`, `CategoryId`, `SpentOn date`, `Amount > 0`, `Note`, `Source` (manual, courier_settlement [P]), `SourceId null`.

## 6. Order status → inventory effects (transaction table) [A rules; P mechanics]
`R` = reserving set {confirmed, preparing, courier}. Every row runs in **one transaction**: it validates the transition (matrix [O OQ-040]), locks or versions the variants, applies the deltas, writes StockMovements (`IsAutomatic = 1`, `ReferenceType = order`, with the operation's `OperationId`) and an OrderStatusLog row, and sets timestamps.

| From → To | Reserved | OnHand | Movement(s) | Other |
|---|---|---|---|---|
| non-R → R (e.g. new → confirmed) | += qty | — | `reserve` | requires Available ≥ qty unless it is a pre-order [A] |
| R → R (confirmed → preparing → courier) | — | — | none | log only |
| R → non-R except delivered/returned (e.g. → cancelled, → new) | −= qty | — | `release` | |
| R → delivered | −= qty | −= qty | `sale` (OnHandDelta −qty, ReservedDelta −qty) | `DeliveredAt` = now; revenue recognized [A] |
| non-R → delivered (if allowed, OQ-040) | — | −= qty | `sale` | requires Available ≥ qty |
| new → cancelled | — | — | none | |
| delivered → returned | — | += restocked qty | `return` | per return line [O OQ-070/071] |

The **quantity limit** [A] is checked inside the transaction against the freshly read, versioned variant, never against a value cached by the client.

## 7. Idempotency & Undo [P]
**Idempotency (OQ: API-DESIGN §6):**
- Client POSTs for status change, payment, settlement, receive, and adjust carry an `Idempotency-Key` (a UUID).
- An `IdempotencyRecords(BusinessId, Key, RequestHash, ResponseStatus, ResponseBody, CreatedAt)` table has a unique `(BusinessId, Key)`.
- On a repeat with the same hash, the stored response is returned with no new effects. On a repeat with a different hash, the API returns 422.
- A status change is also naturally idempotent: "change to X" when the order is already X is a no-op returning the current state, and the `expectedStatus`/`RowVersion` precondition rejects stale requests with 409.

**Undo (OQ-041), proposed semantics:**
- `POST /orders/{id}/status/undo` reverts the **most recent** OrderStatusLog entry of that order, if
  1. it is within the window (proposed 5 minutes, measured on the server),
  2. it is not itself an undo,
  3. no later status change exists on the order,
  4. the reverse transition is valid now (e.g. re-reserving after undoing a cancel requires Available ≥ qty).
- It writes **compensating** movements (a reserve ↔ release, a sale reversed by a "sale reversal": `sale` with positive deltas plus `IsUndo`), plus a new log entry with `IsUndo = 1, UndoOfLogId = …`, and restores `DeliveredAt` and `CancelledAt` accordingly.
- It never restores snapshots and never touches other orders' effects, so later unrelated operations are preserved.
- Undo for payments, expenses, and settlements: [O OQ-041]. The proposal is the same pattern: a reversing entry, never a delete.

## 8. Derived values & calculations [A formulas; P definitions where marked]
| Value | Definition |
|---|---|
| Variant Available | OnHand − Reserved |
| Product Sold | Σ OrderItem.Quantity on delivered orders (− returned quantities [P]) |
| Product Reserved (display) | Σ Variant.Reserved |
| Order Paid | Σ PaymentAllocation.Amount (net of refunds/reversals) |
| Order Remaining | Total − Paid (− Returned value [O]) |
| Payment status [P P-012] | `courier` if COD, delivered, Remaining > 0, and not yet settled; `paid` if Remaining ≤ 0; `partial` if 0 < Paid < Total; `unpaid` if Paid = 0. Computed in queries; it may be persisted only as a recomputed cache column, never edited by hand |
| Customer OrderCount | count of non-cancelled orders [O OQ-031] |
| Customer TotalSpent | Σ Total of delivered orders − returns |
| Customer BalanceDue | Σ Remaining over qualifying orders [O OQ-053] |
| Customer LastOrderAt | max(Order.CreatedAt) of non-cancelled orders |
| Segments | VIP: Spent ≥ X and/or delivered count ≥ Y [O OQ-030] · OwesMoney: BalanceDue > 0 · New: OrderCount ≤ 2 · Dormant: LastOrderAt < today − 14 days [A], counting rules [O OQ-031]. Thresholds live in one `CustomerSegmentPolicy` with options |
| Courier money held | Σ Remaining (at delivery) of delivered COD orders assigned to the courier and not in any `CourierSettlementOrder` |
| Sales (period) | Σ Total of orders with DeliveredAt in the period [A]; delivery fee [O OQ-044] |
| Returns (period) | Σ returned line value with ReturnedAt in the period [P] |
| COGS (period) | Σ qty × UnitCost of delivered items in the period − restocked returned items [P] |
| Gross / Net profit | D-034 [A] |
| Expenses by category | Σ Expense.Amount by category in the period |
| Cash received | Σ Payment.Amount (kind payment or deposit) by PaidOn − refunds [P] |
| Receivables aging | Remaining grouped by age = today − DeliveredAt (or CreatedAt if not delivered [O]) into 0–7, 8–30, >30 [A buckets] |

All of these are implemented once, in Infrastructure query services, and tested against fixed datasets.

## 9. Concurrency [P]
- `rowversion` on `ProductVariant` protects against two orders reserving the last piece at once. On conflict, the operation retries once and then returns 409 "stock changed".
- `rowversion` on `Order` protects against two status changes racing (board and details page). The client sends the `rowVersion` (or `expectedStatus`) it saw.
- Order-number allocation uses a per-business counter row updated with `UPDLOCK, ROWLOCK` inside the creating transaction.
- The default isolation level is Read Committed. **Read Committed Snapshot** is recommended at the database level [P]: it is a database setting the founder applies.

## 10. Delete / archive policy [P]
| Entity | Policy |
|---|---|
| Product, Variant, Customer, Category, Courier, ExpenseCategory | Hard delete only if unreferenced; otherwise **archive** (hidden from pickers, kept in history) |
| Order | Never deleted. It is cancelled |
| OrderItem | Immutable after confirmation (editing [O OQ-046]) |
| StockMovement, OrderStatusLog | Append-only. Never updated or deleted |
| Payment | Never deleted. It is reversed by a reversing entry |
| Expense | [O] deletable, or reversal only. Manual expenses: deletable with an audit row [P]. Settlement-generated: never |
| CourierSettlement | Never deleted. Reversal [O OQ-062] |
| Business / User | Account deletion is out of V1 scope [O]: data retention policy needed before launch |

FKs use `ON DELETE NO ACTION` (Restrict) everywhere except pure child collections owned by their aggregate (e.g. `ProductTemplateField` custom fields).

## 11. Indexes (initial) [P]
- `Orders (BusinessId, Status, CreatedAt DESC)`: list and filter, counts per status
- `Orders (BusinessId, DeliveredAt)` with `INCLUDE (Total, Channel)`: sales and reports
- `Orders (BusinessId, CustomerId, CreatedAt)`: customer profile and segments
- `Orders (BusinessId, OrderNumber)` UNIQUE
- `OrderItems (OrderId)`, `OrderItems (VariantId)`
- `ProductVariants (ProductId)`, `ProductVariants (BusinessId, ExpiryDate)` filtered `WHERE ExpiryDate IS NOT NULL`
- `Products (BusinessId, CategoryId)`, `Products (BusinessId, Name)`
- `Customers (BusinessId, Name)`, `Customers (BusinessId, PhoneE164)` UNIQUE filtered `WHERE PhoneE164 IS NOT NULL`
- `StockMovements (VariantId, CreatedAt DESC)`, `StockMovements (BusinessId, CreatedAt DESC)`
- `Payments (BusinessId, PaidOn)`, `PaymentAllocations (OrderId)`
- `Expenses (BusinessId, SpentOn)`, `CourierSettlementOrders (OrderId)` UNIQUE
- `IdempotencyRecords (BusinessId, Key)` UNIQUE

Indexes are reviewed against the actual query plans in each phase.

## 12. Audit [P]
- Business history is captured through StockMovement, OrderStatusLog, Payment/Allocation, CourierSettlement, and Expense `Source`.
- `CreatedAt`/`UpdatedAt` are on all tables. There is no generic audit-log table in V1 unless the founder requests one.
- With one user per business, the actor is implicitly the owner. `CreatedByUserId` is added to operational tables anyway, for future multi-user support [P].

## 13. Migration guidance
- The first migration is created in Phase 1. Recommended name: `InitialIdentityAndBusiness`. The founder runs:
  - `dotnet ef migrations add <Name> --project src/Lamma.Infrastructure --startup-project src/Lamma.Api --output-dir Persistence/Migrations`
  - `dotnet ef database update --project src/Lamma.Infrastructure --startup-project src/Lamma.Api`
- `dotnet-ef` **9.0.6** is installed globally (checked 2026-11-10). If .NET 10 is chosen (OQ-001), the founder should update it to the matching version (`dotnet tool update -g dotnet-ef`). That command is the founder's action.
- Each phase report gives the exact commands, migration names, and verification steps.
