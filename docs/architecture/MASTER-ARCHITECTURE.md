# Master Architecture — Lamma

**Status:** Phase 0 proposal for founder review · **Date:** 2026-11-10
**Labels:** **[A]** Approved · **[P]** Proposed · **[O]** Open. Where a section mixes the two, the founder-mandated *principles* are [A] and their concrete *shapes* (names, folders, exact APIs) are [P] until reviewed.

---

## 1. Overview
| Concern | Choice | Status |
|---|---|---|
| Style | Clean Architecture + Modular Monolith | [A] |
| Backend | ASP.NET Core Web API, C#, EF Core, SQL Server, ASP.NET Core Identity | [A] |
| Frontend | React + TypeScript SPA | [A]; tooling [P] (FRONTEND-ARCHITECTURE.md) |
| Runtime | .NET 10 LTS (recommended) or .NET 9 | [O] OQ-001 |
| Forbidden | MediatR, CQRS, microservices, generic repository, unnecessary abstractions or dependencies | [A] |
| Deployment | Single API process plus the static SPA, one SQL Server database | [P]; hosting [O] OQ-086 |

```
Browser (React SPA, RTL) ──HTTPS/JSON──▶ Lamma.Api (controllers, auth, ProblemDetails)
                                            │ calls service interfaces
                                            ▼
                                   Lamma.Application (use-case services, DTOs, interfaces)
                                            │ uses domain model        ▲ implements interfaces
                                            ▼                          │
                                      Lamma.Domain              Lamma.Infrastructure (EF Core, Identity,
                                (entities, rules, enums)          repositories, queries, storage, clock)
                                                                        │
                                                                        ▼
                                                                   SQL Server
```

## 2. Guiding principles
- [A] Correctness and data integrity come before speed.
- [A] Simple, testable, maintainable code: use established ASP.NET Core and EF Core capabilities and avoid inventing frameworks.
- [A] Business rules live in Domain and Application, never in controllers or repositories.
- [A] Every business-owned record belongs to exactly one business, and the server enforces this.
- [A] Derived values are computed from records.
- [P] The "modular" in Modular Monolith means **folders and namespaces per module inside each layer project**, not one project per module. Fewer projects means less ceremony for a solo-founder product; modules are still separated by namespace and by architecture tests.

## 3. Solution structure [P]
```
Lamma.sln
src/
  Lamma.Domain/                 // no package references (BCL only)
    Common/                     // Entity base, IBusinessOwned, Money, DomainException, Guard
    Businesses/  Catalog/  Inventory/  Customers/  Orders/  Finance/  Subscription/
  Lamma.Application/            // references Domain only (+ Microsoft.Extensions.* abstractions)
    Common/                     // ICurrentBusiness, ICurrentUser, IClock, IUnitOfWork, paging, exceptions
    Identity/  Businesses/  Catalog/  Inventory/  Customers/  Orders/  Finance/  Reports/  Dashboard/  Subscription/
      // each module: I<Module>Service + implementation, request/response DTOs, repository & query interfaces, validators
    DependencyInjection.cs      // AddApplication()
  Lamma.Infrastructure/         // references Application (+ EF Core, Identity)
    Persistence/
      LammaDbContext.cs
      Configurations/<Module>/  // IEntityTypeConfiguration<T>
      Conventions/              // money precision, enum-to-string, UTC
      Interceptors/             // tenancy stamping, audit timestamps
      Repositories/<Module>/
      Queries/<Module>/         // read-side query services returning DTOs
      Migrations/               // created by the FOUNDER only
    Identity/                   // ApplicationUser, Identity setup, token/cookie services
    Storage/  Time/
    DependencyInjection.cs      // AddInfrastructure(IConfiguration)
  Lamma.Api/                    // references Application; references Infrastructure ONLY for composition root
    Controllers/<Module>/
    Auth/  ErrorHandling/  OpenApi/
    DependencyInjection.cs      // AddApi()
    Program.cs
tests/
  Lamma.Domain.Tests/
  Lamma.Application.Tests/
  Lamma.Infrastructure.Tests/   // repositories & queries against real SQL Server test DB
  Lamma.Api.IntegrationTests/   // WebApplicationFactory
  Lamma.ArchitectureTests/
frontend/                       // React app (Phase 1 Part B), separate from frontend-reference/
frontend-reference/             // ORIGINAL prototype — read-only
docs/
```

