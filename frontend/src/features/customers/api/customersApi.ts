import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SalesChannelCode } from "@/features/settings";
import { api } from "@/services/api/apiClient";
import type { MoneyString } from "@/shared/lib/money";

// Customers contracts (API-DESIGN §14).

export type SegmentCode = "vip" | "owes" | "new" | "dormant";

export interface CustomerListItem {
  id: string;
  name: string;
  phone: string | null;
  channel: SalesChannelCode;
  city: string | null;
  area: string | null;
  orderCount: number;
  totalSpent: MoneyString;
  balanceDue: MoneyString;
  lastOrderOn: string | null;
  segments: SegmentCode[];
  isArchived: boolean;
  createdAt: string;
}

export interface CustomerDetails extends CustomerListItem {
  notes: string | null;
  averageOrder: MoneyString;
  updatedAt: string;
}

export interface CustomersSummary {
  total: number;
  activeThisMonth: number;
  averageSpent: MoneyString;
  totalDue: MoneyString;
  customersWithDue: number;
  segments: Record<SegmentCode, number>;
}

export interface CustomerBody {
  name: string;
  phone: string | null;
  channel: SalesChannelCode;
  city: string | null;
  area: string | null;
  notes: string | null;
}

export interface CustomerListParams {
  search?: string;
  segment?: SegmentCode;
  archived?: boolean;
  page?: number;
  pageSize?: number;
}

export const customerKeys = {
  all: ["customers"] as const,
  list: (p: CustomerListParams) => ["customers", "list", p] as const,
  summary: ["customers", "summary"] as const,
  detail: (id: string) => ["customers", "detail", id] as const,
};

function qs(params: object): string {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== false).map(([k, v]) => [k, String(v)]));
  const text = s.toString();
  return text ? `?${text}` : "";
}

export const useCustomers = (p: CustomerListParams) =>
  useQuery({ queryKey: customerKeys.list(p), queryFn: () => api.get<{ items: CustomerListItem[]; totalCount: number }>(`/customers${qs(p)}`), placeholderData: keepPreviousData });

export const useCustomersSummary = () => useQuery({ queryKey: customerKeys.summary, queryFn: () => api.get<CustomersSummary>("/customers/summary") });

export const useCustomer = (id: string | undefined) =>
  useQuery({ queryKey: customerKeys.detail(id ?? ""), queryFn: () => api.get<CustomerDetails>(`/customers/${id}`), enabled: Boolean(id) });

function useCustomerMutation<TArgs>(fn: (args: TArgs) => Promise<CustomerDetails>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (customer) => {
      queryClient.setQueryData(customerKeys.detail(customer.id), customer);
      void queryClient.invalidateQueries({ queryKey: ["customers", "list"] });
      void queryClient.invalidateQueries({ queryKey: customerKeys.summary });
    },
  });
}

export const useSaveCustomer = () =>
  useCustomerMutation(({ id, body }: { id?: string; body: CustomerBody }) => (id ? api.put<CustomerDetails>(`/customers/${id}`, body) : api.post<CustomerDetails>("/customers", body)));

export const useSetCustomerArchived = () =>
  useCustomerMutation(({ id, archived }: { id: string; archived: boolean }) => api.post<CustomerDetails>(`/customers/${id}/${archived ? "archive" : "restore"}`));
