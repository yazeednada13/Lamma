# Open Questions — Lamma

Each question needs a founder decision. Priority reflects **when the roadmap needs the answer**:
- **P0**: needed before Phase 1 planning is approved.
- **P1**: needed before the named phase starts.
- **P2**: needed late, at Phase 9 or later, or before launch.

When a question is answered, record the answer here, move the resulting decision into `DECISIONS.md` as Approved, and mark the question **Resolved**.

Entry format: **ID · Priority · Blocks**, then the context, the options, and the recommendation (if any).

---

## P0 — before Phase 1 (Foundation)

**OQ-001 · P0 · Blocks Phase 1: target .NET version**
- **Resolved (2026-11-10): .NET 9** (installed SDK 9.0.320; dotnet-ef 9.0.6 matches). Founder chose this over the 10 LTS recommendation. → D-076
- Context: installed SDKs are 7, 8, and 9 (9.0.320). .NET 9 is STS. .NET 10 is the current LTS (Nov 2025, supported until Nov 2028) and is not installed.
- Options: (a) .NET 10 LTS, after the founder installs the SDK; (b) .NET 9 on the installed SDK, with an upgrade later.
- Recommendation: **(a) .NET 10 LTS**. A commercial product should start on LTS. Installing the SDK is the founder's action.

**OQ-002 · P0 · Blocks Phase 1: authentication mechanism**
- **Resolved (2026-11-10): Option A, Identity cookie + antiforgery.** → D-077
- Options: (A) ASP.NET Core Identity cookie auth, with the SPA served from the same site; (B) JWT access token plus a rotating refresh-token cookie. MASTER-ARCHITECTURE §7 sets out the details and security trade-offs.
- Recommendation: **(A)**. It is simpler, it relies on built-in Identity security, it needs no token storage in JS, and CSRF is handled with SameSite plus an antiforgery header. Option B is worth it only if a native mobile app is planned soon.

**OQ-003 · P0 · Blocks Phase 1: sign-up and login identifier, verification, password recovery**
- **Resolved (2026-11-10): email only for V1** (email + password, recovery by email link). Mobile/SMS deferred. The email provider is still to be chosen (a dev log sender is used until then). → D-078
- Context: the spec says "mobile number **or** email". The prototype's sign-up asks only for name plus phone (+962) and says "we'll send you a verification code". Forgot-password says "we'll send a link to your phone". Login accepts a phone number or an email.
- Options:
  - (a) Email plus password in V1, with email recovery (needs an email provider).
  - (b) Mobile plus password, with SMS OTP verification and recovery (needs an SMS provider; recurring cost).
  - (c) Either identifier, with recovery through whichever was given.
  - (d) Mobile plus password **without** OTP verification at first, with recovery handled manually or by email. This is risky.
- Decide also: is verification mandatory before use? Which SMS or email provider (cost, vendor)?
- Recommendation: (c), with each recovery channel built only once a provider has been chosen. A provider decision is required either way.

**OQ-004 · P0 · Blocks Phase 1: User–Business relationship**
- **Resolved (2026-11-10): BusinessMembership table**, unique UserId in V1. → D-079
- Options: (a) a `BusinessMembership(UserId, BusinessId, Role)` table, unique on UserId in V1; (b) a `Business.OwnerUserId` foreign key.
- Recommendation: **(a)**. Future multi-user support then needs no schema change. V1 exposes no membership features.

**OQ-005 · P0 · Blocks Phase 1: money input and display precision**
- **Resolved (2026-11-10): 2 decimals for input and display**; storage and API stay at 3. → D-080
- Context: JOD has 3 decimals (fils). Storage will be `decimal(19,3)` either way. The prototype displays 2 decimals (`38.00`).
- Options: (a) input and display with 2 decimals, rejecting a third decimal (simplest for merchants); (b) the full 3 decimals everywhere; (c) display 2 and allow 3 on input.
- Recommendation: **(a) for V1 input and display**, keeping 3 dp in storage and the API so that rounding results such as averages stay exact.

