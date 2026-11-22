import { useState } from "react";
import { paymentMethodLabel, type PaymentMethodCode } from "@/features/settings";
import { toFils, type MoneyString } from "@/shared/lib/money";
import { Button } from "@/shared/ui/Button";
import { Money } from "@/shared/ui/Money";
import type { PaymentStatus } from "../api/paymentsApi";
import { paidPercent } from "../domain/paymentDomain";
import { PaymentBadge } from "./PaymentBadge";
import { RecordPaymentDrawer } from "./RecordPaymentDrawer";
import { useReversePaymentAction } from "./useReversePaymentAction";

/** A payment applied to the order (API `OrderDetails.payments`). */
export interface OrderPaymentLine {
  paymentId: string;
  amount: MoneyString;
  paymentAmount: MoneyString;
  method: PaymentMethodCode;
  paidOn: string;
  recordedAt: string;
  note: string | null;
  isCustomerLevel: boolean;
  isReversed: boolean;
  reversedAt: string | null;
  reversalReason: string | null;
  /** Set for a payment from a courier settlement (D-141): reversed only with its settlement. */
  settlementId: string | null;
  /** A refund (D-148) has a negative amount on the order and cannot be reversed. */
  kind: "payment" | "refund";
}

/** The order figures the card needs (structurally an `OrderDetails`; the payments feature never imports orders). */
export interface OrderPaymentInfo {
  id: string;
  number: number;
  status: string;
  customer: { name: string };
  total: MoneyString;
  /** Total − returned value (Phase 8, D-148): what the customer owes in the end. */
  netTotal?: MoneyString;
  paid: MoneyString;
  remaining: MoneyString;
  paymentStatus: PaymentStatus | null;
  paymentMethod: PaymentMethodCode | null;
  createdAt: string;
  payments: OrderPaymentLine[];
}

const day = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { day: "numeric", month: "long", timeZone: "UTC" });

/** A business-local payment date (YYYY-MM-DD) as «21 تشرين الثاني». */
export const paidOnLabel = (paidOn: string): string => day.format(new Date(`${paidOn}T00:00:00Z`));

/** Order payment card (prototype order details «الدفع»): pay ring, total/paid/remaining, record, payments with reversal. */
export function OrderPaymentCard({ order: o }: { order: OrderPaymentInfo }) {
  const [paying, setPaying] = useState(false);
  const reverse = useReversePaymentAction();
  // A returned order may still owe its delivery fee (D-148), so only a cancelled order is closed for payments.
  const closed = o.status === "cancelled";
  const due = toFils(o.remaining) > 0;
  const total = o.netTotal ?? o.total;
  const percent = paidPercent(total, o.paid);

  return (
    <article className="card">
      <div className="shead">
        <div className="shead__t">
          <span className="overline">الدفع</span>
          <h2>
            {closed ? (
              "الطلب مسكّر"
            ) : due ? (
              <>
                باقي <Money value={o.remaining} />
              </>
            ) : (
              "مدفوع بالكامل"
            )}
          </h2>
        </div>
        <PaymentBadge status={o.paymentStatus} />
      </div>
      <div className="row" style={{ gap: 18 }}>
        <div className="payring" style={{ ["--p" as string]: percent }}>
          <span>
            <b className="num">
              <bdi>{percent}%</bdi>
            </b>
            مدفوع
          </span>
        </div>
        <dl className="dl grow">
          <dt>{total !== o.total ? "الصافي بعد المرتجع" : "المجموع"}</dt>
          <dd>
            <Money value={total} />
          </dd>
          <dt>المدفوع</dt>
          <dd>
            <Money value={o.paid} />
          </dd>
          <dt>المتبقي</dt>
          <dd>
            <b>
              <Money value={o.remaining} />
            </b>
          </dd>
        </dl>
      </div>
      {o.paymentStatus === "courier" && (
        <p className="caption" style={{ marginTop: 10 }}>
          الدفع عند الاستلام: المبلغ عند شركة التوصيل لحد التسوية.
        </p>
      )}
      {!closed && due && (
        <Button block icon="cash" style={{ marginTop: 14 }} onClick={() => setPaying(true)}>
          تسجيل دفعة
        </Button>
      )}
      {o.payments.length > 0 && (
        <ul className="col" style={{ gap: 8, marginTop: 14, listStyle: "none", padding: 0 }} aria-label="دفعات الطلب">
          {o.payments.map((p) => (
            <li
              key={p.paymentId}
              className="row"
              style={{ gap: 8, justifyContent: "space-between", opacity: p.isReversed ? 0.6 : 1 }}
            >
              <span>
                <span style={p.isReversed ? { textDecoration: "line-through" } : undefined}>
                  <Money value={p.amount} />
                </span>
                <span className="caption" style={{ display: "block" }}>
                  {paymentMethodLabel[p.method]} · {paidOnLabel(p.paidOn)}
                  {p.isCustomerLevel ? " · من دفعة على الحساب" : ""}
                  {p.settlementId ? " · من تسوية شركة التوصيل" : ""}
                  {p.kind === "refund" ? " · استرداد مرتجع" : ""}
                  {p.isReversed ? " · ملغية" : ""}
                </span>
              </span>
              {!p.isReversed && !p.settlementId && p.kind !== "refund" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void reverse({
                      id: p.paymentId,
                      amount: p.paymentAmount,
                      method: p.method,
                      spread: p.isCustomerLevel && p.paymentAmount !== p.amount,
                    })
                  }
                >
                  إلغاء الدفعة
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <RecordPaymentDrawer
        open={paying}
        onClose={() => setPaying(false)}
        target={{
          kind: "order",
          orderId: o.id,
          number: o.number,
          customerName: o.customer.name,
          remaining: o.remaining,
          paymentStatus: o.paymentStatus,
          expectedMethod: o.paymentMethod,
          createdAt: o.createdAt,
        }}
      />
    </article>
  );
}
