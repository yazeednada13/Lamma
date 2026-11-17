import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from "react";
import { FieldShell } from "./FieldShell";

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: ReactNode;
  options: readonly { value: string; label: string }[];
  error?: string;
  help?: ReactNode;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, options, error, help, id, required, disabled, className, ...rest },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <FieldShell label={label} required={required} help={help} error={error} id={selectId} className={className}>
      <span className={`control${error ? " is-error" : ""}${disabled ? " is-disabled" : ""}`}>
        <select ref={ref} id={selectId} required={required} disabled={disabled} aria-invalid={error ? true : undefined} {...rest}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </span>
    </FieldShell>
  );
});
