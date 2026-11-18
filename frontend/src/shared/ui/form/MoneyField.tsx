import { forwardRef } from "react";
import { TextField, type TextFieldProps } from "./TextField";

/** JOD amount input: Latin digits, LTR, decimal keypad, "د.أ" affix. Parse with `parseMoneyInput` (2 decimals, D-080). */
export const MoneyField = forwardRef<HTMLInputElement, Omit<TextFieldProps, "affix" | "ltr" | "inputMode">>(function MoneyField(props, ref) {
  return <TextField ref={ref} ltr inputMode="decimal" autoComplete="off" affix="د.أ" {...props} />;
});
