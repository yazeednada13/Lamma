# Decisions Log — Lamma

Status labels: **Approved** · **Proposed** · **Rejected** · **Out of scope**. Only the founder moves an item to Approved. Each change is logged at the bottom with its date.

Sources:
- **MP** = founder master prompt (Phase 0 brief).
- **REF** = `frontend-reference/Lamma-UI-Design/docs/decisions.md` (9 Nov 2026).
- **F** = founder instruction during the Phase 0 review.

---

## A. Approved decisions

### A1. Product & scope
| ID | Decision | Source |
|---|---|---|
| D-001 | Product is Lamma (لَمّة), with the brand line "كل شغلك بمكان واحد" | MP |
| D-002 | It is a responsive web application. It is not a marketplace, storefront builder, social-automation tool, or multi-vendor platform | MP |
| D-003 | The business owner enters orders manually from social and messaging channels | MP |
| D-004 | V1 has **one user (the owner) per business**. No employees, teams, or roles | MP, REF |
| D-005 | The data model must allow future multi-user support without implementing it now | MP |
| D-006 | Arabic first, RTL first. **The English LTR UI is out of scope for V1.** The prototype's "LTR preview" toggle is **not ported** to React | MP, F |
| D-007 | Currency is JOD (د.أ) only. Money uses precise decimals and never float/double | MP |
| D-008 | Numbers use Latin digits. The currency sign "د.أ" comes after the number. A negative sign stays bound to its number (`<bdi>`) | REF |
| D-009 | 13 business types: Clothing, Shoes & Bags, Perfume, Beauty, Accessories, Gifts, Home Food, Handmade, Electronics, Kids, Home Decor, Books, Other. The type sets the default product template. A product may use a different template | MP, REF |
| D-010 | Free trial: the first month is free with full features, and the remaining days are shown. Plans are monthly and yearly; yearly saves two months. **Prices are undecided. Do not invent them** | MP, REF |
| D-011 | Trial-expiration enforcement is **not approved**. Do not implement it until it is approved | MP |

### A2. Business rules
| ID | Decision | Source |
|---|---|---|
| D-020 | Seven order statuses: new, confirmed, preparing, courier, delivered, cancelled, returned, with Arabic labels | MP |
| D-021 | Four payment statuses: paid, partial, unpaid, courier (held by the courier company) | MP |
| D-022 | Sales channels: Instagram, WhatsApp, Facebook, Other | MP |
| D-023 | Payment methods: Cash, CliQ, Bank Transfer, Cash on Delivery, Zain Cash, Orange Money. The owner enables or disables each one | MP |
| D-024 | Reserving statuses are confirmed, preparing, and courier. Entering a reserving status adds to Reserved; leaving one for a non-reserving status subtracts from it | MP |
| D-025 | Delivered: OnHand −= qty, Reserved −= qty, and deliveredAt is recorded. Sold is derived from delivered items | MP |
| D-026 | Cancelled releases any active reservation and never deducts stock. Returned puts eligible quantities back in stock with a movement | MP |
| D-027 | A status change and its inventory effects happen in **one DB transaction**. Transitions are validated. Retries must not duplicate effects. Concurrency is protected | MP |
| D-028 | Every stock change creates a StockMovement: type, quantity, variant, reference, auto/manual flag, timestamp. Movement types are reserve, release, sale, receive, adjustment, return | MP |
| D-029 | Available = OnHand − Reserved. A normal order cannot exceed Available. Pre-orders are the exception, under rules still to be approved | MP |
| D-030 | Revenue is recognized **on delivery**. Confirmed or preparing orders are not revenue; they may be shown as "expected sales" | MP, REF |
| D-031 | Order Total = Σ(qty × unit price) + delivery fee − discount. COGS = Σ(qty × unit cost) | MP |
| D-032 | OrderItem snapshots the unit price and unit cost. History never changes when product prices change | MP |
| D-033 | Derived values are never maintained by hand as the source of truth. These are product sold/reserved, customer orders/spent/balance/last order, and courier held/pending | MP |
| D-034 | Net Sales = Sales − Returns. Gross Profit = Net Sales − COGS. Net Profit = Gross Profit − Expenses by category | MP |
| D-035 | The courier settlement difference (expected − received) is recorded automatically as a delivery expense, never twice | MP |
| D-036 | Default low-stock threshold is 5, per product | MP, REF |
| D-037 | Customer segments are VIP, Owes Money (balance > 0), New (≤ 2 orders), and Dormant (last order more than 14 days ago). Thresholds are centralized and documented | MP |
| D-038 | Receivables aging buckets: 0–7, 8–30, and over 30 days | MP |
| D-039 | Dashboard figures are computed from records. Caching is allowed only if it is justified and correct | MP |