## 4. Backend Engineering Standards (mandatory)
These principles are **[A] mandated by the founder (D-053–D-055)**. The interface names and code shapes below are **[P]**. FluentValidation, optimistic concurrency, and idempotency remain **[P]**.

### 4.1 Clean Architecture & dependency direction
**Allowed references**
- `Domain` → nothing (BCL only).
- `Application` → `Domain`.
- `Infrastructure` → `Application`, `Domain`.
- `Api` → `Application`. It also references `Infrastructure`, but uses it **only** in the composition root (`Program.cs` and `DependencyInjection.cs` calling `AddInfrastructure`).
- Tests → whatever they test.

**Responsibilities by layer**
| Layer | Contains | Must not contain |
|---|---|---|
| **Domain** | Entities and aggregates (Business, Product, ProductVariant, Customer, Order, OrderItem, Payment, StockMovement, Expense, CourierSettlement…), value objects (`Money`, `Quantity`, `PhoneNumber`), enums (`OrderStatus`, `PaymentStatus`, `StockMovementType`, `SalesChannel`, `PaymentMethod`), domain policies (`OrderStatusTransitionPolicy`, `InventoryEffectCalculator`, `CustomerSegmentPolicy`), invariants enforced in entity methods, `DomainException` types | EF Core attributes or types, ASP.NET Core, DTOs, I/O |
| **Application** | Use-case services (`IOrderService`…), request and response DTOs, mapping, validation, repository and query interfaces, ports (`ICurrentBusiness`, `ICurrentUser`, `IClock`, `IUnitOfWork`, `IFileStorage`, `IEmailSender`/`ISmsSender` when approved), application exceptions (`NotFoundException`, `ConflictException`, `ValidationException`, `ForbiddenException`) | DbContext, EF-specific types (`IQueryable` stays out of interfaces), HTTP types |
| **Infrastructure** | `LammaDbContext`, entity configurations, conventions, interceptors, repository and query implementations, Identity, file storage, clock, external providers | Business rules (beyond persistence mapping), HTTP concerns |
| **Api** | Controllers, authentication and authorization setup, exception handler → ProblemDetails, OpenAPI, CORS, rate limiting, model binding | Business logic, DbContext access, EF queries |

Domain entities keep **private setters**, expose behaviour methods (`order.ChangeStatus(...)`, `variant.Reserve(qty)`), and validate their own invariants. EF Core maps them through configurations and backing fields, so the Domain needs no EF attributes.

### 4.2 Dependency Injection
- [A] Use the built-in `Microsoft.Extensions.DependencyInjection` container only.
- Registration happens through extension methods, one per layer, with per-module helpers inside:
  ```csharp
  builder.Services
      .AddApplication()                         // calls AddOrdersApplication(), AddCatalogApplication(), ...
      .AddInfrastructure(builder.Configuration) // DbContext, Identity, repositories, queries, storage, clock
      .AddApi(builder.Configuration);           // controllers, auth, ProblemDetails, CORS, rate limits
  ```
- Services are registered against **interfaces** (`services.AddScoped<IOrderService, OrderService>()`).

**Lifetimes**
| Lifetime | Use for | Examples |
|---|---|---|
| **Scoped** (per request) | Anything that touches the DbContext or request identity | `LammaDbContext`, repositories, query services, application services, `ICurrentBusiness`, `ICurrentUser`, `IUnitOfWork` |
| **Singleton** | Stateless, thread-safe services with no scoped dependencies | `IClock` (`SystemClock`), configuration via `IOptions<T>`, pure policies (`OrderStatusTransitionPolicy`, `CustomerSegmentPolicy`, the money formatter) |
| **Transient** | Lightweight stateless helpers created per use | Validators, mappers if they are classes |

