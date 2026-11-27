import { useQuery } from "@tanstack/react-query";
import { ApiError, api } from "@/services/api/apiClient";

// The signed-in session (GET /account). Contracts: API-DESIGN §11 (Phase 1).

/** The subscription status in one line (D-167, D-183), computed by the server. */
export interface SubscriptionSummary {
  status: "trial" | "trial_grace" | "trial_ended" | "active" | "active_grace" | "expired" | "suspended";
  readOnly: boolean;
  daysLeft: number;
  /** YYYY-MM-DD: last day of the trial or of the paid run. */
  endsOn: string | null;
  plan: "trial" | "monthly" | "yearly";
  /** YYYY-MM-DD: furthest paid day from today (also a plan queued after the trial). */
  paidUntil: string | null;
}

export interface BusinessSummary {
  id: string;
  name: string;
  businessType: string;
  trialEndsAt: string;
  trialDaysRemaining: number;
  plan: string;
  subscription: SubscriptionSummary | null;
}

export interface Account {
  id: string;
  fullName: string;
  email: string;
  isOnboarded: boolean;
  business: BusinessSummary | null;
  /** The platform admin (D-175): lands on /admin, has no business. */
  isPlatformAdmin?: boolean;
  /** The store name from the sign-up form, to prefill onboarding (D-185). */
  suggestedBusinessName?: string | null;
}

export const accountKey = ["account"] as const;

/** The signed-in account, or null when anonymous (401). */
export async function fetchAccount(): Promise<Account | null> {
  try {
    return await api.get<Account>("/account");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }

    throw error;
  }
}

export function useAccount() {
  return useQuery({
    queryKey: accountKey,
    queryFn: fetchAccount,
    staleTime: 60_000,
    retry: (count, error) => error instanceof ApiError && error.isNetworkError && count < 2,
  });
}
