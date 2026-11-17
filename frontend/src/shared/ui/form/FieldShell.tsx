import type { ReactNode } from "react";

interface FieldShellProps {
  label: ReactNode;
  required?: boolean;
  help?: ReactNode;
  error?: string;
  id: string;
  children: ReactNode;
  className?: string;
}

/** `.field` wrapper: label, control, help or error (errors are announced via aria-describedby). */
export function FieldShell({ label, required, help, error, id, children, className }: FieldShellProps) {
  return (
    <div className={`field${className ? ` ${className}` : ""}`}>
      <label className="field__label" htmlFor={id}>
        {label} {required && <span className="req" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? (
        <span className="field__error" id={`${id}-msg`} role="alert">
          {error}
        </span>
      ) : help ? (
        <span className="field__help" id={`${id}-msg`}>
          {help}
        </span>
      ) : null}
    </div>
  );
}
