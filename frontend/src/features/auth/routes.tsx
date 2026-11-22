import type { RouteObject } from "react-router";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { LoginPage } from "./pages/LoginPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { Navigate } from "react-router";
import { RegisterPage } from "./pages/RegisterPage";

/** Public auth screens; the app router places them under RedirectIfAuthenticated. */
export const authRoutes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  // The open sign-up is closed (D-160): new accounts start from the landing form.
  { path: "/signup", element: <Navigate to="/#join" replace /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
];

/** Reachable whether or not someone is signed in (it comes from an emailed link). */
export const resetPasswordRoute: RouteObject = { path: "/reset-password", element: <ResetPasswordPage /> };
