# Phase 2 Plan — Catalog (Approved 2026-11-17)

## Context
Phase 1 is merged into `develop`, and the founder created `feature/phase2-catalog`, so gate 1 is done. The founder asked me to settle every Phase 2 question with my recommendations. That covers OQ-010 to OQ-015, the missing questions N1 to N9, and the conflicts C1 to C5. This plan builds on those answers.

**Objective:** a merchant can:
- manage categories
- pick a product template (with custom fields)
- create a product, either simple or with a size × colour (or similar) variant matrix, with an opening quantity for each variant
- add an image
- browse, search and filter products
- see product details with stock by variant

**Rules for this phase:**
- Phase 3 work is out: receive, adjust, the movement log and expiry views.
- Phase 5 work is out: orders and sales figures.
- No Git, no migrations run by me, no package installs. Every capability below uses packages already installed.

---

## 0. Decisions recorded on approval (DECISIONS.md → Approved)
| ID | Decision | Resolves |
|---|---|---|
| D-090 | **Default variant:** every product has ≥ 1 `ProductVariant`. A simple product gets one hidden default variant with no option values. Stock, movements and (later) order items always reference a variant | OQ-010, P-006 |
| D-091 | **Six system templates** (codes): `clothing` ملابس, `perfume` عطور, `beauty` تجميل, `jewelry` إكسسوارات, `gift` بوكس هدايا, `other` عام. Contents in §2.1 | OQ-011, C3 |
| D-092 | **Templates are system-defined and fixed.** A business may add **custom fields** to any template (max 20 per template). All templates are always available; there is no enable/disable | OQ-012, N8 |
| D-093 | **Option axes:** 0–2 axes per product. Axis names default from the template and are editable. Values are free text with template suggestions. Limits: ≤ 20 values per axis, ≤ 100 variants per product. Variants are any subset of the axis combinations | N1, N7 |
| D-094 | **Image:** one per product, via `IFileStorage`. Local disk in Development (outside the repo). jpg/png/webp only, **checked by content (magic bytes)**, ≤ 5 MB, no thumbnails. Served only through an authenticated, tenant-checked endpoint. The production store is chosen with OQ-086 | OQ-013 |
| D-095 | **Category delete:** blocked (409 with the count) while active products use the category. If only archived products use it, the category is archived instead. Otherwise it is hard-deleted | OQ-014 |
| D-096 | **Opening stock** is recorded as a `receive` movement (D-028 unchanged), with reference kind `opening`, `IsAutomatic = true`, and unit cost = the variant's effective cost | OQ-015, C1 |
| D-097 | **Price and cost:** selling price > 0 is required. Cost ≥ 0 is **required** (an explicit 0 is allowed; empty is rejected). Per-variant price and cost overrides are allowed (for example, perfume sizes). Input uses 2 decimals (D-080) | N3, DB-design [P] |
| D-098 | **Category is optional.** A product without one shows under "بدون تصنيف" | N4 |
| D-099 | **Stock status:** product available = Σ available of its active variants. Status is `out` (≤ 0), `low` (≤ the product's threshold), or `in`. Each variant also has its own status | N5 |
| D-100 | **No hard delete of products or variants.** They are archived and can be restored. An archived item is hidden from lists and pickers but kept in history. The last active variant cannot be archived | N6 |
| D-101 | **Expiry:** stored on the variant (`ExpiryDate`). Templates with `supportsExpiry` (beauty) get one optional date in the product form, applied to all variants. Batches stay an OQ-021 decision for Phase 3 | C2 |
| D-102 | **Phase 2 has no pre-order, made-to-order, deposit or gift-box columns.** Template capability flags are data only. Behaviour comes in Phase 5 or 8 | C4 |
| D-103 | **Business-type labels:** the API is the single source. `GET onboarding/business-types` adds `defaultTemplateCode`. The client keeps only the type → illustration map | OQ-091, C5 |
| D-104 | SKU and barcode are **out of scope for V1** | N9 |
| D-105 | Approve **P-021** (offset paging, default 20, max 100) and the **JSON column for descriptive attributes** | P-021, DB §5.2 |

**Deviations from DATABASE-DESIGN (Proposed), applied on approval:**
1. **System templates and their fields are defined in code** (`ProductTemplateCatalog`), not in seed tables. They are fixed (D-092), this avoids seed migrations, and they have one source. Only the custom fields are a table.
2. **Variant options are columns, not JSON:** `Product.Option1Name/Option2Name` and `Variant.Option1Value/Option2Value`, plus a normalized `OptionsKey`. They are queryable and validated, and there are at most 2 axes.

---

## 1. Scope
**In:**
- categories CRUD
- templates and custom fields
- products (create, edit, archive and restore)
- variants (add, edit overrides, archive and restore)
- opening-stock movements
- the product image
- product list and details
- the business-type default template
- the Settings section "القوالب والحقول الخاصة"

**Out:**
- receive, adjust, movement-log page, expiry page (Phase 3)
- sales, sold count, sales chart (Phase 5; shown as an empty state)
- pre-orders (Phase 8)
- idempotency records (Phase 3, where the listed idempotent POSTs start)

**Dependencies:** Phase 1 (tenancy, money converter, ProblemDetails, validation filter, business default low-stock threshold).

---

## 2. Backend tasks (run together after `Backend`, D-087)

### 2.1 Template catalogue content (D-091)
| Code | Default axes (suggested values) | System fields | Flags |
|---|---|---|---|
| clothing | المقاس (XS, S, M, L, XL, XXL) · اللون (زيتي, كريمي, طوبي, أسود, سماوي) | الخامة (text) · الفئة (select: نسائي, رجالي, أطفال, للجنسين) · القصّة (text) | — |
| perfume | الحجم (10 مل, 50 مل, 100 مل) | — | — |
| beauty | الدرجة (no suggestions) | — | supportsExpiry |
| jewelry | — | الخامة (text) · الوزن بالغرام (number) | — |
| gift | — | المكوّنات (text) | supportsGiftBox (data only) |
| other | — | — (custom fields only) | — |

All system fields are optional.

**Business type → template (from the prototype):**
- clothing → `clothing`
- kids → `clothing`
- perfume → `perfume`
- beauty → `beauty`
- accessories → `jewelry`
- gifts → `gift`
- shoes_bags, home_food, handmade, electronics, home_decor, books, other → `other`

### 2.2 Tasks
| ID | Task | Acceptance | Tests |
|---|---|---|---|
| 2.A1 | **Template catalogue** (`Lamma.Domain/Catalog/ProductTemplateCatalog.cs`): the 6 templates, axes, fields, flags, and the 13-type map. `BusinessTypeOption` gains `defaultTemplateCode` (D-103) | Every business type maps to an existing template; codes are snake_case | Domain: the map covers all 13 types; field keys are unique per template. API: business-types returns `defaultTemplateCode` |
| 2.A2 | **Custom template fields:** entity `ProductTemplateCustomField` (BusinessId, TemplateCode, Key `c_<8 hex>`, LabelAr ≤ 40, FieldType text\|number\|select\|date, Options ≤ 20 × 40 chars for select, IsRequired, SortOrder). Service + endpoints (§4). Max 20 per template; labels unique per template | Field CRUD for the current business only; deleting a field keeps stored product values but stops showing and validating them | Validators; integration: CRUD, limit, duplicate label 409, cross-business 404 |
| 2.A3 | **Categories:** entity `Category` (Name ≤ 60, IsArchived). Filtered unique index `(BusinessId, Name) WHERE IsArchived = 0`. List with active-product count (projection), create, rename, delete per D-095 | A duplicate name gives a 409 `category.duplicate_name`; delete follows its three outcomes | Integration: CRUD; delete blocked with count; archived-only → archived; isolation |
| 2.A4 | **Product aggregate** (`Lamma.Domain/Catalog`): `Product` (Name ≤ 120, CategoryId?, TemplateCode, SellingPrice, Cost, ImagePath?, ImageVersion?, LowStockThreshold 0–1000, AttributesJson, Option1Name?, Option2Name?, IsArchived, timestamps) and `ProductVariant` (Option1Value?, Option2Value?, OptionsKey, PriceOverride?, CostOverride?, OnHand, Reserved, ExpiryDate?, IsArchived, RowVersion). Invariants: D-090, D-093, D-097, D-100; OnHand ≥ 0, Reserved ≥ 0; effective price and cost | Domain methods: `Create`, `UpdateDetails`, `AddVariant`, `UpdateVariant`, `ArchiveVariant`/`Restore`, `Archive`/`Restore`, `ConvertToVariants` (only when the default variant has OnHand = 0 and Reserved = 0) | Domain unit tests for every invariant, including duplicate combinations, a value outside its axis, too many variants, archiving the last variant, and the convert rule |
| 2.A5 | **Attributes validation** (Application): keys must be system or custom fields of the product's template; value types are text ≤ 200, number (decimal), select ∈ options, date `YYYY-MM-DD`; required custom fields must be present. Unknown keys give a 422 | Field errors use paths such as `attributes.fabric` | Validator unit tests per field type |
| 2.A6 | **StockMovement + create product with opening stock:** entity `StockMovement` (append-only: VariantId, Type per D-028 enum, OnHandDelta, ReservedDelta, ReferenceKind opening\|order\|receipt\|adjustment\|return, ReferenceId, ReferenceLabel, UnitCost, Reason, IsAutomatic, OperationId, CreatedAt). Creating a product writes the product, the variants and one movement per variant with qty > 0, in **one SaveChanges** (D-096). Default template = the business type's template when none is sent | Variant OnHand equals the Σ of its movements; nothing is written on failure | Integration: movements written with the cost; rollback test (a forced failure leaves no product, variant or movement); qty 0 → no movement |
| 2.A7 | **Update / archive:** `PUT products/{id}` (details, attributes, axis renames, threshold, template change revalidates the attributes), add variant (with an opening qty → movement), edit variant overrides and expiry, archive/restore of the product and the variant. Stock is **not** editable here (Phase 3) | Archived products are excluded from the default list; restore works | Integration tests for each action, including the 409 on archiving the last active variant |
| 2.A8 | **Image:** port `IFileStorage` (Application) and `LocalFileStorage` (Infrastructure, root from `Storage:RootPath`; Development default `%LOCALAPPDATA%/Lamma/uploads`; path `{businessId}/{productId}/{guid}.{ext}`). `PUT products/{id}/image` (multipart, `[RequestSizeLimit]`), `DELETE products/{id}/image`, `GET products/{id}/image` (stream, `Cache-Control: private`, the URL carries `?v=ImageVersion`). Magic-byte check; the old file is deleted after a successful commit | Another business gets 404; a wrong type gives 422 `product.image_invalid_type`; a file over 5 MB gives 422 `product.image_too_large` | Unit: signature detection. Integration: upload, get, replace, delete, isolation, a renamed `.exe` rejected, size limit. Tests use a temp-folder storage |
| 2.A9 | **Queries:** `GET products` (search on name, `categoryId` or `uncategorized`, `stockStatus` in\|low\|out, `archived`, sort `-createdAt`\|`name`\|`available`, paging per D-105). Items carry the price range, available, status and variant count, all computed in SQL (one query + count, no N+1). `GET products/{id}` (details + variants + the last 10 movements) | Server-computed figures only | Query tests on a fixed dataset: filters, search, paging bounds (pageSize > 100 → 422), status boundaries, archived variants excluded from totals |
| 2.A10 | **Wiring and checkpoint:** DbSets and configurations (check constraints `OnHand >= 0`, `Reserved >= 0`, `SellingPrice > 0`, `Cost >= 0`; indexes per DB §11; FKs restrict), DI registration, controllers (thin), architecture tests still green, docs. **Migration `AddCatalog`** (commands in the report) | Build has 0 warnings; all tests pass | Infrastructure tests: the tenant filter applies to the 5 new tables; the cross-tenant write guard; the unique indexes |

---

## 3. Database changes (migration `AddCatalog`; the founder runs it)
New tables: `Categories`, `Products`, `ProductVariants`, `StockMovements`, `ProductTemplateCustomFields`. All are business-owned, with the tenant query filter and the write guard.

**Indexes:**
- `Products (BusinessId, CategoryId)`
- `Products (BusinessId, Name)`
- `ProductVariants (ProductId)`
- `ProductVariants (ProductId, OptionsKey)` UNIQUE
- `ProductVariants (BusinessId, ExpiryDate)` filtered
- `StockMovements (VariantId, CreatedAt DESC)`
- `StockMovements (BusinessId, CreatedAt DESC)`
- `Categories (BusinessId, Name)` UNIQUE filtered on `IsArchived = 0`
- `ProductTemplateCustomFields (BusinessId, TemplateCode, Key)` UNIQUE

Money uses `decimal(19,3)`. `ProductVariant` gets a `rowversion`. There are no changes to the Phase 1 tables.

**Commands (for the founder):**
```bash
dotnet ef migrations add AddCatalog --project src/Lamma.Infrastructure --startup-project src/Lamma.Api --output-dir Persistence/Migrations
```
```bash
dotnet ef database update --project src/Lamma.Infrastructure --startup-project src/Lamma.Api
```

---

## 4. API contracts (all under `/api/v1`, `RequireBusiness`, no BusinessId in any request)
| Method & path | Body / query | Success | Errors |
|---|---|---|---|
| GET `product-templates` | — | 200 `[{ code, nameAr, supportsExpiry, defaultAxes:[{ name, suggestedValues[] }], fields:[{ key, labelAr, type, options[], isRequired, isCustom }] }]`, with the current business's custom fields merged in | — |
| POST `product-templates/{code}/fields` | `{ labelAr, type, options[], isRequired }` | 201 field | 404 unknown template · 409 duplicate label / limit · 422 |
| PUT / DELETE `product-templates/{code}/fields/{key}` | as above | 200 / 204 | 404 · 409 · 422 |
| GET `categories` | — | 200 `[{ id, name, productCount }]` | — |
| POST `categories` · PUT `categories/{id}` | `{ name }` | 201 / 200 | 409 `category.duplicate_name` · 422 |
| DELETE `categories/{id}` | — | 204 (deleted or archived) | 409 `category.has_products` (detail gives the count) |
| GET `products` | `search, categoryId \| uncategorized=true, stockStatus, archived, sort, page, pageSize` | 200 `{ items:[{ id, name, categoryId, categoryName, templateCode, imageUrl, minPrice, maxPrice, available, onHand, reserved, lowStockThreshold, stockStatus, variantCount, isArchived }], page, pageSize, totalCount }` | 422 bad paging |
| POST `products` | `{ name, categoryId?, templateCode?, sellingPrice, cost, lowStockThreshold?, attributes{}, expiryDate?, options:[{ name, values[] }], variants:[{ values[], openingQuantity, priceOverride?, costOverride? }] }` | 201 `ProductDetailsDto` + `Location` | 404 category · 422 field errors |
| GET `products/{id}` | — | 200 `ProductDetailsDto` = list fields + `sellingPrice, cost, marginPerUnit, marginPercent, attributes, options, variants:[{ id, values[], label, price, cost, onHand, reserved, available, stockStatus, expiryDate, isArchived, isDefault }], recentMovements:[{ type, referenceKind, label, onHandDelta, unitCost, isAutomatic, createdAt, variantLabel }]` | 404 (including another business) |
| PUT `products/{id}` | `{ name, categoryId?, templateCode, sellingPrice, cost, lowStockThreshold, attributes{}, optionNames[] }` | 200 details | 404 · 422 |
| POST `products/{id}/archive` · `/restore` | — | 200 details | 404 |
| POST `products/{id}/variants` | `{ values[], openingQuantity, priceOverride?, costOverride?, expiryDate? }` | 201 details | 409 duplicate / limit / convert blocked · 422 |
| PUT `products/{id}/variants/{variantId}` | `{ priceOverride?, costOverride?, expiryDate? }` | 200 details | 404 · 422 |
| POST `products/{id}/variants/{variantId}/archive` · `/restore` | — | 200 details | 409 `product.last_variant` |
| PUT · DELETE · GET `products/{id}/image` | multipart `file` | 200 details / 204 / image stream | 404 · 422 type / size |
| GET `onboarding/business-types` (changed) | — | 200 `[{ code, labelAr, defaultTemplateCode }]` | — |

Money fields are 3-dp strings (`MoneyJsonConverter`), and input is limited to 2 dp (D-080). Contracts are recorded in API-DESIGN.md at gate 4.

---

## 5. Frontend tasks (run together after `Frontend`; they follow FRONTEND-ARCHITECTURE.md)
New feature **`features/catalog/`** with `index.ts`, `routes.tsx`, `api/` (productsApi, categoriesApi, templatesApi), `schemas/`, `domain/` (stock status labels and tones, colour-name → swatch map), `components/`, `pages/`. Generic additions go to `shared/`: `MoneyField`, `QuantityField` and an `ImagePicker` (all business-agnostic).

| ID | Task | Acceptance | Tests |
|---|---|---|---|
| 2.B1 | **Products list** `/products`: cards and table toggle, search, category filter (including "بدون تصنيف"), stock-status filter, stock meter, paging, empty and error states, archived toggle | Parity with the prototype's `#/products`; real API | List, filter and empty tests (MSW) |
| 2.B2 | **Product form** `/products/new` and `/products/:id/edit`: template picker (default from the business type), basics with live margin, template plus custom fields, the expiry date when supported, an axes editor with suggestions, the variant matrix with opening quantities and "fill all", opening qty for a simple product, a live preview card, the low-stock threshold, the image picker. In edit mode existing stock is read-only; new cells can be added and variants archived | Parity with `#/products/new`; Zod mirrors the server rules; server errors map onto fields | Validation, create (simple and matrix), and edit tests |
| 2.B3 | **Product details** `/products/:id`: hero (image or template art, badges, price, margin per piece), stock donut, variant heatmap (size × colour, with a list fallback), recent movements, archive/restore. "تعديل المخزون", "استلام" and "طلب فيه" are disabled with "قريبًا" (Phases 3/5); the sales section is an empty state | Parity with `#/products/:id` | Render and archive tests |
| 2.B4 | **Categories** `/products/categories`: list with counts, add, rename, delete with the blocked-delete message | CRUD against the API | CRUD tests, including the 409 message |
| 2.B5 | **Settings → القوالب والحقول الخاصة:** templates grid; add, edit and delete custom fields per template. Settings uses the API business-type labels (D-103), and `features/settings/domain/businessTypes.ts` keeps only the art map | Saves through the API | Workflow tests |
| 2.B6 | **Wiring:** remove the 3 catalog paths from `plannedRoutes`; point the dashboard "أضف أول منتج" and the quick-add "منتج" to `/products/new`; product links from the nav work | No 404 and no coming-soon on the catalog routes | Routing test update |
| 2.B7 | **Frontend checkpoint:** tsc, lint, `check:architecture`, vitest, build, real-API end-to-end check (create a matrix product with an image → list → details → edit → archive; categories), RTL at 1440/1024/768/390 | STOP at gate 6 | Full run reported |

---

## 6. Security and performance
- Tenancy is enforced in three layers: the query filter, the explicit predicate, and the write guard. Another business's ids return 404. The image endpoint checks the product through the tenant filter before it streams the file.
- Uploads:
  - The type is checked by content, not by the name or `Content-Type`.
  - Stored file names are random, so there is no user-controlled path.
  - Size is limited at the server.
  - Files are never served from a static folder.
- The attributes JSON is validated against known keys and length limits, so arbitrary data cannot be stored.
- List queries are projections with SQL-side aggregation (Σ over variants) and paging, using the indexes in §3. There is no N+1 (verified in the query tests through the SQL log count).
- The 100-variant cap and payload validation bound the size of one request.

## 7. Risks
| Risk | Mitigation |
|---|---|
| Variant matrix edit complexity | Axes are fixed after create (rename allowed); simple → variants conversion only at zero stock; strong domain tests |
| Orphan image files | Delete after commit; a failure leaves a harmless orphan, logged (cleanup job out of V1) |
| Filtered unique index + archive interplay | Integration test: archive a category, then re-create the same name |
| Frontend form size (largest screen so far) | Split by responsibility: page = state + submit; sections = BasicsSection, TemplateFieldsSection, VariantMatrixSection, ImageSection, PreviewCard (FRONTEND-ARCHITECTURE §8) |

## 8. Documentation updates
- **DECISIONS:** D-090 to D-105.
- **OPEN-QUESTIONS:** OQ-010 to OQ-015 and OQ-091 marked Resolved.
- **DATABASE-DESIGN §5.2/5.3:** the two deviations, plus "Implemented in Phase 2".
- **API-DESIGN:** the catalog contracts.
- **PRD M4:** the labels updated.
- **PHASE-PLANS:** the Phase 2 tasks and gate status.
- **PROJECT-PROGRESS:** gate and test log.
- **TESTING-STRATEGY:** the catalog suites.
- **FRONTEND-ARCHITECTURE:** the catalog feature and its edges (`catalog → auth, settings`), and the new shared components.
- **LOCAL-DEVELOPMENT:** `Storage:RootPath`.

## 9. Verification
- **Backend:**
  - `dotnet build Lamma.sln` gives 0 warnings.
  - `dotnet test Lamma.sln` passes. That covers the 128 existing tests plus the new domain, application, infrastructure and integration tests, on throwaway LocalDB databases (D-083).
  - Smoke run of the API after the founder applies `AddCatalog`.
- **Frontend:**
  - tsc, lint and `check:architecture` report 0 issues.
  - vitest passes all tests, and the production build succeeds.
  - Real-API browser pass at 4 widths.
- **STOP** at gate 4 (after Backend) and at gate 6 (after Frontend). Each stop includes the exact Git commands for the founder.

## 10. Open items (not blocking Phase 2)
- OQ-086: the production file store (hosting).
- OQ-021: batches versus per-variant expiry (Phase 3).
- OQ-074: pre-order fields (Phase 8).
