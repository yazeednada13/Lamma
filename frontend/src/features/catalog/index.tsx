// Public API of the catalog feature. Other code imports from "@/features/catalog" only.
import type { SettingsExtraSection } from "@/features/settings";
import { ProductTemplatesSection } from "./components/ProductTemplatesSection";

export { catalogRoutes } from "./routes";

/** The templates-and-custom-fields section, composed into the settings page by the app layer (D-092). */
export const productTemplatesSettingsSection: SettingsExtraSection = {
  id: "stpl",
  icon: "palette",
  label: "القوالب والحقول",
  element: <ProductTemplatesSection />,
};
