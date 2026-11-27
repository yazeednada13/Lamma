# Phase 11 Plan — Subscription, platform admin & public sign-up (Approved 2026-11-22)

## Context
Phase 10 is merged and the founder created the Phase 11 branch (`feature/phase11-subscription-admin`). Phase 11 was expanded on 2026-11-22 (D-159). It keeps the original Phase 11 (trial status, days left, plans, trial banners, the trial-expired state) and adds a public sign-up, a platform admin and the paid-subscription lifecycle. The rules are already approved: D-159–D-167. The domain is still open (OQ-092); it blocks go-live only, not this phase.

**What the code has today:**
- `Business` stores `TrialStartsAt`/`TrialEndsAt` (30 days from onboarding) and a display-only `SubscriptionPlan`.
- Sign-up is open (`POST auth/signup`).
- `IEmailSender` only sends the password reset, through a dev-only logging sender.
- `IFileStorage` exists (D-094).
- Identity roles are already registered (`AddRoles`, role tables exist).
- The frontend `subscription` feature has the sidebar trial card and banner only; `/subscription` is a «قريبًا» route.

**Outcome:** a merchant comes from the Instagram bio, reads the landing page, leaves name, email and mobile, receives a branded email, sets a password on a locked-email page and starts the 30-day trial. When the trial or plan ends the account becomes read-only. The merchant pays by CliQ and uploads the proof in the app. The founder approves it in the admin area and the plan opens at once. The founder sees subscribers, leads, pending payments and a simple dashboard, and can change any subscriber's status.

**Rules:** D-106 lean verification. No Git, no migrations by Claude, no package installs (SMTP uses the built-in `System.Net.Mail`). Prices from D-165. Status derived from periods (D-167).

---

## 0. Decisions recorded on approval
| ID | Decision | Recommendation |
|---|---|---|
| D-173 | **Run Phase 11 in two cycles:** 11-I (public sign-up) runs plan → `Backend` → checkpoint → `Frontend` → checkpoint → PR. Then 11-II (admin and lifecycle) runs the same cycle on the same branch, or a new one if the founder prefers. Each part is checked and reviewed on its own | Yes: smaller reviews and earlier testing of the sign-up |
| D-174 | **URLs:** an anonymous visitor at `/` sees the landing page (the Instagram bio link). A signed-in owner at `/` sees the dashboard as today. `/login` stays. `/signup` redirects to the landing form. The registration page is `/register?token=…`. The admin area is `/admin` | Yes |
| D-175 | **Admin account:** a separate account with no business, given the `PlatformAdmin` role from a server setting (`Platform:AdminEmails`) at startup. There is no sign-up path to admin. The admin area has its own layout. Admin requests need the role; business requests need a business, so the two never mix | Yes |
| D-176 | **Read-only mode (D-162) in detail:** blocked = every create/change/delete of business data, settings included (403 `subscription.read_only`). Allowed = everything to view and search, sign-out, account and password, the subscription page and sending a payment request. Enforced on the server for every business endpoint; the UI shows why and links to «اشترك» | Yes |
| D-177 | **When an approved plan starts:** the day after the current trial or plan ends if it is still running (no lost days), otherwise on the approval day. Monthly = 1 calendar month, yearly = 12 months. The admin can set another start date when activating by hand | Yes |
| D-178 | **Payment proof:** jpg/png/webp/pdf, 5 MB max, checked by content, stored privately via `IFileStorage`, shown only to the owner and the admin. One pending request at a time. A rejection carries a reason shown to the owner | Yes |
| D-179 | **Billing details:** the CliQ alias and account name are server settings (`Billing:Cliq:Alias`, `Billing:Cliq:Name`) the founder fills in. Each business gets a fixed reference code `LM-<number>` for the transfer note | Yes; the founder sends the alias before 11-II |
| D-180 | **Trial start:** stays at onboarding, which follows registration immediately (D-160). An admin «extend trial» moves the trial end. It can also reopen an ended trial | Yes |
| D-181 | **Removing the old `SubscriptionPlan` column:** the plan is now derived from the periods (D-167), so the column is dropped in the 11-II migration and the API returns the derived plan | Yes |

