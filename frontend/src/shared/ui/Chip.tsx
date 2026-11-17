import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Selectable `.chip`. Approved primitive (1.B3); first used by later phases. */
export function Chip({ selected, children, ...rest }: { selected?: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`chip${selected ? " is-selected" : ""}`} aria-pressed={selected} {...rest}>
      {children}
    </button>
  );
}
