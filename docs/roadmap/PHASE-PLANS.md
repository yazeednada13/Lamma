# Phase Plans — Lamma V1

**Status:** Phase 0 draft. Each phase below is a **draft outline**. At gate 2 (Plan Mode) of that phase it is refined into the full implementation plan, which needs the founder's approval before any work starts. Task IDs are stable: backend tasks are `N.An` and frontend tasks are `N.Bn`.

Every phase follows the **Phase Execution Workflow** (MASTER-ROADMAP §1 / CLAUDE.md §1).

---

## Per-phase gate template
Copy this block into each phase when it starts, and keep it current.

| Gate | Status | Date | Notes |
|---|---|---|---|
| 1. Branch created by founder | ☐ | | branch name: |
| 2. Plan approved | ☐ | | |
| 3. `Backend` started | ☐ | | |
| 4. Backend pushed (founder confirmed) | ☐ | | migrations applied by founder: ☐ |
| 5. `Frontend` started | ☐ | | |
| 6. Frontend pushed (founder confirmed) | ☐ | | |
| 7. PR merged into `develop` (founder) | ☐ | | |
| 8. `Next Phase` given | ☐ | | |

Each gate-2 plan must include:
- objectives and scope
- Backend and Frontend parts
- dependencies and prerequisites
- numbered tasks
- technical details
- acceptance criteria per task
- unit and integration tests
- security and performance
- DB changes
- API contracts and frontend integration
- doc updates
- risks and open decisions

Task status values: `Pending` · `In progress` · `Done (verified)` · `Blocked (reason)`.

---

## Phase 0 — Discovery & Master Planning
Docs only. Status is tracked in PROJECT-PROGRESS.md. Tasks 0.1–0.8: repository inspection, frontend audit, product analysis, architecture, database planning, roadmap, documentation, open decisions.

---

## Phase 1 — Foundation
**Objective:** a production-grade skeleton that follows the Backend Engineering Standards, plus secure accounts, business ownership and tenancy, onboarding, and basic settings. On the frontend: the React app with the ported design system, the app shell, and the auth, onboarding, account, and basic-settings pages.
**Scope:**
- Included:
  - Modules M1 (account and onboarding) and part of M9 (business profile, channels, payment methods, default low-stock threshold).
  - The empty and new-user dashboard state.
  - The shell, including sidebar indicators as placeholders fed by later phases.
- Excluded: templates (Phase 2), expense categories (Phase 7), subscription (Phase 11).

**Dependencies:** Phase 0 approved. **Blocking:** OQ-001 .NET version, OQ-002 auth option, OQ-003 identifier and recovery, OQ-004 membership model, OQ-005 money display, OQ-007 onboarding. Also requires approval of P-001…P-005, P-013…P-015, P-016…P-017 (frontend stack), and P-020.

### Phase 1 gate status
| Gate | Status | Date | Notes |
|---|---|---|---|
| 1. Branch created by founder | ☑ | 2026-11-10 | `feature/phase1-foundation` |
| 2. Plan approved | ☑ | 2026-11-10 | D-086 (approved plan supersedes the draft task list below) |
| 3. `Backend` started | ☑ | 2026-11-10 | All backend tasks run in one batch (D-087) |
| 4. Backend pushed (founder confirmed) | ☐ | | migration `InitialIdentityAndBusiness` applied by the founder: ☐ |
| 5. `Frontend` started | ☐ | | |
| 6. Frontend pushed (founder confirmed) | ☐ | | |
| 7. PR merged into `develop` (founder) | ☐ | | |
| 8. `Next Phase` given | ☐ | | |

