# Phase 12 Plan — Hardening & launch readiness (Approved 2026-11-28)

## Context
Phase 11 is merged (11-I 2026-11-22, 11-II 2026-11-28). Every V1 feature now exists. Phase 12 makes it safe, fast and ready to put in front of real merchants. The roadmap lists six tasks (12.A1–12.A3, 12.B1–12.B3) and three blocking questions: OQ-084 (offline drafts), OQ-086 (hosting) and OQ-089 (legal pages). OQ-092 (the domain) is still open and blocks real email delivery.

**What the code has today (inspected 2026-11-28):**
- Rate limiting per IP on login, sensitive auth actions and the public sign-up form.
- HSTS outside Development, CORS with an explicit header list, antiforgery on every unsafe request, tenancy filters and the cross-tenant write interceptor.
- `/health` exists but does not check the database.
- **No** security response headers (CSP, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`).
- **No** persisted Data Protection keys: after a restart or on a second server, every session cookie and antiforgery token becomes invalid.
- **No** forwarded-headers setup for running behind a proxy (needed for HTTPS detection and per-IP rate limits).
- Logging is the default console logger; no structured or request logging, no error monitoring.
- Frontend bundle: one JS chunk over 500 kB (build warning since Phase 1; route splitting was deferred here).
- Known debts carried here: the Phase 7 default-category MERGE race (1 in 3 runs under three simultaneous first requests), product images not cached by the browser (Phase 3 note), the customer-balance correlated subquery (Phase 6 note).

**Outcome:** a reviewed, measured, documented V1 that can be deployed by a written runbook to the host the founder chooses, with backups, logs and a launch checklist. Nothing new for the merchant except legal pages and, if approved, the new-order draft.

**Rules:** D-106 lean verification. No Git, no migrations or database updates by Claude, **no package installs without approval** (every package below is listed as an open decision with a no-package alternative). One phase at a time; STOP at every gate.

---

## 0. Proposed: run Phase 12 in two parts (like Phase 11, D-173)
| Part | Scope | Can start |
|---|---|---|
| **12-I Hardening** | Security, performance, reliability, accessibility, code splitting, debts | Now: needs no hosting decision |
| **12-II Launch** | Deployment runbook and config for the chosen host, backups, monitoring, legal pages, launch checklist | After OQ-086 (host), OQ-089 (legal text) and OQ-092 (domain) |

Each part runs plan → `Backend` → checkpoint → `Frontend` → checkpoint → PR.

---

## Part 12-I — Hardening

### Backend tasks (after `Backend`)
| ID | Task | Key details | Acceptance |
|---|---|---|---|
| 12.A1 | **Security review** | Walk every endpoint for: auth policy (owner / admin / anonymous), tenancy (no client BusinessId; 404 on another business's id), CSRF on unsafe methods, idempotency where money or stock moves, validation limits (string lengths, page sizes, file sizes), error bodies (no stack traces, no internal ids outside Development). Review cookies (`Secure`, `HttpOnly`, `SameSite`), password and lockout policy, reset-token lifetime, admin email handling, proof-file access. Output: a findings table in `docs/architecture/SECURITY-REVIEW.md`, each finding fixed or recorded with a reason | Findings table complete; every High/Medium fixed with a test |
| 12.A2 | **Security headers** | One middleware: `Content-Security-Policy` for the API (`default-src 'none'; frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, mic, geolocation off), `Cross-Origin-Opener-Policy: same-origin`. The frontend's own CSP goes with the host (12-II) | An integration test asserts the headers on a normal and an error response |
| 12.A3 | **Data Protection keys and proxy** | Persist Data Protection keys (to the database through a small `DataProtectionKeys` table, or to a configured folder; see decision P-030) so sign-ins survive restarts and a second instance. `ForwardedHeaders` (proto + for) with a configurable known-proxy list, so HTTPS detection and per-IP rate limits work behind the host's proxy | A restart keeps the session (integration test with a shared key store); rate limit keys use the forwarded IP only from a known proxy |
| 12.A4 | **Health and readiness** | `/health` stays public and cheap (liveness). New `/health/ready` checks the database with a short timeout, returns no details anonymously | Ready returns 503 when the DB is down (test with a bad connection string) |
| 12.A5 | **Structured logging** | Built-in JSON console logging in Production (no package), request logging (method, path template, status, duration, trace id; **no** bodies, cookies, emails or phones), log levels by config. The trace id is already in ProblemDetails; the frontend shows it on «حصل خطأ» so a merchant can report it | No personal data in a sample of logs from the full test run |
| 12.A6 | **Performance and indexes** | Seed a realistic volume in a throwaway test database (D-083 rule): 2 years, 5,000 orders, 800 customers, 300 products with variants, payments, returns. Measure the hot endpoints (dashboard, orders list and board, customers list with balances, reports, admin subscribers). Fix N+1 queries and add indexes where a query is slow; target p95 under 300 ms locally. Revisit the customer-balance subquery (Phase 6 note) | A measurements table before/after in `PHASE-PLANS.md`; any new index listed for a migration |
| 12.A7 | **Known debts** | (a) the default-category MERGE race: create defaults once inside a serializable transaction with retry on deadlock, or seed at onboarding; (b) product image caching: serve images with `Cache-Control: private, max-age` and an ETag that survive the cookie refresh | The category test passes 20 runs in a row; images return 304 on revalidation |
| 12.A8 | **Checkpoint** | Migration if 12.A3 uses the database or 12.A6 adds indexes (name proposed: `HardeningKeysAndIndexes`). Full test run, report, commands | — |

