# Frontend Architecture — Lamma

**Status:** **Approved (D-089).** This file is the **authoritative reference** for all frontend work. Every new or changed frontend file must follow it. A deviation is allowed only when it is recorded in §11 (Justified exceptions) with its reason.
**Approved constraints:** React + TypeScript · Arabic RTL first · responsive · preserve the visual identity · real APIs (no mock data) · `frontend-reference/` untouched.

---

## 1. Requirements that drive the choices
| Requirement (source) | Implication |
|---|---|
| ~36 pages, nested shell, mobile hubs | Client-side router with nested layouts |
| Server-computed figures; frequent refetch after mutations | Server-state cache with invalidation |
| Many forms with Arabic errors | Form library + schema validation |
| Money exactness | Typed money strings, integer-fils math |
| RTL, existing CSS with logical properties | Keep the existing CSS. No CSS-in-JS framework |
| Solo founder, maintainability | Small, mainstream libraries; feature-based structure with enforced boundaries |

## 2. Stack (Approved, installed in Phase 1)
| Concern | Choice |
|---|---|
| Build tool | Vite 8.3.7 |
| Language | TypeScript 6.0.3, strict |
| Routing | React Router 7.18.5 (data router) |
| Server state | TanStack Query 5.107.1 |
| HTTP | Thin `fetch` wrapper (`services/api/apiClient.ts`): base URL, credentials, antiforgery header, `Idempotency-Key`, ProblemDetails → typed `ApiError` |
| Forms / validation | React Hook Form 7.91.0 + Zod 4.6.7 + @hookform/resolvers 7.0.5 |
| Client state | React state/context only (no Redux/Zustand) |
| Styling | Existing design-system CSS copied unchanged into `styles/design-system/` + `styles/app-additions.css` |
| Charts | Port the prototype's SVG charts as React components (later phases) |
| Icons / illustrations | Generated ES modules in `assets/` from `frontend-reference/` (`npm run sync:design`) |
| Testing | Vitest 5.1.0 + jsdom 27.4.0 + Testing Library + user-event; **MSW 3.0.4 in tests only** |
| Lint / format | ESLint 10 + typescript-eslint + react-hooks; Prettier |
| E2E (later) | Playwright [Open], Phase 12, needs approval |

## 3. Folder structure (final, as implemented)
```
frontend/
  public/                      fonts/, logo/, favicon.svg (served by URL from CSS and <img>)
  scripts/
    sync-design-assets.mjs     regenerates src/styles/design-system and src/assets from frontend-reference/
    check-architecture.mjs     layer / public-API / cycle check (npm run check:architecture)
  src/
    main.tsx
    app/                       application setup: may import every layer below
      providers/AppProviders.tsx
      router/                  routes.tsx (composition only), guards.tsx, RouteErrorPage.tsx,
                               plannedRoutes.ts (coming-soon paths), pages/{ComingSoonPage,NotFoundPage}.tsx
      layouts/
        AuthenticatedLayout.tsx  container: fills the AppShell slots with feature widgets
        app-shell/             AppShell, Sidebar, Topbar, BottomBar, OfflineBanner,
                               useSidebarCollapse, useSlidingPill, useOnlineStatus  (layout only)
      navigation/              navigation.ts (nav model, QUICK_ADD, sectionOf), NavTiles.tsx,
                               navigationRoutes.tsx, pages/{MoreHubPage,QuickAddHubPage}.tsx
    features/                  business modules
      auth/                    sign-in/up, password reset, session (useAccount, CurrentAccountContext), AccountMenu, SidebarUserCard
      subscription/            trial display only (trialStatus, trial card/banner, business card); no enforcement (D-011)
      onboarding/              onboarding wizard (steps, layout, API)
      dashboard/               dashboard page
      settings/                account page, business settings page (with extra-section slots), business types (API labels, D-103), domain code lists
      catalog/                 products list/details/form, variant matrix, categories, templates & custom fields settings section (Phase 2)
      inventory/               stock levels, receive, adjust dialog, movement log, expiry (Phase 3)
      customers/               customers list with segments, profile (orders-section slot), quick-add/edit drawer (Phase 4)
      orders/                  orders list, status board, 4-step new/edit order form, order details, undo, cancel; customer/product history sections (Phase 5)
    shared/                    reusable, business-agnostic code
      ui/                      Button, Icon, Menu, Badge, Chip, Money, PageHeader
        brand/  form/ (incl. MoneyField, ImagePicker)  feedback/  overlay/  toast/  charts/ (Donut)  MetricCard
      lib/                     money, personName, formErrors, useActionKey (one Idempotency-Key per action, D-112)
      validation/              fieldSchemas (emailSchema, personNameSchema)
    services/                  infrastructure: api/apiClient.ts, query/queryClient.ts
    assets/                    generated modules: icons/iconData, illustrations/lammaArt
    styles/                    index.css, app-additions.css, design-system/* (generated, never edited by hand)
    test/                      setup.ts, renderApp.tsx, fakeApi.ts (MSW)
```

