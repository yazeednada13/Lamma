import { useId } from "react";
import { createPortal } from "react-dom";
import { useOverlayPanel, type OverlayProps } from "./useOverlayPanel";

function DialogPanel({ onClose, title, children, footer }: Omit<OverlayProps, "open">) {
  const { panelRef, shown } = useOverlayPanel(onClose);
  const titleId = useId();
  return createPortal(
    <>
      <div className={`overlay${shown ? " is-open" : ""}`} style={{ display: "block" }} onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} className={`dialog${shown ? " is-open" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <h3 id={titleId}>{title}</h3>
        <div style={{ marginTop: 8 }}>{children}</div>
        {footer && <div className="dialog__actions">{footer}</div>}
      </div>
    </>,
    document.body,
  );
}

/** Centered confirmation dialog. Mounted only while open. Approved primitive (1.B3); first used by later phases. */
export function Dialog({ open, ...panel }: OverlayProps) {
  return open ? <DialogPanel {...panel} /> : null;
}
