import { useId } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "../Button";
import { useOverlayPanel, type OverlayProps } from "./useOverlayPanel";

function DrawerPanel({ onClose, title, children, footer }: Omit<OverlayProps, "open">) {
  const { panelRef, shown } = useOverlayPanel(onClose);
  const titleId = useId();
  return createPortal(
    <>
      <div className={`overlay${shown ? " is-open" : ""}`} style={{ display: "block" }} onClick={onClose} aria-hidden="true" />
      <aside ref={panelRef} className={`drawer${shown ? " is-open" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="drawer__head">
          <h3 id={titleId}>{title}</h3>
          <IconButton icon="x" label="إغلاق" onClick={onClose} />
        </div>
        <div className="drawer__body">{children}</div>
        {footer && <div className="drawer__foot">{footer}</div>}
      </aside>
    </>,
    document.body,
  );
}

/** Side drawer (bottom sheet under 768px via CSS). Mounted only while open. */
export function Drawer({ open, ...panel }: OverlayProps) {
  return open ? <DrawerPanel {...panel} /> : null;
}
