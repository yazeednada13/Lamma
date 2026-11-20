# Testing Strategy — Lamma

**Status:** [P] Proposal. Test packages (xUnit, test SDK, `Microsoft.AspNetCore.Mvc.Testing`, `FluentAssertions` or plain asserts, Vitest, React Testing Library, MSW) need founder approval before installation.
**Approved principles:**
- Tests validate **business behaviour**, not just that code ran.
- No task is complete because it merely compiles.
- Never claim that a test passed unless it was executed.
- No production data is ever used.

**Lean verification (Approved, D-106, from Phase 3):**
- Backend: automated tests only for sensitive business rules (inventory, money, tenant isolation, transactions, status effects). Build per task; the full suite runs once at the end of the Backend part, summary output only.
- Frontend: `tsc`, `lint`, `check:architecture`, `build`, and unit tests for pure logic. No new full-app page tests by default.
- Browser verification is done by the founder with Claude's gate-6 checklist; Claude runs browser checks only when asked.
- Existing suites stay and must keep passing. Sections below describe the full strategy; D-106 limits what is added per phase.

---

## 1. Test pyramid
| Layer | Project / tool | What it proves | Speed |
|---|---|---|---|
| Architecture | `Lamma.ArchitectureTests` (xUnit, reflection; NetArchTest only if approved, P-020) | Dependency direction and Engineering Standards rules | fast |
| Domain unit | `Lamma.Domain.Tests` | Transition policy, inventory effects, money rounding, totals, segments, payment status | fast |
| Application unit | `Lamma.Application.Tests` (hand-written fakes for repository and port interfaces; no mocking library unless approved) | Orchestration rules: validation order, calls to domain logic, committing once, exceptions | fast |
| Persistence integration | `Lamma.Infrastructure.Tests` against **real SQL Server** | Mappings, constraints, query translation, projections, aggregates, filters, concurrency, no N+1 | medium |
| API integration | `Lamma.Api.IntegrationTests` (WebApplicationFactory + real SQL Server test DB) | HTTP contracts, auth, CSRF/refresh, ProblemDetails, tenant isolation, idempotency, transaction rollback | medium |
| Frontend unit and component | Vitest + React Testing Library | Primitives, money helpers, apiClient, forms | fast |
| Frontend workflow | Vitest + RTL + **MSW (tests only)** | Page flows against mocked HTTP that follows the API contract | medium |
| E2E (later, [O]) | Playwright | Full stack smoke tests | slow |

## 2. Database strategy for tests
- **Never** the EF InMemory provider, and never SQLite as a SQL Server stand-in, because they hide translation, precision, and concurrency behaviour.
- Docker is not installed, so **Testcontainers cannot be used**. Proposed instead: a dedicated test database on the local instance (LocalDB `(localdb)\MSSQLLocalDB` or the `MSSQLSERVER01` instance), named `Lamma_Test_<runId>`.
- **Schema creation for tests:** the test fixture builds the schema with `Database.EnsureCreated()` or by applying the existing migrations to the **throwaway test database only**. ⚠ This is technically a schema operation, so **it needs the founder's explicit approval** before Phase 1 (the founder rule bans Claude from executing migrations or DB updates). Options:
  - (a) The founder authorizes fixture-created throwaway test DBs.
  - (b) The founder creates the test DB, and tests only reset data (with Respawn, if approved, or hand-written cleanup).

  This is tracked as an Open item in PROJECT-PROGRESS.md.
- Isolation between tests: each test class gets a fresh business (tenant) where possible, plus a data reset between classes.
- The connection string comes from user-secrets or an environment variable, never from committed files.

### 2a. As implemented (Phase 1)
- **Approved (D-083):** fixtures create a throwaway database per fixture on LocalDB (`Lamma_Test_<guid>`, `Lamma_ApiTest_<guid>`) with `EnsureCreated`, and drop it with `EnsureDeleted`. `Lamma_Dev` is never touched.
- `Lamma.Api.IntegrationTests` runs the real host in environment `Testing` through `WebApplicationFactory<Program>`. It uses an HTTPS base address (secure cookies), a cookie-keeping `ApiSession` that handles the antiforgery token, a capturing email sender, and a controllable clock.
- Rate limits are raised in the shared factory. `LowRateLimitApiFactory` tests the 429.
- Mocks are hand-written fakes; no mocking library is used.

