import type { PaymentStatus } from "../api/paymentsApi";
import { PAYMENT_STATUS } from "../domain/paymentDomain";

/** Payment status badge (prototype `App.payBadge`, D-133). Nothing for a cancelled order (null status). */
export function PaymentBadge({ status }: { status: PaymentStatus | null }) {
  if (!status) return null;
  const info = PAYMENT_STATUS[status];
  return <span className={`badge badge--${info.tone}${info.outline ? " badge--outline" : ""}`}>{info.label}</span>;
}
