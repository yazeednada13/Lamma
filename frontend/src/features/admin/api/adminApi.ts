import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SubscriptionSummary } from "@/features/auth";
import { api } from "@/services/api/apiClient";
import type { MoneyString } from "@/shared/lib/money";

// The platform admin area (API-DESIGN §21, part 11-II; D-164, D-175, P-025).

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface AdminDashboard {
  pendingLeads: number;
  activeTrials: number;
  trialsEndingSoon: number;
  paying: number;
  readOnly: number;
  suspended: number;
  pendingPayments: number;
  monthlyRevenue: MoneyString;
  conversionRate: number | null;
  weeks: { weekStart: string; leads: number; accounts: number }[];
}

export interface SubscriberRow {
  businessId: string;
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  subscription: SubscriptionSummary;
  createdAt: string;
  lastLoginAt: string | null;
  hasPendingPayment: boolean;
}

export interface AuditEntry {
  id: string;
  action: string;
  details: string | null;
  at: string;
}

export interface AdminPayment {
  id: string;
  businessId: string;
  businessName: string;
  ownerName: string;
  referenceCode: string | null;
  plan: "monthly" | "yearly";
  amount: MoneyString;
  status: "pending" | "approved" | "rejected";
  rejectReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  proofContentType: string;
}

export interface AdminPeriod {
  id: string;
  plan: "monthly" | "yearly";
  startsOn: string;
  endsOn: string;
  amount: MoneyString;
  source: "payment" | "admin";
  cancelled: boolean;
  createdAt: string;
}

export interface SubscriberDetail {
  row: SubscriberRow;
  businessType: string;
  referenceCode: string | null;
  trialStartsAt: string;
  trialEndsAt: string;
  suspendReason: string | null;
  ordersCount: number;
  productsCount: number;
  periods: AdminPeriod[];
  payments: AdminPayment[];
  notes: AuditEntry[];
  audit: AuditEntry[];
}

export interface Lead {
  id: string;
  fullName: string;
  email: string;
  phoneE164: string;
  storeName: string | null;
  status: "pending" | "registered";
  utmSource: string | null;
  sendCount: number;
  lastSentAt: string | null;
  createdAt: string;
  registeredAt: string | null;
}

export type SubscriberAction =
  | { kind: "extend-trial"; days: number }
  | { kind: "activate"; plan: "monthly" | "yearly"; startsOn?: string; amount?: string; reference?: string; note?: string }
  | { kind: "extend"; days: number }
  | { kind: "end-plan" }
  | { kind: "suspend"; reason: string }
  | { kind: "reactivate" }
  | { kind: "notes"; text: string };

const keys = {
  all: ["admin"] as const,
  dashboard: ["admin", "dashboard"] as const,
  subscribers: (q: string) => ["admin", "subscribers", q] as const,
  subscriber: (id: string) => ["admin", "subscriber", id] as const,
  payments: (status: string) => ["admin", "payments", status] as const,
  leads: (q: string) => ["admin", "leads", q] as const,
};

const qs = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();

export const useAdminDashboard = () => useQuery({ queryKey: keys.dashboard, queryFn: () => api.get<AdminDashboard>("/admin/dashboard"), staleTime: 0 });

export function useSubscribers(search: string, status: string, page: number) {
  const q = qs({ search, status, page, pageSize: 20 });
  return useQuery({ queryKey: keys.subscribers(q), queryFn: () => api.get<Paged<SubscriberRow>>(`/admin/subscribers?${q}`), placeholderData: keepPreviousData, staleTime: 0 });
}

export const useSubscriber = (id: string) =>
  useQuery({ queryKey: keys.subscriber(id), queryFn: () => api.get<SubscriberDetail>(`/admin/subscribers/${id}`), staleTime: 0 });

/** One admin change; the body without `kind` is sent with a fresh Idempotency-Key per action. */
export function useSubscriberAction(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ action, key }: { action: SubscriberAction; key: string }) => {
      const { kind, ...body } = action;
      return api.post<SubscriberDetail>(`/admin/subscribers/${id}/${kind}`, body, { idempotencyKey: key });
    },
    onSuccess: (detail) => {
      client.setQueryData(keys.subscriber(id), detail);
      void client.invalidateQueries({ queryKey: keys.all, refetchType: "inactive" });
    },
  });
}

export const usePayments = (status: string) =>
  useQuery({ queryKey: keys.payments(status), queryFn: () => api.get<AdminPayment[]>(`/admin/payment-requests?${qs({ status })}`), staleTime: 0 });

export function usePaymentDecision() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve, reason, key }: { id: string; approve: boolean; reason?: string; key: string }) =>
      api.post<AdminPayment>(`/admin/payment-requests/${id}/${approve ? "approve" : "reject"}`, approve ? {} : { reason }, { idempotencyKey: key }),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.all }),
  });
}

export const proofBlob = (paymentId: string) => api.blob(`/admin/payment-requests/${paymentId}/proof`);

export function useLeads(search: string, status: string, page: number) {
  const q = qs({ search, status, page, pageSize: 20 });
  return useQuery({ queryKey: keys.leads(q), queryFn: () => api.get<Paged<Lead>>(`/admin/leads?${q}`), placeholderData: keepPreviousData, staleTime: 0 });
}

export function useResendInvite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, key }: { id: string; key: string }) => api.post<Lead>(`/admin/leads/${id}/resend`, {}, { idempotencyKey: key }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["admin", "leads"] }),
  });
}
