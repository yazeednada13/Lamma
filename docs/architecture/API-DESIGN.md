# API Design — Lamma (Proposal)

**Status:** Phase 0 conventions proposal [P]. Concrete endpoint contracts are finalized per phase in that phase's plan and recorded here at the Backend checkpoint.

---

## 1. Style
- REST over HTTPS with JSON, base path **`/api/v1`**.
- Resources are plural nouns: `/orders`, `/products`, `/customers`. Actions that are not CRUD use sub-resources with POST: `/orders/{id}/status`, `/orders/{id}/payments`, `/orders/{id}/return`, `/courier/settlements`.
- IDs are GUIDs. Orders can also be fetched by number: `GET /orders/by-number/{number}`.
- JSON uses camelCase. Enums are serialized as the spec's string codes (`"confirmed"`, `"cod"`).
- The OpenAPI document is generated with built-in `Microsoft.AspNetCore.OpenApi` and served in Development only.

## 2. Authentication & tenancy
- All endpoints except the `auth/*` ones require authentication.
- Endpoints for business data also require the `RequireBusiness` policy (the user is onboarded).
- **No endpoint accepts a BusinessId.** The current business is resolved on the server (MASTER-ARCHITECTURE §6).
- With cookie auth (option A), the antiforgery header `X-XSRF-TOKEN` is required on unsafe methods.

## 3. Requests & responses
- A success response returns the DTO directly, with no envelope. Status codes:
  - `201 Created` plus `Location` on create
  - `200` with the updated resource after an action
  - `204` on delete
- Writes return the **server-computed** figures (totals, available stock, payment status), so the UI never computes them authoritatively.
- DTOs are explicit records per use case (`CreateOrderRequest`, `OrderDetailsDto`, `OrderListItemDto`). Entities are never exposed.

## 4. Lists: paging, filtering, sorting
- Query parameters: `page` (from 1), `pageSize` (default 20, **max 100**), `search`, `sort` (`createdAt`, `-createdAt`, `total`), plus domain filters (`status`, `categoryId`, `segment`, `from`, `to`).
- The response shape is `{ "items": [...], "page": 1, "pageSize": 20, "totalCount": 134 }`.
- Count endpoints are separate where the UI needs them, e.g. `GET /orders/status-counts`, `GET /sidebar/indicators`.
- Keyset paging is an option for the movement log (`?after=<cursor>`).

## 5. Errors — ProblemDetails (RFC 9457)
```json
{
  "type": "https://lamma.app/errors/order.invalid_transition",
  "title": "Invalid status transition",
  "status": 409,
  "detail": "ما بنقدر ننقل الطلب من «تم التوصيل» إلى «مؤكد».",
  "code": "order.invalid_transition",
  "traceId": "00-…",
  "errors": { "items[0].quantity": ["الكمية أكبر من المتوفر (3)."] }
}
```

| Status | When |
|---|---|
| 400 | Malformed request |
| 401 | Not authenticated |
| 403 | Authenticated but not allowed, e.g. not onboarded |
| 404 | Not found, **including another business's ID** |
| 409 | Conflict: invalid transition, concurrency (`rowVersion` mismatch), stock changed, duplicate |
| 422 | Validation failure (field errors) or an idempotency-key reuse with a different payload |
| 429 | Rate limited |
| 500 | Unexpected (generic message; details only in the logs) |

`detail` and the field messages are **Arabic** and user-safe. `code` is stable, so the frontend can branch on it.

## 6. Idempotency & concurrency [P]
- These POSTs accept a header **`Idempotency-Key: <uuid>`**, generated once per user action by the client:
  - order create
  - order status change
  - undo
  - payment record
  - courier settlement
  - stock receive
  - stock adjust
  - expense create
  - return
- The server stores the key per business together with the request hash and the response (DATABASE-DESIGN §7). A same-key retry returns the original response, and a same key with a different body returns 422.
- **Optimistic concurrency:** mutable resources expose `rowVersion` (base64). Actions on orders send `expectedRowVersion` or `expectedStatus`, and a mismatch returns 409 with the current state.

## 7. Money, quantities, dates [P]
| Kind | Wire format | Example |
|---|---|---|
| Money | **String, exactly 3 decimals**, JOD implied | `"38.000"` |
| Money input | String matching `^\d{1,16}(\.\d{1,3})?$`, normalized by the server to 3 dp | `"38.5"` → `"38.500"` |
| Percent | Number with 1 decimal | `12.5` |
| Quantity | Integer | `2` |
| Timestamp | ISO 8601 UTC | `"2026-11-09T09:40:00Z"` |
| Business date | `YYYY-MM-DD` | `"2026-11-09"` |
| Period | `from`/`to` dates, inclusive, interpreted in the business timezone (`Asia/Amman` [P]) | |

