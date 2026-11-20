# Project Progress — Lamma

**This is the single source of truth for where the project stands.** Update it only with verified facts, and update phase or merge status only after the founder confirms.

## Current position
| Item | Value |
|---|---|
| Current phase | **Phase 4: Customers, closed (merged into `develop`)** |
| Current gate | **Gate 8: Next phase.** Waiting for the founder's `Next Phase` to start Phase 5 (Orders core) planning |
| Git (founder-reported) | Phase 0 merged into `develop` (`0034166`). Phase 1 (`feature/phase1-foundation`) pushed and merged into `develop` (2026-11-17). Phase 2 (`feature/phase2-catalog`) merged into `develop` (2026-11-18). Phase 3 (`feature/phase3-inventory`) merged into `develop` (2026-11-20) |
| Migrations | `InitialIdentityAndBusiness`, `AddCatalog`, `AddInventory`, `AddCustomers` applied by the founder (verified read-only in `Lamma_Dev`) |
| Next expected founder action | Create the Phase 5 branch from the latest `develop` (stash/pop these doc updates), commit them, and write `Next Phase`; Phase 5 open questions OQ-040+ |

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
| 5 Orders core | Pending |
| 6 Payments & receivables | Pending |
| 7 Courier & expenses | Pending |
| 8 Returns & pre-orders | Pending |
| 9 Dashboard | Pending |
| 10 Reports | Pending |
| 11 Subscription (display) | Pending |
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
| 2026-11-20 | Phase 4 backend: `dotnet build` / `dotnet test Lamma.sln` (one full run, D-106) | 0 warnings; **274 passed, 0 failed**: Domain 111, Application 58, Infrastructure 19, Architecture 8, API integration 78 (28 new) |
| 2026-11-20 | Phase 4 frontend: `tsc -b`, `eslint .`, `check:architecture`, `vite build` | all clean; 187 files, 0 violations, 0 cycles |
| 2026-11-20 | Phase 4 frontend: `vitest run` (after the review fixes) | **83 passed, 0 failed** (5 new: customer logic + shared confirmation dialog) |
| 2026-11-20 | Phase 4 manual browser check by the founder (D-106) | Approved after two review fixes: duplicate-phone notice card; unified confirmation dialog (D-120) |
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