**Rules**
- No captive dependencies: a singleton must never depend on a scoped service.
- In Development, `ValidateScopes = true` and `ValidateOnBuild = true`, and a test asserts the container builds.
- **No service locator.** Do not inject `IServiceProvider` into services or call `GetService` inside business code. Use constructor injection only.
- Options are bound with `services.AddOptions<T>().Bind(...).ValidateDataAnnotations().ValidateOnStart()`.

### 4.3 Repository pattern & Unit of Work
- [A] Repository **interfaces** live in `Application/<Module>/` and **implementations** in `Infrastructure/Persistence/Repositories/<Module>/`, using EF Core.
- [A] **Controllers never access DbContext.** [P] Application services don't either; they depend only on repository, query, and UoW interfaces.
- [A] Repositories are **focused**, with no generic `IRepository<T>`. Each one serves a write-side aggregate and exposes intention-revealing methods:
  ```csharp
  public interface IOrderRepository
  {
      Task<Order?> GetForStatusChangeAsync(Guid orderId, CancellationToken ct); // order + items + variants
      Task<Order?> GetWithItemsAsync(Guid orderId, CancellationToken ct);
      Task<int> NextOrderNumberAsync(CancellationToken ct);
      void Add(Order order);
  }
  public interface IProductVariantRepository
  {
      Task<IReadOnlyList<ProductVariant>> GetByIdsForUpdateAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct);
  }
  ```
- **Read side [P]:** lists, dashboards, and reports use **query services** (`IOrderQueries`, `IDashboardQueries`, `IReportQueries`, `ICustomerQueries`…). Their interfaces sit in Application and their implementations in Infrastructure. They compose `IQueryable` internally and return **projected DTOs** (`PagedResult<OrderListItemDto>`). No `IQueryable` crosses the layer boundary. This is a plain read/write separation inside services; it is **not CQRS** (no separate models, buses, or handlers).
- **Unit of Work [P]:** the DbContext already is a unit of work and a transaction scope. A thin interface keeps Application free of EF types:
  ```csharp
  public interface IUnitOfWork
  {
      Task<int> SaveChangesAsync(CancellationToken ct);
      Task ExecuteInTransactionAsync(Func<CancellationToken, Task> work, CancellationToken ct);
  }
  ```
  `LammaDbContext` implements it. There is **no separate UoW object** layered over the repositories (rejected by default, R-009).
- **Transaction rules**
  - One application-service method is one business operation, which is one commit.
  - Repositories **never** call `SaveChanges`. The service calls `IUnitOfWork.SaveChangesAsync` once.
  - A single `SaveChanges` is atomic. `ExecuteInTransactionAsync` is used only when an operation needs several round-trips that must commit together (e.g. allocate an order number, then insert), or needs a specific isolation level. It runs inside `Database.CreateExecutionStrategy()` so that it composes with SQL retry-on-failure.
  - Examples of operations that must be atomic:
    - status change + stock movements + variant quantities + status log
    - payment + allocations
    - courier settlement + order updates + the difference expense
    - receive stock + movements + cost update

### 4.4 Application services
- [A] Each use-case area has a service interface and implementation, and **controllers stay thin**.

**Proposed services and responsibilities**
| Service | Responsibility |
|---|---|
| `IAuthService` | Sign up, login, logout, refresh (if option B), password recovery and reset, change password |
| `IAccountService` | Read and update the owner's profile |
| `IOnboardingService` | Create the business plus membership plus defaults (channels, payment methods, expense categories) and start the trial, atomically |
| `IBusinessSettingsService` | Business profile, enabled channels and payment methods, default low-stock threshold |
| `ICategoryService` | Category CRUD and the delete rule |
| `IProductTemplateService` | Templates and per-business custom fields |
| `IProductService` | Product and variant create, update, archive, opening stock |
| `IInventoryService` | Receive stock, adjust stock, expiry queries |
| `ICustomerService` | Customer CRUD, quick add |
| `IOrderService` | Create an order (pricing snapshots, availability check), edit if approved, cancel, return |
| `IOrderStatusService` | Validated status transitions with inventory effects, idempotency, undo |
| `IPaymentService` | Record payments against an order or a customer, allocations, reversals |
| `ICourierService` | Courier receivables and settlements (the difference becomes an expense) |
| `IExpenseService` | Expense CRUD and expense categories |
| `IDashboardService` | Dashboard aggregates (delegates to `IDashboardQueries`) |
| `IReportService` | P&L and sales reports |
| `ISubscriptionService` | Trial status and plans (display only; enforcement not approved) |