### Inside a feature
```
features/<name>/
  index.ts          public API: the only file other folders may import
  routes.tsx        route objects for this feature's pages (composed by app/router/routes.tsx)
  api/              <area>Api.ts: query/mutation hooks, query keys, DTO types
  schemas/          Zod schemas (<thing>Schema)
  domain/           code lists and pure rules owned by the feature
  components/       feature components (presentational where possible)
  pages/            <Name>Page.tsx route components
  <Subject>.test.tsx  tests next to their subject
```
Create only the sub-folders a feature needs.

## 4. Layers and dependency rules
| Layer | May import |
|---|---|
| `assets/` | nothing |
| `services/` | nothing from `app`, `features`, `shared` |
| `shared/` | `services/`, `assets/` |
| `features/<x>` | `shared/`, `services/`, `assets/`, other features **only via `@/features/<y>`** |
| `app/` | everything (features only via their `index.ts`) |
| `app/layouts/app-shell/` | `shared/`, `services/`, `assets/`, its own folder — **never `@/features`** |
| `test/`, `*.test.ts(x)` | anything |

- **Alias:** `@/` → `src/` (`tsconfig.app.json` `paths` + `vite.config.ts` `resolve.alias`). Inside one folder use relative imports (`./`, `../`); across top-level folders always use `@/…`. **`../../` is banned.**
- **Cross-feature edges (current):** `settings → auth`, `onboarding → auth, settings`, `dashboard → auth, settings`, `subscription → auth`, `catalog → auth, settings, inventory`, `customers → settings, payments`, `orders → settings, customers, payments`, `payments → settings`, `finance → settings`, `dashboard → auth, settings, orders`. All point one way; **no cycles** are allowed.
- **Plugging a feature into another feature's screen:** when feature B must show a section on feature A's page and A must not depend on B, A exposes a slot and the **app layer composes them**. Example: `createSettingsRoutes({ extraSections: [productTemplatesSettingsSection] })` in `app/router/routes.tsx`. Phase 5 uses it twice: `createCatalogRoutes({ productOrders })` and `createCustomersRoutes({ customerOrders })` receive the orders feature's `ProductOrdersSection` / `CustomerOrdersSection`. The slot types live in each feature's `slots.ts` (not `routes.tsx`), so the page and the route factory don't import each other. This is the same pattern as the AppShell slots (§6).
- **Enforcement:** ESLint `no-restricted-imports` per folder (`eslint.config.js`) and `npm run check:architecture` (layer violations, deep feature imports, feature imports in the AppShell, `../../`, unresolved imports, import cycles). Both must report 0 before any frontend checkpoint.

## 5. Public-API rule
- Every feature has an `index.ts`. Other folders import `@/features/<name>` only; deep imports such as `@/features/auth/api/sessionApi` are banned.
- Export only what another folder actually uses. Internal helpers stay unexported from `index.ts`.
- `shared/` has **no barrel files**: import each module by its path (`@/shared/ui/form/TextField`).

