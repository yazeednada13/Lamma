import { errorMessage } from "@/services/api/apiClient";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { Skeleton } from "@/shared/ui/feedback/Skeleton";
import { usePayments } from "../api/paymentsApi";
import { PaymentsTable } from "./PaymentsTable";

/** «الدفعات» on the customer profile: the customer's latest payments, reversed ones flagged. */
export function CustomerPaymentsSection({ customerId }: { customerId: string }) {
  const list = usePayments({ customerId, pageSize: 10 });
  return (
    <section>
      <div className="shead">
        <div className="shead__t">
          <span className="overline">{list.data ? `${list.data.totalCount} دفعة` : "الدفعات"}</span>
          <h2>دفعاته</h2>
        </div>
      </div>
      {list.error ? (
        <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} />
      ) : !list.data ? (
        <Skeleton height={80} />
      ) : list.data.items.length === 0 ? (
        <p className="muted">لسا ما في دفعات مسجّلة.</p>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <PaymentsTable payments={list.data.items} showCustomer={false} />
        </div>
      )}
    </section>
  );
}