**Controller contract:** bind the request, apply `[Authorize]`, call one service method with `HttpContext.RequestAborted`, then map the result to `200`/`201`/`204`. Nothing else. No try/catch for business errors: the global handler maps them.

**Where rules live:** invariants belong in entity methods; cross-entity rules belong in domain policies; the application service orchestrates loading, calling domain behaviour, persisting, and committing. Rules never go in controllers or repositories.

**Error signalling [P]:** domain and application exceptions are mapped centrally to ProblemDetails. This needs no package and keeps services simple. A `Result<T>` type is not used.

### 4.5 LINQ & EF Core standards
- **Server-side work:** filtering, search, sorting, pagination, and aggregation are all translated to SQL. Composable `IQueryable` is used inside Infrastructure query classes only.
- **Reads:** `AsNoTracking()` plus a `Select` projection straight into DTOs. Never load entities to map them in memory.
- **Writes:** load tracked aggregates with explicit, minimal `Include`s through a dedicated repository method per use case.
- **Aggregations** (dashboard, reports, customer stats) use `GroupBy`, `Sum`, `Count`, and `Max` in SQL. `ToList()` is never called before aggregating.
- **Banned:** N+1 queries (lazy loading is **disabled**), client-side evaluation, loading whole tables, unbounded result sets (all list endpoints are paged, with a maximum page size).
- **Cartesian explosion:** use `AsSplitQuery()` only where it is measured to help.
- **Search:** `LIKE` on indexed, normalized columns (name, normalized phone, order number). Full-text search is out of scope unless performance demands it.
- **SQL review:** in Development, log the generated SQL via `LogTo` with `EnableSensitiveDataLogging` **off**. Review indexes against the real query shapes in each phase. Use compiled queries only when profiling justifies them.
- **Bulk operations:** `ExecuteUpdate`/`ExecuteDelete` are used only where they bypass no domain rules or movement logging. Stock changes always go through entities so that movements are written.
- **Testability:** query classes are integration-tested against SQL Server (never the EF InMemory provider, which hides translation problems).

### 4.6 Additional standards
- **SOLID**, applied pragmatically: single-responsibility services, dependency inversion through interfaces. No interface for a class that has a single implementation and no reason to fake it, except at layer boundaries.
- **Async:** async/await for all I/O, with `CancellationToken` passed through controllers → services → repositories → EF. No `.Result` or `.Wait()`.
- **Errors:** a global `IExceptionHandler` produces RFC 9457 **ProblemDetails** with `type`, `title`, `status`, `detail` (Arabic, user-safe), `code` (a machine code such as `order.invalid_transition`), `traceId`, and `errors` (a field map for validation). Unknown exceptions return a generic 500 with no stack trace outside Development.
- **Validation:**
  - [P] FluentValidation for request DTOs (needs approval of a package). The alternative is DataAnnotations plus Domain guards.
  - Domain invariants are always enforced in the Domain regardless of which option is chosen.
- **Concurrency [P]:** `rowversion` on `ProductVariant` and `Order`. A `DbUpdateConcurrencyException` becomes a 409 with a retry hint.
- **Idempotency [P]:** an `Idempotency-Key` header on non-idempotent financial and stock POSTs (API-DESIGN §6).
- **Logging:** the built-in `ILogger` with structured templates. Log business events (order status changed, settlement recorded) by ID. **Never** log passwords, tokens, full phone numbers or emails, or request bodies containing PII. Serilog is optional and needs approval.
- **Tests:** unit and integration tests for every important business rule (TESTING-STRATEGY.md).

