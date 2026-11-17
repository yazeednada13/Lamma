import { forwardRef, useState } from "react";
import { Icon } from "../Icon";
import { TextField, type TextFieldProps } from "./TextField";

/** Password input with show/hide toggle (eye icon), as in the prototype. */
export const PasswordField = forwardRef<HTMLInputElement, Omit<TextFieldProps, "type" | "icon" | "trailing">>(function PasswordField(props, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      ref={ref}
      {...props}
      type={visible ? "text" : "password"}
      icon="lock"
      ltr
      trailing={
        <button
          type="button"
          className="btn btn--ghost icon-btn btn--sm"
          aria-label={visible ? "إخفاء كلمة السر" : "إظهار كلمة السر"}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          <Icon name="eye" size={16} />
        </button>
      }
    />
  );
});
