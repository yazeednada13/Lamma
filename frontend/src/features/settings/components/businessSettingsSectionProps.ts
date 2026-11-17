import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { BusinessSettingsFormValues } from "../schemas/businessSettingsSchema";

/** What every business-settings section receives from the page that owns the form. */
export interface BusinessSettingsSectionProps {
  register: UseFormRegister<BusinessSettingsFormValues>;
  errors: FieldErrors<BusinessSettingsFormValues>;
}

/** Message of a whole-record error (record fields expose it untyped). */
export function recordErrorMessage(error: unknown): string | undefined {
  const message = (error as { message?: unknown } | undefined)?.message;
  return typeof message === "string" ? message : undefined;
}
