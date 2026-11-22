# Phase 10 Plan — Reports (Approved 2026-11-22)

## Context
Phase 9 is merged and the founder created the Phase 10 branch (`feature/phase10-reports`). The navigation already lists «مركز التقارير», «الأرباح والخسائر» and «المبيعات» as planned routes (`plannedRoutes.ts`). The reference screens are `#/reports`, `#/reports/pnl` and `#/reports/sales` (`frontend-reference/.../app/screens2.js`).

**Outcome:** a reports hub, a profit and loss page (period against the previous period, a profit waterfall, a ledger table, and a rule-based «شو تغيّر؟» explanation), and a sales report (by day, channel, weekday and product, with the average order value). All of them use one period picker: this month, last month, last 7 days, or a custom range (PRD M8).

**Out of this phase:** data export and printing (R-002), AI wording, the subscription work (Phase 11), and new expense or return rules.

**Rules:** D-106 lean verification. No Git, no migrations by Claude, no package installs. The money figures reuse the finance-overview definitions (D-030, D-034, D-144, D-148, D-149), so reports, the finance overview and the dashboard never disagree.

---

## 0. Decisions recorded on approval
| ID | Decision | Resolves |
|---|---|---|
| D-168 | **Report periods** (Asia/Amman, resolved on the server): «هالشهر» = the 1st of the month to today (default); «الشهر الماضي» = the whole previous month; «آخر 7 أيام» = today and the 6 days before; «مخصص» = from–to, inclusive, no future dates, at most 366 days. **Comparison period:** this month → the same days of last month (D-153); last month → the whole month before; last 7 days → the 7 days before; custom → the span of the same length just before. The period is kept in the URL (`?period=…&from=…&to=…`) | PRD M8 |
| D-169 | **P&L lines** = the finance overview for the period: sales (orders delivered in the period) − returns (by return date) = net sales; − COGS (restocked returns reduce it, damaged ones do not) = gross profit; − expenses by category (active, settlement differences included) = net profit. The label is «المرتجعات», because order discounts are already inside the order totals. «مبيعات متوقعة» (confirmed but not delivered) shows only when the period includes today | new |
| D-170 | **«شو تغيّر؟»** (resolves OQ-081): the % change for sales, COGS, expenses and net profit. For COGS and expenses, a rise is shown as bad. Then **one Arabic sentence built from rules**: the largest driver of the change in net profit, by absolute amount, among net sales, COGS and each expense category. For example: «صافي الربح زاد 120 د.أ، وأكبر سبب إن المبيعات زادت 200 د.أ». Ties go to sales, then COGS, then the largest category. With no earlier figure the page says «ما في فترة سابقة للمقارنة». No AI | OQ-081 |
| D-171 | **Sales report breakdowns**, all net of returns in the period. **By day:** daily buckets for spans up to 92 days, monthly buckets beyond. **By channel:** a return reduces the channel of its own order. **Best weekday:** within the selected period. **By product:** net pieces, revenue (line total minus its proportional share of the order discount, the same rule as D-148), and gross profit (revenue minus the cost of the net pieces; damaged returns keep their cost). The delivery fee is not part of any product. **Average order value** = net sales ÷ delivered orders. The 50 best products are shown, with the rest summed as «باقي المنتجات» | PRD M8 |
| D-172 | **Reports hub** (this month): P&L (net profit + 14-day spark), sales (net sales + spark), product performance (top product + bars), customers (count + avatars → `/customers`), stock value (Σ available pieces × the current effective cost → `/inventory`), courier (held money → `/finance/courier`) | PRD M8 |

---

