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
| 6. Frontend pushed (founder confirmed) | ☑ | 2026-11-21 | manual checklist passed |
| 7. PR merged into `develop` (founder) | ☑ | 2026-11-21 | |
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
| 4. Backend pushed (founder confirmed) | ☑ | 2026-11-10 | migration `InitialIdentityAndBusiness` applied by the founder: ☑ (verified read-only in `Lamma_Dev`) |
| 5. `Frontend` started | ☑ | 2026-11-10 | All frontend tasks run in one batch (D-087) |
| 6. Frontend pushed (founder confirmed) | ☑ | 2026-11-17 | Pushed together with the frontend restructure (D-089) |
| 7. PR merged into `develop` (founder) | ☑ | 2026-11-17 | Founder-reported |
| 8. `Next Phase` given | ☑ | 2026-11-17 | Phase 2 branch created and plan requested |

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

### Phase 1 Part B: implementation status (approved plan tasks)
| ID | Task | Status |
|---|---|---|
| 1.B1 | Vite + React 19 + TS (strict) scaffold, ESLint, Prettier, Vitest, `lang="ar" dir="rtl"`, Vite proxy `/api` → API | Done (verified) |
| 1.B2 | Design foundations copied (never moved) by `scripts/sync-design-assets.mjs`: fonts, logos, tokens and the 7 CSS files, icons, illustrations | Done (verified) |
| 1.B3 | Primitives: Button, IconButton, TextField, PasswordField + strength meter, Select, Checkbox, Toggle, Chip, Badge, Money, Drawer, Dialog (focus trap, Esc), Toasts, Skeleton, Empty and Error states | Done (verified) |
| 1.B4 | `apiClient` (antiforgery header with one automatic retry, ProblemDetails → ApiError, 401 → session reset), `money.ts` (integer fils, 2-dp display), Arabic labels | Done (verified) |
| 1.B5 | Router and guards (RequireAuth, RequireBusiness, RequireNotOnboarded, RedirectIfAuthenticated), query provider, error page, 404, offline banner | Done (verified) |
| 1.B6 | Login, Signup (email), Forgot, Reset password, wired to the real API | Done (verified against the real API) |
| 1.B7 | Onboarding: name → one type (13) → channels → done | Done (verified against the real API) |
| 1.B8 | App shell: sidebar (collapse, sliding pill, real trial card), topbar (new menu, disabled search and bell, account menu), bottom bar, More and New hubs, late-trial banner | Done (verified) |
| 1.B9 | Coming-soon page for all 21 unbuilt routes | Done (verified) |
| 1.B10 | New-user dashboard with real data | Done (verified) |
| 1.B11 | Account (name, change password in a drawer) and Settings (profile, channels, payment methods, threshold; dirty bar) | Done (verified against the real API) |
| 1.B12 | Tests, build, real-API end-to-end check, RTL and 4-width check, docs | Done. Pushed and merged (2026-11-17) |

**Frontend deviations and notes (for founder review):**
1. The sign-up field is **email** instead of phone (D-078). Onboarding is reordered: name → single type → channels (D-081).
2. The search bar and bell are shown but disabled ("قريبًا") (OQ-082/083). The language and LTR items are removed (D-006). The account page has no devices or notification sections (OQ-088/082).
3. The sidebar user card shows the owner's **email** instead of a gendered role label ("صاحبة المشروع").
4. Quick-add menu entries and getting-started steps open coming-soon pages (D-085). No drawers with fake saves.
5. The reset-password page is new. The prototype had no page for it, so it uses the auth-card styling.
6. Observed in the reference CSS, not changed: a focused input inside `.control` shows two focus rings (OQ-090).
7. Bundle: 555 kB JS (170 kB gzip). Route-level code splitting is deferred to Phase 12.

### Phase 1 frontend restructure (approved 2026-11-17, D-089)
| ID | Task | Status |
|---|---|---|
| 1.R1 | `@/` alias; `services/` (apiClient, queryClient) and `assets/` (generated icon and illustration modules); sync script updated | Done (verified) |
| 1.R2 | `shared/` split one component per file (ui, brand, form, feedback, overlay, toast, lib, validation) | Done (verified) |
| 1.R3 | Features `auth`, `subscription`, `onboarding`, `dashboard`, `settings` with `index.ts`, `routes.tsx`, api/schemas/components/pages | Done (verified) |
| 1.R4 | App layer: providers, router composition, guards, planned routes, navigation; AppShell split into layout-only parts plus `AuthenticatedLayout` | Done (verified) |
| 1.R5 | Tests colocated (17 files, 50 tests); ESLint boundary rules; `npm run check:architecture` | Done (verified) |
| 1.R6 | Post-restructure audit; FRONTEND-ARCHITECTURE.md rewritten as the authoritative reference | Done. Exceptions E-1–E-10 recorded |

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
**Objective:** categories, templates and fields, products with variants and opening stock. **Depends on:** Phase 1. **Blocking:** none (OQ-010…015 resolved as D-090–D-096).

