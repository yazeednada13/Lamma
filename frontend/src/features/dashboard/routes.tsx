import type { RouteObject } from "react-router";
import { DashboardPage } from "./pages/DashboardPage";

/** The home screen inside the authenticated app shell. */
export const dashboardRoute: RouteObject = { index: true, path: "/", element: <DashboardPage /> };
