import type { RouteObject } from "react-router";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { LoginPage } from "./pages/LoginPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { SignUpPage } from "./pages/SignUpPage";

/** Public auth screens; the app router places them under RedirectIfAuthenticated. */
export const authRoutes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignUpPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
];

/** Reachable whether or not someone is signed in (it comes from an emailed link). */
export const resetPasswordRoute: RouteObject = { path: "/reset-password", element: <ResetPasswordPage /> };
