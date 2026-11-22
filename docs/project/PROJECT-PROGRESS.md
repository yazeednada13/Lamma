# Project Progress — Lamma

**This is the single source of truth for where the project stands.** Update it only with verified facts, and update phase or merge status only after the founder confirms.

## Current position
| Item | Value |
|---|---|
| Current phase | **Phase 11: Subscription, platform admin & public sign-up** (branch `feature/phase11-subscription-admin`) |
| Current gate | **Gate 6: Frontend checkpoint, part 11-I.** 11.B1–11.B3 implemented; checks pass; waiting for the founder's manual check ([PHASE-11-PLAN.md](../roadmap/PHASE-11-PLAN.md) §6) |
| Git (founder-reported) | Phase 0 merged into `develop` (`0034166`). Phase 1 (`feature/phase1-foundation`) pushed and merged into `develop` (2026-11-17). Phase 2 (`feature/phase2-catalog`) merged into `develop` (2026-11-18). Phase 3 (`feature/phase3-inventory`) merged into `develop` (2026-11-20). Phase 4 (`feature/phase4-customers`) merged (2026-11-20). Phase 5 (`feature/phase5-orders`) merged (2026-11-21). Phase 6 (`feature/phase6-payments`) merged (2026-11-21). Phase 7 (`feature/phase7-courier-expenses`) merged (2026-11-21). Phase 8 (`feature/phase8-returns-preorders`) merged (2026-11-22). Phase 9 (`feature/phase9-dashboard`) merged (2026-11-22). Phase 10 (`feature/phase10-reports`) merged (2026-11-22) |
| Migrations | `InitialIdentityAndBusiness`, `AddCatalog`, `AddInventory`, `AddCustomers`, `AddOrders`, `AddPayments`, `AddCourierAndExpenses`, `AddReturnsAndPreOrders`, `AddSignupLeads` applied by the founder (verified read-only in `Lamma_Dev`) |
| Next expected founder action | Run the 11-I manual checklist, push the frontend, then the 11-I PR (or continue to 11-II on the same branch) |

## Phase 0 tasks
| ID | Task | Status | Output |
|---|---|---|---|
| 0.1 | Repository inspection | Done (verified 2026-11-10) | Phase 0 report §1, LOCAL-DEVELOPMENT.md |
| 0.2 | Frontend audit | Done | `docs/architecture/FRONTEND-AUDIT.md` |
| 0.3 | Product analysis | Done | `docs/product/PRD.md` |
| 0.4 | Architecture planning | Done (proposal) | `MASTER-ARCHITECTURE.md`, `FRONTEND-ARCHITECTURE.md`, `API-DESIGN.md` |
| 0.5 | Database planning | Done (proposal) | `DATABASE-DESIGN.md` |
| 0.6 | Master roadmap | Done (draft) | `MASTER-ROADMAP.md`, `PHASE-PLANS.md` |
| 0.7 | Project documentation | Done | `CLAUDE.md`, `docs/**` |
| 0.8 | Open decisions | Done | `OPEN-QUESTIONS.md` |

## Phase overview
| Phase | Status |
|---|---|
| 0 Discovery & planning | **Merged into develop (founder-reported 2026-11-10)** |
| 1 Foundation | **Merged into develop (founder-reported 2026-11-17)** |
| 2 Catalog | **Merged into develop (founder-reported 2026-11-18)** |
| 3 Inventory | **Merged into develop (founder-reported 2026-11-20)** |
| 4 Customers | **Merged into develop (founder-reported 2026-11-20)** |
| 5 Orders core | **Merged into develop (founder-reported 2026-11-21)** |
| 6 Payments & receivables | **Merged into develop (founder-reported 2026-11-21)** |
| 7 Courier & expenses | **Merged into develop (founder-reported 2026-11-21)** |
| 8 Returns & pre-orders | **Merged into develop (founder-reported 2026-11-22)** |
| 9 Dashboard | **Merged into develop (founder-reported 2026-11-22)** |
| 10 Reports | **Merged into develop (founder-reported 2026-11-22)** |
| 11 Subscription, platform admin & public sign-up (expanded, D-159) | **Part 11-I frontend done (2026-11-22); at gate 6** |
| 12 Hardening & launch | Pending |

