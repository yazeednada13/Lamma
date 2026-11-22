# Phase 9 Plan — Dashboard (Approved 2026-11-22)

## Context
Phase 8 is merged and the founder created the Phase 9 branch (`feature/phase9-dashboard`). Phase 9 was blocked by OQ-080, OQ-082 and OQ-083. The answers are below as D-153…D-158; the founder approved the plan, and with it these decisions. The dashboard from Phase 1 is a placeholder; this phase replaces it with the reference's «لمّة اليوم».

**Outcome:** one screen with the business journey (products → new orders → preparing → courier → delivered → customers → profit), this month's net profit against the same days of last month, a 14-day sales and profit chart, metric cards, «يحتاج انتباهك», sales by channel, top products, latest orders, recent activity, and sidebar counters.

**Out of this phase:** the notifications bell and Ctrl K search (D-155, D-156); the full reports (Phase 10).

**Rules:** D-106 lean verification; no Git, no migrations by Claude, no package installs. Figures reuse D-030, D-034, D-124, D-144, D-149.

---

## 0. Decisions recorded on approval
| ID | Decision | Resolves |
|---|---|---|
| D-153 | **Dashboard periods** (Asia/Amman): the profit hero and cards cover **this month to date**, compared with **the same days of last month**; the chart covers **the last 14 days by delivery date**. With no earlier period, the UI says «ما في فترة سابقة للمقارنة» | OQ-080 |
| D-154 | **The journey** counts **open orders by stage now** (not only today's): new, preparing (confirmed + preparing), with the courier; plus products (and how many are low), delivered this month, and customers who bought this month | OQ-080 |
| D-155 | **Notifications bell: not in V1.** «يحتاج انتباهك» covers the need; the bell stays «قريبًا» | OQ-082 |
| D-156 | **Ctrl K search: not in V1** (may return in Phase 12); the search button stays «قريبًا» | OQ-083 |
| D-157 | **Dashboard figures use the finance-overview definitions** (D-144, D-149): profit = net profit, sales = sales after returns. **«يحتاج انتباهك»** in this order: orders waiting to be prepared (with the oldest), new orders to confirm, up to 2 low or out-of-stock products, money with the courier, the customer who owes the most. **«ملاحظة لمّة»** is rule-based (top channel, top product, best weekday), no AI | new |
| D-158 | **Sidebar counters:** new orders on «الطلبات», low and out-of-stock on «المخزون», a dot on «العملاء» when anyone owes money; refreshed on navigation | new |

---

## 1. Backend tasks (run together after `Backend`)
| ID | Task | Key details |
|---|---|---|
| 9.A1 | **`GET dashboard`** (one endpoint, SQL aggregation) | Hero (net profit to date + % change), journey (D-154), cards (sales after returns + change, open orders count and value, cash received, receivables), 14-day series (sales and gross profit per day), «يحتاج انتباهك» (D-157), sales by channel this month, top 4 products (revenue and quantity), latest 4 orders, latest 5 events (orders, stock movements, expenses), insight data, trial days left, an empty-account flag |
| 9.A2 | **`GET dashboard/indicators`** | Light query: `newOrders`, `lowStock`, `hasDues` |
| 9.A3 | **Performance** | Query plan and indexes on a dataset of about 500 orders; record the number of queries and the timing; add an index only if needed (then a small migration) |
| 9.A4 | **Formula documentation** | API-DESIGN §19: how every figure is computed |
| 9.A5 | **Checkpoint** | Report; normally no migration |

**Focused tests (D-106), one full run:** exact figures on a fixed dataset with a fixed clock (month to date, previous span, % change, returns inside the period); journey counts by stage; «يحتاج انتباهك» order and limit; series length and zero days; counters; empty account; tenant isolation.

## 2. Frontend tasks (run together after `Frontend`)
| ID | Task |
|---|---|
| 9.B1 | **Dashboard page**, the reference `#/dashboard` look: hero (greeting and date, summary sentence, net-profit card with change), journey with animation and links, quick actions, sales and profit chart, metric cards, «يحتاج انتباهك», channel donut, top products, latest orders, activity feed, «ملاحظة لمّة»; a new account shows the reference `#/dashboard-new` (3-step checklist) |
| 9.B2 | **Sidebar counters** on «الطلبات» and «المخزون», dot on «العملاء» |
| 9.B3 | **Checkpoint (D-106):** checks, logic tests (% change, chart scales, summary sentence), manual checklist. STOP |

**Deviations from the reference:** no «N» shortcut hint on «طلب جديد» (nothing makes it work); the bell and search stay «قريبًا»; every number is real (the reference uses fixed ones).

## 3. Database
No migration expected. An index is added only if 9.A3 shows it is needed; its migration name would be in the gate-4 report.

## 4. Risks
- **Performance:** many figures in one request; SQL projections with existing indexes, measured in 9.A3.
- **Figures disagreeing between screens:** the dashboard reuses the finance-overview calculations, so no number is computed two ways.

## 5. Docs
DECISIONS D-153…D-158 · OPEN-QUESTIONS OQ-080, OQ-082, OQ-083 resolved · API-DESIGN §19 · PRD M2 rows · PHASE-PLANS gates · PROJECT-PROGRESS · FRONTEND-ARCHITECTURE.

## 6. Verification (D-106)
- **Backend:** build with 0 warnings, focused tests, **one** full `dotnet test` run, gate-4 report.
- **Frontend:** `tsc`, `eslint`, `check:architecture`, `vitest`, `build`.
- **Founder's checklist:** dashboard figures match the finance overview for the same month; journey stages and links; «يحتاج انتباهك» order; 14-day chart; new account shows the checklist; sidebar counters change after a new order; widths and RTL.
