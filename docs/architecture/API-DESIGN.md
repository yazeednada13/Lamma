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
