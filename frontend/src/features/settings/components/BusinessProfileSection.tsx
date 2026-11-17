import { SelectField } from "@/shared/ui/form/SelectField";
import { TextField } from "@/shared/ui/form/TextField";
import { businessTypeInfo } from "../domain/businessTypes";
import type { BusinessSettingsSectionProps } from "./businessSettingsSectionProps";
import { SettingsGroup } from "./SettingsGroup";

const TYPE_OPTIONS = Object.entries(businessTypeInfo).map(([value, info]) => ({ value, label: info.label }));

/** Business name, type and (fixed) currency. */
export function BusinessProfileSection({ register, errors }: BusinessSettingsSectionProps) {
  return (
    <SettingsGroup id="sp" icon="home" tone="tone-olive" title="الملف التعريفي" subtitle="اسم مشروعك ونوعه وعملته">
      <div className="grid g-2">
        <TextField label="اسم المشروع" required error={errors.name?.message} {...register("name")} />
        <SelectField label="نوع المشروع" options={TYPE_OPTIONS} help="بيحدد قالب المنتجات الافتراضي" {...register("businessType")} />
        <TextField label="العملة" value="دينار أردني (د.أ)" readOnly disabled />
      </div>
    </SettingsGroup>
  );
}
