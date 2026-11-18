import { SelectField } from "@/shared/ui/form/SelectField";
import { TextField } from "@/shared/ui/form/TextField";
import type { BusinessTypeOption } from "../api/businessTypesApi";
import type { BusinessSettingsSectionProps } from "./businessSettingsSectionProps";
import { SettingsGroup } from "./SettingsGroup";

/** Business name, type (labels from the API, D-103) and (fixed) currency. */
export function BusinessProfileSection({ register, errors, businessTypes }: BusinessSettingsSectionProps & { businessTypes: readonly BusinessTypeOption[] }) {
  const typeOptions = businessTypes.map((t) => ({ value: t.code, label: t.labelAr }));
  return (
    <SettingsGroup id="sp" icon="home" tone="tone-olive" title="الملف التعريفي" subtitle="اسم مشروعك ونوعه وعملته">
      <div className="grid g-2">
        <TextField label="اسم المشروع" required error={errors.name?.message} {...register("name")} />
        <SelectField label="نوع المشروع" options={typeOptions} help="بيحدد قالب المنتجات الافتراضي" {...register("businessType")} />
        <TextField label="العملة" value="دينار أردني (د.أ)" readOnly disabled />
      </div>
    </SettingsGroup>
  );
}
