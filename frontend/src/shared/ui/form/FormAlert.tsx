import type { ReactNode } from "react";
import { Icon } from "../Icon";

/** Form-level error/info message (e.g. wrong credentials, network down). */
export function FormAlert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "info" | "success" }) {
  return (
    <div className={`form-alert form-alert--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon name={tone === "error" ? "alert-triangle" : tone === "success" ? "circle-check" : "info-circle"} size={16} />
      <span>{children}</span>
    </div>
  );
}
