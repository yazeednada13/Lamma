import type { RouteObject } from "react-router";
import { OnboardingPage } from "./pages/OnboardingPage";

/** Signed-in owners without a business; the app router places it under RequireAuth + RequireNotOnboarded. */
export const onboardingRoute: RouteObject = { path: "/onboarding", element: <OnboardingPage /> };