**Approved plan (2026-11-17):** [`PHASE-2-PLAN.md`](PHASE-2-PLAN.md), with tasks 2.A1–2.A10 (backend) and 2.B1–2.B7 (frontend), API contracts, DB changes (migration `AddCatalog`), tests and risks, is the Phase 2 plan approved by the founder. It supersedes the draft task tables below. Decisions: D-090–D-105.

### Phase 2 gate status
| Gate | Status | Date | Notes |
|---|---|---|---|
| 1. Branch created by founder | ☑ | 2026-11-17 | `feature/phase2-catalog` |
| 2. Plan approved | ☑ | 2026-11-17 | D-090–D-105 |
| 3. `Backend` started | ☑ | 2026-11-17 | All backend tasks in one batch (D-087) |
| 4. Backend pushed (founder confirmed) | ☑ | 2026-11-17 | migration `AddCatalog` applied by the founder (verified read-only in `Lamma_Dev`) |
| 5. `Frontend` started | ☑ | 2026-11-17 | All frontend tasks in one batch (D-087) |
| 6. Frontend pushed (founder confirmed) | ☑ | 2026-11-18 | |
| 7. PR merged into `develop` (founder) | ☑ | 2026-11-18 | Founder-reported |
| 8. `Next Phase` given | ☑ | 2026-11-18 | `feature/phase3-inventory` created |

### Phase 2 approved tasks
| ID | Backend task | Status |
|---|---|---|
| 2.A1 | Template catalogue in code (6 templates, axes, fields, flags, 13-type map); `defaultTemplateCode` on business types | Done (verified) |
| 2.A2 | Custom template fields per business (CRUD, max 20 per template) | Done (verified) |
| 2.A3 | Categories: CRUD, product count, delete rule D-095 | Done (verified) |
| 2.A4 | Product + variant aggregate (D-090, D-093, D-097, D-100) | Done (verified) |
| 2.A5 | Attribute validation against template fields | Done (verified) |
| 2.A6 | StockMovement; create product with opening stock in one transaction (D-096) | Done (verified) |
| 2.A7 | Product update, archive/restore; variant add, edit, archive/restore | Done (verified) |
| 2.A8 | Product image via IFileStorage (D-094) | Done (verified) |
| 2.A9 | Product list (search, filters, paging) and details queries | Done (verified) |
| 2.A10 | Wiring, configurations, indexes, docs; migration `AddCatalog` (founder) | Done. **Waiting for the founder: migration + push** |

| ID | Frontend task | Status |
|---|---|---|
| 2.B1 | Products list | Done (verified against the real API) |
| 2.B2 | Product form (new and edit) with the variant matrix | Done (verified against the real API) |
| 2.B3 | Product details | Done (verified against the real API) |
| 2.B4 | Categories page | Done (verified against the real API) |
| 2.B5 | Settings: templates and custom fields; business-type labels from the API | Done (verified against the real API) |
| 2.B6 | Routing wiring (remove the coming-soon catalog routes, links) | Done (verified) |
| 2.B7 | Frontend checkpoint | Done. Pushed (2026-11-18) |

**Frontend notes (for founder review):**
1. The prototype's three summary cards on the products page (stock value at cost, expected profit, needs attention) are not built: they need inventory totals across all products, which is Phase 3 (inventory) scope.
2. Variant archive/restore and per-variant price, cost and expiry live on the product details page (variants table + drawer); the edit form adds new variants and renames axes.
3. "تعديل المخزون", "استلام" and "طلب فيه" on the details page are disabled with "قريبًا" (Phases 3 and 5); the sales chart is an empty state until orders exist.
4. Product images are not cached by the browser (the auth cookie is renewed on every request, which marks responses no-store). Performance only; revisit in Phase 12.

**Draft task tables (Phase 0, superseded by the approved plan above):**

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
**Objective:** stock levels, receive, adjust, movement log, expiry. **Depends on:** 2. **Blocking:** none (OQ-020…024 resolved as D-107–D-111).

