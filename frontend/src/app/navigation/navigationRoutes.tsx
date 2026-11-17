import type { RouteObject } from "react-router";
import { MoreHubPage } from "./pages/MoreHubPage";
import { QuickAddHubPage } from "./pages/QuickAddHubPage";

/** Mobile navigation hubs (inside the authenticated app shell). */
export const navigationRoutes: RouteObject[] = [
  { path: "/more", element: <MoreHubPage /> },
  { path: "/new", element: <QuickAddHubPage /> },
];
