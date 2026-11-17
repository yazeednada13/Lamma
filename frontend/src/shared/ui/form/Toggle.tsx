import { forwardRef, type InputHTMLAttributes } from "react";

/** `input.toggle` switch. Must be given an accessible name via aria-label or a wrapping label. */
export const Toggle = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Toggle(props, ref) {
  return <input ref={ref} type="checkbox" role="switch" className="toggle" {...props} />;
});
