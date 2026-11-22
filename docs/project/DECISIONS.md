# Decisions Log — Lamma

Status labels: **Approved** · **Proposed** · **Rejected** · **Out of scope**. Only the founder moves an item to Approved. Each change is logged at the bottom with its date.

Sources:
- **MP** = founder master prompt (Phase 0 brief).
- **REF** = `frontend-reference/Lamma-UI-Design/docs/decisions.md` (9 Nov 2026).
- **F** = founder instruction during the Phase 0 review.

---

## A. Approved decisions

### A1. Product & scope
| ID | Decision | Source |
|---|---|---|
| D-001 | Product is Lamma (لَمّة), with the brand line "كل شغلك بمكان واحد" | MP |
| D-002 | It is a responsive web application. It is not a marketplace, storefront builder, social-automation tool, or multi-vendor platform | MP |
| D-003 | The business owner enters orders manually from social and messaging channels | MP |
| D-004 | V1 has **one user (the owner) per business**. No employees, teams, or roles | MP, REF |
| D-005 | The data model must allow future multi-user support without implementing it now | MP |
| D-006 | Arabic first, RTL first. **The English LTR UI is out of scope for V1.** The prototype's "LTR preview" toggle is **not ported** to React | MP, F |
| D-007 | Currency is JOD (د.أ) only. Money uses precise decimals and never float/double | MP |
| D-008 | Numbers use Latin digits. The currency sign "د.أ" comes after the number. A negative sign stays bound to its number (`<bdi>`) | REF |
| D-009 | 13 business types: Clothing, Shoes & Bags, Perfume, Beauty, Accessories, Gifts, Home Food, Handmade, Electronics, Kids, Home Decor, Books, Other. The type sets the default product template. A product may use a different template | MP, REF |
| D-010 | Free trial: the first month is free with full features, and the remaining days are shown. Plans are monthly and yearly; yearly saves two months. **Prices are undecided. Do not invent them** | MP, REF |
| D-011 | Trial-expiration enforcement is **not approved**. Do not implement it until it is approved | MP |

### A2. Business rules
| ID | Decision | Source |
|---|---|---|
| D-020 | Seven order statuses: new, confirmed, preparing, courier, delivered, cancelled, returned, with Arabic labels | MP |
| D-021 | Four payment statuses: paid, partial, unpaid, courier (held by the courier company) | MP |
| D-022 | Sales channels: Instagram, WhatsApp, Facebook, Other | MP |
| D-023 | Payment methods: Cash, CliQ, Bank Transfer, Cash on Delivery, Zain Cash, Orange Money. The owner enables or disables each one | MP |
| D-024 | Reserving statuses are confirmed, preparing, and courier. Entering a reserving status adds to Reserved; leaving one for a non-reserving status subtracts from it | MP |
| D-025 | Delivered: OnHand −= qty, Reserved −= qty, and deliveredAt is recorded. Sold is derived from delivered items | MP |
| D-026 | Cancelled releases any active reservation and never deducts stock. Returned puts eligible quantities back in stock with a movement | MP |
| D-027 | A status change and its inventory effects happen in **one DB transaction**. Transitions are validated. Retries must not duplicate effects. Concurrency is protected | MP |
| D-028 | Every stock change creates a StockMovement: type, quantity, variant, reference, auto/manual flag, timestamp. Movement types are reserve, release, sale, receive, adjustment, return | MP |
| D-029 | Available = OnHand − Reserved. A normal order cannot exceed Available. Pre-orders are the exception, under rules still to be approved | MP |
| D-030 | Revenue is recognized **on delivery**. Confirmed or preparing orders are not revenue; they may be shown as "expected sales" | MP, REF |
| D-031 | Order Total = Σ(qty × unit price) + delivery fee − discount. COGS = Σ(qty × unit cost) | MP |
| D-032 | OrderItem snapshots the unit price and unit cost. History never changes when product prices change | MP |
| D-033 | Derived values are never maintained by hand as the source of truth. These are product sold/reserved, customer orders/spent/balance/last order, and courier held/pending | MP |
| D-034 | Net Sales = Sales − Returns. Gross Profit = Net Sales − COGS. Net Profit = Gross Profit − Expenses by category | MP |
| D-035 | The courier settlement difference (expected − received) is recorded automatically as a delivery expense, never twice | MP |
| D-036 | Default low-stock threshold is 5, per product | MP, REF |
| D-037 | Customer segments are VIP, Owes Money (balance > 0), New (≤ 2 orders), and Dormant (last order more than 14 days ago). Thresholds are centralized and documented | MP |
| D-038 | Receivables aging buckets: 0–7, 8–30, and over 30 days | MP |
| D-039 | Dashboard figures are computed from records. Caching is allowed only if it is justified and correct | MP |

