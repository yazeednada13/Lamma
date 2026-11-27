import type { RouteObject } from "react-router";
import { AdminLayout } from "./components/AdminLayout";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { AdminPaymentsPage } from "./pages/AdminPaymentsPage";
import { LeadsPage } from "./pages/LeadsPage";
import { SubscriberPage } from "./pages/SubscriberPage";
import { SubscribersPage } from "./pages/SubscribersPage";

/** The platform admin area (Phase 11-II); the app router places it under RequirePlatformAdmin. */
export const adminRoute: RouteObject = {
  path: "/admin",
  element: <AdminLayout />,
  children: [
    { index: true, element: <AdminDashboardPage /> },
    { path: "subscribers", element: <SubscribersPage /> },
    { path: "subscribers/:businessId", element: <SubscriberPage /> },
    { path: "payments", element: <AdminPaymentsPage /> },
    { path: "leads", element: <LeadsPage /> },
  ],
};
