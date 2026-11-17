import { Badge } from "@/shared/ui/Badge";
import { TextField } from "@/shared/ui/form/TextField";
import type { BusinessSettingsSectionProps } from "./businessSettingsSectionProps";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";

/** Default low-stock threshold, plus the fixed reservation/deduction rules shown for information. */
export function InventorySection({ register, errors }: BusinessSettingsSectionProps) {
  return (
    <SettingsGroup id="sinv" icon="building-warehouse" tone="tone-blue" title="المخزون" subtitle="الحجز والتنبيهات">
      <SettingsRow title="حد «قرب يخلص» الافتراضي" caption="لأي منتج جديد" htmlFor="set-low">
        <div style={{ width: 160 }}>
          <TextField
            id="set-low"
            label={<span className="sr-only">حد «قرب يخلص» الافتراضي</span>}
            type="number"
            inputMode="numeric"
            min={0}
            max={1000}
            ltr
            affix="قطع"
            error={errors.defaultLowStockThreshold?.message}
            {...register("defaultLowStockThreshold", { valueAsNumber: true })}
          />
        </div>
      </SettingsRow>
      <SettingsRow title="احجز القطع عند «مؤكد»" caption="قاعدة ثابتة بلمّة">
        <Badge tone="success">مفعّل دايمًا</Badge>
      </SettingsRow>
      <SettingsRow title="اخصم من المخزون عند «تم التوصيل»" caption="قاعدة ثابتة بلمّة">
        <Badge tone="success">مفعّل دايمًا</Badge>
      </SettingsRow>
    </SettingsGroup>
  );
}