---

## Part 11-I — Public sign-up (D-160, D-161, D-166)

### Backend tasks (after `Backend`)
| ID | Task | Key details |
|---|---|---|
| 11.A1 | **`SignupLead`** (platform-level, not tenant-owned) | Fields: full name, email (normalized, unique), Jordanian mobile E.164 (`+9627[789]xxxxxxx`, required), optional store name, UTM source/medium/campaign, status `pending`/`registered`, invite token hash (SHA-256), expiry, sends count, last sent, created/registered at, user id |
| 11.A2 | **`POST public/signup`** (anonymous) | Validation in Arabic; honeypot field must be empty; rate limits per IP (5/min) and per email (3 sends/day). The same 202 answer whether the email is new, pending or already a user, so nobody can probe emails. A pending lead gets a fresh link (the old one stops working). An existing user gets no invite; the response still says to check the inbox |
| 11.A3 | **Invitation token** | 32 random bytes (base64url) in the link only; the database keeps the hash. Valid 72 hours, single use, bound to the lead's email |
| 11.A4 | **`GET public/invitations/{token}`** + **`POST auth/register`** | GET returns `{ email, fullName }` for a valid token, 410 `invite.expired` or 404 `invite.invalid` otherwise. Register takes `{ token, password, confirmPassword }`: same password rules as today, creates the user with the lead's name, email and mobile, marks the lead registered, signs in, and the client goes to onboarding (trial starts there) |
| 11.A5 | **Closing open sign-up** | `Registration:InviteOnly` (default `true`): `POST auth/signup` answers 404 when on. The integration-test host sets it off for the existing helper, and new tests cover the invite-only path |
| 11.A6 | **Email (D-166)** | `IEmailSender` gains `SendInvitationAsync`, plus the 11-II messages later. Branded Arabic RTL HTML templates with inline CSS (Lamma colours and wordmark as text, no remote images until a domain exists); user input HTML-encoded. Development keeps a file sender (one `.html` per email in a local folder outside the repo, path logged). An SMTP sender (Brevo) is used when `Email:Smtp:*` is configured; secrets come from user-secrets or environment variables, never the repo |
| 11.A7 | **Checkpoint** | Migration **`AddSignupLeads`** (one table). Report and commands |

**Focused tests:** phone and email rules; honeypot; the same answer for new, pending and existing emails; the per-email send limit; the token is stored hashed, works once, expires after 72 h, and a resend kills the old link; register with a mismatched confirmation; register signs in and onboarding starts the 30-day trial; `auth/signup` is closed when invite-only; the email file contains the link and the escaped name.

### Frontend tasks (after `Frontend`)
| ID | Task |
|---|---|
| 11.B1 | **Landing page** (anonymous `/`), mobile first, Lamma identity: hero «كل شغلك بمكان واحد» with an animated order slip moving through its statuses (جديد ← قيد التجهيز ← مع المندوب ← تم التسليم); the problem → Lamma's answer; five feature cards styled as order slips `#001–#005` (orders, stock, customers and dues, courier and expenses, dashboard and reports); three steps (سجّل ← افتح إيميلك ← ابدأ شهرك المجاني); pricing after the free month (9 / 90 د.أ, D-165); short FAQ; a sticky «ابدأ شهرك المجاني» button on phones; footer with «تسجيل الدخول». UTM parameters are passed to the form |
| 11.B2 | **Sign-up form** (in the page): name, email, Jordanian mobile, optional store name, hidden honeypot; on success, a «تفقّد إيميلك» state with what happens next |
| 11.B3 | **`/register?token=`:** the name and email shown locked, password with the existing strength meter, confirmation; expired or invalid links explain what to do and link back to the form; success → onboarding. `/signup` redirects to the landing form |
| 11.B4 | **Checkpoint:** `tsc`, `lint`, `check:architecture`, tests, build; manual checklist (landing at 390/768/1024/1440, form errors, the email file, register, expired link) |

