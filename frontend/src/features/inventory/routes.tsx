import type { RouteObject } from "react-router";
import { ExpiryPage } from "./pages/ExpiryPage";
import { InventoryPage } from "./pages/InventoryPage";
import { MovementsPage } from "./pages/MovementsPage";
import { ReceivePage } from "./pages/ReceivePage";

/** Inventory screens (inside the authenticated app shell). */
export const inventoryRoutes: RouteObject[] = [
  { path: "/inventory", element: <InventoryPage /> },
  { path: "/inventory/receive", element: <ReceivePage /> },
  { path: "/inventory/movements", element: <MovementsPage /> },
  { path: "/inventory/expiry", element: <ExpiryPage /> },
];