**OQ-006 · P0 · Blocks the Phase 0 Git checkpoint: commit `frontend-reference/` to the repo?**
- **Partly resolved (2026-11-10):** the founder reports that the Phase 0 PR was merged into `develop`. Whether `frontend-reference/` was included is still to be confirmed.
- Context: it is currently untracked, at about 1.2 MB with fonts.
- Recommendation: **commit it**, so that every session and reviewer sees the same reference. It stays read-only.

**OQ-007 · P0 · Blocks Phase 1: onboarding steps and business-type multiplicity**
- **Resolved (2026-11-10): spec order, single business type** (name → type → channels). → D-081
- Context: the spec lists step 1 business name, step 2 business type, step 3 sales channels. The prototype instead runs step 1 business types (**multi-select**: "you can pick more than one type"), step 2 channels plus business name plus currency, step 3 done. Settings also shows two types selected.
- Options: (a) a single business type, with the step order from the spec; (b) multiple types, where the first chosen is the "primary" that drives the default template.
- Recommendation: **(a) single type, in the spec's order**. A product can already use any template, so multiple types add complexity for little gain.

---

## P1 — before Phase 2 (Catalog)

**OQ-010 · P1 · Phase 2: default-variant rule.** Proposed P-006: every product has ≥1 ProductVariant, so a simple product has one "default" variant, and stock and movements always live on variants. The alternative is stock on the product when it has no variants, which produces two code paths. Recommendation: approve P-006.

**OQ-011 · P1 · Phase 2: template catalogue and fields.**
- Context: the spec mentions Clothing, Perfume, Gifts, Jewelry, Beauty, and "others". The prototype maps types to 6 template "arts": clothing, perfume, beauty, jewelry, gift, other. Its example fields are clothing (fabric, gender category, cut, size × colour), perfume (size in ml), beauty (shade, expiry), jewelry (material, weight), gift (box, gift message).
- Needed: the exact template list, the fields for each one (name, type, required), which options generate variants, and the business-type → template mapping for all 13 types.

**OQ-012 · P1 · Phase 2: are templates system-defined or editable?** The spec says Settings includes "product templates" and "template fields", and the prototype shows "+ template / custom fields". Options: (a) system templates plus per-business custom fields added to a template; (b) fully custom templates per business. Recommendation: (a).

**OQ-013 · P1 · Phase 2: product image storage.** Options: local disk in development and blob storage (e.g. Azure Blob) in production behind `IFileStorage`. Decide the size limit (Proposed: 5 MB; jpg/png/webp), whether there is one image per product, and whether thumbnails are generated. This also depends on the hosting decision (OQ-086).

**OQ-014 · P1 · Phase 2: category deletion when products exist.** Options: (a) block the delete; (b) move the products to "uncategorized"; (c) archive the category. Recommendation: (a), showing the product count.

**OQ-015 · P1 · Phase 2: initial stock on product creation.** The prototype says "opening quantity is recorded automatically as a stock movement". Confirm that the movement type is `Receive` (or a new `Opening` type) and that it carries the product's cost.

## P1 — before Phase 3 (Inventory)

**OQ-020 · P1 · Phase 3: receive stock versus the "Purchases" expense (double counting).** ⚠
- Context: the prototype's receive screen has a checkbox "record it as a Purchases expense". The approved P&L (D-034) already deducts **COGS** when goods are sold. Recording purchases as an expense **as well** deducts the same cost twice.
- Options:
  - (a) Remove the checkbox. Purchases are inventory (an asset), not an expense, and only COGS hits P&L.
  - (b) Keep it as a cash-flow record only, excluded from P&L expenses.
  - (c) Treat purchases as expenses and drop COGS. This breaks D-034.
- Recommendation: **(a)**, or (b) if cash-outflow tracking is wanted. This is a business decision.

**OQ-021 · P1 · Phase 3: expiry granularity.** The spec gives one expiry date per product. The prototype's expiry screen shows **batches/lots** (B-2401: 8 pcs, B-2408: 18 pcs). Options: (a) one expiry per product or variant; (b) batch/lot tracking with an expiry per received batch, which needs FEFO decisions on sale. Recommendation: (a) for V1, unless lot tracking is a must-have.

