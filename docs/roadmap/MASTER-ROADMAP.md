# Master Roadmap — Lamma V1

**Status:** Phase 0 draft for founder approval · **Date:** 2026-11-10
Detailed tasks are in `PHASE-PLANS.md`. Current progress is in `docs/project/PROJECT-PROGRESS.md`.

---

## 1. Phase Execution Workflow (mandatory, permanent — D-070)
This workflow governs **every** phase. Each gate waits for the founder's explicit trigger, and Claude never advances a gate on its own.

| # | Gate | Who | Trigger / deliverable |
|---|---|---|---|
| 1 | **Phase branch** from the latest `develop` (e.g. `feature/phase1-foundation`) | Founder | Claude runs **no Git commands**: no branch create, switch, merge, or delete |
| 2 | **Plan Mode** → approval | Claude drafts, founder approves | Objectives and scope · Backend and Frontend parts · dependencies · numbered task IDs · technical details · acceptance criteria per task · unit and integration tests · security and performance · DB changes · API contracts and frontend integration · documentation updates · risks and open decisions. **No implementation.** Revise until approved |
| 3 | **Backend** tasks | Claude, after the founder writes **`Backend`** | One task at a time: inspect → implement → build → test → review (correctness, security, performance, maintainability) → fix → docs → report → **STOP** |
| 4 | **Backend checkpoint** | Claude reports, founder executes | Completion report · build and test results · issues · API contracts for the frontend · schema changes · migration name and exact `dotnet ef` and DB-update commands · exact Git commands and commit messages. **Wait** for confirmation of the push |
| 5 | **Frontend** tasks | Claude, after the founder writes **`Frontend`** | Approved React+TS architecture · reuse the Lamma design and assets · real APIs · RTL and responsive. One task at a time: implement → verify → test → fix → report → **STOP** |
| 6 | **Frontend checkpoint** | Claude reports, founder executes | Tests and production build · API integration, RTL, and responsive checks · report · exact Git commands. **Wait** for confirmation |
| 7 | **PR & closure** | Claude drafts the PR text; the founder creates, reviews, and merges | **A ready-to-paste PR title and description are always given before every PR** · Deliverables · tests and results · DB changes and migration status · limitations · checklist against the plan. No `gh`, no automated PRs. Progress docs are updated after the merge **only when authorized** |
| 8 | **Next phase** | Founder writes **`Next Phase`** after confirming the merge into `develop` | Restart at gate 2 |

**Standing rules:** one phase at a time · one task at a time · backend before frontend · tests are mandatory and results are reported honestly · no scope expansion · no Git, migrations, DB updates, or installs by Claude · docs kept in sync · STOP at every gate.

## 2. Dependency analysis
```
Identity ─▶ Business ownership/tenancy ─▶ Onboarding ─▶ Settings (channels, payment methods, defaults)
                                   │
             ┌─────────────────────┼───────────────────────────┐
             ▼                     ▼                           ▼
        Templates ─▶ Products/Variants ─▶ Inventory       Customers
                                   └───────────┬───────────────┘
                                               ▼
                                Orders core (create, status machine + reservations, undo)
                                               ▼
                                Payments & receivables (order + customer level)
                                               ▼
                             Courier settlements ◀─▶ Expenses (settlement difference = expense)
                                               ▼
                             Returns & Pre-orders (need orders, payments, inventory)
                                               ▼
                    Dashboard (needs all sources) ─▶ Reports (P&L needs returns + expenses + COGS)
                                               ▼
                                Subscription display ─▶ Hardening & launch
```
**Why this order, and not the spec's module order:**
- The dashboard (module 2 in the spec) needs every other module's data, so it comes **late** (Phase 9). Phase 1 ships only its empty or new-user state inside the shell.
- Inventory needs variants. Orders need inventory (reservations) and customers. Payments need orders. The courier and expenses depend on delivered COD orders and payments.
- Returns and pre-orders are separated from orders core because their rules are the most open (OQ-070–074). Isolating them avoids blocking the core order flow.
- Expenses are grouped with the courier because the settlement difference must create an expense atomically (D-035).
- Reports need the final definitions of returns, COGS, and expenses.
- Subscription enforcement is not approved, so Phase 11 covers display only.

## 3. Phases
| Phase | Name | Objective | Depends on | Blocking open questions |
|---|---|---|---|---|
| 0 | Discovery & planning | Docs, audit, architecture, roadmap | — | — |
| 1 | **Foundation** | Solution skeleton plus engineering standards, auth, tenancy, onboarding, business settings basics. Frontend: React app, design system port, shell, auth and onboarding pages | 0 | OQ-001…007 (P0) |
| 2 | **Catalog** | Categories, templates and fields, products, variants (opening stock), product list and form | 1 | OQ-010…015 |
| 3 | **Inventory** | Stock levels, receive, adjust, movement log, expiry | 2 | OQ-020…024 |
| 4 | **Customers** | Customer CRUD, quick add, segments, profile (computed fields with zero orders) | 1 | OQ-030…033 |
| 5 | **Orders core** | Create order (4 steps), snapshots, list, board, details, validated status machine with inventory effects, idempotency, concurrency, undo, cancel | 2, 3, 4 | OQ-040…049 |
| 6 | **Payments & receivables** | Payments (order and customer level), allocation, derived payment status, customer balance, receivables and aging | 5 | OQ-050…055 |
| 7 | **Courier & expenses** | Courier held money, settlements (the difference becomes an expense), expenses and categories, finance overview | 6 | OQ-060…063, OQ-020 |
| 8 | **Returns & pre-orders** | Full or partial returns, refunds, restock; pre-orders with deposit and expected date; pre-orders page | 5, 6 | OQ-070…074 |
| 9 | **Dashboard** | All dashboard sections and sidebar indicators computed from records | 3–8 | OQ-080, OQ-082, OQ-083 |
| 10 | **Reports** | Reports hub, P&L with comparison and waterfall, sales reports, periods | 7, 8 | OQ-081 |
| 11 | **Subscription (display)** | Trial status, days remaining, plans without prices; enforcement only if approved | 1 | OQ-085, D-011 |
| 12 | **Hardening & launch readiness** | Security review, performance and index review, accessibility, error monitoring, deployment, backups, legal pages | 1–11 | OQ-084, OQ-086, OQ-089 |

Phases 2 and 4 depend only on Phase 1. They could be reordered but not run in parallel: the rule is one phase at a time.

## 4. Cross-phase acceptance criteria (apply to every backend phase)
- Follows MASTER-ARCHITECTURE §4 (Backend Engineering Standards). Task order within a phase is domain → repository interfaces and implementations → query services → application service → controller → tests.
- No DbContext outside Infrastructure. Controllers stay thin. No generic repository. No MediatR or CQRS.
- Read queries are projected into DTOs with `AsNoTracking`, paged, with no N+1 queries.
- Multi-record operations are atomic, with a rollback test.
- Tenant isolation is tested for every new endpoint (read, write, reference).
- Money follows DATABASE-DESIGN §3. Financial formulas have tests with exact expected values.
- ProblemDetails errors with Arabic `detail` and stable `code`.
- The build has zero warnings promoted to errors [P], and all tests pass. Results are reported as actually executed.

Every frontend phase additionally requires: a pixel comparison with the prototype at 1440, 1024, 768, and 390 widths; RTL verified; loading, error, and empty states present; real API integration; tests passing; and a successful production build.
