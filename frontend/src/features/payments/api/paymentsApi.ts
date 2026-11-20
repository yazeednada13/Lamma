import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { PaymentMethodCode } from "@/features/settings";
import { api } from "@/services/api/apiClient";
import type { MoneyString } from "@/shared/lib/money";
import { useActionKey } from "@/shared/lib/useActionKey";

// Payments & receivables contracts (API-DESIGN §16).

export type PaymentStatus = "paid" | "partial" | "unpaid" | "courier";
export type AgingBucket = "fresh" | "late" | "overdue";

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface Payment {
  id: string;
  customerId: string;
  customerName: string;
  /** Null for a customer-level payment. */
  orderId: string | null;
  orderNumber: number | null;
  amount: MoneyString;
  method: PaymentMethodCode;
  /** Business-local date, YYYY-MM-DD. */
  paidOn: string;
  recordedAt: string;
  note: string | null;
  isReversed: boolean;
  reversedAt: string | null;
  reversalReason: string | null;
  allocations: { orderId: string; orderNumber: number; amount: MoneyString }[];
}

export interface OrderPaymentSummary {
  orderId: string;
  number: number;
  total: MoneyString;
  paid: MoneyString;
  remaining: MoneyString;
  paymentStatus: PaymentStatus | null;
}

export interface PaymentResult {
  payment: Payment;
  orders: OrderPaymentSummary[];
  customerBalance: MoneyString;
}

export interface Receivable {
  orderId: string;
  number: number;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  total: MoneyString;
  paid: MoneyString;
  remaining: MoneyString;
  paymentStatus: PaymentStatus;
  deliveredAt: string;
  ageDays: number;
  bucket: AgingBucket;
}

export interface ReceivablesAging {
  total: MoneyString;
  count: number;
  customerCount: number;
  fresh: { amount: MoneyString; count: number };
  late: { amount: MoneyString; count: number };
  overdue: { amount: MoneyString; count: number };
  courierHeld: MoneyString;
  courierHeldCount: number;
}

export interface PaymentBody {
  amount: MoneyString;
  method: PaymentMethodCode;
  paidOn: string;
  note: string | null;
}

export interface PaymentListParams {
  from?: string;
  to?: string;
  method?: PaymentMethodCode;
  customerId?: string;
  orderId?: string;
  page?: number;
  pageSize?: number;
}

export interface ReceivableListParams {
  search?: string;
  bucket?: AgingBucket;
  customerId?: string;
  page?: number;
  pageSize?: number;
}

export const paymentKeys = {
  all: ["payments"] as const,
  list: (p: PaymentListParams) => ["payments", "list", p] as const,
  receivables: (p: ReceivableListParams) => ["payments", "receivables", p] as const,
  aging: ["payments", "aging"] as const,
};

function qs(params: object): string {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]));
  const text = s.toString();
  return text ? `?${text}` : "";
}

export const usePayments = (p: PaymentListParams, enabled = true) =>
  useQuery({ queryKey: paymentKeys.list(p), queryFn: () => api.get<Paged<Payment>>(`/payments${qs(p)}`), placeholderData: keepPreviousData, enabled });

export const useReceivables = (p: ReceivableListParams, enabled = true) =>
  useQuery({ queryKey: paymentKeys.receivables(p), queryFn: () => api.get<Paged<Receivable>>(`/finance/receivables${qs(p)}`), placeholderData: keepPreviousData, enabled });

export const useReceivablesAging = () => useQuery({ queryKey: paymentKeys.aging, queryFn: () => api.get<ReceivablesAging>("/finance/receivables/aging") });

/** A payment changes order, customer and receivable figures: refresh all of them (keys by prefix, no imports). */
function invalidateAfterPayment(queryClient: QueryClient) {
  for (const key of [paymentKeys.all, ["orders"], ["customers"]]) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}

function usePaymentMutation<TArgs>(fn: (args: TArgs, key: (body: unknown) => string) => Promise<PaymentResult>) {
  const queryClient = useQueryClient();
  const actionKey = useActionKey();
  return useMutation({
    mutationFn: (args: TArgs) => fn(args, (body) => actionKey.keyFor(body)),
    onSuccess: () => {
      actionKey.done();
      invalidateAfterPayment(queryClient);
    },
  });
}

export const useRecordOrderPayment = () =>
  usePaymentMutation(({ orderId, body }: { orderId: string; body: PaymentBody }, key) =>
    api.post<PaymentResult>(`/orders/${orderId}/payments`, body, { idempotencyKey: key({ orderId, body }) }),
  );

export const useRecordCustomerPayment = () =>
  usePaymentMutation(({ customerId, body }: { customerId: string; body: PaymentBody }, key) =>
    api.post<PaymentResult>(`/customers/${customerId}/payments`, body, { idempotencyKey: key({ customerId, body }) }),
  );

export const useReversePayment = () =>
  usePaymentMutation(({ id, reason }: { id: string; reason: string | null }, key) =>
    api.post<PaymentResult>(`/payments/${id}/reverse`, { reason }, { idempotencyKey: key({ id, reason }) }),
  );