## 5. Module map & dependencies
| Module | Owns | Depends on |
|---|---|---|
| Identity | ApplicationUser, auth flows | — |
| Businesses | Business, BusinessMembership, settings, enabled channels and methods | Identity |
| Catalog | Category, ProductTemplate, TemplateField, Product, ProductVariant | Businesses |
| Inventory | StockMovement; receive, adjust, and expiry operations on variants | Catalog |
| Customers | Customer | Businesses |
| Orders | Order, OrderItem, OrderStatusLog, PreOrder info, Returns | Catalog, Inventory, Customers |
| Finance | Payment, PaymentAllocation, Expense, ExpenseCategory, Courier, CourierSettlement, Refund | Orders, Customers |
| Dashboard / Reports | Read-only aggregates | All of the above |
| Subscription | Trial and plan state (display) | Businesses |

Cross-module calls go through Application service or repository interfaces. A module never writes another module's tables directly, except inside one transaction orchestrated by the owning service: for example, `OrderStatusService` writes StockMovements through the Inventory repository.

## 6. Tenancy & business ownership [P unless marked]
### 6.1 User–Business relationship
- [A] V1 has one owner per business; no employees.
- [P] **Recommended:** `Business` plus `BusinessMembership(Id, UserId, BusinessId, Role, CreatedAt)`, with `Role = Owner` the only value in V1 and a **unique index on UserId** in V1, which enforces one business per user. Multi-user support later only relaxes that index and adds roles, with no table change.
- Alternative (OQ-004): `Business.OwnerUserId`. It is simpler, but multi-user support would need a migration and changes to the resolution logic.
- Onboarding creates the Business, the Membership, and the defaults in **one transaction**. A user without a membership is authenticated but **not onboarded**: only `/api/v1/onboarding` and `/api/v1/account` endpoints accept them (enforced by an authorization policy `RequireBusiness`).

### 6.2 Current-business resolution
- `ICurrentUser` reads the user ID from the authenticated principal.
- `ICurrentBusiness` (scoped) resolves `BusinessId` by querying the membership for that user ID **on the server**, once per request (lazy and cached in the scope).
- A `business_id` value from the client (route, query, body, header) is **never** an authorization input. DTOs contain no BusinessId.
- If a claim cache is used later (`business_id` in the cookie or token), it is only a hint and is re-validated against the membership.

### 6.3 Isolation layers (defence in depth)
1. **Schema:** every business-owned table has a non-null `BusinessId` FK plus an index that starts with `BusinessId`.
2. **Query filters:** `HasQueryFilter(e => e.BusinessId == _currentBusiness.Id)` on every `IBusinessOwned` entity, applied through a model-building convention. `IgnoreQueryFilters()` is allowed only in explicitly reviewed infrastructure code (e.g. sign-up uniqueness checks).
3. **Write stamping:** a `SaveChanges` interceptor sets `BusinessId` on added entities and **throws** if a modified or deleted entity's `BusinessId` differs from the current business.
4. **Reference integrity:** when a request references other records (customer, variants, category), the service loads them through filtered repositories. A record not found under the current business means a 404. [P] Composite FKs `(BusinessId, Id)` are an option for the critical relations: Order→Customer, OrderItem→Variant.
5. **Responses:** a cross-business ID returns **404**, not 403, so the API does not reveal that the record exists.
6. **Tests:** a two-tenant integration fixture checks every endpoint: tenant A cannot list, read, update, delete, or **reference** tenant B's records.

### 6.4 Security implications
- The query filter depends on a correctly resolved `ICurrentBusiness`. Background jobs (none in V1) would need an explicit business context.
- Raw SQL (avoided) bypasses filters, so any raw query must include `BusinessId` explicitly and be reviewed.
- Uniqueness constraints are scoped per business (order number, category name, phone), except Identity's user email and phone, which are global.

