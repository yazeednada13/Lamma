import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Dropdown `.menu` (prototype `Lamma.toggleMenu`): opens from a trigger, closes on outside click,
 * Esc, or choosing an item. Items fade in with a 30ms stagger via CSS transition-delay.
 */
export function Menu({ trigger, children, style, label }: { trigger: (props: TriggerProps) => ReactNode; children: ReactNode; style?: CSSProperties; label: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      {trigger({ "aria-haspopup": "menu", "aria-expanded": open, "aria-controls": menuId, onClick: () => setOpen((o) => !o) })}
      <div
        id={menuId}
        className={`menu${open ? " is-open" : ""}`}
        role="menu"
        aria-label={label}
        hidden={!open}
        style={{ top: 48, insetInlineEnd: 0, ...style }}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("[role=menuitem]")) {
            setOpen(false);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}

export interface TriggerProps {
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string;
  onClick: () => void;
}
