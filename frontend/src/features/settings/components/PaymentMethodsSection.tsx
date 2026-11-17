import { Toggle } from "@/shared/ui/form/Toggle";
import { PAYMENT_METHODS, paymentMethodLabel } from "../domain/paymentMethods";
import { recordErrorMessage, type BusinessSettingsSectionProps } from "./businessSettingsSectionProps";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";

/** Enable/disable each payment method (at least one must stay on). */
export function PaymentMethodsSection({ register, errors }: BusinessSettingsSectionProps) {
  const error = recordErrorMessage(errors.methods);
  return (
    <SettingsGroup id="spay" icon="cash" tone="tone-green" title="طرق الدفع" subtitle="اللي بتظهر لما تسجّل دفعة">
      {PAYMENT_METHODS.map((method) => (
        <SettingsRow key={method} htmlFor={`set-pm-${method}`} title={paymentMethodLabel[method]} caption={method === "cod" ? "بتظهر عند «مستحقات شركة التوصيل»" : undefined}>
          <Toggle id={`set-pm-${method}`} aria-label={paymentMethodLabel[method]} {...register(`methods.${method}`)} />
        </SettingsRow>
      ))}
      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
    </SettingsGroup>
  );
}