### 2a-2. Catalog suites (Phase 2)
- **Domain** (`CatalogTests.cs`):
  - template map for all 13 types
  - default variant, matrix rules and limits (2 axes, 20 values, 100 variants)
  - duplicate combinations
  - price and cost rules
  - the opening movement (D-096)
  - last-variant archive, conversion at zero stock only, axis rename vs. count
  - stock-status boundaries
- **Application** (`CatalogValidationTests.cs`):
  - attribute normalization and errors per field type, required custom fields
  - create-request consistency, 2-dp money input, paging and sort bounds
  - image signatures (jpg, png and webp accepted; exe and gif rejected)
  - nullable money JSON
- **Infrastructure** (`CatalogPersistenceTests.cs`):
  - round trip with codes and `decimal(19,3)`
  - tenant isolation of all 5 tables, cross-tenant write rejected
  - filtered unique category names, the CHECK on negative stock
  - **atomic rollback** of a failed save (no product, variant or movement)
  - rowversion conflict → `concurrency.conflict`
  - the product list runs in **2 SQL commands** (no N+1), with status, search and sort
- **API** (`CatalogTests.cs`):
  - categories CRUD and the three delete outcomes
  - templates and custom fields, including isolation
  - simple and matrix products, field errors, expiry
  - list filters and paging
  - cross-business 404s
  - update, variants, conversion, archive
  - image upload, serve, replace, delete, content-type check and the 5 MB limit; images use a temp storage folder per test host

### 2b. Frontend as implemented (Phase 1)
- Vitest + jsdom + React Testing Library + user-event. Every app-level test mounts the **real routes, guards and providers** in `StrictMode` (`src/test/renderApp.tsx`).
- MSW 3 (`src/test/fakeApi.ts`, test-only) implements the Phase 1 contracts, including the antiforgery rule and ProblemDetails. Unhandled requests fail the test.
- Tests sit **next to their subjects** (17 files, 50 tests after the D-089 restructure):
  - `services/api/apiClient.test.ts`, `shared/lib/money.test.ts`
  - `shared/ui/` Button, Icon, Money, form, Drawer, ToastProvider
  - `features/subscription/trial.test.ts`
  - `features/auth/{auth,session}.test.tsx`, `features/onboarding/onboarding.test.tsx`, `features/dashboard/dashboard.test.tsx`, `features/settings/{AccountPage,BusinessSettingsPage}.test.tsx`
  - `app/router/routing.test.tsx` (guards, 404, all coming-soon routes), `app/layouts/app-shell/AppShell.test.tsx` (shell, logout, collapse, banners)
- Timeouts: `testTimeout` 15s and `asyncUtilTimeout` 3s, because full-app renders run in parallel files (FRONTEND-ARCHITECTURE §11 E-9).
- **Phase 2 (catalog), 23 files / 73 tests in total:**
  - `features/catalog/domain/productFormModel.test.ts`: combinations, value toggling, form → create, update and new-variant bodies (including conversion of a simple product)
  - `features/catalog/products.test.tsx`: empty state, list and filters, simple product with opening stock, size × colour matrix, client validation, image upload, edit adding only new combinations
  - `features/catalog/productDetails.test.tsx`: stock map, opening movements, archive variant, variant price drawer, archive/restore product, not found
  - `features/catalog/categories.test.tsx`: add, rename, duplicate name, blocked delete
  - `features/catalog/ProductTemplatesSection.test.tsx`: custom select field in settings; business-type labels from the API (D-103)
  - `shared/ui/form/ImagePicker.test.tsx`: type and size pre-check
- The catalog fake (`src/test/fakeCatalog.ts`, test-only) implements the API-DESIGN §12 contracts; state lives on each fake business.
- Vitest runs with `maxWorkers: 4` (one per physical core of the dev machine; E-9).
- **Phase 3 (inventory), D-106:** `features/inventory/domain/inventoryDomain.test.ts` covers reason rules, the adjust preview, receipt totals in fils, day grouping in Asia/Amman, and idempotency-key reuse. The MSW fake gained `GET inventory/summary` for the products page. Screens are verified by the founder with the gate-6 checklist.
- `npm run check:architecture` and `npm run lint` are part of every frontend checkpoint.
- Manual: a real-API browser pass and a 4-width RTL check at each Frontend checkpoint.