### Phase 1 Part A: implementation status (approved plan tasks)
| ID | Task | Status |
|---|---|---|
| 1.A1 | Solution skeleton (.NET 9, central package versions, global.json, .gitignore, .editorconfig) | Done (verified) |
| 1.A2 | DI composition per layer, ValidateOnBuild/ValidateScopes outside Production | Done (verified) |
| 1.A3 | Domain foundation: Entity, IBusinessOwned, DomainException, MoneyMath, EnumCode, BusinessTime, MoneyJsonConverter | Done (verified) |
| 1.A4 | LammaDbContext + IUnitOfWork, conventions (decimal 19,3 · enum codes · UTC), timestamps interceptor, configurations | Done (verified) |
| 1.A5 | Global exception handler → ProblemDetails (code, Arabic detail, traceId, errors) | Done (verified) |
| 1.A6 | FluentValidation through a global action filter, Arabic messages, camelCase keys | Done (verified) |
| 1.A7 | Request logging (no PII), rate limiting, CORS, OpenAPI (Development), /health | Done (verified) |
| 1.A8 | Identity + cookie auth (no redirects), password policy, lockout | Done (verified) |
| 1.A9 | Antiforgery on every unsafe method (including login and sign-up) + Origin check | Done (verified) |
| 1.A10 | Auth service and endpoints, reset tokens, dev log email sender / 503 elsewhere | Done (verified) |
| 1.A11 | ICurrentUser, ICurrentBusiness (server-resolved), RequireBusiness policy, query filters, tenancy interceptor | Done (verified) |
| 1.A12 | Onboarding (atomic; double submit → exactly one business) | Done (verified) |
| 1.A13 | Account and business settings endpoints | Done (verified) |
| 1.A14 | Full build and tests, docs, checkpoint report | Done. **Waiting for the founder: migration and push** |

**Deviations from the plan (for founder review):**
1. The settings PUT/GET bodies are wrapped: `{ channels: [...] }` and `{ methods: [...] }`, not bare arrays.
2. Login lockout returns **423** `auth.locked_out`.
3. Enum columns are `varchar(32)`, not `nvarchar`, because the codes are ASCII.
4. The security stamp is validated on **every** request, which costs one user lookup per request. This is what makes "other sessions end immediately" possible.
5. The test that drift between `EnsureCreated` and the migrations (`HasPendingModelChanges`) is not added yet. It needs the founder's migration first, and will be added once it is confirmed.
6. There is no expired-reset-token test. Identity's token lifetime (1 hour) can't be controlled from the test clock. Invalid and reused tokens are tested.

### Part A — Backend (Phase 0 draft, superseded by the approved plan above)
| ID | Task | Acceptance criteria | Tests |
|---|---|---|---|
| 1.A1 | Create the solution and projects (`Lamma.Domain`, `Application`, `Infrastructure`, `Api`, five test projects) with the reference rules in MASTER-ARCHITECTURE §3/§4.1. Add `Directory.Build.props` (nullable, warnings, analyzers) | `dotnet build` succeeds; references match the allowed graph | Architecture tests: Domain has no references to EF or ASP.NET; Application doesn't reference Infrastructure; Api doesn't use DbContext |
| 1.A2 | DI composition: `AddApplication`, `AddInfrastructure`, `AddApi`, with per-module extension pattern; `ValidateOnBuild` and `ValidateScopes` in Development; options validation | The container builds; no captive dependencies | DI build test |
| 1.A3 | `LammaDbContext`, conventions (money `decimal(19,3)`, enums as strings, UTC), `IUnitOfWork`, `IClock`, timestamps interceptor | Conventions applied to the model | Model metadata tests (precision, string enums) |
| 1.A4 | Error handling: `IExceptionHandler` → ProblemDetails (code, Arabic detail, traceId, errors map); application exception types | Every error path returns RFC 9457 JSON; no stack traces outside Development | Integration tests per status (400, 401, 403, 404, 409, 422, 500) |
| 1.A5 | Validation infrastructure (FluentValidation or DataAnnotations, per approval), automatically applied to requests | Invalid requests return 422 with field errors in Arabic | Unit and integration tests |
| 1.A6 | Logging setup (structured `ILogger`, request logging without PII); configuration and secrets via user-secrets; CORS; rate limiting | No secrets in the repo; auth endpoints rate limited | Integration test for the 429 response |
| 1.A7 | Identity: `ApplicationUser`, password policy, lockout, the chosen auth mechanism (option A cookie + antiforgery, or B JWT + rotating refresh) | Sign-up, login, logout, and current-user endpoints work; cookie and token flags per §7 | Integration tests: login success and failure, lockout, CSRF rejection (A) or refresh rotation and reuse revocation (B) |
| 1.A8 | Password recovery and change password (channel per OQ-003; a provider interface with a dev implementation that writes to the log, **dev only**) | Reset token is single-use and expires; all sessions invalidated after a change | Integration tests |
| 1.A9 | `Business`, `BusinessMembership`, `ICurrentUser`, `ICurrentBusiness`, the `RequireBusiness` policy, global query filters, tenancy stamping interceptor | Business resolved on the server; client BusinessId ignored | **Two-tenant isolation tests** (read, write, reference); interceptor rejects a cross-tenant update |
| 1.A10 | Onboarding service and endpoint: name, type, channels → business + membership + default channels and payment methods + trial dates, in one transaction | Atomic; idempotent re-submit; cannot onboard twice | Unit and integration tests, including rollback on failure |
| 1.A11 | Account and business settings endpoints: profile, change password, business profile, enable or disable channels and payment methods, default low-stock threshold | Validation (at least one channel and one payment method enabled [P]) | Integration tests |
| 1.A12 | OpenAPI (Development), health endpoint, Backend checkpoint docs: API contracts in API-DESIGN.md, migration name `InitialIdentityAndBusiness` with the founder's commands | Report delivered; **STOP at gate 4** | Full test-suite run reported |

