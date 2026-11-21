import type { RouteObject } from "react-router";
import { CourierPage } from "./pages/CourierPage";
import { ExpensesPage } from "./pages/ExpensesPage";
import { FinanceOverviewPage } from "./pages/FinanceOverviewPage";

/** Finance screens (Phase 7). `/finance/payments` belongs to the payments feature (Phase 6). */
export const financeRoutes: RouteObject[] = [
  { path: "/finance", element: <FinanceOverviewPage /> },
  { path: "/finance/expenses", element: <ExpensesPage /> },
  { path: "/finance/courier", element: <CourierPage /> },
];
