import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountKey, type SubscriptionSummary } from "@/features/auth";
import { api } from "@/services/api/apiClient";
import type { MoneyString } from "@/shared/lib/money";
import type { PaidPlan } from "../domain/subscriptionDomain";

// The owner's subscription (API-DESIGN §21, part 11-II).

export interface PaymentRequest {
  id: string;
  plan: PaidPlan;
  amount: MoneyString;
  status: "pending" | "approved" | "rejected";
  rejectReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

export interface Period {
  id: string;
  plan: PaidPlan;
  startsOn: string;
  endsOn: string;
  amount: MoneyString;
  source: "payment" | "admin";
  cancelled: boolean;
  createdAt: string;
}

export interface Subscription {
  summary: SubscriptionSummary;
  trialStartsAt: string;
  trialEndsAt: string;
  plans: { plan: PaidPlan; price: MoneyString; months: number }[];
  cliqAlias: string;
  cliqName: string;
  referenceCode: string;
  pending: PaymentRequest | null;
  lastReviewed: PaymentRequest | null;
  periods: Period[];
}

export const subscriptionKey = ["subscription"] as const;

export const useSubscription = () =>
  useQuery({ queryKey: subscriptionKey, queryFn: () => api.get<Subscription>("/subscription"), staleTime: 0 });

/** Sends the CliQ proof (D-163, D-178); allowed even when the account is read-only. */
export function usePayment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ plan, file, key }: { plan: PaidPlan; file: File; key: string }) => {
      const form = new FormData();
      form.append("plan", plan);
      form.append("file", file);
      return api.post<Subscription>("/subscription/payment-requests", form, { idempotencyKey: key });
    },
    onSuccess: (data) => {
      client.setQueryData(subscriptionKey, data);
      void client.invalidateQueries({ queryKey: accountKey });
    },
  });
}
