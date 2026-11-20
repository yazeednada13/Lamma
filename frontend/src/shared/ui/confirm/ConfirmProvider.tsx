import { createContext, useCallback, useContext, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { errorMessage } from "@/services/api/apiClient";
import { Button } from "../Button";
import { FormAlert } from "../form/FormAlert";
import { Icon, type IconName } from "../Icon";
import { useOverlayPanel } from "../overlay/useOverlayPanel";

export type ConfirmTone = "danger" | "warning" | "neutral";

export interface ConfirmOptions {
  title: string;
  /** What will happen, in one or two short sentences. */
  message?: ReactNode;
  /** The thing being acted on (e.g. a customer's name), shown as a chip. */
  subject?: ReactNode;
  tone?: ConfirmTone;
  icon?: IconName;
  /** Extra controls between the text and the buttons (e.g. a reason picker); they keep their own state. */
  content?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /**
   * Optional work to run on confirm. The dialog stays open with a spinner until it finishes; an error is shown
   * inside the dialog and it stays open. Without it, the dialog closes immediately.
   */
  action?: () => Promise<unknown>;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * Lamma's single confirmation dialog: `const confirm = useConfirm(); if (await confirm({...})) …`.
 * Every confirm-worthy action uses it, so all confirmations look and behave the same.
 */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside ConfirmProvider.");
  return confirm;
}

interface Pending extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirm = useCallback<Confirm>((options) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })), []);
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmPanel
          key={pending.title}
          options={pending}
          onDone={(confirmed) => {
            pending.resolve(confirmed);
            setPending(null);
          }}
        />
      )}
    </ConfirmContext.Provider>
  );
}

const DEFAULT_ICON: Record<ConfirmTone, IconName> = { danger: "trash", warning: "alert-triangle", neutral: "info-circle" };

function ConfirmPanel({ options, onDone }: { options: ConfirmOptions; onDone: (confirmed: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const cancel = () => {
    if (!busyRef.current) onDone(false);
  };
  const { panelRef, shown } = useOverlayPanel(cancel);
  const titleId = useId();
  const textId = useId();
  const tone = options.tone ?? "neutral";

  const accept = async () => {
    if (!options.action) return onDone(true);
    setError(null);
    setBusy(true);
    busyRef.current = true;
    try {
      await options.action();
      onDone(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return createPortal(
    <>
      <div className={`overlay${shown ? " is-open" : ""}`} style={{ display: "block" }} onClick={cancel} aria-hidden="true" />
      <div
        ref={panelRef}
        className={`dialog lconfirm lconfirm--${tone}${shown ? " is-open" : ""}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={options.message ? textId : undefined}
        tabIndex={-1}
      >
        <div className="lconfirm__band" aria-hidden="true" />
        <div className="lconfirm__seal" aria-hidden="true">
          <Icon name={options.icon ?? DEFAULT_ICON[tone]} size={24} />
        </div>
        <div className="lconfirm__body">
          <h3 id={titleId} className="lconfirm__title">
            {options.title}
          </h3>
          {options.subject && <div className="lconfirm__subject">{options.subject}</div>}
          {options.message && (
            <p id={textId} className="lconfirm__text">
              {options.message}
            </p>
          )}
          {options.content && <div className="lconfirm__content">{options.content}</div>}
          {error && <FormAlert>{error}</FormAlert>}
          <div className="lconfirm__actions">
            <Button variant={tone === "danger" ? "danger" : "primary"} loading={busy} onClick={() => void accept()}>
              {options.confirmLabel}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={cancel}>
              {options.cancelLabel ?? "إلغاء"}
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