### Part B — Frontend
| ID | Task | Acceptance criteria | Tests |
|---|---|---|---|
| 1.B1 | Create the `frontend/` Vite + React + TS app (after install approval); ESLint and Prettier; `lang="ar" dir="rtl"` | Dev server and production build work | Smoke test |
| 1.B2 | Port the design foundations: copy fonts, logos, icons, `tokens.css`, and the prototype CSS; global import order; `Icon` component | Visual parity with `components.html` primitives | Render tests |
| 1.B3 | Core primitives: Button, IconButton, TextField, PasswordField with strength meter, MoneyInput, PhoneInput (+962), Select, Checkbox, Toggle, Chip, Badge, Toast host, Dialog, Drawer (bottom sheet on mobile), Skeleton, EmptyState, ErrorState | Matches the prototype states; keyboard and a11y | Component tests |
| 1.B4 | `lib/apiClient` (credentials, antiforgery or bearer, Idempotency-Key, ProblemDetails → ApiError), `lib/money`, `lib/i18n/ar` | Typed errors; integer-fils math | Unit tests |
| 1.B5 | Router, providers (TanStack Query), guards (RequireAuth, RequireBusiness), 404 page, offline and error boundary | Unauthenticated users are redirected; non-onboarded users go to `/onboarding` | Routing tests |
| 1.B6 | AuthLayout + Login, Signup, Forgot and Reset password pages, wired to the real API | Server field errors shown; loading states | Workflow tests (MSW) |
| 1.B7 | Onboarding (3 steps as approved) wired to the API | Creates the business; redirects to the dashboard empty state | Workflow test |
| 1.B8 | AppShell: sidebar (groups, submenus, collapse, sliding pill, trial card), topbar (new menu, me menu), mobile bottom bar, More and New hubs (links only for delivered features) | Matches the prototype at 4 widths; RTL | Component and layout tests |
| 1.B9 | Dashboard new-user empty state (getting-started steps) | Matches `#/dashboard-new` | Render test |
| 1.B10 | Account page (profile, change password) and Business Settings (profile, channels, payment methods, inventory default) with a dirty-bar | Saves through the API; **no LTR toggle** | Workflow tests |
| 1.B11 | Frontend checkpoint: tests, production build, RTL and responsive verification report | **STOP at gate 6** | Full run reported |

**Completion criteria:** all tasks Done (verified); isolation tests green; founder confirmed migration applied and pushes; PR merged.
**Review checkpoints:** gate 4 (backend), gate 6 (frontend), gate 7 (PR).

---

## Phase 2 — Catalog
**Objective:** categories, templates and fields, products with variants and opening stock. **Depends on:** Phase 1. **Blocking:** OQ-010…015.

| ID | Backend task | Acceptance / tests |
|---|---|---|
| 2.A1 | Template seed data (system templates, fields, business-type → template map) | Seeded idempotently; query tests |
| 2.A2 | Custom template fields per business (if OQ-012 = a) | CRUD tests; tenant isolation |
| 2.A3 | Category CRUD with product count (projected) and the delete rule | Integration tests, including the delete-blocked case |
| 2.A4 | Product + variants aggregate: default variant rule, option matrix, attributes validated against template fields, price and cost overrides | Domain tests; invalid attribute rejected |
| 2.A5 | Product create with opening stock → movements (type per OQ-015) in one transaction | Rollback test; movement written |
| 2.A6 | Product update and archive; variant add and archive (not delete when referenced) | Tests |
| 2.A7 | Product image upload via `IFileStorage` (local in development), with type and size validation | Tests for rejected type and size |
| 2.A8 | Product list query (search, category filter, stock status, paging, projection) and product details query | Query tests; no N+1 |
| 2.A9 | Backend checkpoint (API contracts, migration `AddCatalog`) | STOP |