**OQ-022 · P1 · Phase 3: cost update on receive.** When stock arrives at a different cost, does the product's cost become (a) the latest cost, (b) a weighted average, or (c) stay unchanged? COGS snapshots (D-032) depend on this. Recommendation: (b) weighted average.

**OQ-023 · P1 · Phase 3: adjustment reasons.** The prototype shows "Adjustment: damage". Proposed fixed list: damage, loss, count correction, other (with a note). Is negative on-hand stock ever allowed? Recommendation: never, and an adjustment cannot push Available below 0.

**OQ-024 · P1 · Phase 3: expiry warning window.** The prototype warns 60 days ahead. Confirm the value and whether it is configurable.

## P1 — before Phase 4 (Customers)

**OQ-030 · P1 · Phase 4: VIP thresholds.** Spend ≥ X JOD **and/or** ≥ Y delivered orders. Values are needed (the prototype has none).

**OQ-031 · P1 · Phase 4: segment counting rules.** Do "New (≤ 2 orders)" and "Dormant (last order > 14 days)" count cancelled or returned orders? Is "last order" the created date or the delivered date? Can a customer be in several segments at once? Recommendation: count non-cancelled orders, use the created date, and allow multiple segments.

**OQ-032 · P1 · Phase 4: customer mobile uniqueness.** Is a mobile number unique per business, and is it required? Should the system warn about duplicates? Recommendation: optional, unique per business when present, normalized to E.164 (+962).

**OQ-033 · P1 · Phase 4: Jordan cities list.** Is City a free-text field or a fixed list (12 governorates plus major cities)? Recommendation: a fixed list for cities, free text for the area.

## P1 — before Phase 5 (Orders core)

**OQ-040 · P1 · Phase 5: status transition matrix.** ⚠ Proposed matrix, to approve or edit:

| From \ To | new | confirmed | preparing | courier | delivered | cancelled | returned |
|---|---|---|---|---|---|---|---|
| new | – | ✓ | ✓? | ✗ | ✗ | ✓ | ✗ |
| confirmed | ✓? (back) | – | ✓ | ✓ | ✓? | ✓ | ✗ |
| preparing | ✗ | ✓ (back) | – | ✓ | ✓? | ✓ | ✗ |
| courier | ✗ | ✗ | ✓ (back) | – | ✓ | ✓ | ✗ |
| delivered | ✗ | ✗ | ✗ | ✗ | – | ✗ | ✓ |
| cancelled | ✗ | ✗ | ✗ | ✗ | ✗ | – | ✗ |
| returned | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | – |

Questions:
- Are backward moves allowed (other than Undo)? Can an order skip steps (e.g. confirmed → delivered)?
- Can a cancelled order be reopened?
- Can a courier order be cancelled, which would be a failed delivery?

**OQ-041 · P1 · Phase 5: Undo semantics.** ⚠
- Context: the prototype restores a snapshot of stock, which would wipe out any operation made in the meantime.
- Proposed P-009: Undo creates a **compensating transition** back to the previous status, with reverse movements and a status-log entry flagged "undo". It is allowed only (1) within N minutes (proposed: 5), (2) when it reverts the order's latest status change, and (3) when the reverse is still valid (e.g. undoing "delivered" needs the deducted stock to be restorable, which it always is; undoing "cancelled" needs enough Available to re-reserve).
- Needed: the window length, and whether Undo also applies to payments, expenses, and settlements (the prototype offers Undo on all of these).

**OQ-042 · P1 · Phase 5: order number format.** Proposed P-022: a sequential integer per business starting at 1001, shown as `#1001`. Alternatives: a prefix, or a yearly reset.

**OQ-043 · P1 · Phase 5: business timezone.** Proposed P-018: `Asia/Amman` (UTC+3) for "today", reporting days, and period boundaries.