## 6. The AppShell rule
`app/layouts/app-shell/AppShell.tsx` does **layout composition only**. It takes the nav model and slots (`sidebarHeader`, `sidebarFooter`, `topbarEnd`, `banners`) and renders Sidebar, Topbar, BottomBar and the outlet. Its only hooks are layout hooks (collapse, sliding pill, online status). It contains no auth, session, subscription or business logic.
`app/layouts/AuthenticatedLayout.tsx` is the one container that reads the session and passes feature widgets into the slots (`SidebarBusinessCard`, `SidebarTrialCard`, `SidebarUserCard`, `TrialBanner`, `AccountMenu`).

## 7. What belongs in `shared/`
Only code that is reusable and **business-agnostic**: UI primitives, brand art, overlays, toasts, generic utilities (`personName`, `formErrors`), generic field formats (email, person name), and money formatting (see §11).
Business code lists, policies and rules live in the feature that owns them (for example, the sales channels in `features/settings/domain/`, the password policy in `features/auth/schemas/passwordSchema.ts`, and the trial rules in `features/subscription/trial.ts`).

## 8. Split rules
Split a file only along a real responsibility boundary, never just to cut lines:
- **Page:** data loading, form state, orchestration, submit.
- **Section / step component:** one presentational concern, which receives `register`, `errors` and values as props.
- **`schemas/`:** validation only. **`api/`:** server communication only (UI never calls `apiRequest` directly; it uses hooks).
- **Hook:** one reusable behaviour.
- **Size guide:** components under about 200 lines and pages under about 250. A larger file is split along a boundary, or else listed in §11 with its reason.

## 9. Naming conventions
| Item | Rule | Example |
|---|---|---|
| Folders | lowercase; kebab-case for several words | `app-shell/` |
| Component files | PascalCase, one main component per file, file = component | `TextField.tsx` |
| Pages | `<Name>Page.tsx` under `pages/` | `BusinessSettingsPage.tsx` |
| Hooks | `use<Thing>`; queries `use<Resource>`, mutations `use<Verb><Resource>` | `useSaveSettings` |
| API modules | `<area>Api.ts` under `api/`; keys `<area>Keys` / `<thing>Key` | `settingsKeys`, `accountKey` |
| Non-component modules | camelCase | `apiClient.ts` |
| Types | PascalCase, no `I` prefix; bodies `<Action>Body`; form values `<Form>Values` | `LoginBody` |
| Schemas | `<thing>Schema` in `schemas/` | `signUpSchema` |
| Constants | UPPER_SNAKE for fixed lists | `SALES_CHANNELS` |
| CSS | kebab-case files; design-system class names unchanged | `app-additions.css` |
| Tests | `<Subject>.test.tsx` next to the subject | `AccountPage.test.tsx` |

## 10. Key patterns
- **Routing:** each feature exports route objects from `routes.tsx`. `app/router/routes.tsx` only composes them under the guards (`RequireAuth`, `RequireBusiness`, `RequireNotOnboarded`, `RedirectIfAuthenticated`) and `AuthenticatedLayout`.
- **Session:** `RequireAuth` loads `GET /account` and provides `CurrentAccountContext`; pages read it with `useCurrentAccount()`, so they never render after the session ends.
- **Mutations:** send an `Idempotency-Key` generated when the action starts; on success invalidate the related queries and show a toast.
- **Loading / error / empty states:** `Skeleton`/`PageSkeleton`, `ErrorState` (with retry), `EmptyState`.
- **Forms:** Zod schemas mirror the server rules; ProblemDetails `errors` map back onto the fields (`applyServerErrors`).
- **Money:** `MoneyString` (3-dp string from the API); integer-fils math in `shared/lib/money.ts`; display with `<Money>`.
- **RTL:** `dir="rtl"` on `<html>`, logical CSS only, numbers in `<bdi class="ltr">`. No LTR toggle (D-006).
- **Responsive:** the prototype's breakpoints (1280, 1024, 768); bottom bar on mobile.
- **Icons and illustrations** are generated modules rendered with `dangerouslySetInnerHTML`, from static brand code only (never user input).
- **No mock data in product code.** MSW handlers live in `src/test/` only.
- **CSS:** the design-system files stay unchanged and in the same import order. Components render the prototype's class names. Optional co-located `*.module.css` files are allowed later, but they must never change the visuals without approval.