New feature folder: `features/public-signup` (landing, form, register). The landing page uses the public layout, not the AppShell.

---

## Part 11-II — Platform admin & subscription lifecycle (D-162–D-165, D-167)

### Backend tasks (after `Backend`)
| ID | Task | Key details |
|---|---|---|
| 11.A8 | **Subscription model** | `SubscriptionPeriod` (business, plan monthly/yearly, starts/ends on (business dates), amount, CliQ reference, source `payment`/`admin`, payment request id, created by, created/cancelled at). `Business` gains a suspension (at, reason) and the reference code. The trial stays on `Business`. A pure domain **status calculator**: trial · trial grace · trial ended · active (plan, end date) · active grace · plan ended · suspended; days left; read-only flag (3-day grace, D-167) |
| 11.A9 | **Read-only enforcement (D-176)** | One authorization filter on business endpoints for unsafe methods: 403 `subscription.read_only` unless the endpoint is on the allowed list. GET is never blocked. Covered by a test that walks every mutating business endpoint |
| 11.A10 | **Owner subscription API** | `GET subscription`: status, days left, trial dates, current period, plans with prices (D-165), CliQ alias/name, reference code, pending request, period history. `POST subscription/payment-requests` (multipart: plan + proof, D-178). `GET subscription/payment-requests/{id}/proof` (own only) |
| 11.A11 | **Platform admin role and access (D-175)** | `PlatformAdmin` role assigned at startup from `Platform:AdminEmails` (idempotent); policy `RequirePlatformAdmin`; `AdminAuditLog` (admin, action, business or lead, details, at) written in the same transaction as each admin change; `LastLoginAt` on users |
| 11.A12 | **Admin API** (`/api/v1/admin/*`) | **Dashboard:** pending leads, active trials, trials ending in 7 days, paying subscribers, read-only accounts, suspended, pending payments, monthly revenue (Σ monthly 9 + yearly 90/12), sign-ups per week (8 weeks), trial → paid conversion. **Subscribers:** search by name, email, mobile or store; status filter; paging. **Subscriber detail:** owner, business, created, last sign-in, order and product counts only (P-025), periods, payment requests, notes, audit. **Actions:** extend trial (days), activate plan (plan, start, amount, reference, note), extend plan (days), end plan, suspend (reason), reactivate, add note. **Payments:** pending list, proof, approve (opens the period, D-177), reject (reason). **Leads:** list and resend invite |
| 11.A13 | **Emails and reminders** | Templates: payment received, approved (plan and end date), rejected (reason), reminders 7, 3 and 1 days before the trial or plan ends, and «حسابك صار للقراءة فقط». A hosted background service runs daily at 09:00 Amman and is idempotent through a `ReminderLog` (business, kind, target date, unique) |
| 11.A14 | **Checkpoint** | Migration **`AddSubscriptionsAndAdmin`**: SubscriptionPeriods, PaymentRequests, AdminAuditLogs, ReminderLogs; Businesses + suspension and reference code, − `SubscriptionPlan` (D-181); AspNetUsers + `LastLoginAt`. Report and commands |

**Focused tests:**
- Status calculator on every boundary (last trial day, grace days, plan end, suspension, extension after expiry).
- Read-only: blocked and allowed lists; the GET pass.
- Payment request: file checks, one pending, approval start date (running vs ended, D-177), rejection.
- Admin: every action writes an audit row; owners get 403 on admin routes and the admin gets 403 on business routes; the subscriber detail exposes no customer or order data (P-025).
- Reminders: sent once per day and kind; MRR and conversion figures.

