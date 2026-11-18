import { SelectField } from "@/shared/ui/form/SelectField";
import { TextField } from "@/shared/ui/form/TextField";
import type { ProductTemplate } from "../api/catalogTypes";
import type { ProductFormSectionProps } from "./productFormSectionProps";

/** Step 3: the template's descriptive fields (system + the business's custom fields) and expiry when supported (D-101). */
export function TemplateFieldsSection({ form, template }: ProductFormSectionProps & { template: ProductTemplate }) {
  const { register, formState } = form;
  const attributeErrors = (formState.errors.attributes ?? {}) as Record<string, { message?: string } | undefined>;
  if (template.fields.length === 0 && !template.supportsExpiry) {
    return null;
  }

  return (
    <section className="card osec" aria-labelledby="pf-details">
      <div className="osec__h">
        <span className="osec__n">3</span>
        <h2 id="pf-details">تفاصيل القطعة</h2>
      </div>
      <div className="grid g-3">
        {template.fields.map((field) => {
          const name = `attributes.${field.key}` as const;
          const error = attributeErrors[field.key]?.message;
          if (field.type === "select") {
            return (
              <SelectField
                key={field.key}
                label={field.labelAr}
                required={field.isRequired}
                error={error}
                options={[{ value: "", label: "—" }, ...field.options.map((o) => ({ value: o, label: o }))]}
                {...register(name)}
              />
            );
          }

          return (
            <TextField
              key={field.key}
              label={field.labelAr}
              required={field.isRequired}
              error={error}
              type={field.type === "date" ? "date" : "text"}
              inputMode={field.type === "number" ? "decimal" : undefined}
              ltr={field.type !== "text"}
              {...register(name)}
            />
          );
        })}
        {template.supportsExpiry && (
          <TextField label="تاريخ الانتهاء" type="date" ltr help="لكل نسخ المنتج" error={formState.errors.expiryDate?.message} {...register("expiryDate")} />
        )}
      </div>
    </section>
  );
}
