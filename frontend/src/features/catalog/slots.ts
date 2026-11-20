import type { ReactNode } from "react";

/** Sections other features add to catalog screens, composed by the app layer (no feature cycles). */
export interface CatalogSlots {
  /** Sales section of the product details (orders feature). */
  productOrders?: (product: { productId: string; sold: number }) => ReactNode;
}
