import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/services/api/apiClient";
import type { MoneyString } from "@/shared/lib/money";
import { useActionKey } from "@/shared/lib/useActionKey";

// Courier & expenses contracts (API-DESIGN §17).

export type CategoryCode = "ads" | "delivery" | "packaging" | "rent" | "other";

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  code: CategoryCode | null;
  isSystem: boolean;
  isArchived: boolean;
}

export interface Expense {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryCode: CategoryCode | null;
  amount: MoneyString;
  /** Business-local date, YYYY-MM-DD. */
  spentOn: string;
  note: string | null;
  source: "manual" | "courier_settlement";
  settlementId: string | null;
  recordedAt: string;
  isVoided: boolean;
  voidedAt: string | null;
  voidReason: string | null;
}

export interface ExpenseSummary {
  from: string;
  to: string;
  total: MoneyString;
  count: number;
  byCategory: { categoryId: string; name: string; code: CategoryCode | null; amount: MoneyString; count: number }[];
  lastCategoryId: string | null;
}

export interface HeldOrder {
  orderId: string;
  number: number;
  customerId: string;
  customerName: string;
  total: MoneyString;
  paid: MoneyString;
  remaining: MoneyString;
  deliveredAt: string;
}

export interface Settlement {
  id: string;
  settledOn: string;
  expectedAmount: MoneyString;
  receivedAmount: MoneyString;
  difference: MoneyString;
  note: string | null;
  recordedAt: string;
  isReversed: boolean;
  reversedAt: string | null;
  reversalReason: string | null;
  expenseId: string | null;
  orders: { orderId: string; number: number; customerName: string; expectedAmount: MoneyString }[];
}

export interface CourierOverview {
  companyName: string;
  held: MoneyString;
  waitingCount: number;
  onTheWay: MoneyString;
  onTheWayCount: number;
  monthFees: MoneyString;
  lastSettlement: Settlement | null;
  waiting: HeldOrder[];
}

export interface FinanceOverview {
  from: string;
  to: string;
  sales: MoneyString;
  deliveredCount: number;
  cogs: MoneyString;
  grossProfit: MoneyString;
  expenses: MoneyString;
  netProfit: MoneyString;
  cashReceived: MoneyString;
  cashOut: MoneyString;
  cashFlow: MoneyString;
  customerDues: MoneyString;
  courierHeld: MoneyString;
  expectedSales: MoneyString;
  expensesByCategory: { categoryId: string; name: string; code: CategoryCode | null; amount: MoneyString }[];
  /** Phase 8 (D-149): value returned in the period, and sales − returns. */
  returns: MoneyString;
  netSales: MoneyString;
}

export interface Period {
  from?: string;
  to?: string;
}

export const financeKeys = {
  all: ["finance"] as const,
  categories: (includeArchived: boolean) => ["finance", "categories", includeArchived] as const,
  expenses: (p: object) => ["finance", "expenses", p] as const,
  summary: (p: Period) => ["finance", "summary", p] as const,
  courier: ["finance", "courier"] as const,
  settlements: (page: number) => ["finance", "settlements", page] as const,
  overview: (p: Period) => ["finance", "overview", p] as const,
};

function qs(params: object): string {
  const s = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)]),
  );
  const text = s.toString();
  return text ? `?${text}` : "";
}

export const useExpenseCategories = (includeArchived = false) =>
  useQuery({
    queryKey: financeKeys.categories(includeArchived),
    queryFn: () =>
      api.get<ExpenseCategory[]>(`/expense-categories${qs({ includeArchived: includeArchived || undefined })}`),
  });

export const useExpenses = (p: Period & { categoryId?: string; page?: number; pageSize?: number }) =>
  useQuery({
    queryKey: financeKeys.expenses(p),
    queryFn: () => api.get<Paged<Expense>>(`/expenses${qs(p)}`),
    placeholderData: keepPreviousData,
  });

export const useExpenseSummary = (p: Period) =>
  useQuery({
    queryKey: financeKeys.summary(p),
    queryFn: () => api.get<ExpenseSummary>(`/expenses/summary${qs(p)}`),
    placeholderData: keepPreviousData,
  });

export const useCourier = () =>
  useQuery({ queryKey: financeKeys.courier, queryFn: () => api.get<CourierOverview>("/courier") });

export const useSettlements = (page: number) =>
  useQuery({
    queryKey: financeKeys.settlements(page),
    queryFn: () => api.get<Paged<Settlement>>(`/courier/settlements${qs({ page, pageSize: 10 })}`),
    placeholderData: keepPreviousData,
  });

export const useFinanceOverview = (p: Period) =>
  useQuery({
    queryKey: financeKeys.overview(p),
    queryFn: () => api.get<FinanceOverview>(`/finance/overview${qs(p)}`),
    placeholderData: keepPreviousData,
  });

/** Money writes change finance, order, customer and receivable figures: refresh them (keys by prefix, no imports). */
function invalidateMoney(queryClient: QueryClient) {
  for (const key of [financeKeys.all, ["orders"], ["customers"], ["payments"]]) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}

function useMoneyMutation<TArgs, TResult>(fn: (args: TArgs, key: (body: unknown) => string) => Promise<TResult>) {
  const queryClient = useQueryClient();
  const actionKey = useActionKey();
  return useMutation({
    mutationFn: (args: TArgs) => fn(args, (body) => actionKey.keyFor(body)),
    onSuccess: () => {
      actionKey.done();
      invalidateMoney(queryClient);
    },
  });
}

export interface ExpenseBody {
  amount: MoneyString;
  categoryId: string;
  spentOn: string;
  note: string | null;
}

export const useRecordExpense = () =>
  useMoneyMutation((body: ExpenseBody, key) => api.post<Expense>("/expenses", body, { idempotencyKey: key(body) }));

export const useVoidExpense = () =>
  useMoneyMutation(({ id, reason }: { id: string; reason: string | null }, key) =>
    api.post<Expense>(`/expenses/${id}/void`, { reason }, { idempotencyKey: key({ id, reason }) }),
  );

export interface SettlementBody {
  orderIds: string[];
  receivedAmount: MoneyString;
  settledOn: string;
  note: string | null;
}

export const useSettle = () =>
  useMoneyMutation((body: SettlementBody, key) =>
    api.post<Settlement>("/courier/settlements", body, { idempotencyKey: key(body) }),
  );

export const useReverseSettlement = () =>
  useMoneyMutation(({ id, reason }: { id: string; reason: string | null }, key) =>
    api.post<Settlement>(`/courier/settlements/${id}/reverse`, { reason }, { idempotencyKey: key({ id, reason }) }),
  );

function useFinanceSettingMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: financeKeys.all }),
  });
}

export const useCreateCategory = () =>
  useFinanceSettingMutation((name: string) => api.post<ExpenseCategory>("/expense-categories", { name }));

export const useRenameCategory = () =>
  useFinanceSettingMutation(({ id, name }: { id: string; name: string }) =>
    api.put<ExpenseCategory>(`/expense-categories/${id}`, { name }),
  );

export const useSetCategoryArchived = () =>
  useFinanceSettingMutation(({ id, archived }: { id: string; archived: boolean }) =>
    api.post<ExpenseCategory>(`/expense-categories/${id}/${archived ? "archive" : "restore"}`),
  );

export const useSaveCourierName = () =>
  useFinanceSettingMutation((companyName: string) => api.put<CourierOverview>("/courier/settings", { companyName }));