## 3. Architecture tests (Engineering Standards)
- Domain references no `Microsoft.EntityFrameworkCore`, no `Microsoft.AspNetCore.*`, and no Infrastructure.
- Application references no Infrastructure and no `DbContext`. No public interface in Application exposes `IQueryable`.
- Api types (except `Program` and `DependencyInjection`) do not reference `LammaDbContext` or Infrastructure repositories.
- Controllers' constructor dependencies are Application service interfaces only.
- No type implements a generic `IRepository<>`. No MediatR references.
- DI: `ServiceProvider` builds with `ValidateOnBuild` and `ValidateScopes`, and no singleton depends on a scoped service.

## 4. Mandatory business-rule suites
| Suite | Key cases |
|---|---|
| Money | Rounding AwayFromZero at 3 dp; string serialization `"38.000"`; rejecting > 3 dp; no float paths |
| Order totals | Σ(qty × price) + fee − discount; discount bounds; snapshot immutability after a product price change |
| Status transitions | Every allowed and forbidden pair in the approved matrix |
| Inventory effects | Each row of DATABASE-DESIGN §6: reserve, release, sale, return; movements written with the correct deltas and references |
| Availability | Cannot reserve more than available; pre-order exception per the approved rules |
| Concurrency | Two parallel reservations of the last unit: exactly one succeeds and the other gets 409; two parallel status changes |
| Idempotency | Retrying with the same key causes no duplicate movement, payment, settlement, or expense; same key with a different payload returns 422 |
| Undo | Within and outside the window; blocked after a later change; does not alter other orders; compensating movements |
| Payments | Derived payment status; FIFO allocation exactness; reversal |
| Receivables aging | Bucket boundaries 7/8 and 30/31 days, with a controlled `IClock` |
| Courier settlement | Difference becomes exactly one Delivery expense; an order is never settled twice; rollback on failure |
| Returns | Partial quantities; restock; Net Sales and COGS effects in the correct period |
| Customer segments | VIP threshold edges; New ≤ 2; Dormant > 14 days; owes money > 0 |
| Dashboard and reports | Exact expected values on a fixed seeded dataset (period vs previous, % change, channel split, top products, P&L waterfall) |
| Tenancy | For **every** endpoint: tenant A cannot list, get, update, delete, or reference tenant B's data (404); a client-supplied BusinessId has no effect |
| Auth | Lockout; rate limit; CSRF rejection (option A) or refresh rotation and reuse revocation (option B); sessions invalidated after a password change |
| Transactions | An injected failure mid-operation leaves no partial writes |
| Query quality | Key list and detail endpoints issue a bounded number of SQL commands, checked with a command-counting interceptor (no N+1) |

## 5. Frontend tests
- `money.ts`: parse, format, integer-fils arithmetic, RTL formatting with `د.أ` after the number.
- `apiClient`: credentials and antiforgery or bearer handling, `Idempotency-Key` reuse on retry, ProblemDetails → `ApiError` with field errors.
- Components: Button states, TextField errors, MoneyInput, StockMeter thresholds, status and payment badges (all 7 + 4 codes), Dialog and Drawer focus trap and Esc.
- Workflows (MSW): sign-up → onboarding → dashboard; new order through 4 steps; status change + undo toast; record payment; settlement; server validation errors shown on fields; loading, empty, and error states.
- RTL and responsive: assertions on `dir`, plus manual verification at 1440, 1024, 768, and 390 per frontend checkpoint (documented in the report).

## 6. Execution & reporting
- Backend: `dotnet build` then `dotnet test` (per project or the whole solution). Frontend: `npm run test` and `npm run build`.
- Every task report lists the commands run, pass/fail counts, and any skipped or blocked tests with the reason.
- CI is not configured in V1 planning [O]. The founder may add GitHub Actions later, which needs approval.