## 11. Justified exceptions register (post-restructure audit, R6)
| # | Exception | Reason |
|---|---|---|
| E-1 | `app/router/guards.tsx` decides redirects from `isOnboarded` / business presence | Routing is an app concern. It reads the session through `@/features/auth` and holds no business rule |
| E-2 | `shared/ui/form/PasswordStrength.tsx` contains the strength meter's scoring | A display meter only. The password **policy** (what is accepted) is `newPasswordSchema` in auth |
| E-3 | Money formatting in `shared/` (`lib/money.ts`, `ui/Money.tsx`) | V1 has a single currency (D-007). It holds no business rules, and every money-showing feature needs it |
| E-4 | `services/api/apiClient.ts` is 194 lines, left whole | One responsibility (the HTTP client); splitting it would only scatter its internals |
| E-5 | Hand-built `button` markup for the menu trigger (AccountMenu) and the `is-soon` nav buttons | Their markup and classes differ from `Button`; they reproduce the prototype exactly |
| E-6 | Unused primitives kept: `Chip`, `Dialog`, `Money` and the money helpers (used only in tests today) | Approved primitives (plan 1.B3) needed from Phase 2 onward |
| E-7 | Some exported types are used only inside their own module | They are the module's contract (for example DTO and props types) |
| E-8 | Business-type labels exist both in the API (`labelAr`) and the client (`features/settings/domain/businessTypes.ts`) | Unifying them would change behaviour; tracked as **OQ-091** |
| E-9 | Vitest `testTimeout: 30_000`, `asyncUtilTimeout: 10_000`, **`maxWorkers: 4`**, and a 20 s wait after saving in the product-form tests (raised in Phase 3: the dev machine runs at 40–60% CPU from other apps, which slowed the full-app tests ~5×) | Many test files mount the full app in jsdom. With 7 workers on 4 physical cores each full-app test ran ~7× slower and flaked. Each file passes alone with the defaults |
| E-10 | `public/logo/favicon.svg` duplicates `public/favicon.svg` | Keeps the logo folder a mirror of the reference set; removal only on founder request |

| E-11 | `features/catalog/components/` is flat (17 files) instead of sub-folders | `../../` imports are banned (§4), and deep `@/features/catalog/...` self-imports are banned too; sub-folders inside `components/` would need one of them. Files carry their area in the name (`ProductHero`, `VariantsSection`, …) |
| E-13 | `shared/ui/Icon.tsx` has a small `APP_ICONS` map (`archive`) next to the generated set | The prototype's icon set has no archive icon; the generated file must not be edited. Same Tabler source and MIT licence |
| E-12 | `ProductFormPage.tsx` is 202 lines | Within the page guide (~250). Mapping between the form and the API bodies is already split out into the unit-tested `domain/productFormModel.ts` |

**Audit results (2026-11-17):** 0 layer or public-API violations, 0 import cycles (`check:architecture`, 125 files). No UI file calls the API client directly. There are no duplicate type names. No business rule lives in `app/`, `shared/` or the app-shell. The largest files are `apiClient.ts` (194 lines) and `BusinessSettingsPage.tsx` (131 lines).