### Frontend tasks (after `Frontend`)
| ID | Task | Key details | Acceptance |
|---|---|---|---|
| 12.B1 | **Code splitting** | Route-level `lazy()` for every feature route, the admin area and the landing page in their own chunks; a light route fallback (the existing skeleton). Keep the first screen fast on 4G | No chunk over 250 kB gzip; the build warning is gone; first load of `/` (signed in) smaller than today, measured |
| 12.B2 | **Accessibility audit** | Keyboard path through every main flow (login → onboarding → new order → status → payment), focus visible everywhere, focus trapped and returned in drawers and dialogs, labels on every control, colour contrast (AA) of the Lamma tokens on olive and mist, `aria-live` for toasts, `lang="ar" dir="rtl"`. Fix what fails | Checklist in `TESTING-STRATEGY.md` all ticked; no contrast failures in the token pairs we use |
| 12.B3 | **Reduced motion and cross-browser** | Check every animated piece (landing, welcome slip, board stickers, celebrations) with `prefers-reduced-motion`; check Chrome, Safari (iOS) and Samsung Internet behaviour for date inputs, file upload, sticky bars, `100dvh` | A short results table; fixes for anything broken |
| 12.B4 | **Error and offline states** | One consistent error screen with the trace id; the existing offline screen; the new-order form keeps (D-191) a local draft (browser storage, per user, cleared on submit, never sent anywhere) and offers to restore it | Manual check; unit test for the draft rules if approved |
| 12.B5 | **Checkpoint** | `tsc`, `lint`, `check:architecture`, tests, build, bundle sizes, manual checklist | — |

---

## Part 12-II — Launch (planned in detail after the decisions)
| ID | Task (outline) |
|---|---|
| 12.C1 | Production configuration for the chosen host: connection string and secrets from the host's secret store, `ASPNETCORE_ENVIRONMENT=Production`, CORS origin, cookie domain, file storage for images and proofs, email (Brevo SMTP, D-166) on the real domain with SPF/DKIM/DMARC |
| 12.C2 | Deployment runbook (build, publish, migrate by the founder, smoke test, rollback) and, if approved, a CI pipeline |
| 12.C3 | Backups: automated database backups with retention, a tested restore, file-storage backup for proofs and images |
| 12.C4 | Monitoring: uptime check on `/health/ready`, error alerts (host logs or an approved service), disk and DB size |
| 12.C5 | Legal pages: terms and privacy in Arabic (founder-approved text, OQ-089), linked from the landing, the register page and the footer |
| 12.C6 | Launch checklist: admin email set, CliQ details, reminders on, real emails received, a full trial → payment → approval run on production with a test merchant |

