import type { RouteObject } from "react-router";
import { adminRoute } from "@/features/admin";
import { authRoutes, resetPasswordRoute } from "@/features/auth";
import { createCatalogRoutes, productTemplatesSettingsSection } from "@/features/catalog";
import { createCustomersRoutes } from "@/features/customers";
import { inventoryRoutes } from "@/features/inventory";
import { dashboardRoute } from "@/features/dashboard";
import { onboardingRoute } from "@/features/onboarding";
import { CustomerOrdersSection, ordersRoutes, ProductOrdersSection } from "@/features/orders";
import { courierSettingsSection, expenseCategoriesSettingsSection, financeRoutes } from "@/features/finance";
import { reportsRoutes } from "@/features/reports";
import { LandingPage } from "@/features/signup";
import { subscriptionRoutes } from "@/features/subscription";
import { paymentsRoutes } from "@/features/payments";
import { createSettingsRoutes } from "@/features/settings";
import { AuthenticatedLayout } from "../layouts/AuthenticatedLayout";
import { navigationRoutes } from "../navigation/navigationRoutes";
import { RedirectIfAuthenticated, RequireAuth, RequireBusiness, RequireNotOnboarded, RequirePlatformAdmin } from "./guards";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { COMING_SOON_ROUTES } from "./plannedRoutes";
import { RouteErrorPage } from "./RouteErrorPage";

// Features plug into each other's screens here, so they never import each other in a cycle.
const settingsRoutes = createSettingsRoutes({ extraSections: [expenseCategoriesSettingsSection, courierSettingsSection, productTemplatesSettingsSection] });
const catalogRoutes = createCatalogRoutes({ productOrders: (p) => <ProductOrdersSection {...p} /> });
const customersRoutes = createCustomersRoutes({ customerOrders: (c) => <CustomerOrdersSection {...c} /> });

const plannedRoutes: RouteObject[] = COMING_SOON_ROUTES.map((r) => ({
  path: `/${r.path}`,
  element: <ComingSoonPage key={r.path} title={r.title} phase={r.phase} />,
}));

/**
 * All routes, composed from the features' public route objects and placed under the access guards.
 * Exported so tests can mount them in a memory router.
 */
export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorPage />,
    children: [
      { element: <RedirectIfAuthenticated />, children: authRoutes },
      resetPasswordRoute,
      {
        element: <RequireAuth anonymousHome={<LandingPage />} />,
        children: [
          { element: <RequireNotOnboarded />, children: [onboardingRoute] },
          { element: <RequirePlatformAdmin />, children: [adminRoute] },
          {
            element: <RequireBusiness />,
            children: [
              {
                element: <AuthenticatedLayout />,
                children: [dashboardRoute, ...catalogRoutes, ...inventoryRoutes, ...customersRoutes, ...ordersRoutes, ...paymentsRoutes, ...financeRoutes, ...reportsRoutes, ...subscriptionRoutes, ...settingsRoutes, ...navigationRoutes, ...plannedRoutes, { path: "*", element: <NotFoundPage /> }],
              },
            ],
          },
        ],
      },
    ],
  },
];
