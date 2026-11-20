import type { RouteObject } from "react-router";
import { PaymentsPage } from "./pages/PaymentsPage";

/** Payments & receivables screens (Phase 6). `/finance` (overview) stays a planned route until Phase 7. */
export const paymentsRoutes: RouteObject[] = [{ path: "/finance/payments", element: <PaymentsPage /> }];
