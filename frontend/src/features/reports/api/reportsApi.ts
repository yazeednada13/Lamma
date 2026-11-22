import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { SalesChannelCode } from "@/features/settings";
import { api } from "@/services/api/apiClient";
import type { MoneyString } from "@/shared/lib/money";

// Reports contracts (API-DESIGN §20, D-168–D-172).

export type PeriodCode = "month" | "last_month" | "last_7_days" | "custom";

export interface PeriodSelection {
  period: PeriodCode;
  from?: string;
  to?: string;
}

/** The query string of a selection, also the cache key: `period=month` or `period=custom&from=…&to=…`. */
export function periodSearch(s: PeriodSelection): string {
  return s.period === "custom" && s.from && s.to ? `period=custom&from=${s.from}&to=${s.to}` : `period=${s.period}`;
}

export interface ReportPeriod {
  period: PeriodCode;
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  includesToday: boolean;
  bucket: "day" | "month";
}

export interface PnlLines {
  sales: MoneyString;
  deliveredCount: number;
  returns: MoneyString;
  netSales: MoneyString;
  cogs: MoneyString;
  grossProfit: MoneyString;
  expenses: MoneyString;
  netProfit: MoneyString;
}

export type ExpenseCode = "ads" | "delivery" | "packaging" | "rent" | "other";

export interface PnlDriver {
  kind: "sales" | "cogs" | "expense";
  categoryName: string | null;
  categoryCode: ExpenseCode | null;
  /** The item's own change (current − previous). */
  change: MoneyString;
  /** Its effect on net profit (+ for sales, − for costs). */
  effect: MoneyString;
}

export interface PnlReport {
  period: ReportPeriod;
  current: PnlLines;
  previous: PnlLines;
  hasPrevious: boolean;
  changes: { sales: number | null; cogs: number | null; expenses: number | null; netProfit: number | null };
  netProfitChange: MoneyString;
  driver: PnlDriver | null;
  expensesByCategory: { categoryId: string; name: string; code: ExpenseCode | null; current: MoneyString; previous: MoneyString }[];
  expectedSales: MoneyString | null;
}

export interface ProductSales {
  productId: string;
  name: string;
  quantity: number;
  revenue: MoneyString;
  grossProfit: MoneyString;
}

export interface SalesReport {
  period: ReportPeriod;
  series: { start: string; sales: MoneyString; grossProfit: MoneyString }[];
  channels: { channel: SalesChannelCode; amount: MoneyString; orders: number }[];
  /** Index 0 = Sunday … 6 = Saturday. */
  weekdays: MoneyString[];
  bestWeekday: number | null;
  products: ProductSales[];
  otherProducts: { count: number; quantity: number; revenue: MoneyString; grossProfit: MoneyString } | null;
  deliveryFees: MoneyString;
  netSales: MoneyString;
  grossProfit: MoneyString;
  orders: number;
  averageOrderValue: MoneyString;
  previousNetSales: MoneyString;
  previousOrders: number;
  previousAverageOrderValue: MoneyString;
  netSalesChange: number | null;
  ordersChange: number | null;
  averageOrderValueChange: number | null;
}

export interface ReportsSummary {
  from: string;
  to: string;
  netProfit: MoneyString;
  netSales: MoneyString;
  series: { day: string; sales: MoneyString; grossProfit: MoneyString }[];
  topProducts: ProductSales[];
  customers: number;
  recentCustomers: { id: string; name: string }[];
  stockValue: MoneyString;
  courierHeld: MoneyString;
}

export const reportKeys = {
  all: ["reports"] as const,
  summary: ["reports", "summary"] as const,
  pnl: (s: PeriodSelection) => ["reports", "pnl", periodSearch(s)] as const,
  sales: (s: PeriodSelection) => ["reports", "sales", periodSearch(s)] as const,
};

// staleTime 0: figures change with every order, payment and expense, so each visit refetches (like the dashboard).
export const useReportsSummary = () =>
  useQuery({ queryKey: reportKeys.summary, queryFn: () => api.get<ReportsSummary>("/reports/summary"), staleTime: 0 });

export const usePnlReport = (s: PeriodSelection) =>
  useQuery({
    queryKey: reportKeys.pnl(s),
    queryFn: () => api.get<PnlReport>(`/reports/pnl?${periodSearch(s)}`),
    staleTime: 0,
    placeholderData: keepPreviousData,
  });

export const useSalesReport = (s: PeriodSelection) =>
  useQuery({
    queryKey: reportKeys.sales(s),
    queryFn: () => api.get<SalesReport>(`/reports/sales?${periodSearch(s)}`),
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
