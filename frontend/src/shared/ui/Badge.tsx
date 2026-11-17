import type { ReactNode } from "react";

export type BadgeTone = "success" | "warning" | "danger" | "info" | "attention" | "outline";

/** `.badge` from the design system. */
export function Badge({ tone, dot, large, children }: { tone?: BadgeTone; dot?: boolean; large?: boolean; children: ReactNode }) {
  const cls = ["badge", tone ? `badge--${tone}` : "", dot ? "badge--dot" : "", large ? "badge--lg" : ""].filter(Boolean).join(" ");
  return <span className={cls}>{children}</span>;
}