### A3. Technology & architecture
| ID | Decision | Source |
|---|---|---|
| D-050 | Frontend is React with TypeScript | MP |
| D-051 | Backend is ASP.NET Core Web API (C#), EF Core, SQL Server, and ASP.NET Core Identity | MP |
| D-052 | Clean Architecture plus a Modular Monolith. Layers are Domain, Application, Infrastructure, API, and Tests | MP |
| D-053 | **Backend Engineering Standards are mandatory:** Clean Architecture with strict dependency direction, built-in DI registered through extension methods, focused repositories behind interfaces (no generic repository), application services with thin controllers, professional LINQ/EF Core use, async with CancellationToken, centralized ProblemDetails errors, proper transaction boundaries, safe logging, unit and integration tests | F |
| D-054 | **Do not use** MediatR, CQRS, microservices, unnecessary abstractions or patterns, generic repository frameworks, or unnecessary dependencies | MP, F |
| D-055 | Controllers never access DbContext | F |
| D-056 | No mock data replaces real backend integration | MP |
| D-057 | The original `frontend-reference/` files are preserved and never modified. The React app is a separate folder | MP |

### A4. Governance
| ID | Decision | Source |
|---|---|---|
| D-070 | **Mandatory Phase Execution Workflow** (gates 1–8; trigger words `Backend`, `Frontend`, `Next Phase`). See CLAUDE.md §1 | F |
| D-071 | The founder performs **all Git operations**, including branches, commits, pushes, PRs, and merges. Claude provides the exact commands only | MP, F |
| D-072 | The founder performs **all EF Core migrations and DB updates**. Claude provides the exact commands only | MP, F |
| D-073 | No package or tool installation without approval | MP |
| D-074 | Backend work is completed and reviewed before the matching frontend work | MP |
| D-075 | Before every PR, Claude provides a ready-to-paste **PR title and description**, plus the source and target branches | F |

### A6. Phase 1 prerequisite decisions (founder answers, 2026-11-10)
| ID | Decision | Source |
|---|---|---|
| D-076 | Target **.NET 9** (supersedes the P-019 recommendation of .NET 10) | F, OQ-001 |
| D-077 | Authentication: **ASP.NET Core Identity cookie + antiforgery** (option A of P-004) | F, OQ-002 |
| D-078 | V1 sign-up and login use **email + password**; password recovery by email link. Mobile/SMS is deferred. Provider TBD | F, OQ-003 |
| D-079 | User–Business link: **BusinessMembership** table, unique UserId in V1 (approves P-002) | F, OQ-004 |
| D-080 | Money **input and display at 2 decimals**; storage and API at 3 (`decimal(19,3)`) | F, OQ-005 |
| D-081 | Onboarding: **spec order** (name → single business type → channels) | F, OQ-007 |
| D-082 | Backend request validation with **FluentValidation** (approves P-015; installing the package is approved as part of Phase 1) | F |
| D-083 | **Scoped exception to the DB rule:** test fixtures may create and drop throwaway `Lamma_Test_<guid>` databases on LocalDB (EnsureCreated/EnsureDeleted). They never touch `Lamma_Dev` or any real database | F |
| D-084 | Email confirmation is **not required** before login in V1 (until an email provider is chosen) | F |
| D-085 | Unbuilt modules stay visible in the navigation and open an Arabic "coming soon" page (no fake data) | F |
| D-087 | **Execution granularity:** after `Backend`, Claude implements all approved Backend tasks of the phase in one continuous run, with no stop between tasks, then gives one consolidated report and stops at gate 4. `Frontend` works the same way up to gate 6. Each task is still built, tested, and reviewed. This replaces "one task at a time, STOP after each" | F |
| D-089 | **Frontend architecture:** feature-based structure `app/ · features/ · shared/ · services/ · assets/ · styles/`. Strict layer rules, a public `index.ts` per feature (no deep cross-feature imports), a layout-only AppShell with slots, and a business-agnostic `shared/`. Enforced by ESLint and `npm run check:architecture`. `docs/architecture/FRONTEND-ARCHITECTURE.md` is the authoritative reference for all frontend work (approved 2026-11-17) | F |
| D-088 | **API response shape:** success responses return the DTO directly (no `ApiResponse<T>` envelope); errors use RFC 9457 ProblemDetails with `code`, Arabic `detail`, `traceId`, `errors`. An envelope was considered and rejected (2026-11-10). An `X-Request-Id` header on success responses was offered and is not added unless requested | F |
| D-106 | **Lean verification (token budget), from Phase 3 on.** Backend: automated tests only for sensitive business rules (inventory, money, tenant isolation, transactions, status effects), not every edge case. Build per task; the full suite runs **once** at the end of the Backend part, with summary-only output. Frontend: Claude runs `tsc`, `lint`, `check:architecture`, `build` and unit tests for pure logic only (no new full-app MSW page tests); Claude does **not** run browser/screenshot checks unless asked for a specific problem. The founder verifies the screens in the browser using a manual checklist that Claude delivers at gate 6 (scenarios, widths 1440/1024/768/390, RTL). Existing tests stay and keep passing | F (2026-11-18) |
| D-107 | **No "Purchases" expense on receive.** The prototype's checkbox is removed. Received goods are stock (an asset); their cost reaches P&L only as COGS when sold (D-034). A purchases cash-flow view may later be derived from receipts (Phase 10) | F (2026-11-18, Phase 3 plan) |
| D-108 | **Expiry stays one date per variant (D-101), no batch/lot tracking.** A receive line may carry an expiry date: with 0 on hand the variant takes the new date, otherwise it keeps the earlier date. The expiry screen lists variants | F (2026-11-18, Phase 3 plan) |
| D-109 | **Cost on receive = weighted average per variant:** (onHand × currentCost + qty × unitCost) / (onHand + qty), rounded to 3 dp; with 0 on hand the new cost = the unit cost. Stored as the variant cost (CostOverride); the product Cost stays the default for new variants | F (2026-11-18, Phase 3 plan) |
| D-110 | **Adjustment reasons:** damage, loss, count, correction, gift to customer (decrease); count, correction (increase); optional note ≤ 200. On hand never goes below reserved or below 0 | F (2026-11-18, Phase 3 plan) |
| D-111 | **Expiry warning window = 60 days**, fixed in V1. Status: expired (< 0 days), soon (≤ 60), ok | F (2026-11-18, Phase 3 plan) |
| D-112 | **Idempotency for receive and adjust:** required `Idempotency-Key` header; IdempotencyRecords unique per business; same key + same body → stored response; same key + different body → 422 `idempotency.key_reused` | F (2026-11-18, Phase 3 plan) |
| D-113 | **Inventory summary** (stock value at cost, expected profit, reserved, low/out counts) is computed on the server; it also fills the products-page summary cards deferred in Phase 2 | F (2026-11-18, Phase 3 plan) |
| D-114 | **VIP = top third of customers by total spent (spent > 0)**, the prototype rule: the cut-off is the spend at rank ceil(n × 0.34). No fixed amount; one `CustomerSegmentPolicy` | F (2026-11-20, Phase 4 plan approved; confirmed in chat "سجّل القرارات") |
| D-115 | **Segment counting:** order count = non-cancelled orders (returned still count); last order = created date of the latest non-cancelled order; New ≤ 2 orders; Dormant = has ordered and last order > 14 days ago (never ordered = New); Owes = balance > 0; several segments at once | F (2026-11-20, Phase 4 plan) |
| D-116 | **Customer mobile:** optional, normalized to E.164 (Jordanian 07…/7…/962…/+962… → +9627XXXXXXXX; other +country accepted); unique per business when present (archived included); duplicate → 409 `customer.duplicate_phone` naming the existing customer | F (2026-11-20, Phase 4 plan) |
| D-117 | **City** = optional choice of the 12 Jordanian governorates (amman, irbid, zarqa, balqa, mafraq, jerash, ajloun, madaba, karak, tafilah, maan, aqaba); **Area** = optional free text ≤ 100 | F (2026-11-20, Phase 4 plan) |
| D-118 | **Customer fields:** name (required ≤ 100), mobile, channel (required, one of the 4 sales channels; defaults to the first enabled), city, area, notes ≤ 500. Archive/restore only, never hard-deleted | F (2026-11-20, Phase 4 plan) |
| D-119 | The prototype's **WhatsApp button on the customer profile is not built** (WhatsApp sharing is out of V1, R-001) | F (2026-11-20, Phase 4 plan) |
| D-121 | **Order status transitions:** forward only, skipping allowed: new → confirmed/preparing/courier/delivered/cancelled; confirmed → preparing/courier/delivered/cancelled; preparing → courier/delivered/cancelled; courier → delivered/cancelled (failed delivery releases stock); delivered → returned (Phase 8). Cancelled and returned are final. No manual backward moves (only Undo, D-122). A skip applies all accumulated stock effects in one transaction and needs available stock | F (2026-11-20, Phase 5 plan; founder: «حسب خبرتك… نفّذ الأفضل وأنا موافق») |
| D-122 | **Undo** = compensating transition reverting the order's latest status change, within 5 minutes (server clock), only if no later change exists and the reverse is valid now; writes reverse movements and an undo-flagged log row. Undo for payments/expenses/settlements is decided in their phases (reversing entries) | F (2026-11-20, Phase 5 plan) |
| D-123 | **Order number:** sequential per business from 1001, shown `#1001`, no prefix, no yearly reset; locked per-business counter (approves P-022) | F (2026-11-20, Phase 5 plan) |
| D-124 | **Business time zone `Asia/Amman`** for today/days/periods; timestamps in UTC (approves P-018) | F (2026-11-20, Phase 5 plan) |
| D-125 | **Delivery fee is revenue** (part of Sales, D-031); courier charges are a delivery expense recorded through courier settlements (Phase 7). Order "ربحك من الطلب" = items − discount − cost of items, with the delivery fee shown separately | F (2026-11-20, Phase 5 plan) |
| D-126 | **Discount:** one fixed amount per order, 0 ≤ discount ≤ items subtotal, ≤ 2 decimals; no percentage or per-line discounts in V1 | F (2026-11-20, Phase 5 plan) |
| D-127 | **Order editing:** items, quantities, prices, fee and discount editable only while `new`; from `confirmed` on items are locked (cancel and re-create); address, recipient, gift message and note editable until delivered or cancelled | F (2026-11-20, Phase 5 plan) |
| D-128 | **A new order is saved as «جديد» (no reservation) or «مؤكد» (reserves immediately; needs available stock)** | F (2026-11-20, Phase 5 plan) |
| D-129 | **Order delivery/gift fields:** delivery address (optional ≤ 200, prefilled from the customer's governorate · area); gift option with recipient name ≤ 100, recipient phone (E.164, D-116), gift message ≤ 300 | F (2026-11-20, Phase 5 plan) |
| D-130 | **Cancellation reasons:** customer changed their mind, no answer on the phone, product unavailable, other (other requires text ≤ 200); stored on the order and in its timeline | F (2026-11-20, Phase 5 plan) |
| D-131 | **Customer-level payment: automatic FIFO allocation** over the customer's receivable orders, oldest delivery first (then lowest order number); allocation rows kept; order paid = Σ active allocations | F (2026-11-21, Phase 6 plan) |
| D-132 | **No overpayment:** order-level amount ≤ the order's remaining; customer-level amount ≤ the customer's balance; no customer credit in V1; amount > 0, ≤ 2 decimals | F (2026-11-21, Phase 6 plan) |
| D-133 | **Payment status derived, never stored** (approves P-012). First match: `paid` if remaining ≤ 0; `courier` if expected method is COD, status courier or delivered, remaining > 0 (Phase 7 adds "not yet settled"); `partial` if paid > 0; else `unpaid`. Cancelled orders show no payment status | F (2026-11-21, Phase 6 plan) |
| D-134 | **Receivable** = delivered order with remaining > 0, not courier-held. Customer balance = Σ remaining over those orders. Courier-held tracked separately. Age = Amman today − Amman date of `DeliveredAt`; buckets 0–7, 8–30, >30 (D-038) | F (2026-11-21, Phase 6 plan) |
| D-135 | **A deposit is an early payment:** order-level payments allowed in any open status (new … delivered); optional «المدفوع هلأ» at order creation, saved in the order's transaction | F (2026-11-21, Phase 6 plan) |
| D-136 | **Payment date and reversal:** back-dating allowed (≤ today Amman; order payment ≥ order creation date). No edits or deletes; a mistaken payment is reversed = marked void (time, optional reason ≤ 200), kept in history, excluded from every sum; this is the payment «تراجع» (D-122). Reversing a customer payment voids all its allocations | F (2026-11-21, Phase 6 plan) |
| D-137 | **Payments and cancelling:** no payments on cancelled or returned orders; cancelling an order with active payments is blocked (409 `order.has_payments`); refunds are Phase 8; status undo does not touch payments | F (2026-11-21, Phase 6 plan) |
| D-138 | **Recording methods:** enabled methods only, excluding COD (collected by the courier, recorded by the Phase 7 settlement). A manual payment on a courier-held order is allowed and lowers the held amount | F (2026-11-21, Phase 6 plan) |
| D-139 | **One courier company per business** in V1: name editable (default «شركة التوصيل»), every COD order goes through it, no per-order assignment | F (2026-11-21, Phase 7 plan) |
| D-140 | **COD flow:** a delivered COD order's remaining amount is courier-held automatically (D-133); the fees the courier deducts before transferring are the settlement difference, recorded automatically as a delivery expense (D-035, D-125) | F (2026-11-21, Phase 7 plan) |
| D-141 | **Settlement:** the owner picks delivered courier-held orders (all by default); expected = Σ their remaining; 0 ≤ received ≤ expected (more is blocked in V1); each order gets a COD payment covering its remaining; the difference becomes one «توصيل» expense; one transaction, idempotent, an order settled once; back-dating allowed, no future; undo = reversal only (voids its payments and expense) | F (2026-11-21, Phase 7 plan) |
| D-142 | **Expense categories:** defaults إعلانات، توصيل، تغليف، إيجار، أخرى (no «مشتريات», D-107); «توصيل» is system (no rename, no archive); other defaults renamable/archivable; up to 30 custom (name ≤ 40, unique); archive only | F (2026-11-21, Phase 7 plan) |
| D-143 | **Expenses:** amount > 0 (≤ 2 dp), category, date (back-dating, no future), note ≤ 200; no editing; mistakes are voided and kept in history (also the toast «تراجع»); a settlement expense is removed only by reversing its settlement | F (2026-11-21, Phase 7 plan) |
| D-144 | **Finance overview** per period (default this month, Asia/Amman): Sales = Σ total of orders delivered in the period; COGS; Gross = Sales − COGS; Expenses = active expenses by date (settlement differences included); Net = Gross − Expenses; Cash received = active manual payments by paidOn + settlement received by settledOn; Cash out = active manual expenses; Cash flow = received − out; plus current customer dues and courier-held. No period comparison (Phase 10) | F (2026-11-21, Phase 7 plan) |
| D-145 | **Return eligibility:** delivered orders only; no time limit in V1; several partial returns allowed until every piece is back | F (2026-11-21, Phase 8 plan) |
| D-146 | **Partial returns** by line and quantity (≤ delivered − already returned); full return = all lines; the order becomes «مرتجع» only when every piece is returned, otherwise it stays «تم التوصيل» with «مرتجع جزئي» | F (2026-11-21, Phase 8 plan) |
| D-147 | **Return stock:** per line «رجعت للمخزون» (default, `return` movement) or «تالفة» (no stock change; its cost stays as a loss) | F (2026-11-21, Phase 8 plan) |
| D-148 | **Returned value and refund:** returned value = pieces × unit price − their proportional discount share (rounded to 2 decimals on the cumulative value, so a full return removes exactly the discount and refunds can be exact); delivery fee not returned; net total = total − returned value. Refund prefilled with the minimum that leaves no customer credit (D-132), up to min(paid, returned value); an unpaid order simply owes less; the refund is a «استرداد» payment (method, never COD) that reduces cash received in the return's period | F (2026-11-21, Phase 8 plan) |
| D-149 | **Return figures:** sales go down by the returned value in the return's period (net sales, D-034); COGS goes down only by restocked pieces; customer spent and product sold are net of returns | F (2026-11-21, Phase 8 plan) |
| D-150 | **A return is final in V1:** no undo (confirmation first); status undo (D-122) does not apply; a refund cannot be reversed alone | F (2026-11-21, Phase 8 plan) |
| D-151 | **Pre-order:** any order may be marked «طلب مسبق» with an expected delivery date (today or later) and optional time; saved «جديد» even above available stock (D-029 exception); confirming still needs stock; no product flag | F (2026-11-21, Phase 8 plan) |
| D-152 | **Pre-order deposit and limits:** deposit optional (D-135) with a «30%» shortcut, no required deposit; no daily capacity in V1; cancelling with a deposit follows D-137 | F (2026-11-21, Phase 8 plan) |
| D-120 | **One confirmation dialog for every confirm-worthy action** (archive, delete, and similar): a centered Lamma-styled popup (tone band, icon seal, subject chip, short consequence text, full-width confirm/cancel), the shared `useConfirm()` (`shared/ui/confirm/ConfirmProvider.tsx`). Archive actions use an archive icon and the label «أرشفة»; restore needs no confirmation | F (2026-11-20, founder request during the Phase 4 review) |
| D-090 | **Default variant:** every product has at least one ProductVariant. A simple product gets one hidden default variant with no option values. Stock, movements and order items always reference a variant (approves P-006) | F (2026-11-17, Phase 2 plan) |
| D-091 | **Six system product templates:** `clothing` ملابس, `perfume` عطور, `beauty` تجميل, `jewelry` إكسسوارات, `gift` بوكس هدايا, `other` عام. Default axes and fields per PHASE-PLANS Phase 2 §2.1. Business type → template: clothing, kids → clothing; perfume → perfume; beauty → beauty; accessories → jewelry; gifts → gift; all other types → other | F (2026-11-17, Phase 2 plan) |
| D-092 | **Templates are system-defined and fixed (defined in code).** A business may add up to 20 custom fields per template. All templates are always available (no enable/disable) | F (2026-11-17, Phase 2 plan) |
| D-093 | **Option axes:** 0–2 per product. Names default from the template and are editable. Values are free text with suggestions. Limits: 20 values per axis, 100 variants per product. Variants are any subset of the combinations. Options are stored as columns, not JSON | F (2026-11-17, Phase 2 plan) |
| D-094 | **Product image:** one per product via `IFileStorage`. Local disk in Development (outside the repo). jpg/png/webp checked by content, max 5 MB, no thumbnails. Served only by an authenticated, tenant-checked endpoint. The production store follows OQ-086 | F (2026-11-17, Phase 2 plan) |
| D-095 | **Category delete:** blocked (409, with the count) while active products use it. Archived if only archived products use it. Hard-deleted otherwise | F (2026-11-17, Phase 2 plan) |
| D-096 | **Opening stock** is a `receive` movement (D-028 unchanged) with reference kind `opening`, automatic, at the variant's effective cost | F (2026-11-17, Phase 2 plan) |
| D-097 | **Price and cost:** selling price > 0 required. Cost >= 0 required (explicit 0 allowed). Per-variant price and cost overrides allowed. Input uses 2 decimals (D-080) | F (2026-11-17, Phase 2 plan) |
| D-098 | **Category is optional**; products without one show as "بدون تصنيف" | F (2026-11-17, Phase 2 plan) |
| D-099 | **Stock status:** product available = sum of the available stock of its active variants. Status: out (<= 0), low (<= the product's threshold), in. Each variant has its own status as well (implementation: variant `low` at 1 piece, the prototype heatmap rule) | F (2026-11-17, Phase 2 plan) |
| D-100 | **Products and variants are never hard-deleted.** They are archived and can be restored. The last active variant cannot be archived | F (2026-11-17, Phase 2 plan) |
| D-101 | **Expiry** is stored on the variant. Templates that support expiry get one optional date in the product form, applied to all variants. Batches remain OQ-021 (Phase 3) | F (2026-11-17, Phase 2 plan) |
| D-102 | **No pre-order, made-to-order, deposit or gift-box product columns in Phase 2.** Template capability flags are data only | F (2026-11-17, Phase 2 plan) |
| D-103 | **Business-type labels come from the API only.** `GET onboarding/business-types` adds `defaultTemplateCode`. The client keeps only the type → illustration map (resolves OQ-091) | F (2026-11-17, Phase 2 plan) |
| D-104 | **SKU and barcode** are out of scope for V1 | F (2026-11-17, Phase 2 plan) |
| D-105 | **Paging:** offset paging, default page size 20, max 100 (approves P-021). The product's descriptive attributes are stored as a JSON column validated against the template fields | F (2026-11-17, Phase 2 plan) |
| D-086 | Phase 1 plan approved (2026-11-10). It also approves P-001, P-003, P-005, P-013, P-014, P-016, P-017, P-020 and the Phase 1 package list | F |

### A5. Visual identity (from REF; preserve)
| ID | Decision |
|---|---|
| D-090 | Mark: a hand-drawn slanted shadda. Wordmark in olive `#3F4F2A`, with the shadda and "m" in brick `#C8553D` |
| D-091 | Palette: olive, dark olive, apricot, brick, cream, sage. Apricot appears only on dark backgrounds |
| D-092 | Brand font is Readex Pro. The UI font (v2) is IBM Plex Sans Arabic plus Inter for numbers (tabular). All are SIL OFL |
| D-093 | v2.1 background is olive mist `#EFF1EB`, and the sidebar is 276px |

---

## B. Proposed — awaiting founder approval
Details are in the architecture docs. Each item becomes Approved only when the founder says so.

| ID | Proposal | Doc |
|---|---|---|
| P-001 | Solution layout `Lamma.Domain` / `Application` / `Infrastructure` / `Api` plus test projects, with module folders inside each | MASTER-ARCHITECTURE §3 |
| P-002 | `BusinessMembership` join table (unique UserId in V1) instead of `Business.OwnerUserId` | MASTER-ARCHITECTURE §6 |
| P-003 | Tenant isolation through `ICurrentBusiness`, EF global query filters, a SaveChanges interceptor, and same-business reference validation | MASTER-ARCHITECTURE §6 |
| P-004 | Authentication: option A (Identity cookie) or option B (JWT plus rotating refresh cookie). **Recommendation: A** | MASTER-ARCHITECTURE §7 |
| P-005 | Money stored as `decimal(19,3)`, rounded AwayFromZero to 3 dp, sent over the API as a 3-dp string | DATABASE-DESIGN §3 |
| P-006 | **→ Approved as D-090.** **Default-variant rule:** every product has at least one ProductVariant, and stock always lives on variants | DATABASE-DESIGN §5 |
| P-007 | Optimistic concurrency with `rowversion` on ProductVariant and Order | DATABASE-DESIGN §9 |
| P-008 | `Idempotency-Key` header on status-change, payment, settlement, and receive-stock POSTs | API-DESIGN §6 |
| P-009 | Undo as a compensating reversal, allowed only within a window and only if nothing later touched the order | DATABASE-DESIGN §7 |
| P-010 | Pre-order data as a 1:0..1 extension (`OrderPreOrderInfo`) of Order | DATABASE-DESIGN §5 |
| P-011 | Soft-archive (`IsArchived`) for products, customers, and categories that are referenced. Hard delete only when unreferenced | DATABASE-DESIGN §10 |
| P-012 | Payment status is **derived** from payments versus the total plus the COD/courier state, not stored as the source of truth | DATABASE-DESIGN §8 |
| P-013 | Thin `IUnitOfWork` (SaveChanges plus ExecuteInTransaction) implemented by DbContext | MASTER-ARCHITECTURE §4.3 |
| P-014 | Errors as domain or application exceptions mapped centrally to ProblemDetails, not a Result<T> library | MASTER-ARCHITECTURE §4.4 |
| P-015 | FluentValidation for request validation (needs a package) | MASTER-ARCHITECTURE §4.6 |
| P-016 | Frontend stack: Vite, React Router, TanStack Query, a thin fetch wrapper, React Hook Form plus Zod, Vitest, React Testing Library, MSW (tests only) | FRONTEND-ARCHITECTURE |
| P-017 | Reuse the prototype's `tokens.css` and CSS files as global styles first, then move them to per-component CSS gradually | FRONTEND-ARCHITECTURE §5 |
| P-018 | Business timezone `Asia/Amman` for "today" and period boundaries. Store timestamps in UTC | API-DESIGN §8 |
| P-019 | Target .NET: .NET 10 LTS (needs an SDK install) versus .NET 9 (installed). **Recommendation: .NET 10 LTS** | OPEN-QUESTIONS OQ-001 |
| P-020 | Architecture tests: reflection-based xUnit (no package) or NetArchTest (needs a package) | TESTING-STRATEGY §3 |
| P-021 | **→ Approved as D-105.** Offset pagination with a maximum page size of 100; keyset pagination as an option for the movement log | API-DESIGN §4 |
| P-022 | Order number: a sequential integer per business, starting at 1001 | DATABASE-DESIGN §5 |

---

## C. Rejected / out of scope (V1)
| ID | Item | Status | Source |
|---|---|---|---|
| R-001 | WhatsApp order sharing | Rejected for now | MP, REF |
| R-002 | Data export | Rejected for now | MP, REF |
| R-003 | Expense receipt photos | Rejected for now | MP, REF |
| R-004 | Dark mode | Rejected for now | MP, REF |
| R-005 | Customer invoices | Rejected for now | MP, REF |
| R-006 | English LTR interface, including the LTR-preview toggle | Out of scope (V1) | MP, F |
| R-007 | Multiple users, employees, permissions | Out of scope (V1) | MP |
| R-008 | MediatR, CQRS, microservices, generic repositories | Rejected | MP, F |
| R-009 | A separate Unit of Work object layered over DbContext (beyond the thin interface in P-013) | Rejected by default | F |
| R-010 | `ApiResponse<T>` envelope (success flag + data + meta + errors) for every response | Rejected (D-088) | F |

---

## D. Change log
| Date | Change |
|---|---|
| 2026-11-10 | D-075 added (PR title and description before every PR) |
| 2026-11-10 | D-076–D-082 added from the founder's P0 answers before Phase 1 |
| 2026-11-10 | D-083–D-086 added; Phase 1 plan approved |
| 2026-11-10 | D-087 added: all Backend tasks run together, then all Frontend tasks together |
| 2026-11-10 | D-088 added: keep DTO + ProblemDetails, no response envelope |
| 2026-11-17 | D-089 added: feature-based frontend architecture; FRONTEND-ARCHITECTURE.md is authoritative |
| 2026-11-17 | D-090–D-105 added: Phase 2 (Catalog) decisions; the founder accepted the recommended answers and approved the Phase 2 plan |
| 2026-11-21 | D-145–D-152 added: Phase 8 (Returns & pre-orders) decisions; the founder approved the Phase 8 plan |
| 2026-11-21 | D-139–D-144 added: Phase 7 (Courier & expenses) decisions; the founder approved the Phase 7 plan |
| 2026-11-21 | D-131–D-138 added: Phase 6 (Payments & receivables) decisions; the founder approved the Phase 6 plan |
| 2026-11-20 | D-121–D-130 added: Phase 5 (Orders core) decisions; the founder delegated the answers («حسب خبرتك… نفّذ الأفضل وأنا موافق») and approved the Phase 5 plan |
| 2026-11-20 | D-120 added: unified confirmation dialog for every confirm-worthy action (founder request) |
| 2026-11-20 | D-114–D-119 added: Phase 4 (Customers) decisions; the founder approved the Phase 4 plan and confirmed recording them |
| 2026-11-18 | D-107–D-113 added: Phase 3 (Inventory) decisions; the founder approved the Phase 3 plan with the recommended answers |
| 2026-11-18 | D-106 added: lean verification to save tokens (focused backend tests, one full run; frontend checked manually by the founder with a checklist) |
| 2026-11-10 | Initial log created in Phase 0 from MP, REF, and the founder's review instructions (workflow, engineering standards, status-label discipline, LTR toggle exclusion) |
