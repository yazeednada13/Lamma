import { paymentMethodLabel, type PaymentMethodCode } from "@/features/settings";
import { formatMoneyNumber, type MoneyString } from "@/shared/lib/money";
import { useConfirm } from "@/shared/ui/confirm/ConfirmProvider";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { useReversePayment } from "../api/paymentsApi";

/** The parts of a payment the reversal dialog shows. */
export interface ReversiblePayment {
  id: string;
  amount: MoneyString;
  method: PaymentMethodCode;
  /** More than one order (a customer-level payment split FIFO): the dialog says so. */
  spread?: boolean;
}

/** «إلغاء الدفعة» through the shared confirmation dialog (D-120). A reversal keeps the payment in history (D-136). */
export function useReversePaymentAction() {
  const confirm = useConfirm();
  const reverse = useReversePayment();
  const toast = useToast();

  return async (payment: ReversiblePayment): Promise<boolean> => {
    const done = await confirm({
      tone: "danger",
      icon: "x",
      title: "إلغاء الدفعة؟",
      subject: `${formatMoneyNumber(payment.amount)} د.أ · ${paymentMethodLabel[payment.method]}`,
      message: payment.spread
        ? "الدفعة متوزعة على أكثر من طلب، ورح تنلغي من كلهم. بتضل بالسجل بس ما بتنحسب، والمبلغ برجع مستحق."
        : "الدفعة بتضل بالسجل بس ما بتنحسب، والمبلغ برجع مستحق على العميل.",
      confirmLabel: "إلغاء الدفعة",
      cancelLabel: "رجوع",
      action: () => reverse.mutateAsync({ id: payment.id, reason: null }),
    });
    if (done) toast("انلغت الدفعة ورجع المبلغ مستحق", { type: "info" });
    return done;
  };
}