**Approved plan (2026-11-18):** [`PHASE-3-PLAN.md`](PHASE-3-PLAN.md), tasks 3.A1–3.A8 and 3.B1–3.B7, decisions D-107–D-113, verification per D-106. It supersedes the draft tables below.

### Phase 3 gate status
| Gate | Status | Date | Notes |
|---|---|---|---|
| 1. Branch created by founder | ☑ | 2026-11-18 | `feature/phase3-inventory` |
| 2. Plan approved | ☑ | 2026-11-18 | D-107–D-113 |
| 3. `Backend` started | ☑ | 2026-11-18 | 3.A1–3.A8 done in one run (D-087) |
| 4. Backend pushed (founder confirmed) | ☑ | 2026-11-18 | migration `AddInventory` applied by the founder (verified read-only) |
| 5. `Frontend` started | ☑ | 2026-11-18 | 3.B1–3.B7 done in one run; verification per D-106 |
| 6. Frontend pushed (founder confirmed) | ☑ | 2026-11-20 | Manual check 21/21 |
| 7. PR merged into `develop` (founder) | ☑ | 2026-11-20 | Founder-reported |
| 8. `Next Phase` given | ☐ | | |

**Draft task tables (Phase 0, superseded by the approved plan):**

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
**Objective:** customers, quick add, segments, profile. **Depends on:** 1 (it can follow Phase 3). **Blocking:** none (OQ-030…033 resolved as D-114–D-117).

**Approved plan (2026-11-20):** [`PHASE-4-PLAN.md`](PHASE-4-PLAN.md), tasks 4.A1–4.A4 and 4.B1–4.B4, decisions D-114–D-119, verification per D-106. It supersedes the draft tables below.

### Phase 4 gate status
| Gate | Status | Date | Notes |
|---|---|---|---|
| 1. Branch created by founder | ☑ | 2026-11-20 | `feature/phase4-customers` |
| 2. Plan approved | ☑ | 2026-11-20 | D-114–D-119 |
| 3. `Backend` started | ☑ | 2026-11-20 | 4.A1–4.A4 done in one run (D-087) |
| 4. Backend pushed (founder confirmed) | ☑ | 2026-11-20 | migration `AddCustomers` applied by the founder (verified read-only) |
| 5. `Frontend` started | ☑ | 2026-11-20 | 4.B1–4.B4 done in one run; verification per D-106 |
| 6. Frontend pushed (founder confirmed) | ☑ | 2026-11-20 | Founder review approved |
| 7. PR merged into `develop` (founder) | ☑ | 2026-11-20 | Founder-reported |
| 8. `Next Phase` given | ☑ | 2026-11-20 | |

**Draft task tables (Phase 0, superseded by the approved plan):**

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
**Objective:** order creation, lifecycle, and the inventory effects, which make up the core business engine. **Depends on:** 2, 3, 4. **Blocking:** none (OQ-040…049 resolved as D-121–D-130).

**Approved plan (2026-11-20):** [`PHASE-5-PLAN.md`](PHASE-5-PLAN.md), tasks 5.A1–5.A9 and 5.B1–5.B6, decisions D-121–D-130, verification per D-106. It supersedes the draft tables below.

### Phase 5 gate status
| Gate | Status | Date | Notes |
|---|---|---|---|
| 1. Branch created by founder | ☑ | 2026-11-20 | `feature/phase5-orders` |
| 2. Plan approved | ☑ | 2026-11-20 | D-121–D-130 |
| 3. `Backend` started | ☑ | 2026-11-20 | 5.A1–5.A9 implemented and verified |
| 4. Backend pushed (founder confirmed) | ☑ | 2026-11-20 | migration `AddOrders` applied |
| 5. `Frontend` started | ☑ | 2026-11-20 | 5.B1–5.B6 implemented; automated checks pass |
| 6. Frontend pushed (founder confirmed) | ☑ | 2026-11-21 | Founder's manual check passed after two fixes |
| 7. PR merged into `develop` (founder) | ☑ | 2026-11-21 | Founder-reported |
| 8. `Next Phase` given | ☑ | 2026-11-21 | |

**Draft task tables (Phase 0, superseded by the approved plan):**

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
**Depends on:** 5. **Blocking:** none (OQ-050…055 resolved as D-131–D-136; D-137, D-138 added).

**Approved plan (2026-11-21):** [`PHASE-6-PLAN.md`](PHASE-6-PLAN.md), tasks 6.A1–6.A7 and 6.B1–6.B5, decisions D-131–D-138, verification per D-106. It supersedes the draft tables below.

