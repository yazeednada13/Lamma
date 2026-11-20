# Phase 4 Plan — Customers (Approved 2026-11-20)

## Context
Phase 3 is merged, and the founder created `feature/phase4-customers` and asked to continue. Phase 4 is blocked by OQ-030…OQ-033. As in Phases 2 and 3, my recommended answers are part of this plan, and **approving the plan approves them** (D-114…D-119).

**Outcome:** the merchant can:
- add customers (also through a quick-add drawer that Phase 5's new-order flow will reuse)
- find a customer by name or phone
- see the automatic segments
- open a customer profile

**Important limit:** orders arrive in Phase 5 and payments in Phase 6. Every customer figure (order count, total spent, balance, last order) is **derived from those records and never stored** (CLAUDE.md §4). In Phase 4 the figures are honestly **0 or "—"**. The segment rules are built and unit-tested now, and get real data in Phase 5.

**Rules:** verification follows D-106. No Git, no migrations run by me, no package installs.

---

## 0. Decisions recorded on approval
| ID | Decision | Resolves |
|---|---|---|
| D-114 | **VIP = the top third of customers by total spent (spent > 0)**. This is the prototype's rule: the cut-off is the spend of the customer at rank ⌈n × 0.34⌉. No fixed amount is invented, and the rule adapts as the business grows. It lives in one `CustomerSegmentPolicy`, so it is easy to change later | OQ-030 |
| D-115 | **Segment counting:** order count = non-cancelled orders (returned orders still count). "Last order" = the created date of the latest non-cancelled order. **New** = ≤ 2 orders. **Dormant** = has ordered, and the last order was more than 14 days ago (business time zone); a customer who never ordered is "New", not "Dormant". **Owes money** = balance > 0. A customer can be in **several segments at once** | OQ-031 |
| D-116 | **Mobile:** optional. Stored normalized to E.164: Jordanian input `07XXXXXXXX`, `7XXXXXXXX`, `9627…` or `+9627…` becomes `+9627XXXXXXXX`; other `+<country>` numbers are accepted. **Unique per business when present** (archived customers included). A duplicate returns 409 `customer.duplicate_phone` with the existing customer's name, so the merchant can open them instead | OQ-032 |
| D-117 | **City** = optional choice from the **12 Jordanian governorates** (codes `amman, irbid, zarqa, balqa, mafraq, jerash, ajloun, madaba, karak, tafilah, maan, aqaba`). **Area** = optional free text (≤ 100). They are shown together as «عمّان · خلدا», as in the prototype | OQ-033 |
| D-118 | **Customer fields:** name (required, ≤ 100), mobile, channel (required, one of the 4 sales channels, D-022; it defaults to the first channel enabled in settings), city, area, notes (≤ 500). Customers are **archived and restored, never hard-deleted** (same policy as D-100) | PRD M6 |
| D-119 | The prototype's **"WhatsApp" button on the profile is not built**: WhatsApp sharing is out of V1 scope (R-001) | R-001 |

---

## 1. Backend tasks (run together after `Backend`)
| ID | Task | Key details |
|---|---|---|
| 4.A1 | **Customer aggregate + phone rules** | `Lamma.Domain/Customers/Customer.cs` (IBusinessOwned, timestamps, archive/restore, field limits). `PhoneNumber.Normalize` returns E.164 or a domain error (D-116). `JordanGovernorate` enum (D-117). `SalesChannel` reused |
| 4.A2 | **`CustomerSegmentPolicy`** (pure, Domain) | Input: `CustomerStats(OrderCount, TotalSpent, BalanceDue, LastOrderAt)` plus today and the VIP cut-off. Output: the set of segments `vip, owes, new, dormant` (D-114, D-115). Also `VipCutoff(IEnumerable<spent>)` |
| 4.A3 | **CRUD service + API** | `GET customers` (search by name or phone with digit normalization; `segment=vip\|owes\|new\|dormant`; `archived`; sort by `-spent`, `name` or `-createdAt`; paging ≤ 100). `GET customers/summary` (total, active this month, average spent, total due, count per segment). `GET customers/{id}` (profile: fields, stats, segments). `POST customers` (201; also used by quick add). `PUT customers/{id}`, `POST customers/{id}/archive` and `/restore`. Errors: 409 `customer.duplicate_phone` (detail names the existing customer, and the body carries `existingCustomerId`), 404 for another business, 422 field errors |
| 4.A4 | **Stats in one place + checkpoint** | One query component projects `CustomerStats` per customer. **In Phase 4 it yields zero / null**, because no orders exist yet. Phase 5 replaces only this projection with order aggregates, and the segment filters are SQL expressions over it. Wiring and docs. **Migration `AddCustomers`** |

**Focused tests (D-106), one full run at the end:**
- Domain: phone normalization (valid and invalid Jordanian and international formats), every segment boundary (2 vs 3 orders, 14 vs 15 days, never ordered, VIP cut-off with ties and with zero spend), field limits.
- Integration: create/update/archive, duplicate phone 409 (in different formats of the same number), search by phone, tenant isolation (404), summary counts.

## 2. Frontend tasks (run together after `Frontend`)
New feature `features/customers`. Edges: `customers → auth, settings` (settings for the channel labels and the default channel). Its public API exports `QuickAddCustomerDrawer` for Phase 5.

| ID | Task |
|---|---|
| 4.B1 | **Customers list** `/customers` (prototype `#/customers`): 3 metric cards (`MetricCard`), "أهم الزباين" strip (hidden while nobody has spent), segment rail (`srail`/`sopt`) with server counts, search by name or number, table (ring avatar, channel icon, city, tags, orders, spent, last order, balance), paging |
| 4.B2 | **Customer profile** `/customers/:id` (prototype `chero`): avatar ring, channel, phone (LTR), city · area, last order, segment tags, 4 metrics (orders, spent, average order, balance due). The orders and payments sections show empty states ("بتظهر الطلبات هون من أول طلب"), filled by Phases 5 and 6. Actions: edit (drawer), archive/restore. "طلب جديد إلها" is disabled «قريبًا» (Phase 5) |
| 4.B3 | **Quick-add drawer** (prototype `App.addCustomer`): name, phone with a +962 prefix, channel chips, governorate select + area, notes. The duplicate-phone 409 shows "هاد الرقم مسجّل لـ X" with a link to that customer. Opened from the list, from `/customers/new`, and from the topbar/quick-add "عميل" entries. Exported for Phase 5 |
| 4.B4 | **Checkpoint (D-106)**: `tsc`, `lint`, `check:architecture`, `build`, logic unit tests (phone display/normalization helper, segment tag labels); remove `customers` and `customers/new` from the coming-soon list; **manual checklist** for the founder. STOP |

## 3. Database (migration `AddCustomers`; the founder runs it)
- `Customers` table:
  - `Id`, `BusinessId` (FK Restrict)
  - `Name nvarchar(100)`, `PhoneE164 varchar(16) null`, `Channel varchar(32)`, `City varchar(32) null`, `Area nvarchar(100) null`, `Notes nvarchar(500) null`
  - `IsArchived`, `CreatedAt`, `UpdatedAt`
- **Unique `(BusinessId, PhoneE164)` filtered `WHERE PhoneE164 IS NOT NULL`**.
- Index `(BusinessId, Name)`.
- Tenant filter and write guard.

```bash
dotnet ef migrations add AddCustomers --project src/Lamma.Infrastructure --startup-project src/Lamma.Api --output-dir Persistence/Migrations -- --environment Development
```
```bash
dotnet ef database update --project src/Lamma.Infrastructure --startup-project src/Lamma.Api -- --environment Development
```

## 4. Security, performance, risks
- **Tenancy:** another business's customer returns 404. Phone uniqueness is scoped per business, so two businesses can store the same customer.
- **Privacy:** phone numbers are personal data. They are not written to the logs (the request log already logs no bodies) and appear only to the owning business.
- **Performance:** the list is a projection with paging, phone search uses the unique index, name search is a `LIKE` on the indexed column.
- **Risk: the segments look empty until orders exist.** Mitigation: the list shows real zeros (no invented numbers), and the rules are unit-tested now.

## 5. Docs
- DECISIONS D-114…D-119.
- OPEN-QUESTIONS: OQ-030…033 resolved.
- API-DESIGN §14.
- DATABASE-DESIGN §12d.
- PRD M6.
- PHASE-PLANS: Phase 4 gates, and the plan saved as `docs/roadmap/PHASE-4-PLAN.md`.
- PROJECT-PROGRESS.
- FRONTEND-ARCHITECTURE: the customers feature and its edges.

## 6. Verification (D-106)
- **Backend:** build with 0 warnings, focused tests per task, **one** full `dotnet test` run, and a gate-4 report with the migration commands.
- **Frontend:** `tsc`, `eslint`, `check:architecture`, `vitest` (the existing 78 tests plus the logic tests), `build`.
- **Founder's checklist:**
  - add customers through all 3 entry points
  - the same phone typed in another format → duplicate message with a link
  - search by name and by number
  - segments rail (everyone is "New" until Phase 5)
  - profile and edit
  - archive and restore
  - widths 1440/1024/768/390, RTL
