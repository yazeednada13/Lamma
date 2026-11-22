import { ApiError, errorMessage } from "@/services/api/apiClient";
import { useCelebrate } from "@/shared/ui/celebrate/CelebrateProvider";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import {
  useChangeOrderStatus,
  useRefreshOrders,
  useUndoOrderStatus,
  type CancelReason,
  type OrderDetails,
  type OrderStatus,
} from "../api/ordersApi";
import { STATUS, statusMessage } from "../domain/orderDomain";

/** How long the undo action stays in the toast; the server keeps the 5-minute window (D-122). */
const UNDO_TOAST_MS = 10_000;

export interface MoveTarget {
  id: string;
  number: number;
  status: OrderStatus;
}

/**
 * Moves an order to a status (list, board and details share it) and offers «تراجع» in the toast (D-122).
 * Stale data (409) refreshes the screens so the merchant sees the current state.
 */
export function useOrderMove() {
  const change = useChangeOrderStatus();
  const undo = useUndoOrderStatus();
  const refresh = useRefreshOrders();
  const toast = useToast();
  const celebrate = useCelebrate();

  const fail = (error: unknown) => {
    if (error instanceof ApiError && error.status === 409) refresh();
    toast(errorMessage(error), { type: "error" });
  };

  const undoChange = async (order: OrderDetails) => {
    if (!order.undo) return;
    try {
      await undo.mutateAsync({ id: order.id, changeId: order.undo.changeId });
      toast(`رجع الطلب #${order.number} لـ «${STATUS[order.undo.to].label}»`, { type: "info" });
    } catch (error) {
      fail(error);
    }
  };

  /** Throws nothing; returns the updated order, or null when the change failed (an error toast was shown). */
  const move = async (
    target: MoveTarget,
    to: OrderStatus,
    cancel?: { reason: CancelReason; note: string | null },
  ): Promise<OrderDetails | null> => {
    try {
      const order = await change.mutateAsync({
        id: target.id,
        to,
        expectedStatus: target.status,
        cancelReason: cancel?.reason,
        cancelNote: cancel?.note,
      });
      announce(order, to);
      if (to === "delivered")
        celebrate({
          kind: "burst",
          sticker: "check",
          title: `طلب ${order.customer.name} وصل`,
          text: `#${order.number} · انحسبت المبيعة وانخصم المخزون`,
        });
      return order;
    } catch (error) {
      fail(error);
      return null;
    }
  };

  /** Toast for a change done elsewhere (e.g. the cancel dialog), with the same undo action. */
  const announce = (order: OrderDetails, to: OrderStatus) =>
    toast(
      statusMessage(order.number, to),
      order.undo ? { action: "تراجع", onAction: () => void undoChange(order), durationMs: UNDO_TOAST_MS } : undefined,
    );

  return {
    move,
    announce,
    undoChange,
    /** The order currently being moved, if any. */
    movingId: change.isPending ? (change.variables?.id ?? null) : null,
    undoing: undo.isPending,
    /** Raw mutation for flows that show errors themselves (the cancel dialog). */
    changeAsync: change.mutateAsync,
  };
}
