# Frontend Architecture — Lamma (Proposal)

**Status:** [P] in full. **No package has been installed.** Each library below needs founder approval in DECISIONS.md (P-016, P-017) before Phase 1 Part B.
**Approved constraints:** React + TypeScript · Arabic RTL first · responsive · preserve the visual identity · real APIs (no mock data) · `frontend-reference/` untouched.

---

## 1. Requirements that drive the choices
| Requirement (source) | Implication |
|---|---|
| ~36 pages, nested shell, mobile hubs | Client-side router with nested layouts |
| Server-computed figures; frequent refetch after mutations (status change updates counts, stock, dashboard) | Server-state cache with invalidation |
| Many forms (sign-up, 4-step order, product with variant matrix, receive, settings) with Arabic errors | Form library + schema validation |
| Money exactness | Typed money strings, integer-fils math |
| RTL, existing CSS with logical properties | Keep the existing CSS. No CSS-in-JS framework needed |
| Solo founder, maintainability | Small, mainstream, well-documented libraries only |

## 2. Proposed stack
| Concern | Proposal | Why | Alternatives considered |
|---|---|---|---|
| Build tool | **Vite** (React + TS template) | The standard choice for a React SPA: fast, minimal config, first-class TS | Next.js: SSR/SEO not needed for an authenticated SPA, and it adds server complexity. CRA: deprecated |
| Language | **TypeScript strict** | Catches errors early. API DTO types | — |
| Routing | **React Router** (data/declarative mode) | Nested layouts (AuthLayout, AppShell), route guards, lazy routes | TanStack Router: good, but a smaller ecosystem |
| Server state | **TanStack Query** | Caching, invalidation after mutations, loading and error states, retries | Plain fetch + context: re-implements caching. RTK Query: needs Redux |
| HTTP | **Thin `fetch` wrapper** (`apiClient`) | No dependency. Handles the base URL, credentials, antiforgery header, the `Idempotency-Key`, and ProblemDetails parsing into a typed `ApiError` | Axios: unnecessary for these needs |
| Forms | **React Hook Form** | Performant, works well with dynamic arrays (order lines, variant matrix) | Formik: heavier, less active |
| Validation | **Zod** (+ `@hookform/resolvers`) | Typed schemas, Arabic messages, reused for parsing API responses where useful | Yup |
| Client state | React state/context only | Server state lives in TanStack Query. Little global UI state (sidebar collapse, toasts) | Redux/Zustand: not needed |
| Styling | **Existing CSS** (`tokens.css` + prototype CSS) then CSS Modules gradually | Preserves the design exactly, with no new framework (§5) | Tailwind: would mean rewriting the design system |
| Charts | **Port the prototype's SVG charts** (bars, curve, donut, waterfall) as React components | Matches the design, no dependency, small data sizes | Recharts: adds weight and needs restyling |
| Icons | Local Tabler SVGs → `<Icon>` component | Already in the reference (MIT) | An icon package |
| Testing | **Vitest + React Testing Library + user-event**; **MSW** in tests only | Fast, Vite-native. MSW mocks the network in tests without touching product code | Jest: slower with Vite |
| E2E (later) | Playwright | [O] Phase 12, needs approval | Cypress |
| Lint/format | ESLint (typescript-eslint, react-hooks) + Prettier | Standard | — |

## 3. Folder structure
```
frontend/
  public/                    fonts/, logo/ (copied from frontend-reference/assets)
  src/
    app/                     App.tsx, router.tsx, providers.tsx (QueryClient, Toasts), guards (RequireAuth, RequireBusiness)
    layouts/                 AuthLayout, OnboardingLayout, AppShell/ (Sidebar, Topbar, BottomBar, TrialBanner)
    components/              shared UI: Button, TextField, MoneyInput, Badge, DataTable, Dialog, Drawer, Toast, EmptyState, Skeleton, charts/, art/
    features/
      auth/  onboarding/  settings/  catalog/  inventory/  customers/  orders/  finance/  reports/  dashboard/  subscription/
        api.ts               typed endpoint functions + query keys
        hooks.ts             useOrders(), useChangeOrderStatus() (TanStack Query)
        schemas.ts           Zod schemas
        pages/               route components
        components/          feature components
    lib/
      apiClient.ts           fetch wrapper, ApiError, ProblemDetails parsing, idempotency helper
      money.ts               parse/format/integer-fils helpers
      dates.ts               business-timezone display helpers
      i18n/ar.ts             Arabic labels: statuses, payment statuses, channels, methods, errors
    styles/                  tokens.css, lamma.css, cards.css, ... (copied), global.css
    types/                   API DTO types (hand-written from API-DESIGN; codegen from OpenAPI is an option [O])
  index.html                 lang="ar" dir="rtl"
```

## 4. Key patterns
- **Auth:** `RequireAuth` redirects to `/login`, and `RequireBusiness` redirects to `/onboarding`. The session comes from `GET /account` (cookie option A) or from the in-memory access token with silent refresh (option B).
- **Mutations:** each mutation sends an `Idempotency-Key` generated when the action starts, so a retry or double-click reuses the same key. On success the client invalidates the related queries (order, order lists, status counts, sidebar indicators, inventory) and shows a toast. An undo toast calls the undo endpoint.
- **Loading, error, and empty states:** every page uses `Skeleton` (the prototype's `.skel`), a typed `ErrorState` (with retry), and an `EmptyState` (the prototype's art).
- **Forms:** Zod schemas mirror the server rules for fast feedback. Server `errors` from ProblemDetails map back onto the fields.
- **Money:** amounts are typed as `MoneyString`. The live receipt computes in integer fils, and the display uses `formatMoney()`. The server's response replaces the previews.
- **RTL:** `dir="rtl"` on `<html>`, logical CSS properties only, directional icons flipped through a CSS class, numbers and phone numbers wrapped in `<bdi class="ltr">`. No LTR toggle (D-006).
- **Responsive:** the prototype's breakpoints (1280, 1024, 768). Tables become cards below 768, and drawers become bottom sheets.
- **Accessibility:** focus trap and Esc on dialogs and drawers, `aria-label` on icon buttons, focus ring tokens, `prefers-reduced-motion` respected (the prototype's rules are kept).
- **No mock data in product code.** MSW handlers live under `src/test/` only.

## 5. CSS reuse strategy [P-017]
1. Copy `tokens.css` and the 7 prototype CSS files into `src/styles/` unchanged, and import them globally in a fixed order (the same as `index.html`).
2. Components render the **same class names** as the prototype, so the visual output matches it from day one.
3. When a component's styles are fully isolated, they may move to a co-located `*.module.css` file, with tokens still referenced through CSS variables. This is optional and gradual, and never changes the visuals without approval.
4. Fonts are loaded via `@font-face` from `public/fonts`, using the prototype's `unicode-range` split (IBM Plex Sans Arabic and Inter).

## 6. Testing (see TESTING-STRATEGY.md)
Component tests for the primitives (MoneyInput, StockMeter, badges). Page and workflow tests with MSW cover new order, status change with undo, record payment, and form validation errors from ProblemDetails. There are also tests for the `apiClient` (idempotency header, error parsing) and the `money.ts` helpers.
