# Testing Strategy — Lamma

**Status:** [P] Proposal. Test packages (xUnit, test SDK, `Microsoft.AspNetCore.Mvc.Testing`, `FluentAssertions` or plain asserts, Vitest, React Testing Library, MSW) need founder approval before installation.
**Approved principles:**
- Tests validate **business behaviour**, not just that code ran.
- No task is complete because it merely compiles.
- Never claim that a test passed unless it was executed.
- No production data is ever used.

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
