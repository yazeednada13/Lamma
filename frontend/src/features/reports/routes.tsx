import type { RouteObject } from "react-router";
import { ProfitLossPage } from "./pages/ProfitLossPage";
import { ReportsHubPage } from "./pages/ReportsHubPage";
import { SalesReportPage } from "./pages/SalesReportPage";

/** Reports (Phase 10, D-168–D-172). */
export const reportsRoutes: RouteObject[] = [
  { path: "/reports", element: <ReportsHubPage /> },
  { path: "/reports/pnl", element: <ProfitLossPage /> },
  { path: "/reports/sales", element: <SalesReportPage /> },
];