## Resolved for Phase 1 (2026-11-10)
- .NET 9 (D-076)
- Identity cookie auth (D-077)
- Email-only sign-up and recovery (D-078)
- BusinessMembership (D-079)
- 2-decimal money display (D-080)
- Spec onboarding order with a single business type (D-081)
- FluentValidation (D-082)

## Still open during Phase 1
- Email provider for password recovery (until it is chosen, a dev-only log sender is used).

## Test results log
| Date | Scope | Result |
|---|---|---|
| 2026-11-10 | Phase 1 backend: `dotnet build Lamma.sln` | 0 warnings, 0 errors |
| 2026-11-10 | Phase 1 backend: `dotnet test Lamma.sln` (LocalDB) | **128 passed, 0 failed**: Domain 29, Application 39, Infrastructure 10, Architecture 8, API integration 42 |
| 2026-11-10 | Phase 1 frontend: `tsc -b`, `eslint .`, `vite build` | all clean (JS 555 kB / 170 kB gzip) |
| 2026-11-10 | Phase 1 frontend: `vitest run` (jsdom + MSW, StrictMode) | **47 passed, 0 failed** |
| 2026-11-10 | Backend re-run after frontend work: `dotnet test Lamma.sln` | 128 passed, 0 failed |
| 2026-11-10 | Real-API end-to-end check in the browser (Vite dev + API + `Lamma_Dev`) | signup → onboarding → dashboard → settings save → logout → forgot (dev log link) → reset (reused link rejected) → login: all passed. Widths 1440/1024/768/390: layout per breakpoints, no horizontal scroll, RTL |
| 2026-11-17 | Frontend restructure (D-089): `tsc -b`, `eslint .`, `npm run check:architecture` | all clean; 125 files, 0 layer violations, 0 cycles |
| 2026-11-17 | Frontend restructure: `vitest run` | **50 passed, 0 failed** across 17 test files (47 previous + 3 new trial tests) |
| 2026-11-17 | Frontend restructure: `vite build` | CSS byte-identical (132.24 kB); JS 557 kB |
| 2026-11-17 | Frontend restructure: real-API end-to-end check | signup → onboarding → dashboard → settings save → name change → logout → login passed; all 19 sidebar links resolve; 1440 and 390 layouts correct, RTL, no horizontal scroll |
| 2026-11-17 | Phase 2 backend: `dotnet build Lamma.sln` | 0 warnings, 0 errors |
| 2026-11-17 | Phase 2 backend: `dotnet test Lamma.sln` (LocalDB) | **222 passed, 0 failed**: Domain 71, Application 58, Infrastructure 19, Architecture 8, API integration 66 (94 new) |
| 2026-11-18 | Phase 2 frontend: `tsc -b`, `eslint .`, `npm run check:architecture` | all clean; 165 files, 0 violations, 0 cycles |
| 2026-11-18 | Phase 2 frontend: `vitest run` (jsdom + MSW, StrictMode) | **73 passed, 0 failed** across 23 files (23 new); stable over 3 consecutive full runs |
| 2026-11-18 | Phase 2 frontend: `vite build` | OK; JS 613 kB (186 kB gzip) |
| 2026-11-18 | Phase 2 real-API browser check (Vite + API + `Lamma_Dev`) | category create → product with size matrix and opening stock → details (stock map, variants, opening movements) → variant price override → edit adds a size with opening stock → list with price range; settings templates section loads; widths 1440/1024/768/375 without horizontal scroll, RTL |
| 2026-11-18 | Phase 3 backend: `dotnet build` / `dotnet test Lamma.sln` (one full run, D-106) | 0 warnings; **246 passed, 0 failed**: Domain 88, Application 58, Infrastructure 19, Architecture 8, API integration 73 (24 new) |
| 2026-11-18 | Phase 3 frontend: `tsc -b`, `eslint .`, `check:architecture`, `vite build` | all clean; 178 files, 0 violations, 0 cycles |
| 2026-11-18 | Phase 3 frontend: `vitest run` | **78 passed, 0 failed** (24 files; 5 new logic tests) |
| 2026-11-20 | Phase 3 manual browser check by the founder (D-106 checklist, 21 cases on the real API: summary, receive incl. double-submit, weighted cost, adjust rules, movement filters, low/out, expiry rule, 4 widths, RTL) | **21/21 passed** |
| 2026-11-20 | Phase 5 frontend: `tsc -b`, `eslint .`, `check:architecture`, `vite build` | all clean; 216 files, 0 violations, 0 cycles |
| 2026-11-21 | Phase 5 manual browser check by the founder (21 cases on the real API, 4 widths, RTL) | **All passed** after two review fixes: skip-ahead moves in the order menu (D-121), and no rectangular focus ring on fields inside `.control` |
| 2026-11-20 | Phase 5 frontend: `vitest run` | **92 passed, 0 failed** (28 files; 9 new logic tests: receipt math, order rules, Amman date presets, form model) |
| 2026-11-20 | Phase 4 backend: `dotnet build` / `dotnet test Lamma.sln` (one full run, D-106) | 0 warnings; **274 passed, 0 failed**: Domain 111, Application 58, Infrastructure 19, Architecture 8, API integration 78 (28 new) |
| 2026-11-20 | Phase 4 frontend: `tsc -b`, `eslint .`, `check:architecture`, `vite build` | all clean; 187 files, 0 violations, 0 cycles |
| 2026-11-20 | Phase 4 frontend: `vitest run` (after the review fixes) | **83 passed, 0 failed** (5 new: customer logic + shared confirmation dialog) |
| 2026-11-20 | Phase 4 manual browser check by the founder (D-106) | Approved after two review fixes: duplicate-phone notice card; unified confirmation dialog (D-120) |
| 2026-11-20 | Phase 5 backend: `dotnet build` / `dotnet test Lamma.sln` (one full run, D-106) | 0 warnings; 350 passed, 1 failed (architecture rule: public `init` setters on two Domain records). Fixed; Architecture 8/8 and Order domain 69/69 re-run green → **351 passing** (Domain 180, Application 58, Infrastructure 19, Architecture 8, API integration 86; 77 new) |
| 2026-11-21 | Phase 6 backend: `dotnet build` / `dotnet test Lamma.sln` (one full run, D-106) | 0 warnings; **382 passed, 0 failed**: Domain 206, Application 58, Infrastructure 19, Architecture 8, API integration 91 (31 new: 26 payment rules, 5 payment API) |
| 2026-11-21 | Phase 6 frontend: `tsc -b`, `eslint .`, `check:architecture`, `vite build` | all clean; 228 files, 0 violations, 0 cycles; JS 738 kB (216 kB gzip) |
| 2026-11-21 | Phase 6 frontend: `vitest run` | **101 passed, 0 failed** (29 files; 9 new payment logic tests) |
| 2026-11-21 | Phase 7 backend: `dotnet build` / `dotnet test Lamma.sln` (one full run, D-106; built to a separate output folder because the founder's API was running) | 0 warnings; 392 passed, 1 failed (architecture rule: a positional record in Domain). Fixed; Architecture 8/8 and Domain 212/212 re-run green → **393 passing** (Domain 212, Application 58, Infrastructure 19, Architecture 8, API integration 96; 11 new) |
| 2026-11-21 | Phase 7 frontend: `tsc -b`, `eslint .`, `check:architecture`, `vite build` | all clean; 239 files, 0 violations, 0 cycles; JS 769 kB (224 kB gzip) |
| 2026-11-21 | Phase 7 frontend: `vitest run` | **108 passed, 0 failed** (30 files; 6 new finance logic tests; 1 settings assertion flipped from «no expense section until Phase 7» to «present») |
| 2026-11-22 | Phase 8 backend: `dotnet build` / `dotnet test Lamma.sln` (one full run, D-106; separate output folder because the founder's API was running) | 0 warnings; **405 passed, 0 failed** (Domain 220, Application 58, Infrastructure 19, Architecture 8, API integration 100; 12 new) |
| 2026-11-22 | Phase 8 frontend: `tsc -b`, `eslint .`, `check:architecture`, `vite build`, `vitest run` | all clean; 0 violations, 0 cycles; **113 passed, 0 failed** (31 files; 5 new logic tests: return math like the server, calendar cells, 30% deposit); JS 784 kB (228 kB gzip) |
| 2026-11-22 | Phase 9 backend: `dotnet build` / `dotnet test Lamma.sln` (one full run, D-106) | 0 warnings; **416 passed, 0 failed** (Domain 220, Application 66, Infrastructure 19, Architecture 8, API integration 103; 11 new incl. the opt-in perf test) |
| 2026-11-22 | Phase 9 dashboard performance (500 orders, LocalDB) | median 866 ms → **138 ms** after computing channels and top products once; indicators ~115 ms; no index needed |
| 2026-11-22 | Phase 9 frontend: `tsc -b`, `eslint .`, `check:architecture` (248 files, 0 violations, 0 cycles), `vite build` (JS 808 kB, 234 kB gzip), `vitest run` | all clean; **119 passed, 0 failed** (32 files; 7 new dashboard logic tests; the test-only fake API gained the two dashboard handlers) |
| 2026-11-22 | Phase 10 backend: focused tests (Application 19, Infrastructure 5, API 6) | all passed |
| 2026-11-22 | Phase 10 backend: `dotnet build` / `dotnet test Lamma.sln` (one full run, D-106) | 0 warnings; **447 passed, 0 failed** (Domain 220, Application 85, Infrastructure 24, Architecture 8, API integration 110) |
| 2026-11-22 | Phase 10 report performance (500 orders, 366-day range, LocalDB, opt-in `ReportPerfTests`) | medians: summary 101 ms, P&L 28 ms, sales 18 ms; no index needed |
| 2026-11-22 | Phase 10 frontend: `tsc -b`, `eslint .`, `check:architecture` (269 files, 0 violations, 0 cycles), `vite build`, `vitest run` | all clean; **129 passed, 0 failed** (34 files; new: reports domain 9, shared chart math 2 moved from the dashboard) |
| 2026-11-22 | «test all» re-run after the checklist fixes: `dotnet test Lamma.sln`; frontend `tsc -b`, `eslint .`, `check:architecture`, `vitest run`, `vite build` | backend **447 passed, 0 failed**; frontend all clean, **130 passed, 0 failed** (34 files; +1 axis-label test) |
| 2026-11-22 | Phase 11-I backend: focused tests (Domain 10, Application 5, API 4) | all passed |
| 2026-11-22 | Phase 11-I backend: `dotnet build` / `dotnet test Lamma.sln` | 0 warnings; **466 passed** (Domain 230, Application 90, Infrastructure 24, Architecture 8, API 114) after one fix (the `Utm` type broke the no-public-setters rule); the API project also showed 1 intermittent pre-existing failure (Phase 7 category race) in 1 of 3 isolated runs |
| 2026-11-22 | Phase 11-I frontend: `tsc -b`, `eslint .`, `check:architecture` (277 files, 0 violations, 0 cycles), `vite build`, `vitest run` | all clean; **136 passed, 0 failed** (36 files; new: sign-up domain 4, landing 2, register 3; the open sign-up tests replaced; the api-client error test now uses `/auth/register`) |
| 2026-11-10 | API smoke run (Development, https 7101) | /health 200; anonymous /account → 401 ProblemDetails; POST without CSRF → 400; OpenAPI lists 13 paths |

## Change log
| Date | Entry |
|---|---|
| 2026-11-10 | Phase 0 documentation created (docs only; no code, Git, migrations, or installs) |
| 2026-11-10 | Founder reported the Phase 0 merge; P0 decisions recorded; Phase 1 at gate 1 |
| 2026-11-10 | Founder created `feature/phase1-foundation`; Phase 1 at gate 2 |
| 2026-11-10 | Phase 1 plan approved (D-086); decisions D-083–D-085 recorded |
| 2026-11-10 | D-087 recorded (all tasks of a part run together) |
| 2026-11-10 | Phase 1 Backend 1.A1–1.A14 implemented and verified; waiting at gate 4 |
| 2026-11-10 | Backend pushed and migration applied (founder); D-088 recorded |
| 2026-11-10 | Phase 1 Frontend 1.B1–1.B12 implemented and verified; waiting at gate 6 |
| 2026-11-17 | Frontend restructured into the feature-based architecture (D-089, plan approved by the founder); no UI, behaviour or route changes |
| 2026-11-17 | Founder pushed the Phase 1 frontend and merged the Phase 1 PR into `develop`; Phase 1 closed |
| 2026-11-17 | Founder created `feature/phase2-catalog`, accepted the recommended answers to the Phase 2 questions, and approved the Phase 2 plan (D-090–D-105) |
| 2026-11-17 | Phase 2 Backend 2.A1–2.A10 implemented and verified; waiting at gate 4 |
| 2026-11-17 | Founder applied `AddCatalog` and pushed the backend; `Frontend` given |
| 2026-11-18 | Phase 2 Frontend 2.B1–2.B7 implemented and verified |
| 2026-11-18 | Founder pushed the Phase 2 frontend and merged the Phase 2 PR into `develop`; Phase 2 closed |
| 2026-11-18 | D-106 recorded (lean verification); founder created `feature/phase3-inventory`; Phase 3 at gate 2 |
| 2026-11-18 | Phase 3 plan approved (D-107–D-113) |
| 2026-11-18 | Phase 3 Backend 3.A1–3.A8 implemented and verified |
| 2026-11-18 | Founder applied `AddInventory` and pushed the backend; `Frontend` given |
| 2026-11-18 | Phase 3 Frontend 3.B1–3.B7 implemented; automated checks pass |
| 2026-11-20 | Founder's manual browser check passed (21/21) |
| 2026-11-20 | Founder pushed the Phase 3 frontend and merged the Phase 3 PR into `develop`; Phase 3 closed, at gate 8 |
| 2026-11-20 | Founder created `feature/phase4-customers`; Phase 4 plan approved and decisions D-114–D-119 recorded on the founder's confirmation; waiting at gate 3 |
| 2026-11-20 | Phase 4 Backend 4.A1–4.A4 implemented and verified |
| 2026-11-20 | Founder applied `AddCustomers` and pushed the backend; `Frontend` given |
| 2026-11-20 | Phase 4 Frontend 4.B1–4.B4 implemented; founder review → duplicate-phone notice redesigned and unified confirmation dialog added (D-120); approved |
| 2026-11-20 | Founder pushed the Phase 4 frontend and merged the Phase 4 PR into `develop`; Phase 4 closed, at gate 8 |
| 2026-11-20 | Founder created `feature/phase5-orders`, delegated the Phase 5 answers, and approved the Phase 5 plan (D-121–D-130); waiting at gate 3 |
| 2026-11-20 | Phase 5 Backend 5.A1–5.A9 implemented and verified; waiting at gate 4 (migration `AddOrders`) |
| 2026-11-20 | Founder applied `AddOrders` and pushed the backend; `Frontend` given |
| 2026-11-20 | Phase 5 Frontend 5.B1–5.B6 implemented; automated checks pass; waiting at gate 6 |
| 2026-11-21 | Founder's manual check passed (after two fixes) and the frontend was pushed; at gate 7 |
| 2026-11-21 | Founder pushed `feature/phase5-orders` and merged the Phase 5 PR into `develop`; Phase 5 closed, at gate 8 |
| 2026-11-21 | `Next Phase` given on `feature/phase6-payments`; Phase 6 plan approved (D-131–D-138, OQ-050…055 resolved); waiting at gate 3 |
| 2026-11-21 | Phase 6 Backend 6.A1–6.A7 implemented and verified; waiting at gate 4 (migration `AddPayments`) |
| 2026-11-21 | Founder applied `AddPayments` and pushed the backend; `Frontend` given |
| 2026-11-21 | Phase 6 Frontend 6.B1–6.B5 implemented; automated checks pass; waiting at gate 6 |
| 2026-11-21 | Live smoke test on the real API passed (aging, courier-held, drawer limits and methods, save, undo); founder pushed the frontend and merged the Phase 6 PR into `develop`; Phase 6 closed, at gate 8 |
| 2026-11-21 | `Next Phase` given on `feature/phase7-courier-expenses`; Phase 7 plan approved (D-139–D-144, OQ-060…063 resolved); waiting at gate 3 |
| 2026-11-21 | Founder-approved UX fix on receive stock (before Phase 7 Backend): visible labels «الكمية اللي وصلت» / «تكلفة القطعة (سعر الشراء)», live weighted-average cost preview (D-109) when the cost changes, unit cost on the receipt. Frontend only; `tsc`, `eslint`, `check:architecture` clean; inventory tests 6/6 (1 new) |
| 2026-11-21 | Phase 7 Backend 7.A1–7.A6 implemented and verified; waiting at gate 4 (migration `AddCourierAndExpenses`) |
| 2026-11-21 | Founder applied `AddCourierAndExpenses` and pushed the backend; `Frontend` given |
| 2026-11-21 | Phase 7 Frontend 7.B1–7.B5 implemented; automated checks pass; waiting at gate 6 |
| 2026-11-21 | Phase 7 smoke test on the real API (throwaway business): overview figures exact (sales 58, COGS 20, expenses 9, net 29, cash in 30, out 5, dues 12, courier-held 12); received > expected blocked; settlement drawer prefill, live difference notice, save and toast; expenses, courier and overview screens read correctly. Not covered: reversal from the UI, settings sections, widths |
| 2026-11-21 | Phase 7 checklist cases 10–21 run by Claude on the real API (founder request): partial settlement, reversal from the UI, settlement payment protected, period switch, ?add/?pay links, categories (locked delivery, add, duplicate, archive, restore), courier name, 375px no horizontal scroll: all passed. Two fixes from the founder review: deduction steps in the finance hero use white instead of the reference pink (app-additions.css); settlement payments show «من تسوية شركة التوصيل» and no cancel button. 768px not measured |
| 2026-11-21 | Founder approved the screens and pushed the Phase 7 frontend; at gate 7 |
| 2026-11-21 | Founder merged the Phase 7 PR into `develop`; Phase 7 closed, at gate 8 |
| 2026-11-21 | `Next Phase` given; Phase 8 plan approved (D-145–D-152, OQ-070…074 resolved); waiting at gate 3 |
| 2026-11-22 | Phase 8 Backend 8.A1–8.A5 implemented and verified (discount share rounded to 2 decimals so refunds can be exact); waiting at gate 4 (migration `AddReturnsAndPreOrders`) |
| 2026-11-22 | Founder applied `AddReturnsAndPreOrders` and pushed the backend; `Frontend` given |
| 2026-11-22 | Phase 8 Frontend 8.B1–8.B5 implemented; automated checks pass; waiting at gate 6 |
| 2026-11-22 | Phase 8 checklist (19 cases) run by Claude on the real API (founder request, throwaway business «متجر فحص 8»): all passed. Two fixes found and applied: the order payment card now uses the net total after a return (it showed the original total and a 69% ring); a fully returned order still owing its delivery fee can record a payment (the card had marked it closed). 768px not measured |
| 2026-11-22 | Founder asked for the Phase 8 PR; at gate 7 |
| 2026-11-22 | Founder merged the Phase 8 PR into `develop`; Phase 8 closed, at gate 8 |
| 2026-11-22 | `Next Phase` given; Phase 9 plan approved (D-153–D-158; OQ-080, OQ-082, OQ-083 resolved); waiting at gate 3 |
| 2026-11-22 | Phase 9 Backend 9.A1–9.A5 implemented and verified (no migration); waiting at gate 4 |
| 2026-11-22 | Founder pushed the Phase 9 backend; `Frontend` given |
| 2026-11-22 | Phase 9 Frontend 9.B1–9.B3 implemented; automated checks pass; waiting at gate 6 |
| 2026-11-22 | Phase 9 checklist run by Claude on the real API (test business «متجر فحص 8», background tab): dashboard figures equal the finance overview (net −4.00, net sales 4.00, cash 2.00); journey links; «يحتاج انتباهك» order; 14-day chart with «اليوم» last and hover tooltip; sidebar counters (new order 1 → 2 after navigation); 375 and 768 px without horizontal scroll: all passed. Case 5 (new account) covered by the automated tests only, to avoid switching the founder's browser session |
| 2026-11-22 | Founder tested, pushed and merged Phase 9 into `develop`; Phase 9 closed, at gate 8 |
| 2026-11-22 | Phase 11 expanded and its decisions recorded (D-159–D-167): landing page, invitation sign-up, read-only enforcement, CliQ with in-app proof, platform admin, prices, Brevo; domain still open (OQ-092) |
| 2026-11-22 | Founder created `feature/phase10-reports` and gave `Next Phase`; Phase 10 plan proposed (D-168–D-172 pending approval); waiting at gate 2 |
| 2026-11-22 | Phase 10 plan approved (D-168–D-172; OQ-081 resolved); `Backend` given |
| 2026-11-22 | Phase 10 Backend 10.A1–10.A6 implemented and verified (no migration); waiting at gate 4 |
| 2026-11-22 | Founder pushed the Phase 10 backend; `Frontend` given |
| 2026-11-22 | Phase 10 Frontend 10.B1–10.B4 implemented; automated checks pass; waiting at gate 6 |
| 2026-11-22 | Phase 10 checklist (13 cases) run by Claude on the real API (founder request «test all», throwaway businesses «متجر فحص 10» and «متجر فحص فاضي»): hub, P&L and sales figures equal the finance overview and the dashboard (net 32.40, net sales 62.40, return 19.60, COGS 24.00, stock value 448.00); period chips, URL, back button, custom range with its errors, loss waterfall, expected sales, month buckets, empty account, dashboard regression; 1440/1024/768/390 without page overflow: all passed after four fixes: «مقارنة بـ» wording; period changes now add a history entry so the back button returns to the previous period; axis labels no longer overlap the last one; weekday bars overflowed the page at 390 px and the waterfall was unreadable on phones (CSS overrides in `app-additions.css`) |
| 2026-11-22 | Founder pushed the Phase 10 frontend and asked for the PR; at gate 7 |
| 2026-11-22 | Founder merged the Phase 10 PR into `develop`; Phase 10 closed, at gate 8 |
| 2026-11-22 | Founder created `feature/phase11-subscription-admin` and gave `Next Phase`; Phase 11 plan proposed (D-173–D-181 pending approval); waiting at gate 2 |
| 2026-11-22 | Phase 11 plan approved (D-173–D-181); `Backend` given for part 11-I |
| 2026-11-22 | Phase 11-I Backend 11.A1–11.A7 implemented and verified; migration `AddSignupLeads` pending; waiting at gate 4. Found a pre-existing intermittent issue (Phase 7): three simultaneous first requests to expense categories can deadlock the default-category MERGE and one answers 500 (test `Categories_default_once…` failed 1 of 3 runs); not changed, proposed for Phase 12 |
| 2026-11-22 | Founder applied `AddSignupLeads` and pushed the 11-I backend; `Frontend` given |
| 2026-11-22 | Phase 11-I Frontend 11.B1–11.B3 implemented; checks pass; browser check on the real API: landing at 390/768/1024/1440 without overflow, form → lead saved → email file → `/register` (locked email, mismatch refused) → onboarding; one fix (a float card covered the slip's steps at 390 px); waiting at gate 6 |
| 2026-11-22 | Landing page redesigned after the founder's review (colors without pink/red, apricot accent, olive night and mist, more motion: gathering hero, business band, before/after switch, sticky feature phone, profit waterfall, pricing switch, confetti); checked in the browser at 390/768/1024/1440 without overflow; `tsc`, `lint`, `check:architecture` (280 files, 0/0), `vitest` **136 passed**, `vite build` clean |
| 2026-11-22 | Landing review 2: «قديش» replaced in the whole UI; hero stickers no longer overlap the card or the replay button; clearer customers line; tighter feature chapters; new order-journey motion scene with a live order card. Overlap measurements at 1440/1024/768/390 for every scene stage and the hero: none; no horizontal scroll; `tsc`, `lint`, `check:architecture` (281 files, 0/0), `vitest` **136 passed**, `vite build` clean |
