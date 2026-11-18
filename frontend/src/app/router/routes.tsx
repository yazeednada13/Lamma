import type { RouteObject } from "react-router";
import { authRoutes, resetPasswordRoute } from "@/features/auth";
import { catalogRoutes, productTemplatesSettingsSection } from "@/features/catalog";
import { dashboardRoute } from "@/features/dashboard";
import { onboardingRoute } from "@/features/onboarding";
import { createSettingsRoutes } from "@/features/settings";
import { AuthenticatedLayout } from "../layouts/AuthenticatedLayout";
import { navigationRoutes } from "../navigation/navigationRoutes";
import { RedirectIfAuthenticated, RequireAuth, RequireBusiness, RequireNotOnboarded } from "./guards";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { COMING_SOON_ROUTES } from "./plannedRoutes";
import { RouteErrorPage } from "./RouteErrorPage";

// Features plug into each other's screens here, so they never import each other in a cycle.
const settingsRoutes = createSettingsRoutes({ extraSections: [productTemplatesSettingsSection] });

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
        element: <RequireAuth />,
        children: [
          { element: <RequireNotOnboarded />, children: [onboardingRoute] },
          {
            element: <RequireBusiness />,
            children: [
              {
                element: <AuthenticatedLayout />,
                children: [dashboardRoute, ...catalogRoutes, ...settingsRoutes, ...navigationRoutes, ...plannedRoutes, { path: "*", element: <NotFoundPage /> }],
              },
            ],
          },
        ],
      },
    ],
  },
];