### Phase 6 gate status
| Gate | Status | Date | Notes |
|---|---|---|---|
| 1. Branch created by founder | ☑ | 2026-11-21 | `feature/phase6-payments` |
| 2. Plan approved | ☑ | 2026-11-21 | D-131–D-138 |
| 3. `Backend` started | ☑ | 2026-11-21 | 6.A1–6.A7 implemented and verified |
| 4. Backend pushed (founder confirmed) | ☑ | 2026-11-21 | migration `AddPayments` applied (verified read-only) |
| 5. `Frontend` started | ☑ | 2026-11-21 | 6.B1–6.B5 implemented; automated checks pass |
| 6. Frontend pushed (founder confirmed) | ☑ | 2026-11-21 | Smoke test on the real API passed |
| 7. PR merged into `develop` (founder) | ☑ | 2026-11-21 | Founder-reported |
| 8. `Next Phase` given | ☑ | 2026-11-21 | |

**Draft task tables (Phase 0, superseded by the approved plan):**

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
**Depends on:** 6. **Blocking:** none (OQ-060…063 resolved as D-139–D-142; OQ-020 as D-107; D-143, D-144 added).

**Approved plan (2026-11-21):** [`PHASE-7-PLAN.md`](PHASE-7-PLAN.md), tasks 7.A1–7.A6 and 7.B1–7.B5, decisions D-139–D-144, verification per D-106. It supersedes the draft tables below.

### Phase 7 gate status
| Gate | Status | Date | Notes |
|---|---|---|---|
| 1. Branch created by founder | ☑ | 2026-11-21 | `feature/phase7-courier-expenses` |
| 2. Plan approved | ☑ | 2026-11-21 | D-139–D-144 |
| 3. `Backend` started | ☑ | 2026-11-21 | 7.A1–7.A6 implemented and verified |
| 4. Backend pushed (founder confirmed) | ☑ | 2026-11-21 | migration `AddCourierAndExpenses` applied (verified read-only) |
| 5. `Frontend` started | ☑ | 2026-11-21 | 7.B1–7.B5 implemented; automated checks pass |
| 6. Frontend pushed (founder confirmed) | ☑ | 2026-11-21 | Founder approved the look; checklist run |
| 7. PR merged into `develop` (founder) | ☑ | 2026-11-21 | Founder-reported |
| 8. `Next Phase` given | ☑ | 2026-11-21 | |

**Draft task tables (Phase 0, superseded by the approved plan):**

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
**Depends on:** 5, 6. **Blocking:** none (OQ-070…074 resolved as D-145–D-149, D-151, D-152; D-150 added).

**Approved plan (2026-11-21):** [`PHASE-8-PLAN.md`](PHASE-8-PLAN.md), tasks 8.A1–8.A5 and 8.B1–8.B5, decisions D-145–D-152, verification per D-106. It supersedes the draft tables below.

### Phase 8 gate status
| Gate | Status | Date | Notes |
|---|---|---|---|
| 1. Branch created by founder | ☑ | 2026-11-21 | `feature/phase8-returns-preorders` |
| 2. Plan approved | ☑ | 2026-11-21 | D-145–D-152 |
| 3. `Backend` started | ☑ | 2026-11-22 | 8.A1–8.A5 implemented and verified |
| 4. Backend pushed (founder confirmed) | ☑ | 2026-11-22 | migration `AddReturnsAndPreOrders` applied (verified read-only) |
| 5. `Frontend` started | ☑ | 2026-11-22 | 8.B1–8.B5 implemented; automated checks pass |
| 6. Frontend pushed (founder confirmed) | ☑ | 2026-11-22 | 19-case checklist run on the real API |
| 7. PR merged into `develop` (founder) | ☑ | 2026-11-22 | Founder-reported |
| 8. `Next Phase` given | ☑ | 2026-11-22 | |

**Draft task tables (Phase 0, superseded by the approved plan):**

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
**Depends on:** 3–8. **Blocking:** none (OQ-080, OQ-082, OQ-083 resolved as D-153–D-156; D-157, D-158 added).

**Approved plan (2026-11-22):** [`PHASE-9-PLAN.md`](PHASE-9-PLAN.md), tasks 9.A1–9.A5 and 9.B1–9.B3, decisions D-153–D-158, verification per D-106. It supersedes the draft tables below.

