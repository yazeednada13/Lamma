# Project Progress — Lamma

**This is the single source of truth for where the project stands.** Update it only with verified facts, and update phase or merge status only after the founder confirms.

## Current position
| Item | Value |
|---|---|
| Current phase | **Phase 1: Foundation** |
| Current gate | **Gate 4: Backend checkpoint.** All Phase 1 backend tasks are done and verified. Waiting for the founder to create and apply the migration, and to commit and push |
| Git (founder-reported) | Phase 0 merged into `develop` (`0034166`). Branch `feature/phase1-foundation` created from the latest `develop` (2026-11-10) |
| Migrations | None created yet. The founder needs to create and apply `InitialIdentityAndBusiness` |
| Next expected founder action | Set the user-secret, create and apply the migration, commit and push, confirm, then write `Frontend` |

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
| 1 Foundation | Backend done (gate 4 checkpoint); Frontend waiting for `Frontend` |
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
