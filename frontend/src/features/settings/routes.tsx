import type { RouteObject } from "react-router";
import { AccountPage } from "./pages/AccountPage";
import { BusinessSettingsPage } from "./pages/BusinessSettingsPage";

/** Account and business settings screens (inside the authenticated app shell). */
export const settingsRoutes: RouteObject[] = [
  { path: "/account", element: <AccountPage /> },
  { path: "/settings", element: <BusinessSettingsPage /> },
];
