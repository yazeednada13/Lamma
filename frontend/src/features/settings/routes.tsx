import type { RouteObject } from "react-router";
import type { SettingsExtraSection } from "./components/SettingsSectionNav";
import { AccountPage } from "./pages/AccountPage";
import { BusinessSettingsPage } from "./pages/BusinessSettingsPage";

/** Account and business settings screens (inside the authenticated app shell). */
export function createSettingsRoutes({ extraSections = [] }: { extraSections?: readonly SettingsExtraSection[] } = {}): RouteObject[] {
  return [
    { path: "/account", element: <AccountPage /> },
    { path: "/settings", element: <BusinessSettingsPage extraSections={extraSections} /> },
  ];
}
