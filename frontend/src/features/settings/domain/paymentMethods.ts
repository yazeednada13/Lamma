// Payment methods (D-023): API codes and Arabic labels. Owned by business settings.

export type PaymentMethodCode = "cash" | "cliq" | "bank_transfer" | "cod" | "zain_cash" | "orange_money";

export const PAYMENT_METHODS: readonly PaymentMethodCode[] = ["cash", "cliq", "bank_transfer", "cod", "zain_cash", "orange_money"];

export const paymentMethodLabel: Record<PaymentMethodCode, string> = {
  cash: "كاش",
  cliq: "CliQ",
  bank_transfer: "تحويل بنكي",
  cod: "عند الاستلام",
  zain_cash: "زين كاش",
  orange_money: "أورنج موني",
};
