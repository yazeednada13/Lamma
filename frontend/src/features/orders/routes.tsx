import type { RouteObject } from "react-router";
import { OrderDetailsPage } from "./pages/OrderDetailsPage";
import { OrderFormPage } from "./pages/OrderFormPage";
import { OrdersBoardPage } from "./pages/OrdersBoardPage";
import { OrdersPage } from "./pages/OrdersPage";

/** Order screens (Phase 5). Static paths win over ":id"; `/orders/preorders` stays a planned route (Phase 8). */
export const ordersRoutes: RouteObject[] = [
  { path: "/orders", element: <OrdersPage /> },
  { path: "/orders/board", element: <OrdersBoardPage /> },
  { path: "/orders/new", element: <OrderFormPage key="new" /> },
  { path: "/orders/:id", element: <OrderDetailsPage /> },
  { path: "/orders/:id/edit", element: <OrderFormPage key="edit" /> },
];
