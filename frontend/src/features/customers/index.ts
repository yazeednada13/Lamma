// Public API of the customers feature. Other code imports from "@/features/customers" only.
export { customersRoutes } from "./routes";
/** Quick add / edit customer drawer, reused by the Phase 5 new-order flow. */
export { CustomerFormDrawer as QuickAddCustomerDrawer } from "./components/CustomerFormDrawer";
export type { CustomerDetails } from "./api/customersApi";
