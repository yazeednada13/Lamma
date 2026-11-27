import type { RouteObject } from "react-router";
import { ReadOnlyPage } from "./pages/ReadOnlyPage";
import { SubscriptionPage } from "./pages/SubscriptionPage";

/** The owner's subscription (Phase 11-II). */
export const subscriptionRoutes: RouteObject[] = [
  { path: "/subscription", element: <SubscriptionPage /> },
  { path: "/trial-expired", element: <ReadOnlyPage /> },
];