## 1. Backend tasks (run together after `Backend`)
| ID | Task | Key details |
|---|---|---|
| 10.A1 | **Period resolution** | `ReportPeriod` in Application: preset or custom → (from, to, prevFrom, prevTo, bucket). Validation (from ≤ to, no future, ≤ 366 days) returns 422 ProblemDetails in Arabic with a field error (the project's validation status, `RequestValidationException`) |
| 10.A2 | **`GET reports/pnl`** | Two calls to `IFinanceQueries.OverviewAsync` (current and previous), the % changes, the driver from D-170 (code + amounts; the UI writes the sentence), expenses by category for both periods, and expected sales when the period includes today |
| 10.A3 | **`GET reports/sales`** | SQL aggregation: buckets (sales and gross profit), channels, weekdays, products (D-171), delivered orders count, AOV, and the previous period's net sales, orders and AOV for comparison |
| 10.A4 | **`GET reports/summary`** | Hub figures (D-172) in one request; the series reuses the dashboard's daily-series query |
| 10.A5 | **Performance and docs** | Dataset of about 500 orders with a 366-day custom range; record the timings (target under 300 ms); add an index only if needed. Document every formula in API-DESIGN §20 |
| 10.A6 | **Checkpoint** | Report. No migration expected |

**Focused tests (D-106), one full run at the end:**
- Period resolution: 31 March → February; a leap year; January → December; last 7 days; custom (same day, future, more than 366 days, reversed).
- Exact P&L values on a fixed dataset with a fixed clock, including a partial return, a damaged return and a settlement expense.
- Driver choice and ties; no previous period.
- Channel and product figures net of returns, with the discount share (sum of products + delivery fees = sales).
- AOV with zero orders; daily against monthly buckets; tenant isolation.

## 2. Frontend tasks (run together after `Frontend`)
| ID | Task |
|---|---|
| 10.B1 | **`reports` feature:** API hooks, domain logic (driver sentence, bucket labels, % format) with unit tests, and a **period picker** (preset chips + a custom from–to popover in the Lamma style, kept in the URL) |
| 10.B2 | **Hub** `/reports`: the six cards of the reference, with spark, bars, avatars and art |
| 10.B3 | **P&L** `/reports/pnl`: hero (net profit, flow steps from net sales to net), SVG waterfall (RTL; net in apricot, or red when it is a loss), ledger table, «شو تغيّر؟» with the sentence, expected-sales insight, and empty and loading states |
| 10.B4 | **Sales** `/reports/sales`: sales and profit area chart, channel donut with legend, weekday bars with «أقوى يوم», product performance (→ product page), plus a small row of cards: net sales, orders and AOV with their changes |
| 10.B5 | **Checkpoint:** `tsc`, `lint`, `check:architecture`, `vitest`, a production build, and a manual checklist (1440/1024/768/390, RTL) |

**Shared components:** the dashboard's `AreaChart` and `DeltaPill` move to `shared/ui/charts`, made business-agnostic (data in through props), so reports do not import from the dashboard feature (D-089). The dashboard then uses the shared versions.

**Deviations from the reference (reasons):**
- The reference has a fixed month with no period picker; the PRD requires periods.
- The sales report adds net sales, orders and AOV cards; the PRD requires AOV.
- «الخصومات والمرتجعات» becomes «المرتجعات», because discounts are already in the totals.
- The weekday bars cover the selected period instead of «كل الطلبات», so they match the page.
- The product list is capped at 50 rows, with the rest summed.

## 3. API contracts (summary; full shapes in API-DESIGN §20 during Backend)
- `GET /api/reports/summary` → hub figures for this month.
- `GET /api/reports/pnl?period=month|last_month|last_7_days|custom&from=&to=` → `{ period, previous, current: lines, previousLines, changes, driver, expensesByCategory, expectedSales? }`.
- `GET /api/reports/sales?period=…` → `{ period, previous, bucket: day|month, series[], channels[], weekdays[7], products[], otherProducts, orders, netSales, aov, previousNetSales, previousOrders, previousAov }`.
- Money is sent as 3-dp strings (P-005); errors are ProblemDetails.

## 4. Database
No schema change expected. The reports read Orders, OrderItems, OrderReturns, OrderReturnLines, Expenses and Payments through the existing indexes. If the performance step needs an index, it is reported with a migration name (`AddReportIndexes`) and the exact commands, and the founder applies it.

## 5. Security and performance
- Every query is tenant-filtered (EF global filters); no BusinessId comes from the client.
- The period is validated and capped at 366 days.
- Aggregation runs in SQL; there are no N+1 queries; requests are read-only with `AsNoTracking`.

## 6. Risks
- **Stock value** uses today's effective cost, not a historical cost. That is fine for a "value now" card, and the card says so.
- **Product revenue with the discount share** needs careful rounding so the products and delivery fees add up exactly to sales. It is covered by a test.
- **Long custom ranges** carry a performance risk, covered by 10.A5.

## 7. Documentation updates
API-DESIGN §20, DECISIONS (D-168–D-172; OQ-081 resolved), PHASE-PLANS gate table, PROJECT-PROGRESS, FRONTEND-ARCHITECTURE (charts moved to shared), and FRONTEND-AUDIT parity notes for routes 26–28.

---

## 8. Frontend manual checklist (gate 6, D-106)
Run against the real API with a business that has delivered orders, a return and expenses. Check at widths 1440, 1024, 768 and 390, in RTL.

| # | Scenario | Expected |
|---|---|---|
| 1 | Open «التقارير» from the sidebar | `/reports` shows six cards (P&L, sales, product performance, customers, stock value, delivery), each with its preview; each card opens its page |
| 2 | Hub figures | P&L and sales cards equal «نظرة مالية» for this month (net profit, net sales); delivery equals the courier page's held money |
| 3 | `/reports/pnl` default | «هالشهر» selected; hero, flow steps, waterfall and ledger agree (net sales − COGS − expenses = net); the subtitle names this month and last month |
| 4 | «شو تغيّر؟» | Delta pills for sales, COGS, expenses and net (a rise in costs is red); the sentence names the largest driver; a new account says «ما في فترة سابقة للمقارنة» |
| 5 | Period chips | «الشهر الماضي» and «آخر 7 أيام» change every figure and the URL; reloading keeps the period; the back button returns to the previous period |
| 6 | Custom range | «فترة مخصصة» opens the from–to panel; a reversed range, a future date or more than a year shows the reason; a valid range updates the page and the chip shows the range |
| 7 | A loss | With expenses above gross profit, the hero says «صافي الخسارة», the last waterfall bar is red and below the zero line |
| 8 | Expected sales | With confirmed orders not yet delivered, the «مبيعات متوقعة» note shows on periods that include today only |
| 9 | `/reports/sales` | Net sales, orders and AOV cards with deltas; area chart with tooltips («اليوم» on the last point); a range over 92 days shows month buckets |
| 10 | Channels and weekdays | Donut and legend with % and order counts; the best weekday is highlighted and named in the title |
| 11 | Product performance | Rows ranked by revenue, pieces, sales and profit after discount and returns; a row opens the product; the delivery-fee note shows when fees exist |
| 12 | Empty account | Every page loads without errors and shows the empty texts |
| 13 | Dashboard regression | The dashboard chart and delta pills look and behave as before (they now use the shared components) |