A custom `System.Text.Json` converter handles money strings for `decimal`, so the C# code keeps using `decimal` everywhere.

## 8. Time
- "Today" and period boundaries are computed on the server in the business timezone.
- The client sends `period=this_month|last_month|last_7_days|custom&from&to`, and the server returns the resolved range in the response.

## 9. Indicative endpoint map (finalized per phase)
| Area | Endpoints (indicative) | Phase |
|---|---|---|
| Auth | `POST auth/signup`, `auth/login`, `auth/logout`, `auth/forgot-password`, `auth/reset-password`, `GET auth/antiforgery` (A) or `POST auth/refresh` (B) | 1 |
| Account | `GET/PUT account`, `POST account/change-password` | 1 |
| Onboarding | `POST onboarding`, `GET onboarding/business-types` | 1 |
| Settings | `GET/PUT settings/business`, `PUT settings/channels`, `PUT settings/payment-methods` | 1 |
| Catalog | `categories` CRUD, `product-templates` (GET), `products` CRUD and archive, `products/{id}/variants` | 2 |
| Inventory | `GET inventory/levels`, `POST inventory/receipts`, `POST inventory/adjustments`, `GET inventory/movements`, `GET inventory/expiring` | 3 |
| Customers | `customers` CRUD, `GET customers/{id}/summary`, `GET customers/{id}/orders` | 4 |
| Orders | `GET orders`, `GET orders/status-counts`, `POST orders`, `GET orders/{id}`, `POST orders/{id}/status`, `POST orders/{id}/status/undo`, `POST orders/{id}/cancel` | 5 |
| Payments | `POST orders/{id}/payments`, `POST customers/{id}/payments`, `GET finance/receivables`, `GET finance/receivables/aging` | 6 |
| Courier / expenses | `GET courier/held`, `POST courier/settlements`, `GET courier/settlements`, `expenses` CRUD, `expense-categories` CRUD, `GET expenses/summary` | 7 |
| Returns / pre-orders | `POST orders/{id}/returns`, `GET orders/preorders` | 8 |
| Dashboard | `GET dashboard?period=`, `GET sidebar/indicators` | 9 |
| Reports | `GET reports/pnl`, `GET reports/sales` | 10 |
| Subscription | `GET subscription` (trial days, plans without prices) | 11 |
| Finance overview | `GET finance/overview?period=` | 7 / 9 |

## 10. Versioning
`/api/v1` stays stable within V1. A breaking change introduces `/api/v2` for the affected resources only. Additive changes (new fields) are non-breaking.

## 11. Phase 1 contracts (implemented, 2026-11-10)
All endpoints live under `/api/v1` and use camelCase JSON. Code values (business types, channels, payment methods, plan) are snake_case strings (`"shoes_bags"`, `"bank_transfer"`).

**CSRF:**
- Every POST, PUT, PATCH, or DELETE must send `X-XSRF-TOKEN`, taken from `GET auth/antiforgery`. This includes login and sign-up.
- The token is bound to the signed-in identity, so re-fetch it after sign-up, login, and logout.
- A browser `Origin` that isn't the API itself or listed in `App:AllowedOrigins` is rejected.

**Session:** cookie `lamma.auth` (HttpOnly, Secure, SameSite=Lax). Without "remember me" it is a session cookie; with it, it lasts 14 days, sliding. Its security stamp is checked on every request, so changing or resetting the password ends all other sessions immediately.

