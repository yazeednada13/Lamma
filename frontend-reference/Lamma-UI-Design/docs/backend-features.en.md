# Lamma · Feature Report for Backend

Based on the prototype screens (38 screens). **Purpose:** show the backend team which entities, operations and business rules need to be built.

**Version 1:**
- Single user: the business owner.
- Arabic first.
- Currency: JOD (د.أ).

## 1. Account and onboarding
- **Sign up:** name, mobile number or email, and password with a strength meter.
- **Log in, and password recovery.**
- **3-step onboarding:**
  1. Business name.
  2. Business type.
  3. Sales channels.
- **13 business types:** clothing, shoes & bags, perfume, beauty, accessories, gifts, home food, handmade, electronics, kids, home decor, books, other. The type sets the **default product template**.
- **Account:** edit personal details and password.

## 2. Dashboard
All numbers are **computed from the records**. No number is stored pre-calculated.
- **Today's journey:** order count at each stage, from New to Delivered.
- **Profit for the period, and % change vs the previous period.**
- **Daily sales chart:** 7 or 30 days.
- **Metric cards:**
  - Sales.
  - Open orders.
  - Cash received.
  - Receivables.
- **"Needs your attention":**
  - New orders.
  - Products running low.
  - Customers who owe money.
  - Money held by the courier company.
- **Sales split by channel.**
- **Top sellers, and recent activity.**
- **Free-trial banner:** days remaining.
- **New-user version:** empty state with getting-started steps.
- **Sidebar counters:**
  - Number of new orders.
  - Number of low-stock products.
  - A dot when money is owed.

## 3. Orders
- **List:**
  - Filter by status, with a count for each status.
  - Search.
  - Table or card view.
  - Quick "next step" button.
- **Status board (Kanban):** move orders between statuses, with Undo.
- **New order, in 4 steps:**
  1. Customer: pick an existing customer, or quick-add a new one.
  2. Products: variant (size, color…) and quantity. You can't pick more than is **available**.
  3. Delivery and payment:
     - Delivery fee.
     - Discount.
     - Payment method and amount paid.
     - Channel.
     - Note or gift message.
  4. Review, with a live receipt.
- **Order details:**
  - Items.
  - Customer.
  - Amounts: total, paid, remaining.
  - Order lifecycle (timeline).
  - Change status.
  - Record a payment.
  - Cancel, with a reason.
  - Return.
- **Pre-orders:** for products that are out of stock or made to order. They have a deposit and an expected delivery date.

**Order statuses (7):**

| Code | Status (AR) |
|---|---|
| `new` | جديد · New |
| `confirmed` | مؤكد · Confirmed |
| `preparing` | قيد التجهيز · Preparing |
| `courier` | مع المندوب · With courier |
| `delivered` | تم التوصيل · Delivered |
| `cancelled` | ملغي · Cancelled |
| `returned` | مرتجع · Returned |

**Payment statuses:**

| Code | Status |
|---|---|
| `paid` | Paid |
| `partial` | Partially paid |
| `unpaid` | Unpaid |
| `courier` | Held by courier company |

**Sales channels:** Instagram, WhatsApp, Facebook, other.

## 4. Products and categories
- **Product list:** search, filter by category, and a stock indicator.
- **New product:**
  - **Basics:**
    - Name.
    - Category.
    - Selling price.
    - Cost.
    - Image.
    - Low-stock threshold (default 5).
  - **Template by type:** clothing, perfume, gifts, jewelry, beauty… Each template has its own descriptive fields.
  - **Options that create variants:** e.g. size × color, and **each variant has its own stock**.
  - **Template-specific behavior:** expiry date, gift box, pre-order, deposit.
  - **Different template:** a product can use a different template from the business type.
- **Product details:**
  - Sales.
  - Profit margin.
  - Stock map per variant.
  - Movement history.
  - Stock adjustment, with a reason.
- **Categories:** create, edit, delete, and a product count for each category.

## 5. Inventory
- **Stock levels:**
  - **Per product and variant:** on hand, reserved, available (= on hand − reserved).
  - **Status:** in stock, running low, out of stock.
- **Receive stock:**
  - **Input:** product and variant, quantity, cost, supplier or note.
  - **Result:** stock goes up and a movement is logged.
- **Movement log:**
  - **Types:** reserve, release, sale, receive, adjustment, return.
  - **Each movement has:** the quantity (+ or −), the reference (order number), and whether it was automatic.
- **Expiry dates:** products with an expiry date, sorted soonest first.

## 6. Customers
- **List:** search, and automatic segments:
  - **VIP:** by spend and order count.
  - **Owes money:** balance > 0.
  - **New:** 2 orders or fewer.
  - **Dormant:** last order more than 14 days ago.
