import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { Icon, type IconName } from "../Icon";
import { FieldShell } from "./FieldShell";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  icon?: IconName;
  affix?: ReactNode;
  help?: ReactNode;
  error?: string;
  ltr?: boolean;
  trailing?: ReactNode;
}

/** `.control` text input with optional leading icon, affix (د.أ, +962) and trailing action. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, icon, affix, help, error, ltr, trailing, required, id, className, disabled, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hasMessage = Boolean(error || help);
  return (
    <FieldShell label={label} required={required} help={help} error={error} id={inputId} className={className}>
      <span className={`control${error ? " is-error" : ""}${disabled ? " is-disabled" : ""}`}>
        {icon && <Icon name={icon} />}
        <input
          ref={ref}
          id={inputId}
          className={ltr ? "ltr" : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={hasMessage ? `${inputId}-msg` : undefined}
          required={required}
          disabled={disabled}
          {...rest}
        />
        {affix && <span className="control__affix">{affix}</span>}
        {trailing}
      </span>
    </FieldShell>
  );
});