**OQ-044 · P1 · Phase 5: delivery fee — revenue or pass-through?** ⚠
- Context: the order total includes the delivery fee (D-031). The prototype's "your profit from this order" computes `total − delivery − cost`, which treats the fee as a pass-through rather than profit. The prototype's sales figures include delivery.
- Options: (a) the delivery fee is revenue, and the courier's charges are a delivery expense; (b) the delivery fee is a pass-through, excluded from sales and profit.
- This affects Sales, Net Sales, and P&L, so a decision is required.

**OQ-045 · P1 · Phase 5: discount rules.** Is the discount a fixed amount per order only, or can it be a percentage or apply per line? May it exceed the subtotal? Recommendation: a fixed amount per order, between 0 and the item subtotal. (The prototype's total omits the discount, which is a prototype bug.)

**OQ-046 · P1 · Phase 5: order editing.** The prototype's order menu has "edit order", which the spec does not list. Can items or quantities change after confirmation, and how are reservations recalculated? Recommendation: allow edits only in `new` (and maybe `confirmed`, with re-reservation).

**OQ-047 · P1 · Phase 5: initial status on save.** The prototype lets the owner save as "new" or as "confirmed", with immediate reservation. Confirm both.

**OQ-048 · P1 · Phase 5: delivery address and gift fields on the order.** The prototype has an address field and a gift toggle with "recipient and gift message". The spec lists only the gift message. Confirm the extra fields: delivery address, recipient name, recipient phone.

**OQ-049 · P1 · Phase 5: cancellation reasons.** The prototype offers: customer changed their mind, no answer on the phone, product unavailable, other. Confirm the list, and say whether "other" takes free text.

## P1 — before Phase 6 (Payments)

**OQ-050 · P1 · Phase 6: customer-level payment allocation.** When a payment is recorded "against a customer", how is it allocated? (a) Automatically, oldest unpaid order first (FIFO); (b) manual allocation; (c) held as unallocated customer credit. Recommendation: (a), keeping the allocation records.

**OQ-051 · P1 · Phase 6: overpayment and credit.** Can a payment exceed the remaining amount? The prototype blocks it. Recommendation: block it in V1.

**OQ-052 · P1 · Phase 6: payment status source.** Proposed P-012: derived from the sum of payments versus the total, plus a COD-with-courier state. (The mock data is inconsistent: order 1039 has `pay: "paid"` but `paid: 0`.)

**OQ-053 · P1 · Phase 6: what counts as a receivable.** Customer receivables = Σ(total − paid) for which orders? Only delivered ones, or also confirmed or in-progress ones? Are courier-held amounts excluded from customer balances (the customer has paid the courier)? Recommendation: customer receivables cover delivered orders that are not fully paid and not courier-held. Courier receivables are tracked separately.

**OQ-054 · P1 · Phase 6: deposits on normal orders.** The prototype's payment step has "deposit" and "amount paid" options for any order. Are a deposit and a payment the same thing (a Payment recorded at creation)? Recommendation: yes. A deposit is just an early Payment.

**OQ-055 · P1 · Phase 6: payment date.** May the owner back-date payments? May payments be edited or deleted (with an audit trail), or only reversed? Recommendation: back-dating allowed; no edits; reversal only, through a reversing entry.

## P1 — before Phase 7 (Courier & Expenses)

**OQ-060 · P1 · Phase 7: courier companies.** Is there one courier company per business (the prototype shows one, "توصيل السريع"), or several? Is the courier assigned per order? Recommendation: support a list, defaulting to one, with a courier assigned to each COD order.

**OQ-061 · P1 · Phase 7: COD flow.** When a COD order is delivered, is its remaining amount automatically "held by courier"? Does the courier deduct its delivery fee before transferring? If so, is that deduction the settlement difference that becomes a delivery expense (D-035)?

**OQ-062 · P1 · Phase 7: settlement edge cases.** These cases need a decision:
- A partial settlement, covering a subset of orders.
- A received amount greater than expected (negative difference).
- Whether a settlement can be undone.

Recommendation:
- The owner selects the orders being settled.
- An overpayment is recorded as other income, or blocked.
- Undo is a reversal only.

**OQ-063 · P1 · Phase 7: default expense categories.** The prototype uses Ads, Delivery, Packaging, Rent, Purchases, Other. "Purchases" is linked to OQ-020. Can the owner add, rename, or delete categories? Is "Delivery" a system category that the settlement uses?

## P1 — before Phase 8 (Returns & Pre-orders)

**OQ-070 · P1 · Phase 8: full versus partial returns.** Can a single line, or part of a line's quantity, be returned? Recommendation: support line-level return quantities, with a full return as the special case of all lines.

**OQ-071 · P1 · Phase 8: refund handling.** The prototype's return dialog shows an editable "refunded amount" and a checkbox "return items to stock (good condition)". These need decisions:
- whether the refund is recorded as a Refund entity, which reduces cash received
- whether the refund can differ from the item value
- whether the delivery fee is refunded
- whether non-restocked (damaged) items create a write-off movement

**OQ-072 · P1 · Phase 8: return eligibility.** Can only delivered orders be returned? Is there a time window? Can an order be returned more than once (several partial returns)?

**OQ-073 · P1 · Phase 8: how returns affect revenue and COGS.** Returned value reduces Net Sales in the **return's** period, not the original delivery period. Is the COGS of restocked items reversed? Recommendation: yes on both counts.

**OQ-074 · P1 · Phase 8: pre-order rules.** The prototype shows pre-orders with a delivery date **and time**, a **daily capacity limit** ("4 orders/day"), and a **default deposit of 30%**. None of these are in the spec. Needed:
- Which products allow pre-order: a template flag, a product flag, or any out-of-stock product?
- Is the deposit required, as a fixed amount or a percentage?
- Does a pre-order reserve stock when stock arrives, or only on confirmation?
- Is a daily capacity limit in scope?
- Can a pre-order be cancelled after a deposit, and is the deposit refunded?

## P2 — later phases / launch

**OQ-080 · P2 · Phase 9: dashboard period semantics.** The prototype compares month-to-date against the same span of the previous month, and 7 days against the previous 7. Confirm. Is "today's order journey" limited to orders created today, or does it count all open orders by stage?

**OQ-081 · P2 · Phase 10: wording of the P&L "what changed" sentence.** Proposed: generated in Arabic from rules (the largest driver of change among sales, COGS, and each expense category). No AI.

**OQ-082 · P2 · Phase 9: notifications (bell).** The prototype has a bell menu and notification toggles in Account (new order, low stock, receivables reminder, trial ending). The spec doesn't list them. Options: (a) out of scope; (b) in-app notifications derived from the "Needs attention" data with no delivery channel. Recommendation: (b) at most, or defer.

**OQ-083 · P2 · Phase 9: command palette (Ctrl K) global search.** It appears in the prototype but not in the spec. Is it in scope? Recommendation: a simple search across orders, customers, and products, if approved.

**OQ-084 · P2 · Phase 12: offline drafts.** The offline screen promises that "the order you were writing is saved as a draft". Is this in scope? Recommendation: local draft persistence for the new-order form only, if approved.

**OQ-085 · P2 · Phase 11: subscription details.** These need decisions:
- Prices (undecided, D-010).
- The prototype shows **three** plans (monthly, yearly, two-year), but the spec says two. The recommendation is to follow the spec's two plans.
- A billing-invoices list.
- The payment gateway.
- Trial-expiration enforcement (D-011, not approved).

**OQ-086 · P2 · Phase 12: hosting and deployment target.** Azure App Service plus Azure SQL, a VPS with IIS or Kestrel, or other. This affects image storage, secrets management, and email/SMS providers.

**OQ-087 · P2 · Phase 1 FE: font rule.** `decisions.md` mentions Readex Pro digits in tables, while v2 uses tabular Inter. Confirm that v2 (IBM Plex Sans Arabic plus Inter) is authoritative for the UI. Recommendation: yes.

**OQ-088 · P2 · Phase 1: account extras in the prototype.** These appear in the prototype but not in the spec: "registered devices" management in Account, a profile photo, and a business logo upload. In scope? Recommendation: business logo only, or defer all three.

**OQ-089 · P2 · Legal: terms and privacy.** The prototype says "by creating an account you agree to the terms and privacy policy". Content and pages are needed before launch.
