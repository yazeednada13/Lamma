import type { RouteObject } from "react-router";
import type { CatalogSlots } from "./slots";
import { CategoriesPage } from "./pages/CategoriesPage";
import { ProductDetailsPage } from "./pages/ProductDetailsPage";
import { ProductFormPage } from "./pages/ProductFormPage";
import { ProductsPage } from "./pages/ProductsPage";

/** Catalog screens (inside the authenticated app shell). Static paths win over ":id" in React Router. */
export function createCatalogRoutes(slots: CatalogSlots = {}): RouteObject[] {
  return [
    { path: "/products", element: <ProductsPage /> },
    { path: "/products/new", element: <ProductFormPage key="new" /> },
    { path: "/products/categories", element: <CategoriesPage /> },
    { path: "/products/:id", element: <ProductDetailsPage ordersSection={slots.productOrders} /> },
    { path: "/products/:id/edit", element: <ProductFormPage key="edit" /> },
  ];
}
