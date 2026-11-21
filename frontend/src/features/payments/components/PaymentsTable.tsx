import { Link } from "react-router";
import { paymentMethodLabel } from "@/features/settings";
import { Button } from "@/shared/ui/Button";
import { Money } from "@/shared/ui/Money";
import type { Payment } from "../api/paymentsApi";
import { paidOnLabel } from "./OrderPaymentCard";
import { useReversePaymentAction } from "./useReversePaymentAction";

/** Which order(s) a payment went to: «#1001» or «#1001، #1002». */
function OrdersCell({ payment }: { payment: Payment }) {
  if (payment.allocations.length === 0) return <>—</>;
  return (
    <span className="ltr">
      {payment.allocations.map((a, i) => (
        <span key={a.orderId}>
          {i > 0 && "، "}
          <Link to={`/orders/${a.orderId}`} onClick={(e) => e.stopPropagation()} style={{ color: "inherit" }}>
            <b>#{a.orderNumber}</b>
          </Link>
        </span>
      ))}
    </span>
  );
}

/** Received payments (prototype «الدفعات المستلمة»). Reversed rows stay listed, struck through (D-136). */
export function PaymentsTable({ payments, showCustomer = true }: { payments: Payment[]; showCustomer?: boolean }) {
  const reverse = useReversePaymentAction();
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>الطلب</th>
            {showCustomer && <th>العميل</th>}
            <th className="hide-sm">الطريقة</th>
            <th>التاريخ</th>
            <th className="num">المبلغ</th>
            <th className="num">
              <span className="sr-only">إجراء</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} style={p.isReversed ? { opacity: 0.6 } : undefined}>
              <td>
                <OrdersCell payment={p} />
                {p.orderId === null && <span className="caption" style={{ display: "block" }}>على الحساب</span>}
                {p.settlementId && <span className="caption" style={{ display: "block" }}>تسوية شركة التوصيل</span>}
              </td>
              {showCustomer && (
                <td>
                  <Link to={`/customers/${p.customerId}`} style={{ color: "inherit" }}>
                    {p.customerName}
                  </Link>
                </td>
              )}
              <td className="hide-sm">{paymentMethodLabel[p.method]}</td>
              <td className="caption">
                {paidOnLabel(p.paidOn)}
                {p.isReversed && <span style={{ display: "block" }}>ملغية</span>}
              </td>
              <td className="num" style={p.isReversed ? { textDecoration: "line-through" } : undefined}>
                <Money value={p.amount} tone={p.isReversed ? undefined : "pos"} />
              </td>
              <td className="num">
                {!p.isReversed && !p.settlementId && (
                  <Button variant="ghost" size="sm" onClick={() => void reverse({ id: p.id, amount: p.amount, method: p.method, spread: p.allocations.length > 1 })}>
                    إلغاء الدفعة
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