| Method & path | Auth | Request body | Success | Errors (code) |
|---|---|---|---|---|
| GET `auth/antiforgery` | anonymous | — | 200 `{ token }` | — |
| POST `auth/signup` | anonymous | `{ fullName, email, password }` | 201 `AccountDto` + session cookie | 409 `auth.email_taken` · 422 `validation.failed` |
| POST `auth/login` | anonymous | `{ email, password, rememberMe }` | 200 `AccountDto` + cookie | 401 `auth.invalid_credentials` · 423 `auth.locked_out` (5 failures → 15 min) · 429 `rate_limited` |
| POST `auth/logout` | user | — | 204 | 401 |
| POST `auth/forgot-password` | anonymous | `{ email }` | 202 (same response whether or not the email exists) | 503 `email.not_configured` (outside Development until a provider is chosen) |
| POST `auth/reset-password` | anonymous | `{ email, token, newPassword }` | 204 (also clears a lockout) | 422 `auth.invalid_token` (field `token`) · 422 `validation.failed` |
| GET `account` | user | — | 200 `AccountDto` | 401 |
| PUT `account` | user | `{ fullName }` | 200 `AccountDto` | 422 |
| POST `account/change-password` | user | `{ currentPassword, newPassword }` | 204 (this session stays, other sessions end) | 422 `auth.wrong_password` (field `currentPassword`) |
| GET `onboarding/business-types` | user | — | 200 `[{ code, labelAr, defaultTemplateCode }]` (13 items; `defaultTemplateCode` added in Phase 2, D-103) | — |
| POST `onboarding` | user | `{ businessName, businessType, salesChannels: ["instagram", …] }` | 201 `AccountDto` (`isOnboarded: true`) | 409 `onboarding.already_completed` · 422 |
| GET / PUT `settings/business` | business | `{ name, businessType, defaultLowStockThreshold }` (0–1000) | 200 `{ name, businessType, defaultLowStockThreshold, currency }` | 403 `business.not_onboarded` · 422 |
| GET / PUT `settings/sales-channels` | business | `{ channels: [{ channel, isEnabled }] }` (all 4, each once) | 200 same shape | 422 `settings.channel_required` · 422 `validation.failed` |
| GET / PUT `settings/payment-methods` | business | `{ methods: [{ method, isEnabled }] }` (all 6, each once) | 200 same shape | 422 `settings.payment_method_required` · 422 `validation.failed` |
| GET `/health` | anonymous | — | 200 `Healthy` | — |

`AccountDto` = `{ id, fullName, email, isOnboarded, business: null | { id, name, businessType, trialEndsAt, trialDaysRemaining, plan } }`. `trialDaysRemaining` counts whole days in Asia/Amman local dates, and it is display only (D-011).

Notes for the frontend:
- The settings lists are wrapped in an object (`{ channels: [...] }`) instead of being a bare array. This lets them be validated and extended later.
- Login lockout returns **423**.
- Generic codes: `request.malformed` (400), `auth.unauthenticated` (401), `auth.forbidden` (403), `http.404`, `server.error` (500), `security.csrf` / `security.origin_rejected` (400).

## 12. Phase 2 contracts: Catalog (implemented, 2026-11-17)
All endpoints need an onboarded business (`403 business.not_onboarded` otherwise). Another business's ids return **404**. Money is a 3-dp string on output. Money input accepts at most 2 decimals (D-080), and a third decimal gives a 422 field error. Unsafe methods need `X-XSRF-TOKEN`.

