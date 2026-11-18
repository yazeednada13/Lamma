import type { UseFormReturn } from "react-hook-form";
import type { ProductFormValues } from "../schemas/productFormSchema";

/** What the product-form sections receive from the page that owns the form. */
export interface ProductFormSectionProps {
  form: UseFormReturn<ProductFormValues>;
}
