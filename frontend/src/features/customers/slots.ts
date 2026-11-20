import type { ReactNode } from "react";

/** Sections other features add to customer screens, composed by the app layer (no feature cycles). */
export interface CustomersSlots {
  /** Orders section of the customer profile (orders feature). */
  customerOrders?: (customer: { customerId: string; orderCount: number }) => ReactNode;
}