- **Customer fields:** name, mobile, channel, city and area, notes.
- **Customer profile:**
  - **Computed:** order count, total spent, balance due, last order.
  - **Also:** their orders, and record a payment.
- **Quick add customer:** from the new-order screen.

## 7. Finance
- **Overview:**
  - Sales.
  - Cash received.
  - Profit.
  - Receivables.
  - Courier receivables.
  - Cash flow.
- **Payments and receivables:**
  - **Record a payment against an order or customer:** amount and method.
  - **Receivables aging:** 0–7 days, 8–30 days, over 30 days.
- **Courier company:**
  - **Money it is holding:** cash-on-delivery orders that have been delivered.
  - **Settlement:** the amount actually received. The difference is logged automatically as a delivery expense.
- **Expenses:**
  - **Fields:** date, category (ads, delivery, packaging, other…), amount, note.
  - **View:** totals by category.
- **Payment methods:** cash, CliQ, bank transfer, cash on delivery, Zain Cash, Orange Money. The merchant turns on the ones they use.

## 8. Reports
- **Reports hub:** summary and links.
- **Profit & Loss (P&L):** for a period, compared with the previous period.
  - **Net sales** = sales − returns.
  - **Gross profit** = net sales − cost of goods sold.
  - **Net profit** = gross profit − expenses by category.
  - **View:** waterfall chart, plus one sentence explaining what changed.
- **Sales:**
  - By day.
  - By channel.
  - By product (quantity and amount).
  - Average order value.
- **Periods:** this month, last month, last 7 days, and custom.

## 9. Settings and subscription
- **Business settings:**
  - Business profile.
  - Sales channels.
  - Payment methods.
  - Inventory: default low-stock threshold.
  - Expense categories.
  - Templates and fields.
- **Subscription:**
  - **Trial:** first month free with every feature, with days remaining shown.
  - **Plans:** monthly and yearly. Yearly saves two months. Prices are not set yet.
- **Trial expired:** data stays saved and viewable, but nothing new can be added until they subscribe. This is a proposal, not yet approved.
- **General states:** loading, offline, 404.

## 10. Business rules (key for backend)
- **An order status change must be a single transaction, and it updates stock:**
  - **Reserving statuses:** `confirmed`, `preparing`, `courier`.
  - **Entering a reserving status:** reserved += quantity.
  - **Leaving a reserving status for a non-reserving one:** reserved −= quantity.
  - **`delivered`:** on hand −= quantity, sold += quantity, and `deliveredAt` is set.
  - **`cancelled`:** releases the reservation.
  - **`returned`:** the items go back into stock.
- **Undo:** every status change must be undoable for a few minutes.
- **Stock movements:** every stock change is logged automatically as a movement, with its reference.
- **Sales:**
  - Revenue is recognized on delivery.
  - Confirmed orders that aren't delivered yet count as "expected sales".
- **Order total** = Σ(quantity × price) + delivery − discount.
- **COGS** = Σ(quantity × product cost).
- **Derived values, never edited by hand (may be cached):**
  - **Product:** sold, reserved.
  - **Customer:** orders, spent, balance, last order.
  - **Courier:** money held, and pending orders.
- **Quantity limit:** you can't order more than is available. Exception: pre-orders.
- **Courier settlement:** the difference is logged as a delivery expense.

## 11. Proposed data model
- **Business:**
  - Name.
  - Type.
  - Currency.
  - Enabled channels.
  - Enabled payment methods.
  - Default low-stock threshold.
  - Subscription: plan, trial start and end.
- **User:** one per business in version 1.
- **Category:** name.
- **Product:**
  - Name.
  - Category.
  - Template.
  - Price.
  - Cost.
  - Image.
  - Low-stock threshold.
  - Expiry date (optional).
  - Descriptive fields (JSON).
- **ProductVariant:** product, options (size, color…), on hand, reserved.
- **Customer:** name, mobile, channel, city, notes.
- **Order:**
  - Number.
  - Customer.
  - Channel.
  - Status.
  - Delivery fee.
  - Discount.
  - Gift message.
  - Note.
  - Created at.
  - `deliveredAt`.
  - Pre-order: deposit, and delivery date.
- **OrderItem:** order, variant, quantity, unit price at sale, unit cost at sale.
- **OrderStatusLog:** from, to, timestamp.
- **Payment:** order or customer, amount, method, date.
- **StockMovement:** variant, type, quantity, reference, automatic (yes/no), timestamp.
- **Expense:** date, category, amount, note.
- **CourierSettlement:** date, expected amount, received amount, difference.

## 12. Out of scope for version 1
- **Multiple users and permissions.**
- **Rejected for now:**
  - Sharing an order on WhatsApp.
  - Export.
  - Expense receipt photo.
  - Dark mode.
  - Customer invoice.
- **Postponed:** English (LTR) version of the app.
