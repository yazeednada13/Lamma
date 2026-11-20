import type { RouteObject } from "react-router";
import { CustomerProfilePage } from "./pages/CustomerProfilePage";
import { CustomersPage } from "./pages/CustomersPage";

/** Customer screens. `/customers/new` is the list with the quick-add drawer open (topbar and hub "عميل" entries). */
export const customersRoutes: RouteObject[] = [
  { path: "/customers", element: <CustomersPage /> },
  { path: "/customers/new", element: <CustomersPage /> },
  { path: "/customers/:id", element: <CustomerProfilePage /> },
];