| ID | Frontend task | Acceptance / tests |
|---|---|---|
| 2.B1 | Products list (cards and table, search, category filter, stock meter) | Parity with `#/products`; tests |
| 2.B2 | Product form: template picker, basics with live margin, template fields, variant matrix with quantities, live preview, low-stock threshold | Parity with `#/products/new`; validation tests |
| 2.B3 | Product details (variants, stock by variant; sales and margin placeholders until Phase 5) | Parity with `#/products/:id` |
| 2.B4 | Categories page | CRUD tests |
| 2.B5 | Settings → templates and fields section (if approved) | Tests |
| 2.B6 | Frontend checkpoint | STOP |

---

## Phase 3 — Inventory
**Objective:** stock levels, receive, adjust, movement log, expiry. **Depends on:** 2. **Blocking:** OQ-020…024.

| ID | Backend task | Acceptance / tests |
|---|---|---|
| 3.A1 | Inventory domain: movement types, `Variant.Receive/Adjust`, invariants (OnHand ≥ 0, Reserved ≤ OnHand) | Domain unit tests |
| 3.A2 | Receive stock (multi-line, supplier, cost; cost update per OQ-022; purchases handling per OQ-020), idempotent, atomic | Integration tests: retry is not duplicated, rollback works |
| 3.A3 | Stock adjustment with reason, idempotent | Tests: negative stock blocked |
| 3.A4 | Stock levels query (on hand, reserved, available, status, filters) | Query tests |
| 3.A5 | Movement log query (filters in/out/auto/manual, by variant, paging) | Query tests |
| 3.A6 | Expiry query (nearest first, warning window) | Tests |
| 3.A7 | Reconciliation check (Σ movements = OnHand/Reserved) as a test utility | Test |
| 3.A8 | Backend checkpoint (migration `AddInventory`) | STOP |

| ID | Frontend task | Acceptance / tests |
|---|---|---|
| 3.B1 | Stock levels page | Parity with `#/inventory` |
| 3.B2 | Receive stock page with receipt | Parity with `#/inventory/receive`; idempotent submit |
| 3.B3 | Adjust stock dialog (from the product card and details) | Tests |
| 3.B4 | Movement log page | Parity |
| 3.B5 | Expiry page | Parity |
| 3.B6 | Product details: movement history and adjust | Tests |
| 3.B7 | Frontend checkpoint | STOP |

---

## Phase 4 — Customers
**Objective:** customers, quick add, segments, profile. **Depends on:** 1 (it can follow Phase 3). **Blocking:** OQ-030…033.

| ID | Backend task | Acceptance / tests |
|---|---|---|
| 4.A1 | Customer aggregate (phone normalization E.164, uniqueness rule) and CRUD/archive | Tests |
| 4.A2 | `CustomerSegmentPolicy` with options (central thresholds) | Unit tests per segment boundary |
| 4.A3 | Customer list query (search by name or phone, segment filter, computed fields) and profile summary query | Query tests (computed values are zero until orders exist) |
| 4.A4 | Backend checkpoint (migration `AddCustomers`) | STOP |

| ID | Frontend task | Acceptance / tests |
|---|---|---|
| 4.B1 | Customers list with segment tabs | Parity with `#/customers` |
| 4.B2 | Customer profile (orders and payments sections are filled in by Phases 5 and 6) | Parity with `#/customers/:id` |
| 4.B3 | Quick-add customer drawer (reused in the new-order flow) | Tests |
| 4.B4 | Frontend checkpoint | STOP |

---

## Phase 5 — Orders core
**Objective:** order creation, lifecycle, and the inventory effects, which make up the core business engine. **Depends on:** 2, 3, 4. **Blocking:** OQ-040…049.