### Frontend tasks (after `Frontend`)
| ID | Task |
|---|---|
| 11.B5 | **`/subscription`** (prototype `#/subscription`): ring and day dots for the trial or plan, two plans (monthly 9, yearly 90 «وفّر شهرين»; not the prototype's three), a «ادفع بكليك» drawer (alias, name, amount and reference with copy buttons, proof upload), the pending/approved/rejected state, period history in place of the invoices table |
| 11.B6 | **Status everywhere:** the sidebar trial card and banners follow the derived status (trial, grace, read-only, plan ending); the prototype's **«انتهت التجربة»** state page; a blocked action shows a friendly dialog with «اشترك» instead of a raw error |
| 11.B7 | **Admin area** (`/admin`, its own layout): dashboard cards and the weekly sign-ups chart; subscribers table with search, filter and status chips; subscriber page with the actions above (each confirmed, D-120); payments queue with the proof viewer and approve/reject; leads list with resend. Arabic RTL, responsive |
| 11.B8 | **Checkpoint:** checks, build, manual checklist (trial → read-only → payment → approval → active; admin actions; widths) |

New feature folder: `features/admin` with its own layout (recorded in FRONTEND-ARCHITECTURE as a second shell); `features/subscription` grows the page and the read-only UI.

---

## 1. API contracts (summary; full shapes go into API-DESIGN §21 during Backend)
- **Public:** `POST /api/v1/public/signup` → 202 · `GET /api/v1/public/invitations/{token}` → `{ email, fullName }` | 404 | 410 · `POST /api/v1/auth/register` → 201 account (signed in).
- **Owner:** `GET /api/v1/subscription` · `POST /api/v1/subscription/payment-requests` (multipart) · `GET /api/v1/subscription/payment-requests/{id}/proof`.
- **Admin:** `GET /api/v1/admin/dashboard` · `GET /api/v1/admin/subscribers` · `GET /api/v1/admin/subscribers/{businessId}` · `POST /api/v1/admin/subscribers/{businessId}/{extend-trial|activate|extend|end-plan|suspend|reactivate|notes}` · `GET /api/v1/admin/payment-requests` · `GET …/{id}/proof` · `POST …/{id}/{approve|reject}` · `GET /api/v1/admin/leads` · `POST /api/v1/admin/leads/{id}/resend`.
- Money as 3-dp strings, errors as ProblemDetails, CSRF on every POST as today, Idempotency-Key on payment requests and admin activations.

## 2. Database (migrations are applied by the founder)
| Migration | Changes |
|---|---|
| `AddSignupLeads` (11-I) | `SignupLeads` (unique normalized email, index on token hash) |
| `AddSubscriptionsAndAdmin` (11-II) | `SubscriptionPeriods`, `PaymentRequests`, `AdminAuditLogs`, `ReminderLogs`; `Businesses` + `SuspendedAt`, `SuspendReason`, `ReferenceCode` (unique), − `SubscriptionPlan`; `AspNetUsers` + `LastLoginAt` |

## 3. Security and privacy
- Tokens are random, single-use and stored hashed.
- Public answers never reveal whether an email exists; there are rate limits and a honeypot.
- Admin access is role-only, comes from server settings, and every admin change is audited. The admin sees subscription metadata and counts only (P-025).
- Proof files are private, content-checked and served only to their owner and the admin.
- Read-only mode is enforced on the server.
- No secrets in the repo; SMTP credentials come from user-secrets or environment variables.
- Email templates encode all user text.

## 4. Risks
- **No domain yet (OQ-092):** real emails may land in spam or be refused; development uses the file sender, so the whole flow is testable.
- **Read-only filter coverage:** a missed endpoint would let an expired account write. Covered by a test over all mutating routes.
- **Existing tests use open sign-up:** handled by the test-host setting (11.A5).
- **Background reminders on a single server** are fine for V1; the reminder log makes repeats harmless.

## 5. Documentation updates
DECISIONS (D-173–D-181), API-DESIGN §21, DATABASE-DESIGN (new tables), FRONTEND-ARCHITECTURE (admin shell, public layout), FRONTEND-AUDIT (routes `/subscription`, `/trial-expired`, new public and admin routes), LOCAL-DEVELOPMENT (email file folder, admin setting, Brevo settings), PHASE-PLANS, PROJECT-PROGRESS.

---

## 6. Part 11-I frontend manual checklist (gate 6, D-106)
| # | Scenario | Expected |
|---|---|---|
| 1 | Open `/` signed out (also with `?utm_source=ig`) | Landing page (redesign 2026-11-22): dark hero where the scattered pieces gather into one order card and the shadda draws; the business-types band; the before/after switch (turns by itself once); the five features with the sticky phone (inline screens on phones); the order-journey scene (message → packing → courier → delivered → money in, with the live order card; click a stage to jump, «وقّف/شغّل»); the profit waterfall counting up; three steps; pricing with the monthly/yearly switch; FAQ; the form (confetti on send); footer |
| 2 | 390 px | No horizontal scroll; the sticky «ابدأ شهرك المجاني» button shows, hides when the form is in view, and scrolls to the form |
| 3 | Send the form empty, then with a landline | Arabic field errors; «اكتب رقم موبايل أردني…» |
| 4 | Send a valid form | «تفقّد إيميلك» with the masked email; an `.html` file appears in `%TEMP%\lamma-emails` and the API log shows the link |
| 5 | Open the email file | Branded RTL email with the name, store name, «أكمل تسجيلك» button, 3 steps, 72-hour note |
| 6 | Open the link | `/register`: name and email locked; strength meter; mismatched confirmation is refused |
| 7 | Register | Lands on onboarding with the name; after onboarding the trial shows 30 days |
| 8 | Open the same link again / after 72 h | «الرابط ما بيشتغل» with the server's reason and «ابعتلي رابط جديد» → `/#join` |
| 9 | `/signup`, «ابدأ تجربتك المجانية» on `/login` | Both lead to the landing form |
| 10 | Signed in at `/` | The dashboard as before |

---

## 7. Part 11-II detailed plan (approved 2026-11-22)
11-I is merged. This section turns the approved outline (11.A8–11.A14, 11.B5–11.B8; D-162–D-167, D-173–D-181) into concrete work. The founder sent the CliQ details: alias **YAZEED133**, account name **YAZEED NADA** (D-179; not secret, shown to subscribers).

### 7.1 Points confirmed with this plan
| ID | Point | Recommendation |
|---|---|---|
| D-182 | **The admin email** for `Platform:AdminEmails`. The admin account is created like any other: the public form → invitation → `/register` with that email, then promoted at startup. It needs no business, and onboarding is skipped for it | The founder names the email (it goes into user-secrets or an environment variable, not the repo) |
| D-183 | **Status words in Arabic:** «تجربة مجانية» · «فترة سماح» (3 days, D-167) · «انتهت التجربة» · «مشترك شهري/سنوي حتى …» · «انتهى الاشتراك» · «موقوف». Read-only = trial ended, plan ended, or suspended | Yes |
| D-184 | **Reference code:** `LM-` + a number per business starting at 1001, assigned on first use, unique | Yes |
| D-185 | **Onboarding prefill:** the store name from the sign-up form fills the onboarding name field (editable) | Yes (the 11-I known limitation) |
| D-186 | **Reminders:** 09:00 Amman every day, by email and in the app, 7, 3 and 1 days before the trial or plan ends, plus once when the account becomes read-only. Sent once per business, kind and date | Yes |

### 7.2 Backend tasks (run together after `Backend`)
| ID | Task | Key details |
|---|---|---|
| 11.A8 | **Subscription domain** | `SubscriptionPeriod` (business, plan monthly/yearly, startsOn/endsOn as business dates, amount, CliQ reference, source `payment`/`admin`, payment request id, created by, created at, cancelled at/by). `Business` gains `SuspendedAt`, `SuspendReason` and `ReferenceCode`; `SubscriptionPlan` is dropped (D-181). A pure `SubscriptionStatus.Compute(trialEndsAt, periods, suspension, now, zone)` returns the status, plan, end date, days left, grace and read-only flag. Unit-tested on every boundary |
| 11.A9 | **Read-only enforcement (D-162, D-176)** | One MVC filter on every business-policy action with an unsafe method: 403 ProblemDetails `subscription.read_only` (Arabic message) unless the action carries `[AllowWhenReadOnly]`. Allowed: account and password, logout, subscription payment requests. The status is computed once per request. A test walks all 53 write endpoints and checks each one is either blocked or explicitly allowed |
| 11.A10 | **Owner subscription API** | `GET subscription`: status, days left, trial dates, current period, history, plans with prices (9 / 90 JOD, D-165), CliQ alias and name, reference code, pending request. `POST subscription/payment-requests` (multipart: plan + proof; jpg/png/webp/pdf ≤ 5 MB checked by content; one pending; Idempotency-Key). `GET subscription/payment-requests/{id}/proof` (own only). The account DTO gains a small `subscription` summary (status, read-only, days left, end date) so the app shell can show banners without another call |
| 11.A11 | **Platform admin access (D-175)** | Role `PlatformAdmin` given at startup to the emails in `Platform:AdminEmails` (idempotent). Policy `RequirePlatformAdmin`. The account DTO gains `isPlatformAdmin`. `AdminAuditLog` (admin, action, business or lead, JSON details, at) is written in the same transaction as each change. `AspNetUsers.LastLoginAt` is updated on login |
| 11.A12 | **Admin API** (`/api/v1/admin`) | **Dashboard:** pending leads, active trials, trials ending in 7 days, paying subscribers, read-only, suspended, pending payments, monthly revenue (monthly 9 + yearly 90/12 of active periods), sign-ups per week (8 weeks), trial → paid conversion. **Subscribers:** search (name, email, mobile, store), status filter, paging. **Subscriber detail:** owner, business, created, last sign-in, order and product counts only (P-025), periods, payment requests, notes, audit. **Actions:** extend trial (days), activate plan (plan, start, amount, reference, note; the D-177 start rule as default), extend plan (days), end plan, suspend (reason), reactivate, add note. **Payments:** pending list, proof, approve (opens the period, email), reject (reason, email). **Leads:** list (pending, registered, filters) and resend the invitation. Every action is Idempotency-Key protected and audited |
| 11.A13 | **Emails and reminders** | Templates: payment received, approved (plan and end date), rejected (reason), reminders (7/3/1 days), read-only notice. A hosted `BackgroundService` runs daily at 09:00 Amman; a `ReminderLog` (business, kind, target date, unique) makes repeats harmless |
| 11.A14 | **Checkpoint** | Migration **`AddSubscriptionsAndAdmin`**. API-DESIGN §21 (11-II part), DATABASE-DESIGN, LOCAL-DEVELOPMENT (admin and billing settings). Report and commands |

**Focused tests (D-106), one full run at the end:**
- Status calculator boundaries: the last trial day, each grace day, plan end, extension after expiry, suspension.
- Read-only: the write-endpoint walk; GET always allowed.
- Payment request: file checks, one pending at a time, the approval start date (running vs ended, D-177), rejection.
- Admin: each action writes an audit row; owners get 403 on admin routes and the admin gets 403 on business routes; the detail shows no customers, orders or finances (P-025).
- Reminders: once per day and kind. Dashboard figures: revenue and conversion.

### 7.3 Frontend tasks (run together after `Frontend`)
| ID | Task |
|---|---|
| 11.B5 | **`/subscription`** (prototype `#/subscription`): ring and day dots for the trial or plan; two plans (monthly 9, yearly 90 «وفّر شهرين»); a «ادفع بكليك» drawer with the alias, name, amount and reference (copy buttons) and the proof upload; the pending, approved and rejected states; period history in place of the invoices table |
| 11.B6 | **Status everywhere:** the sidebar card and banners follow the status (trial, grace, read-only, plan ending); the prototype's «انتهت التجربة» page; a blocked action (403 `subscription.read_only`) opens a friendly dialog with «اشترك» instead of an error; onboarding prefills the store name (D-185) |
| 11.B7 | **Admin area** (`/admin`, its own layout, Lamma identity): dashboard cards and the weekly sign-ups chart; subscribers table (search, filter, status chips); subscriber page with the actions (each confirmed, D-120); payments queue with a proof viewer and approve/reject; leads list with resend. The admin lands on `/admin` after login. Arabic RTL, responsive |
| 11.B8 | **Checkpoint:** checks, build, manual checklist (trial → grace → read-only → payment → approval → active; admin actions; widths) |

### 7.4 Database
Migration **`AddSubscriptionsAndAdmin`** (applied by the founder):
- New tables: `SubscriptionPeriods`, `PaymentRequests`, `AdminAuditLogs`, `ReminderLogs`.
- `Businesses`: + `SuspendedAt`, `SuspendReason`, `ReferenceCode` (unique, filtered); − `SubscriptionPlan`.
- `AspNetUsers`: + `LastLoginAt`.
- Existing businesses keep their trial dates and get no periods, so their status is computed from the trial alone.

### 7.5 Risks
- **Read-only coverage:** a missed write endpoint would let an expired account write. Covered by the endpoint walk test.
- **The first admin:** if `Platform:AdminEmails` is empty there is simply no admin; the app works as before.
- **Proof files** are private data: stored outside the web root and served only to the owner and the admin.
- **Reminder emails need a real provider and a domain** (OQ-092) to reach inboxes; until then they go to the dev file folder.

### 7.6 Part 11-II frontend manual checklist (gate 6, D-106)
Before you start: set the admin email in user-secrets (`Platform:AdminEmails:0`), sign that account up through the landing form → email file → `/register`, then restart the API so it is promoted.

| # | Scenario | Expected |
|---|---|---|
| 1 | Sign in as an owner in the trial | Sidebar card «تجربة مجانية، ضل N يوم»; no banner while more than 7 days are left |
| 2 | Admin: extend the trial so it has ≤ 7 days left (or use a fresh trial and end-plan) | Owner sees the top banner «ضل … من تجربتك المجانية · اشترك» |
| 3 | Owner opens `/subscription` | Ring + day dots, two plans (9 / 90 «وفّر شهرين»), reference `LM-…`, period history empty |
| 4 | «ادفع بكليك» → copy buttons → upload a jpg/png/pdf (try a 6 MB file and a .txt first) | Copy works; big or wrong files are refused in Arabic; a valid one shows «بانتظار المراجعة»; a second submit is blocked while one is pending |
| 5 | Admin signs in | Lands on `/admin` (no onboarding, no sidebar); dashboard cards and the weekly chart; tab counts |
| 6 | Admin → الدفعات | The pending card with the proof (image zooms, PDF opens); reject with a reason → owner sees the reason on `/subscription` and an email file |
| 7 | Owner pays again, admin approves | Owner becomes «مشترك» with the end date; the plan starts after the trial (D-177); email file |
| 8 | Admin → المشتركين | Search by name/email/phone, status chips, paging; open a subscriber: facts, counts only (no order details) |
| 9 | Subscriber page actions: تفعيل خطة, تمديد التجربة, تمديد الخطة, إنهاء الخطة, إيقاف → إرجاع, ملاحظة | Each asks to confirm or opens its drawer; the status line updates; every action appears in «سجل العمليات» |
| 10 | Suspend the owner, then the owner tries to add an order | One dialog «حسابك موقوف/للقراءة فقط» with «اشترك الآن» → `/subscription`; reading pages still works; the banner shows |
| 11 | Owner opens `/trial-expired` when read-only | The «انتهت التجربة» state page with the subscribe button |
| 12 | Admin → المسجّلين | Pending/registered filter, search, «ابعت الرابط» (new email file, send count +1), WhatsApp link opens with the local number |
| 13 | An owner opens `/admin` | Redirected away (not an admin) |
| 14 | Widths 1440 / 1024 / 768 / 390 | Admin bar tabs scroll on phones; tables scroll inside their card; drawers full-width on 390; no page-wide horizontal scroll; RTL |
