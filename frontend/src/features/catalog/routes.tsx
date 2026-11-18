import type { RouteObject } from "react-router";
import { CategoriesPage } from "./pages/CategoriesPage";
import { ProductDetailsPage } from "./pages/ProductDetailsPage";
import { ProductFormPage } from "./pages/ProductFormPage";
import { ProductsPage } from "./pages/ProductsPage";

/** Catalog screens (inside the authenticated app shell). Static paths win over ":id" in React Router. */
export const catalogRoutes: RouteObject[] = [
  { path: "/products", element: <ProductsPage /> },
  { path: "/products/new", element: <ProductFormPage key="new" /> },
  { path: "/products/categories", element: <CategoriesPage /> },
  { path: "/products/:id", element: <ProductDetailsPage /> },
  { path: "/products/:id/edit", element: <ProductFormPage key="edit" /> },
];