| Method & path | Request | Success | Errors (code) |
|---|---|---|---|
| GET `categories` | — | 200 `[{ id, name, productCount }]` (non-archived, by name; count = active products) | — |
| POST `categories` | `{ name }` (≤ 60) | 201 `{ id, name, productCount }` | 409 `category.duplicate_name` · 422 |
| PUT `categories/{id}` | `{ name }` | 200 same shape | 404 `category.not_found` · 409 · 422 |
| DELETE `categories/{id}` | — | 204: deleted, or archived when only archived products use it (D-095) | 409 `category.has_products` (detail gives the count) · 404 |
| GET `product-templates` | — | 200 `[{ code, nameAr, supportsExpiry, supportsGiftBox, defaultAxes:[{ name, suggestedValues[] }], fields:[{ key, labelAr, type, options[], isRequired, isCustom }] }]` (6 system templates, plus the business's custom fields) | — |
| POST `product-templates/{code}/fields` | `{ labelAr (≤ 40), type: text\|number\|select\|date, options[] (select: 1–20), isRequired }` | 201 field | 404 `template.not_found` · 409 `template.duplicate_field_label` / `template.field_limit` (20) · 422 |
| PUT `product-templates/{code}/fields/{key}` | same | 200 field | 404 `template.field_not_found` · 409 · 422 |
| DELETE `product-templates/{code}/fields/{key}` | — | 204 (stored product values are kept but no longer shown or validated) | 404 |
| GET `products` | `search, categoryId \| uncategorized=true, stockStatus=in\|low\|out, archived=true, sort=-createdAt\|createdAt\|name\|-name\|available\|-available, page (≥ 1), pageSize (1–100, default 20)` | 200 `{ items:[ProductListItem], page, pageSize, totalCount }` | 422 `validation.failed` |
| POST `products` | `CreateProductRequest` (below) | 201 `ProductDetails` + `Location` | 404 `category.not_found` · 422 `validation.failed` (field paths such as `sellingPrice`, `variants`, `attributes.fabric`, `expiryDate`) |
| GET `products/{id}` | — | 200 `ProductDetails` | 404 `product.not_found` |
| PUT `products/{id}` | `{ name, categoryId?, templateCode, sellingPrice, cost, lowStockThreshold, attributes{}, optionNames[] }` (renames axes; their count is fixed) | 200 `ProductDetails` | 404 · 422 `product.axes_fixed` · 422 |
| POST `products/{id}/archive` · `/restore` | — | 200 `ProductDetails` | 404 |
| POST `products/{id}/variants` | `{ values[], openingQuantity, priceOverride?, costOverride?, expiryDate?, optionNames? }`. On a simple product, `optionNames` converts it (only at zero stock) | 201 `ProductDetails` | 409 `product.duplicate_variant` / `product.too_many_variants` / `product.convert_has_stock` · 422 |
| PUT `products/{id}/variants/{variantId}` | `{ priceOverride?, costOverride?, expiryDate? }` (null clears the override) | 200 `ProductDetails` | 404 `product.variant_not_found` · 409 `concurrency.conflict` · 422 |
| POST `products/{id}/variants/{variantId}/archive` · `/restore` | — | 200 `ProductDetails` | 409 `product.last_variant` / `product.default_variant_retired` · 404 |
| PUT `products/{id}/image` | multipart, field `file` | 200 `ProductDetails` | 422 `product.image_invalid_type` (checked by content: jpg/png/webp) / `product.image_too_large` (> 5 MB) / `product.image_missing` · 404 |
| DELETE `products/{id}/image` | — | 204 | 404 |
| GET `products/{id}/image` | — | 200 image stream (`X-Content-Type-Options: nosniff`) | 404 `product.not_found` / `product.image_not_found` |

**`CreateProductRequest`:**
```json
{ "name": "فستان كتان", "categoryId": null, "templateCode": "clothing", "sellingPrice": "38", "cost": "17",
  "lowStockThreshold": null, "attributes": { "fabric": "كتان 100%" }, "expiryDate": null,
  "options": [ { "name": "المقاس", "values": ["S", "M"] }, { "name": "اللون", "values": ["زيتي"] } ],
  "variants": [ { "values": ["S", "زيتي"], "openingQuantity": 3, "priceOverride": null, "costOverride": null } ] }
```
- `templateCode` omitted → the business type's default (D-091). `lowStockThreshold` omitted → the business default.
- No `options` → simple product: `variants` is empty or one entry with `values: []` that carries the opening quantity.
- `expiryDate` is accepted only for templates with `supportsExpiry` and applies to all variants (D-101).
- Opening quantities become `receive` movements with `referenceKind: "opening"` in the same transaction (D-096).

**`ProductListItem`:** `{ id, name, categoryId, categoryName, templateCode, imageUrl, minPrice, maxPrice, onHand, reserved, available, lowStockThreshold, stockStatus, variantCount, isArchived, createdAt }`. `variantCount` counts non-default active variants.

**`ProductDetails`:**
- List fields plus `sellingPrice, cost, marginPerUnit, marginPercent (number, 1 dp), attributes{key: value}, options:[{ name, values[] }], variants:[...], recentMovements:[...], updatedAt`.
- `variants[]` = `{ id, values[], label, price, cost, priceOverride, costOverride, onHand, reserved, available, stockStatus, expiryDate, isArchived, isDefault }`, active first, in creation order.
- `recentMovements[]` = the last 10 `{ id, variantId, variantLabel, type, referenceKind, label, onHandDelta, reservedDelta, unitCost, isAutomatic, createdAt }`.

**Stock status (D-099):**
- Product: `out` when available ≤ 0, `low` when ≤ `lowStockThreshold`, otherwise `in`.
- Variant: `out` at ≤ 0, `low` at 1 (the prototype heatmap rule), otherwise `in`.
- Archived variants are excluded from the totals.

**Image URL:** `/api/v1/products/{id}/image?v=<file id>`. The image changes URL when it is replaced. Responses are never publicly cacheable, because the auth cookie is renewed on each request.

## 13. Phase 3 contracts: Inventory (implemented, 2026-11-18)
All endpoints need an onboarded business. Another business's ids return **404 `inventory.variant_not_found`**. Unsafe calls need `X-XSRF-TOKEN`, and **receive and adjust also need `Idempotency-Key: <uuid>`** (D-112).
- A missing or invalid key returns 422 `idempotency.key_required`.
- A retry with the same key returns the stored response (same status code).
- The same key with a different body returns 422 `idempotency.key_reused`.
- The client generates the key once per user action and reuses it on retries.

| Method & path | Request | Success | Errors |
|---|---|---|---|
| POST `inventory/receipts` | `{ receivedOn? (≤ today, Asia/Amman; default today), supplier? ≤100, note? ≤200, lines[1..50]: { variantId, quantity 1..100000, unitCost (≥0, ≤2 dp), expiryDate? } }` (no duplicate variants) | 201 `{ id, receivedOn, supplier, note, pieces, totalCost, lines:[{ productId, productName, variantId, variantLabel, quantity, unitCost, lineTotal, newOnHand, newCost }] }` | 404 · 409 `stock.archived` · 422 (`lines[i].expiryDate` for templates without expiry) |
| POST `inventory/adjustments` | `{ variantId, delta (≠0), reason: damage\|loss\|count\|correction\|gift, note? ≤200 }` (increase: count/correction only) | 200 `{ movementId, productId, productName, variantId, variantLabel, delta, onHand, reserved, available, stockStatus }` | 409 `stock.below_reserved` · 409 `stock.archived` · 422 `stock.invalid_reason` |
| GET `inventory/levels` | `search, categoryId, status=low\|out, page, pageSize ≤100` | 200 paged `{ productId, name, categoryName, templateCode, imageUrl, onHand, reserved, available, lowStockThreshold, stockStatus, variants:[{ variantId, label, onHand, reserved, available, cost, expiryDate }] }`, most urgent first (available ÷ threshold) | 422 |
| GET `inventory/summary` | — | 200 `{ stockValueAtCost, retailValue, expectedProfit, pieces, reserved, productCount, lowCount, outCount, lowNames[≤2], outNames[≤2] }` (active products/variants, D-113) | — |
| GET `inventory/movements` | `direction=in\|out, origin=auto\|manual, productId, variantId, page, pageSize ≤100 (default 50)` | 200 paged `{ id, productId, productName, variantId, variantLabel, type, referenceKind, label, adjustmentReason, note, onHandDelta, reservedDelta, unitCost, isAutomatic, createdAt }`, newest first | 422 |
| GET `inventory/expiring` | — | 200 `[{ productId, productName, templateCode, imageUrl, variantId, variantLabel, onHand, expiryDate, daysLeft, status: expired\|soon\|ok }]`, nearest first, only variants with stock (D-108, D-111) | — |

**Rules:**
- **Receive** raises on hand and sets the variant cost to the weighted average (D-109). The expiry date follows the oldest stock (D-108). It writes one `receive` movement per line (`referenceKind: receipt`, label = supplier or «استلام بضاعة»).
- **Adjust** writes an `adjustment` movement whose label is «تعديل: <reason>».
- No purchases expense is recorded (D-107).

## 14. Phase 4 contracts: Customers (implemented, 2026-11-20)
All endpoints need an onboarded business. Another business's id returns 404 `customer.not_found`.

| Method & path | Request | Success | Errors |
|---|---|---|---|
| GET `customers` | `search` (name, or ≥ 3 digits of the number in any format), `segment=vip\|owes\|new\|dormant`, `archived`, `sort=-spent\|name\|-createdAt`, `page`, `pageSize ≤ 100` | 200 paged `{ id, name, phone (E.164 or null), channel, city, area, orderCount, totalSpent, balanceDue, lastOrderOn, segments[], isArchived, createdAt }` | 422 |
| GET `customers/summary` | — | 200 `{ total, activeThisMonth, averageSpent, totalDue, customersWithDue, segments: { vip, owes, new, dormant } }` | — |
| GET `customers/{id}` | — | 200 `CustomerDetails` = list fields + `notes, averageOrder, updatedAt` | 404 |
| POST `customers` | `{ name ≤100, phone?, channel (sales channel code), city? (governorate code), area? ≤100, notes? ≤500 }` | 201 `CustomerDetails` | 409 `customer.duplicate_phone` (+ `existingCustomerId`, `existingCustomerName`) · 422 `customer.invalid_phone` · 422 `validation.failed` |
| PUT `customers/{id}` | same body | 200 `CustomerDetails` | 404 · 409 · 422 |
| POST `customers/{id}/archive` · `/restore` | — | 200 `CustomerDetails` | 404 |

**Rules:**
- Phones are stored as E.164 (D-116). Jordanian input such as `0791234567` or `+962 79 123 4567` becomes `+962791234567`.
- City codes are the 12 governorates: `amman, irbid, zarqa, balqa, mafraq, jerash, ajloun, madaba, karak, tafilah, maan, aqaba` (D-117).
- **The figures and segments are derived** (D-033, D-114, D-115). Until orders exist (Phase 5) they are `0`, `null` and `["new"]`.