### A3. Technology & architecture
| ID | Decision | Source |
|---|---|---|
| D-050 | Frontend is React with TypeScript | MP |
| D-051 | Backend is ASP.NET Core Web API (C#), EF Core, SQL Server, and ASP.NET Core Identity | MP |
| D-052 | Clean Architecture plus a Modular Monolith. Layers are Domain, Application, Infrastructure, API, and Tests | MP |
| D-053 | **Backend Engineering Standards are mandatory:** Clean Architecture with strict dependency direction, built-in DI registered through extension methods, focused repositories behind interfaces (no generic repository), application services with thin controllers, professional LINQ/EF Core use, async with CancellationToken, centralized ProblemDetails errors, proper transaction boundaries, safe logging, unit and integration tests | F |
| D-054 | **Do not use** MediatR, CQRS, microservices, unnecessary abstractions or patterns, generic repository frameworks, or unnecessary dependencies | MP, F |
| D-055 | Controllers never access DbContext | F |
| D-056 | No mock data replaces real backend integration | MP |
| D-057 | The original `frontend-reference/` files are preserved and never modified. The React app is a separate folder | MP |

### A4. Governance
| ID | Decision | Source |
|---|---|---|
| D-070 | **Mandatory Phase Execution Workflow** (gates 1–8; trigger words `Backend`, `Frontend`, `Next Phase`). See CLAUDE.md §1 | F |
| D-071 | The founder performs **all Git operations**, including branches, commits, pushes, PRs, and merges. Claude provides the exact commands only | MP, F |
| D-072 | The founder performs **all EF Core migrations and DB updates**. Claude provides the exact commands only | MP, F |
| D-073 | No package or tool installation without approval | MP |
| D-074 | Backend work is completed and reviewed before the matching frontend work | MP |
| D-075 | Before every PR, Claude provides a ready-to-paste **PR title and description**, plus the source and target branches | F |

### A6. Phase 1 prerequisite decisions (founder answers, 2026-11-10)
| ID | Decision | Source |
|---|---|---|
| D-076 | Target **.NET 9** (supersedes the P-019 recommendation of .NET 10) | F, OQ-001 |
| D-077 | Authentication: **ASP.NET Core Identity cookie + antiforgery** (option A of P-004) | F, OQ-002 |
| D-078 | V1 sign-up and login use **email + password**; password recovery by email link. Mobile/SMS is deferred. Provider TBD | F, OQ-003 |
| D-079 | User–Business link: **BusinessMembership** table, unique UserId in V1 (approves P-002) | F, OQ-004 |
| D-080 | Money **input and display at 2 decimals**; storage and API at 3 (`decimal(19,3)`) | F, OQ-005 |
| D-081 | Onboarding: **spec order** (name → single business type → channels) | F, OQ-007 |
| D-082 | Backend request validation with **FluentValidation** (approves P-015; installing the package is approved as part of Phase 1) | F |
| D-083 | **Scoped exception to the DB rule:** test fixtures may create and drop throwaway `Lamma_Test_<guid>` databases on LocalDB (EnsureCreated/EnsureDeleted). They never touch `Lamma_Dev` or any real database | F |
| D-084 | Email confirmation is **not required** before login in V1 (until an email provider is chosen) | F |
| D-085 | Unbuilt modules stay visible in the navigation and open an Arabic "coming soon" page (no fake data) | F |
| D-087 | **Execution granularity:** after `Backend`, Claude implements all approved Backend tasks of the phase in one continuous run, with no stop between tasks, then gives one consolidated report and stops at gate 4. `Frontend` works the same way up to gate 6. Each task is still built, tested, and reviewed. This replaces "one task at a time, STOP after each" | F |
| D-086 | Phase 1 plan approved (2026-11-10). It also approves P-001, P-003, P-005, P-013, P-014, P-016, P-017, P-020 and the Phase 1 package list | F |

### A5. Visual identity (from REF; preserve)
| ID | Decision |
|---|---|
| D-090 | Mark: a hand-drawn slanted shadda. Wordmark in olive `#3F4F2A`, with the shadda and "m" in brick `#C8553D` |
| D-091 | Palette: olive, dark olive, apricot, brick, cream, sage. Apricot appears only on dark backgrounds |
| D-092 | Brand font is Readex Pro. The UI font (v2) is IBM Plex Sans Arabic plus Inter for numbers (tabular). All are SIL OFL |
| D-093 | v2.1 background is olive mist `#EFF1EB`, and the sidebar is 276px |

---

## B. Proposed — awaiting founder approval
Details are in the architecture docs. Each item becomes Approved only when the founder says so.

| ID | Proposal | Doc |
|---|---|---|
| P-001 | Solution layout `Lamma.Domain` / `Application` / `Infrastructure` / `Api` plus test projects, with module folders inside each | MASTER-ARCHITECTURE §3 |
| P-002 | `BusinessMembership` join table (unique UserId in V1) instead of `Business.OwnerUserId` | MASTER-ARCHITECTURE §6 |
| P-003 | Tenant isolation through `ICurrentBusiness`, EF global query filters, a SaveChanges interceptor, and same-business reference validation | MASTER-ARCHITECTURE §6 |
| P-004 | Authentication: option A (Identity cookie) or option B (JWT plus rotating refresh cookie). **Recommendation: A** | MASTER-ARCHITECTURE §7 |
| P-005 | Money stored as `decimal(19,3)`, rounded AwayFromZero to 3 dp, sent over the API as a 3-dp string | DATABASE-DESIGN §3 |
| P-006 | **Default-variant rule:** every product has at least one ProductVariant, and stock always lives on variants | DATABASE-DESIGN §5 |
| P-007 | Optimistic concurrency with `rowversion` on ProductVariant and Order | DATABASE-DESIGN §9 |
| P-008 | `Idempotency-Key` header on status-change, payment, settlement, and receive-stock POSTs | API-DESIGN §6 |
| P-009 | Undo as a compensating reversal, allowed only within a window and only if nothing later touched the order | DATABASE-DESIGN §7 |
| P-010 | Pre-order data as a 1:0..1 extension (`OrderPreOrderInfo`) of Order | DATABASE-DESIGN §5 |
| P-011 | Soft-archive (`IsArchived`) for products, customers, and categories that are referenced. Hard delete only when unreferenced | DATABASE-DESIGN §10 |
| P-012 | Payment status is **derived** from payments versus the total plus the COD/courier state, not stored as the source of truth | DATABASE-DESIGN §8 |
| P-013 | Thin `IUnitOfWork` (SaveChanges plus ExecuteInTransaction) implemented by DbContext | MASTER-ARCHITECTURE §4.3 |
| P-014 | Errors as domain or application exceptions mapped centrally to ProblemDetails, not a Result<T> library | MASTER-ARCHITECTURE §4.4 |
| P-015 | FluentValidation for request validation (needs a package) | MASTER-ARCHITECTURE §4.6 |
| P-016 | Frontend stack: Vite, React Router, TanStack Query, a thin fetch wrapper, React Hook Form plus Zod, Vitest, React Testing Library, MSW (tests only) | FRONTEND-ARCHITECTURE |
| P-017 | Reuse the prototype's `tokens.css` and CSS files as global styles first, then move them to per-component CSS gradually | FRONTEND-ARCHITECTURE §5 |
| P-018 | Business timezone `Asia/Amman` for "today" and period boundaries. Store timestamps in UTC | API-DESIGN §8 |
| P-019 | Target .NET: .NET 10 LTS (needs an SDK install) versus .NET 9 (installed). **Recommendation: .NET 10 LTS** | OPEN-QUESTIONS OQ-001 |
| P-020 | Architecture tests: reflection-based xUnit (no package) or NetArchTest (needs a package) | TESTING-STRATEGY §3 |
| P-021 | Offset pagination with a maximum page size of 100; keyset pagination as an option for the movement log | API-DESIGN §4 |
| P-022 | Order number: a sequential integer per business, starting at 1001 | DATABASE-DESIGN §5 |

---

## C. Rejected / out of scope (V1)
| ID | Item | Status | Source |
|---|---|---|---|
| R-001 | WhatsApp order sharing | Rejected for now | MP, REF |
| R-002 | Data export | Rejected for now | MP, REF |
| R-003 | Expense receipt photos | Rejected for now | MP, REF |
| R-004 | Dark mode | Rejected for now | MP, REF |
| R-005 | Customer invoices | Rejected for now | MP, REF |
| R-006 | English LTR interface, including the LTR-preview toggle | Out of scope (V1) | MP, F |
| R-007 | Multiple users, employees, permissions | Out of scope (V1) | MP |
| R-008 | MediatR, CQRS, microservices, generic repositories | Rejected | MP, F |
| R-009 | A separate Unit of Work object layered over DbContext (beyond the thin interface in P-013) | Rejected by default | F |

---

## D. Change log
| Date | Change |
|---|---|
| 2026-11-10 | D-075 added (PR title and description before every PR) |
| 2026-11-10 | D-076–D-082 added from the founder's P0 answers before Phase 1 |
| 2026-11-10 | D-083–D-086 added; Phase 1 plan approved |
| 2026-11-10 | D-087 added: all Backend tasks run together, then all Frontend tasks together |
| 2026-11-10 | Initial log created in Phase 0 from MP, REF, and the founder's review instructions (workflow, engineering standards, status-label discipline, LTR toggle exclusion) |
