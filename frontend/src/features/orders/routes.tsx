import type { RouteObject } from "react-router";
import { OrderDetailsPage } from "./pages/OrderDetailsPage";
import { OrderFormPage } from "./pages/OrderFormPage";
import { OrdersBoardPage } from "./pages/OrdersBoardPage";
import { OrdersPage } from "./pages/OrdersPage";
import { PreOrdersPage } from "./pages/PreOrdersPage";

/** Order screens (Phases 5 and 8). Static paths win over ":id". */
export const ordersRoutes: RouteObject[] = [
  { path: "/orders", element: <OrdersPage /> },
  { path: "/orders/board", element: <OrdersBoardPage /> },
  { path: "/orders/preorders", element: <PreOrdersPage /> },
  { path: "/orders/new", element: <OrderFormPage key="new" /> },
  { path: "/orders/:id", element: <OrderDetailsPage /> },
  { path: "/orders/:id/edit", element: <OrderFormPage key="edit" /> },
];
