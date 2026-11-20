// Public API of the customers feature. Other code imports from "@/features/customers" only.
export { createCustomersRoutes } from "./routes";
export type { CustomersSlots } from "./slots";
/** Quick add / edit customer drawer, reused by the Phase 5 new-order flow. */
export { CustomerFormDrawer as QuickAddCustomerDrawer } from "./components/CustomerFormDrawer";
export type { CustomerDetails } from "./api/customersApi";
/** Place and phone display helpers, shared with order screens. */
export { placeLabel, phoneDisplay } from "./domain/customerDomain";