## 7. Authentication & session security [P; choice is OQ-002]
### 7.1 Common to both options
- ASP.NET Core Identity with `ApplicationUser` and PBKDF2 hashing (Identity default).
- Password policy [P]: minimum 8 characters, at least one letter and one digit (this matches the prototype's strength meter). The strength indicator is UI only; the server enforces the policy.
- Lockout after 5 failed attempts for 15 minutes. **Rate limiting** (built-in `Microsoft.AspNetCore.RateLimiting`) on login, sign-up, forgot-password, and reset.
- The identifier is email and/or E.164 phone (OQ-003). Recovery tokens come from Identity token providers, are single-use, short-lived, and sent through the approved channel.
- On password change, all sessions are invalidated (security stamp update).
- HTTPS only, with HSTS in production. Secrets are never in the repo.

### 7.2 Option A — Identity cookie authentication (recommended)
- The SPA and the API share a site (same origin through a reverse proxy, or subdomains of one registrable domain).
- Cookie flags: `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict`), sliding expiration (e.g. 14 days with "remember me", otherwise a session cookie). On an API call, an unauthenticated request returns 401 rather than a redirect.
- **CSRF:** cookies are sent automatically, so state-changing endpoints require the antiforgery token. The SPA fetches the token (`GET /api/v1/auth/antiforgery`), keeps it in memory, and sends it as `X-XSRF-TOKEN`. The server validates it on every POST, PUT, PATCH, and DELETE, and also checks the `Origin` header. SameSite=Lax adds a further layer.
- Pros: no tokens in JS, built-in revocation through the security stamp, simple. Cons: a same-site deployment is required, and it is less natural for a future native mobile app.

### 7.3 Option B — JWT access token + refresh-token cookie
- The access token is a JWT with a 10–15 minute lifetime, held **in memory only** (never in localStorage) and sent as `Authorization: Bearer`.
- The refresh token is a random 256-bit value in a cookie with `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/v1/auth`. It lasts 14–30 days.
- **Rotation:** every refresh issues a new refresh token and revokes the old one. Tokens are stored **hashed** (SHA-256) in a `RefreshTokens` table with `FamilyId`, `ExpiresAt`, `RevokedAt`, `ReplacedById`, and a user-agent hint.
- **Reuse detection:** presenting a revoked token revokes the whole family and forces a new login.
- **CSRF:** Bearer-authenticated endpoints are not CSRF-prone. The cookie-authenticated `/auth/refresh` and `/auth/logout` endpoints are, so they require SameSite=Strict, a custom header (`X-Requested-With`) or a double-submit token, and a strict `Origin` check.
- Revocation happens on logout, password change, and the reuse signal. The security stamp is checked on refresh.
- Pros: works cross-origin and for a future mobile app. Cons: more moving parts (a token table, rotation, a refresh race in the SPA).

### 7.4 CORS
In Development, only the configured SPA origin(s) are allowed, with credentials enabled for cookies. Production follows the same rule, and wildcard origins are never used.

## 8. Error handling & API responses
See API-DESIGN.md §5. Success responses return the resource DTO directly, with no envelope. Errors use ProblemDetails.

## 9. Configuration & secrets
- `appsettings.json` contains no secrets. Development secrets live in **dotnet user-secrets** (connection string, signing keys). Production secrets come from environment variables or a vault (OQ-086).
- Strongly typed options are validated on start.
- The connection string targets a local SQL Server instance (LOCAL-DEVELOPMENT.md).

## 10. Date, time & money
- Timestamps are stored as UTC `datetime2` (`DateTime` in UTC, or `DateTimeOffset` [P]). Business dates (expense date, payment date, expiry) are stored as `date` (`DateOnly`).
- The business timezone (`Asia/Amman` [P]) converts "today" and period boundaries. `IClock` provides the current time, so tests can control it.
- Money follows one representation across all layers: see DATABASE-DESIGN.md §3 and API-DESIGN.md §7.

## 11. Frontend architecture
See FRONTEND-ARCHITECTURE.md (all [P]).

## 12. Explicitly not used
MediatR, CQRS, event sourcing, microservices, message brokers, generic repositories, AutoMapper (manual projection is clearer and keeps queries translatable [P]), an EF lazy-loading proxy, the EF InMemory provider for tests.