- **Stock changes across features:** inventory mutations invalidate only `["inventory"]`. Catalog screens refetch on mount (`staleTime` 0), and the shared `AdjustStockDialog` takes an `onDone` callback so the catalog refreshes its own product. Neither feature imports the other's query keys.
- **Confirmations (D-120):** every confirm-worthy action (archive, delete, …) calls `useConfirm()` from `shared/ui/confirm/ConfirmProvider.tsx` (mounted once in `AppProviders`). Pass `action` so the dialog shows the spinner and keeps a server error (e.g. a blocked delete) inside it. Never build an ad-hoc confirm dialog.
- **Error extensions:** `ApiError.problem` keeps the whole ProblemDetails body, so a screen can read error-specific members (e.g. `existingCustomerId` on `customer.duplicate_phone`).
- **Idempotent actions:** `useActionKey()` (`shared/lib/useActionKey.ts`, moved from inventory in Phase 5) keeps one `Idempotency-Key` per request body; retries reuse it, a changed body gets a new one, and success clears it (D-112).
- **Confirmation content:** `useConfirm({ …, content })` renders extra controls (e.g. the cancel-reason chips of an order, D-130) between the text and the buttons. The controls keep their own state; `action` reads it and can throw an `ApiError` to show a message inside the dialog.
- **Payments (Phase 6):** `features/payments` owns the record-payment drawer (order, customer and pick modes), the payment badge, the order payment card, the customer payments section and `/finance/payments`. Orders and customers embed these widgets through `@/features/payments`; payments never imports them (it types the order fields it needs itself, `OrderPaymentInfo`). Payment writes invalidate `["payments"]`, `["orders"]` and `["customers"]`; order writes also invalidate `["payments"]`. The quick action «دفعة» links to `/finance/payments?pay=1`, which opens the drawer in pick mode. The drawer stays mounted with its page, because the toast's «تراجع» (a reversal, D-136) runs after it closes.
- **Finance (Phase 7):** `features/finance` owns `/finance` (overview), `/finance/expenses` (add-expense drawer) and `/finance/courier` (settlement drawer), plus two settings sections (`expenseCategoriesSettingsSection`, `courierSettingsSection`) that the app layer composes into the settings page. It reads only its own endpoints and invalidates `["finance"]`, `["orders"]`, `["customers"]` and `["payments"]` after money writes. The quick action «مصروف» links to `/finance/expenses?add=1`, which opens the drawer.
- **Returns and pre-orders (Phase 8):** the orders feature owns the return drawer (`ReturnDrawer`, per-line pieces and restock, refund range from `returnModel.returnPreview`, which mirrors the server's math in integer fils) and `/orders/preorders` (calendar, `calendarCells`, week from Saturday). The new-order form's «طلب مسبق» option lifts the quantity cap only for «جديد», and `/orders/new?preorder=1` starts with it on. The details drawer always sends the schedule fields, because the API clears a schedule that is omitted.
- **Dashboard (Phase 9):** `features/dashboard` reads `GET dashboard` (every figure computed on the server, API-DESIGN §19) and the inventory levels endpoint for «قرب يخلص» with its own minimal types; «آخر الطلبات» is the orders feature's `LatestOrdersGrid`. Sidebar counters (D-158) come from `useNavBadges()`, which `AuthenticatedLayout` passes to the new `AppShell` slot `navBadges` (plain data keyed by nav item, so the shell stays feature-free); they refetch on every navigation. The shared `Illustration` gained the brand's `packing` art and `sticker`s.
- **Order status moves:** list, board and details share `useOrderMove()` (status change + toast with «تراجع», D-122). Orders invalidate `["orders"]`, `["catalog"]`, `["inventory"]` and `["customers"]`, because a move changes stock, sold and customer figures. The order form reads other modules' endpoints (`/customers`, `/products`) through its own read-only hooks and types in `orders/api`, never through another feature's internals.

**Audit after Phase 5 frontend (2026-11-20):** `check:architecture` reports 0 violations and 0 cycles over 216 files. No UI file calls the API client directly. The order form is split into `OrderCustomerSection`, `OrderLinesSection`, `OrderExtrasSections` and `OrderReceipt`, with the pure state mapping in `domain/orderFormModel.ts` (unit-tested). Largest order files: `OrderFormPage.tsx` 222, `OrderDetailsPage.tsx` 204, `OrdersPage.tsx` 173.

**Audit after Phase 2 frontend (2026-11-18):** `check:architecture` reports 0 violations and 0 cycles over 165 files. No UI file calls the API client directly. Largest files: `ProductFormPage.tsx` 202, `apiClient.ts` 197 (multipart upload added), `ProductsPage.tsx` 182, `VariantsSection.tsx` 161.

## 12. Testing (see TESTING-STRATEGY.md)
Tests sit next to their subjects: shared primitives (Button, Icon, Money, form, Drawer, Toast), `apiClient`, `money`, `trial`; one test file per feature page area; routing and AppShell tests in `app/`. Every test file uses MSW (`src/test/fakeApi.ts`) and `renderApp` (`src/test/renderApp.tsx`, under StrictMode).
