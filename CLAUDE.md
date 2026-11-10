# CLAUDE.md — Lamma | لَمّة

> Read this file completely at the start of **every** session. Then read `docs/project/PROJECT-PROGRESS.md` to learn where the project stands. Do not rely on conversation history alone.

**Product:** Lamma (لَمّة), "كل شغلك بمكان واحد". It is a business-management SaaS for small businesses that sell through social media.
**Stack (Approved):** React + TypeScript · ASP.NET Core Web API (C#) · EF Core · SQL Server · ASP.NET Core Identity · Clean Architecture + Modular Monolith.
**V1 constraints (Approved):** one owner-user per business · Arabic-first RTL · JOD (د.أ) only · responsive web app.

---

## 1. Mandatory Phase Execution Workflow (permanent rule)

Every phase follows these gates in order. Each gate waits for the founder's explicit trigger. **Never skip a gate and never proceed automatically.**

| # | Gate | Who | What happens |
|---|---|---|---|
| 1 | **Phase branch** | Founder | The founder creates a branch from the latest `develop` (e.g. `feature/phase1-foundation`). Claude **never** creates, switches, merges, or deletes branches, and runs **no Git commands at all**. |
| 2 | **Plan Mode** | Claude → founder approval | The founder asks for the plan. The plan includes objectives and scope, Backend and Frontend parts, dependencies, numbered task IDs, technical details, acceptance criteria per task, unit and integration tests, security and performance considerations, DB changes, API contracts and frontend integration, documentation updates, risks, and open decisions. **Nothing is implemented during planning.** If changes are requested, revise the plan and wait for approval again. |
| 3 | **Backend tasks** | Claude | Starts only when the founder writes **`Backend`**. Work on one task at a time: inspect → implement → build → run tests → review (correctness, security, performance, maintainability) → fix → update docs → report → **STOP**. |
| 4 | **Backend checkpoint** | Claude reports → founder executes | Deliver the Backend completion report: features, architecture, build and test results, remaining issues, API contracts for the frontend, schema changes, recommended migration name, the exact `dotnet ef` and database-update commands, and the exact Git commands with commit messages. **Wait** until the founder confirms the push to the remote. |
| 5 | **Frontend tasks** | Claude | Starts only when the founder writes **`Frontend`**. Use the approved React + TS architecture. Preserve the Lamma design and reuse its tokens, CSS, fonts, icons, and assets. Integrate with the real APIs; no mock data in product functionality. Arabic RTL and responsive. Work on one task at a time: implement → verify → test → fix → report → **STOP**. |
| 6 | **Frontend checkpoint** | Claude reports → founder executes | Run the frontend tests and a production build. Verify the API integration, RTL, and responsive layouts. Report the results and remaining issues. Provide the exact Git commands. **Wait** for the founder's confirmation. |
| 7 | **PR & closure** | Claude drafts → founder creates/merges | Draft the PR description: deliverables, tests and their results, DB changes and migration status, known limitations, and a checklist against the plan. Claude **never** creates or merges PRs (no `gh`, no Git). Update progress docs after the merge **only when authorized**. |
| 8 | **Next phase** | Founder | Only after the founder confirms the merge into `develop` and writes **`Next Phase`**. Planning then restarts at gate 2. |

### Non-negotiable working principles
- One phase at a time. One task at a time.
- Planning and explicit approval come before implementation.
- Backend always comes before Frontend.
- Testing and verification are mandatory. Never claim a test passed unless it was actually executed successfully.
- No unapproved scope expansion. Do not add features because competitors have them.
- **No autonomous Git operations** of any kind: init, clone, checkout, switch, branch, add, commit, push, pull, merge, rebase, reset, cherry-pick, tags, PRs, `gh`.
- **No autonomous migrations or database updates.**
- **No unapproved package or tool installations.** This covers NuGet, npm, dotnet tools, and SDKs.
- Keep project documentation synchronized with the actual implementation.
- Report blockers immediately. Ask focused questions when a business rule is ambiguous.
- **STOP** whenever a task, checkpoint, or approval gate is reached.

## 2. Database & migration governance
- **Allowed:** write approved entity, configuration, and DbContext source code. Inspect database code and schemas by read-only methods. Recommend migration names and exact commands.
- **Never:** run `dotnet ef migrations add`, `dotnet ef migrations remove`, `dotnet ef database update`, any equivalent, or any schema script.
- At the end of every backend task that changes the model, report:
  1. the schema changes
  2. the migration name
  3. the exact migration command
  4. the exact update command
  5. verification steps
- Then wait. Never assume a migration was applied.

## 3. Decision status labels
Every requirement and design choice in `docs/` carries exactly one label:

| Label | Meaning |
|---|---|
| **Approved** | Stated by the founder (master prompt, `decisions.md` in the reference, or recorded in `docs/project/DECISIONS.md`) |
| **Proposed** | Claude's recommendation. **Not binding** until the founder approves it and it is moved to Approved in DECISIONS.md |
| **Open** | Needs founder input. Tracked in `docs/project/OPEN-QUESTIONS.md` |
| **Out of scope** | Excluded from V1 |

Never implement a Proposed or Open item as if it were decided. Never silently change an Approved item.

## 4. Product & code rules
- **Business ownership:** every business-owned record has a `BusinessId`. The current business is resolved **on the server from the authenticated user**. Never trust a client-supplied BusinessId. One business must never see another's data.
- **Money:** `decimal` only, never `float` or `double`. JOD has 3 minor decimals (fils). See `docs/architecture/DATABASE-DESIGN.md` §Money.
- **Derived values** (sold, reserved, customer balance, courier held…) are computed from records, never maintained by hand as the source of truth.
- A **status change and its inventory effects** happen in one DB transaction. Every stock change writes a StockMovement.
- **OrderItem** stores the unit price and unit cost at the time of sale.
- **Architecture:** follow `docs/architecture/MASTER-ARCHITECTURE.md` §Backend Engineering Standards. Controllers stay thin. No DbContext outside Infrastructure. Focused repositories (no generic repository). **No MediatR, no CQRS, no microservices.**
- **Frontend reference:** `frontend-reference/` is the original HTML/CSS/JS prototype and design system. **Never modify or delete it.** The React app lives in a separate folder.
- **No mock data** replaces real backend integration. Test-only mocks such as MSW are allowed only in tests, once approved.
- **Out of scope for V1:** multiple users or employees, WhatsApp order sharing, data export, expense receipt photos, dark mode, customer invoices, the English LTR UI (the prototype's LTR-preview toggle is **not** ported), subscription enforcement (not approved), and invented prices.

## 5. Session start checklist
1. Read this file.
2. Read `docs/project/PROJECT-PROGRESS.md`, which shows the current phase, gate, and task.
3. Read the relevant phase in `docs/roadmap/PHASE-PLANS.md` and the related architecture docs.
4. Check `docs/project/OPEN-QUESTIONS.md` for anything that blocks the current task.
5. Inspect the actual code before changing it. Never assume implementation details.
6. Confirm which gate the project is at. If unsure, ask the founder.

## 6. Documentation map
| Doc | Purpose |
|---|---|
| `docs/product/PRD.md` | V1 requirements with status labels and the financial glossary |
| `docs/architecture/MASTER-ARCHITECTURE.md` | Solution structure, Backend Engineering Standards, tenancy and auth, errors, config |
| `docs/architecture/DATABASE-DESIGN.md` | Entities, constraints, indexes, money, inventory rules, concurrency |
| `docs/architecture/API-DESIGN.md` | REST conventions and API contracts |
| `docs/architecture/FRONTEND-AUDIT.md` | Prototype inventory and its mapping to React |
| `docs/architecture/FRONTEND-ARCHITECTURE.md` | React architecture proposal |
| `docs/roadmap/MASTER-ROADMAP.md` | Phase order, dependencies, and the workflow |
| `docs/roadmap/PHASE-PLANS.md` | Per-phase tasks, acceptance criteria, tests, gate status |
| `docs/project/PROJECT-PROGRESS.md` | Current status (single source of truth for progress) |
| `docs/project/DECISIONS.md` | Approved, proposed, and rejected decisions |
| `docs/project/OPEN-QUESTIONS.md` | Prioritized decisions needing founder input |
| `docs/project/LOCAL-DEVELOPMENT.md` | Environment and local setup |
| `docs/testing/TESTING-STRATEGY.md` | Test architecture and required suites |
