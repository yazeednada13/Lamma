// Public API of the payments feature. Other code imports from "@/features/payments" only.
// payments → settings only: orders and customers embed these widgets, never the other way round.
export { paymentsRoutes } from "./routes";
export { PaymentBadge } from "./components/PaymentBadge";
export { RecordPaymentDrawer, type PaymentTarget } from "./components/RecordPaymentDrawer";
export { OrderPaymentCard, paidOnLabel, type OrderPaymentInfo, type OrderPaymentLine } from "./components/OrderPaymentCard";
export { CustomerPaymentsSection } from "./components/CustomerPaymentsSection";
export type { PaymentStatus } from "./api/paymentsApi";
export { PAYMENT_STATUS, recordableMethods, defaultMethod, checkAmount } from "./domain/paymentDomain";