| ID | Backend task | Acceptance / tests |
|---|---|---|
| 5.A1 | Order domain: statuses, `OrderStatusTransitionPolicy` (approved matrix), totals formula, snapshots | Unit tests for every allowed and forbidden transition, and for the totals formula |
| 5.A2 | `InventoryEffectCalculator` implementing the DATABASE-DESIGN §6 table | Unit tests for every row of the table |
| 5.A3 | Order-number allocation (per-business counter, locked) | Concurrency test: no duplicate numbers |
| 5.A4 | Create order: customer and variant validation (same business), availability check, price and cost snapshots, discount rule, initial status new or confirmed (with reservation), idempotent | Integration: over-availability rejected; snapshot immutability; retry not duplicated |
| 5.A5 | Change status: validated, single transaction (variants + movements + log + timestamps), `rowversion` and expected-status precondition, idempotent | Integration: concurrent reservation of the last unit (one wins, one gets 409); rollback on failure; retry is a no-op |
| 5.A6 | Undo (approved semantics), as a compensating transition | Tests: within and outside the window, blocked after a later change, does not touch other orders |
| 5.A7 | Cancel with reason (releases the reservation) | Tests |
| 5.A8 | Order list query (search, status filter, counts per status, paging) and order details query (items, timeline, amounts) | Query tests; no N+1 |
| 5.A9 | Order editing (only if OQ-046 is approved) | Tests |
| 5.A10 | Backend checkpoint (migration `AddOrders`) | STOP |

| ID | Frontend task | Acceptance / tests |
|---|---|---|
| 5.B1 | Orders list (table and cards, status chips with counts, search, quick next step with undo toast) | Parity with `#/orders` |
| 5.B2 | Kanban board (valid moves only, undo) | Parity with `#/orders/board` |
| 5.B3 | New order, 4 steps, with live receipt (integer-fils preview), customer quick add, stepper capped at available stock | Parity with `#/orders/new`; workflow tests |
| 5.B4 | Order details (items, lifecycle, timeline, change status, cancel dialog) | Parity with `#/orders/:id` |
| 5.B5 | Customer profile and product details: order history and sales sections | Tests |
| 5.B6 | Frontend checkpoint | STOP |

---

## Phase 6 — Payments & receivables
**Depends on:** 5. **Blocking:** OQ-050…055.

| ID | Backend task | Acceptance / tests |
|---|---|---|
| 6.A1 | Payment and allocation domain; derived payment status | Unit tests for every status case |
| 6.A2 | Record payment against an order (enabled methods only, amount ≤ remaining), idempotent | Integration tests, including duplicate prevention |
| 6.A3 | Record payment against a customer with the approved allocation rule | Tests (FIFO allocation exactness) |
| 6.A4 | Payment reversal (no delete) | Tests |
| 6.A5 | Receivables query (customer balances) and aging buckets | Query tests with fixed dates (IClock) |
| 6.A6 | Order and customer queries extended with paid, remaining, and balance | Tests |
| 6.A7 | Backend checkpoint (migration `AddPayments`) | STOP |

| ID | Frontend task | Acceptance / tests |
|---|---|---|
| 6.B1 | Record-payment drawer (from the order, the customer, and the global "new" menu) | Parity with the prototype drawer |
| 6.B2 | Payments and receivables page with aging | Parity with `#/finance/payments` |
| 6.B3 | Order details payment card and customer profile balance | Tests |
| 6.B4 | Frontend checkpoint | STOP |

---

## Phase 7 — Courier & expenses
**Depends on:** 6. **Blocking:** OQ-060…063, OQ-020.

| ID | Backend task | Acceptance / tests |
|---|---|---|
| 7.A1 | Expense categories (system Delivery category, CRUD/archive) | Tests |
| 7.A2 | Expenses CRUD (per policy), totals by category, period query | Tests |
| 7.A3 | Courier entity and COD assignment on orders; courier-held query | Tests |
| 7.A4 | Courier settlement: order selection, expected versus received, difference → Delivery expense **atomically and exactly once**, orders marked settled, idempotent | Integration tests: no double expense, no double settlement of an order, rollback |
| 7.A5 | Finance overview query (sales, cash received, profit, receivables, courier receivables, cash flow) | Exact-value tests on a fixed dataset |
| 7.A6 | Backend checkpoint (migration `AddCourierAndExpenses`) | STOP |

| ID | Frontend task | Acceptance / tests |
|---|---|---|
| 7.B1 | Expenses page and add-expense drawer | Parity |
| 7.B2 | Courier page and settlement drawer | Parity |
| 7.B3 | Finance overview | Parity with `#/finance` |
| 7.B4 | Settings → expense categories | Tests |
| 7.B5 | Frontend checkpoint | STOP |

