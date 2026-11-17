import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { LammaMark } from "../brand/LammaMark";
import { Icon } from "../Icon";

export type ToastType = "success" | "error" | "info";

interface ToastOptions {
  type?: ToastType;
  action?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  message: string;
  leaving: boolean;
}

type ShowToast = (message: string, options?: ToastOptions) => void;

const ToastContext = createContext<ShowToast | null>(null);

/** `.toasts` host. Success toasts draw the shadda (the "lamma" moment), as in the prototype. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 220);
  }, []);

  const show = useCallback<ShowToast>(
    (message, options = {}) => {
      const id = nextId.current++;
      setItems((list) => [...list, { id, message, leaving: false, ...options }]);
      window.setTimeout(() => dismiss(id), options.durationMs ?? 4200);
    },
    [dismiss],
  );

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast${t.type === "error" ? " toast--error" : ""}${t.leaving ? " is-leaving" : ""}`}>
            {t.type === "error" ? <Icon name="alert-triangle" /> : t.type === "info" ? <Icon name="info-circle" /> : <LammaMark size={26} draw />}
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.onAction?.();
                  dismiss(t.id);
                }}
              >
                {t.action}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) {
    throw new Error("useToast must be used inside <ToastProvider>.");
  }

  return show;
}