---

## 1. API contracts (12-I)
- New: `GET /health/ready` → 200 `{ status: "ready" }` or 503 (no details).
- Changed: every response carries the security headers (12.A2). Image responses gain cache headers (12.A7).
- No other contract changes.

## 2. Database
- Possible migration `HardeningKeysAndIndexes` (applied by the founder): a `DataProtectionKeys` table if P-030 picks the database; indexes found by 12.A6. Nothing else.

## 3. Tests (D-106)
- Integration: headers, ready check, key persistence across a host restart, forwarded-IP rate limit, category race (repeated), image revalidation.
- Performance: an opt-in test class (like Phase 10's `ReportPerfTests`) that seeds the volume and prints timings.
- Frontend: unit tests only for pure logic (draft rules if approved). Accessibility and browsers by checklist.

## 4. Risks
- **CSP breaking the app:** the API CSP is strict but the API serves JSON and files only; the frontend CSP is set with the host in 12-II and tested before launch.
- **Key persistence migration:** existing sessions end once when keys move to the new store (users sign in again once).
- **Performance seed** must only ever run against a throwaway `Lamma_Test_<guid>` database.
- **Scope creep:** Phase 12 adds no merchant features except the legal pages and, if approved, the draft.

## 5. Documentation updates
SECURITY-REVIEW.md (new), MASTER-ARCHITECTURE (headers, keys, proxy, logging, health), LOCAL-DEVELOPMENT (ready check, logs), TESTING-STRATEGY (accessibility and browser checklists, perf test), PHASE-PLANS, PROJECT-PROGRESS.

---

## 6. Decisions (approved 2026-11-28 with the recommendations: P-029→D-187, P-030→D-188, P-031→D-189, P-032→D-190, OQ-084→D-191, OQ-089→D-192; OQ-086 and OQ-092 stay open for 12-II)
| ID | Question | Options | Recommendation |
|---|---|---|---|
| P-029 | Run Phase 12 in two parts (12-I now, 12-II after hosting/legal/domain)? | Yes / one part | **Yes** |
| P-030 | Where to keep Data Protection keys? | (a) database table (needs `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore`, **package approval**); (b) a folder on persistent disk (no package, fine for one server); (c) decide with the host in 12-II | **(b) now**, revisit with the host |
| P-031 | Error monitoring | (a) host logs only (no package); (b) Sentry or similar (**package + account**) | **(a)** for V1 launch |
| OQ-084 | Offline draft for the new-order form | (a) yes, local only; (b) not in V1 (remove the promise from the offline screen) | **(a)**, small and useful on weak mobile data |
| OQ-086 | Hosting | Azure App Service + Azure SQL; a VPS (Windows/IIS or Linux + Kestrel) with SQL Server; other | Needed for 12-II only. A small Azure App Service + Azure SQL is the least operations work; a VPS is cheaper but you run backups and updates |
| OQ-089 | Terms and privacy text | You provide it / Claude drafts an Arabic draft for your lawyer to review | Claude drafts (marked Proposed), you approve |
| OQ-092 | The domain | Buy one (e.g. `lamma.jo` or `.com`) | Needed before real emails; 12-II |
| P-032 | E2E smoke tests (Playwright) | (a) yes (**npm package approval**); (b) no, manual checklist | **(b)** for V1; revisit after launch |

**Branch:** `feature/phase12-hardening` (created by the founder from `develop`, 2026-11-28).
