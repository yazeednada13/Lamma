# Project Progress — Lamma

**This is the single source of truth for where the project stands.** Update it only with verified facts, and update phase or merge status only after the founder confirms.

## Current position
| Item | Value |
|---|---|
| Current phase | **Phase 1: Foundation** |
| Current gate | **Gate 6: Frontend checkpoint.** All Phase 1 frontend tasks are done and verified, and the frontend was restructured (D-089). Waiting for the founder to commit and push |
| Git (founder-reported) | Phase 0 merged into `develop` (`0034166`). Branch `feature/phase1-foundation` created from the latest `develop` (2026-11-10) |
| Migrations | `InitialIdentityAndBusiness` created and applied by the founder (verified read-only: tables exist in `Lamma_Dev`) |
| Next expected founder action | Review the app, commit and push the frontend, confirm. Then PR (gate 7) |

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
| 1 Foundation | Backend pushed; Frontend done (gate 6 checkpoint) |
| 2 Catalog | Pending |
| 3 Inventory | Pending |
| 4 Customers | Pending |
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
| 2026-11-17 | Frontend restructured into the feature-based architecture (D-089, plan approved by the founder); no UI, behaviour or route changes; still at gate 6 |
