import { fromFils, parseMoneyInput, toFils } from "@/shared/lib/money";
import { MoneyField } from "@/shared/ui/form/MoneyField";
import { SelectField } from "@/shared/ui/form/SelectField";
import { TextField } from "@/shared/ui/form/TextField";
import { Icon } from "@/shared/ui/Icon";
import { Money } from "@/shared/ui/Money";
import type { Category } from "../api/catalogTypes";
import type { ProductFormSectionProps } from "./productFormSectionProps";

/** Step 2: name, price, cost (required, D-097), optional category (D-098) and the live margin. */
export function BasicsSection({ form, categories }: ProductFormSectionProps & { categories: readonly Category[] }) {
  const { register, formState, watch } = form;
  const errors = formState.errors;
  const price = parseMoneyInput(watch("sellingPrice") ?? "");
  const cost = parseMoneyInput(watch("cost") ?? "");
  const margin = price !== null && cost !== null ? toFils(price) - toFils(cost) : null;
  const percent = margin !== null && price !== null && toFils(price) > 0 ? Math.round((margin / toFils(price)) * 100) : 0;
  const options = [{ value: "", label: "بدون تصنيف" }, ...categories.map((c) => ({ value: c.id, label: c.name }))];

  return (
    <section className="card osec" aria-labelledby="pf-basics">
      <div className="osec__h">
        <span className="osec__n">2</span>
        <h2 id="pf-basics">الأساسيات</h2>
      </div>
      <TextField label="اسم المنتج" required error={errors.name?.message} {...register("name")} />
      <div className="grid g-3" style={{ marginTop: 12 }}>
        <MoneyField label="سعر البيع" required error={errors.sellingPrice?.message} {...register("sellingPrice")} />
        <MoneyField label="التكلفة" required help="عشان نحسب ربحك" error={errors.cost?.message} {...register("cost")} />
        <SelectField label="التصنيف" options={options} error={errors.categoryId?.message} {...register("categoryId")} />
      </div>
      {margin !== null && (
        <div className="receipt__profit" style={{ marginTop: 12 }} aria-live="polite">
          <span>
            <Icon name="wallet" size={16} /> ربحك بالقطعة
          </span>
          <b>
            <Money value={fromFils(margin)} /> · <bdi>{percent}%</bdi>
          </b>
        </div>
      )}
    </section>
  );
}