### Phase 9 gate status
| Gate | Status | Date | Notes |
|---|---|---|---|
| 1. Branch created by founder | ☑ | 2026-11-22 | `feature/phase9-dashboard` |
| 2. Plan approved | ☑ | 2026-11-22 | D-153–D-158 |
| 3. `Backend` started | ☑ | 2026-11-22 | 9.A1–9.A5 implemented and verified; no migration |
| 4. Backend pushed (founder confirmed) | ☑ | 2026-11-22 | no migration |
| 5. `Frontend` started | ☑ | 2026-11-22 | 9.B1–9.B3 implemented; automated checks pass |
| 6. Frontend pushed (founder confirmed) | ☑ | 2026-11-22 | Founder tested and pushed |
| 7. PR merged into `develop` (founder) | ☑ | 2026-11-22 | Founder-reported |
| 8. `Next Phase` given | ☐ | | |

**Draft task tables (Phase 0, superseded by the approved plan):**

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
**Depends on:** 7, 8. **Blocking:** OQ-081 (answer proposed as D-170).

**Approved plan (2026-11-22):** [`PHASE-10-PLAN.md`](PHASE-10-PLAN.md), tasks 10.A1–10.A6 and 10.B1–10.B5, decisions D-168–D-172, verification per D-106. It supersedes the draft tables below.

### Phase 10 gate status
| Gate | Status | Date | Notes |
|---|---|---|---|
| 1. Branch created by founder | ☑ | 2026-11-22 | `feature/phase10-reports` |
| 2. Plan approved | ☑ | 2026-11-22 | D-168–D-172 |
| 3. `Backend` started | ☑ | 2026-11-22 | 10.A1–10.A6 implemented and verified; no migration |
| 4. Backend pushed (founder confirmed) | ☑ | 2026-11-22 | no migration |
| 5. `Frontend` started | ☑ | 2026-11-22 | 10.B1–10.B4 implemented; automated checks pass |
| 6. Frontend pushed (founder confirmed) | ☑ | 2026-11-22 | 13-case checklist run on the real API |
| 7. PR merged into `develop` (founder) | ☑ | 2026-11-22 | Founder-reported |
| 8. `Next Phase` given | ☐ | | |

**Draft task tables (Phase 0):**

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

## Phase 11 — Subscription, platform admin & public sign-up
**Approved plan (2026-11-22):** [`PHASE-11-PLAN.md`](PHASE-11-PLAN.md): part 11-I (11.A1–11.A7, 11.B1–11.B4) and part 11-II (11.A8–11.A14, 11.B5–11.B8), decisions D-173–D-181.

### Phase 11 gate status
| Gate | Status | Date | Notes |
|---|---|---|---|
| 1. Branch created by founder | ☑ | 2026-11-22 | `feature/phase11-subscription-admin` |
| 2. Plan approved | ☑ | 2026-11-22 | D-173–D-181 |
| 3. `Backend` started | ☑ | 2026-11-22 | part 11-I (11.A1–11.A7) implemented and verified; migration `AddSignupLeads` pending |
| 4. Backend pushed (founder confirmed) | ☑ | 2026-11-22 | 11-I; `AddSignupLeads` applied (seen working on `Lamma_Dev`) |
| 5. `Frontend` started | ☑ | 2026-11-22 | 11-I: 11.B1–11.B3 implemented; checks pass |
| 6. Frontend pushed (founder confirmed) | ☐ | | |
| 7. PR merged into `develop` (founder) | ☐ | | |
| 8. `Next Phase` given | ☐ | | |

**Depends on:** 1. **Blocking:** prices set (D-165); OQ-092 (domain, go-live only). **Decisions:** D-159–D-167. Detailed tasks are written in the Phase 11 plan (gate 2).

**Part 11-I: public sign-up**
- Public landing page in Lamma's identity (mobile first; feature cards styled as Lamma order slips), sign-up form (name, email, Jordanian mobile, optional store name), UTM source capture.
- Invitation tokens (single-use, expiring, hashed, bound to the email); branded Arabic RTL email templates; registration page with a locked email; open registration closed; trial starts on activation.

**Part 11-II: platform admin & subscription lifecycle**
- Platform admin role and area; admin dashboard; subscriber list and detail; leads list; admin audit log.
- Trial and paid periods with a derived status (P-024); admin actions (extend trial, activate/extend/end plan, suspend).
- In-app subscription page: status, days remaining, plans, CliQ instructions with a reference code, proof upload; admin approval queue.
- Read-only mode on expiry (D-162), enforced on the server; banners and reminders (P-026).

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