---

## Phase 8 — Returns & pre-orders
**Depends on:** 5, 6. **Blocking:** OQ-070…074.

| ID | Backend task | Acceptance / tests |
|---|---|---|
| 8.A1 | Return model (full or partial per approval), restock movements, refund recording | Tests: quantities ≤ delivered minus already returned; restock movement written |
| 8.A2 | Returns effect on revenue, COGS, and customer figures (query updates) | Exact-value tests |
| 8.A3 | Pre-order: eligibility, deposit, expected date, availability exception, conversion and reservation rules | Tests per approved rule |
| 8.A4 | Pre-orders query (calendar range) | Tests |
| 8.A5 | Backend checkpoint (migration `AddReturnsAndPreOrders`) | STOP |

| ID | Frontend task | Acceptance / tests |
|---|---|---|
| 8.B1 | Return dialog (lines, restock, refund) | Tests |
| 8.B2 | Pre-order options in new order (date, deposit) | Tests |
| 8.B3 | Pre-orders calendar page | Parity with `#/preorders` |
| 8.B4 | Frontend checkpoint | STOP |

---

## Phase 9 — Dashboard
**Depends on:** 3–8. **Blocking:** OQ-080, OQ-082, OQ-083.

| ID | Backend task | Acceptance / tests |
|---|---|---|
| 9.A1 | Dashboard query service: journey counts, profit and % change, daily series over 7 and 30 days, metric cards, needs-attention lists, channel split, top sellers, recent activity, trial days | Exact-value tests on a fixed dataset; SQL aggregation only |
| 9.A2 | Sidebar indicators endpoint (new orders, low stock, owed-money flag) | Tests |
| 9.A3 | Performance review: indexes and query plans for the dashboard | Documented timings |
| 9.A4 | Dashboard calculations documented (formula per figure) | Doc review |
| 9.A5 | Backend checkpoint | STOP |

| ID | Frontend task | Acceptance / tests |
|---|---|---|
| 9.B1 | Dashboard page with all sections and charts | Parity with `#/dashboard` |
| 9.B2 | Sidebar indicators wired up | Tests |
| 9.B3 | Notifications and palette, only if approved | — |
| 9.B4 | Frontend checkpoint | STOP |

---

## Phase 10 — Reports
**Depends on:** 7, 8. **Blocking:** OQ-081.

| ID | Backend task | Acceptance / tests |
|---|---|---|
| 10.A1 | P&L query (period versus previous): sales, returns, net sales, COGS, gross, expenses by category, net, "what changed" driver | Exact-value tests including returns and the settlement expense |
| 10.A2 | Sales reports (by day, channel, product with quantity and amount, AOV) | Tests |
| 10.A3 | Period resolution (this month, last month, last 7 days, custom) in the business timezone | Boundary tests |
| 10.A4 | Backend checkpoint | STOP |

| ID | Frontend task | Acceptance / tests |
|---|---|---|
| 10.B1 | Reports hub | Parity |
| 10.B2 | P&L page with waterfall | Parity with `#/reports/pnl` |
| 10.B3 | Sales report page | Parity with `#/reports/sales` |
| 10.B4 | Frontend checkpoint | STOP |

---

## Phase 11 — Subscription (display only)
**Depends on:** 1. **Blocking:** OQ-085. **Enforcement is excluded unless approved (D-011).**

| ID | Task |
|---|---|
| 11.A1 | Subscription status endpoint (trial start and end, days remaining, plan). No prices are invented |
| 11.A2 | Backend checkpoint |
| 11.B1 | Subscription page (trial ring, plans without prices), trial banners (late) |
| 11.B2 | Trial-expired state only if enforcement is approved |
| 11.B3 | Frontend checkpoint |

---

## Phase 12 — Hardening & launch readiness
**Depends on:** 1–11. **Blocking:** OQ-084, OQ-086, OQ-089.

| ID | Task |
|---|---|
| 12.A1 | Security review (auth, CSRF, tenancy, rate limits, headers, secrets) |
| 12.A2 | Performance and index review with realistic data volumes |
| 12.A3 | Logging and monitoring, backups, deployment pipeline for the approved host |
| 12.B1 | Accessibility audit, reduced-motion check, cross-browser and mobile check |
| 12.B2 | E2E smoke suite (if approved) |
| 12.B3 | Legal pages, production configuration, launch checklist |
