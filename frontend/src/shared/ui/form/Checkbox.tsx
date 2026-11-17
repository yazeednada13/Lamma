import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }>(function Checkbox({ label, ...rest }, ref) {
  return (
    <label className="check">
      <input ref={ref} type="checkbox" {...rest} /> {label}
    </label>
  );
});
