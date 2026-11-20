import { useState } from "react";
import { ApiError } from "@/services/api/apiClient";
import { useConfirm } from "@/shared/ui/confirm/ConfirmProvider";
import { TextField } from "@/shared/ui/form/TextField";
import type { CancelReason, OrderDetails } from "../api/ordersApi";
import { CANCEL_NOTE_MAX, CANCEL_REASONS, cancelProblem, isReserving } from "../domain/orderDomain";
import type { MoveTarget } from "./useOrderMove";
import { useOrderMove } from "./useOrderMove";

interface Choice {
  reason: CancelReason;
  note: string;
}

/** Reason chips (D-130) inside the shared confirmation dialog; «سبب ثاني» asks for a short text. */
function CancelReasonPicker({ onChange }: { onChange: (choice: Choice) => void }) {
  const [choice, setChoice] = useState<Choice>({ reason: "changed_mind", note: "" });
  const update = (next: Choice) => {
    setChoice(next);
    onChange(next);
  };

  return (
    <>
      <div className="row wrap" role="radiogroup" aria-label="سبب الإلغاء" style={{ gap: 6 }}>
        {CANCEL_REASONS.map((r) => (
          <button
            key={r.code}
            type="button"
            role="radio"
            aria-checked={choice.reason === r.code}
            className={`chip${choice.reason === r.code ? " is-selected" : ""}`}
            onClick={() => update({ ...choice, reason: r.code })}
          >
            {r.label}
          </button>
        ))}
      </div>
      {choice.reason === "other" && (
        <TextField label="السبب" maxLength={CANCEL_NOTE_MAX} value={choice.note} onChange={(e) => update({ ...choice, note: e.target.value })} autoFocus />
      )}
    </>
  );
}

/** Cancel through the shared confirmation dialog (D-120) with a reason (D-130); the toast offers undo. */
export function useCancelOrder() {
  const confirm = useConfirm();
  const { changeAsync, announce } = useOrderMove();

  return async (order: MoveTarget): Promise<OrderDetails | null> => {
    const choice = { current: { reason: "changed_mind", note: "" } as Choice };
    const outcome: { order: OrderDetails | null } = { order: null };
    const confirmed = await confirm({
      tone: "danger",
      icon: "x",
      title: `إلغاء الطلب #${order.number}؟`,
      message: isReserving(order.status) ? "القطع المحجوزة رح ترجع للمتوفر تلقائيًا." : "الطلب ما حجز قطع، فالمخزون ما بيتأثر.",
      content: <CancelReasonPicker onChange={(c) => (choice.current = c)} />,
      confirmLabel: "إلغاء الطلب",
      cancelLabel: "رجوع",
      action: async () => {
        const { reason, note } = choice.current;
        const problem = cancelProblem(reason, note);
        if (problem) throw new ApiError(422, "validation.failed", problem);
        outcome.order = await changeAsync({ id: order.id, to: "cancelled", expectedStatus: order.status, cancelReason: reason, cancelNote: note.trim() || null });
      },
    });
    if (confirmed && outcome.order) announce(outcome.order, "cancelled");
    return outcome.order;
  };
}
