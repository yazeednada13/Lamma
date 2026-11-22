// Public API of the orders feature. Other code imports from "@/features/orders" only.
export { ordersRoutes } from "./routes";
/** History sections composed into the customer profile and product details by the app layer (no feature cycles). */
export { CustomerOrdersSection, LatestOrdersGrid, ProductOrdersSection } from "./components/OrderHistory";
