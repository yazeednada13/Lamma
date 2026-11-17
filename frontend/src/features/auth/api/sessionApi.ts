import { useQuery } from "@tanstack/react-query";
import { ApiError, api } from "@/services/api/apiClient";

// The signed-in session (GET /account). Contracts: API-DESIGN §11 (Phase 1).

export interface BusinessSummary {
  id: string;
  name: string;
  businessType: string;
  trialEndsAt: string;
  trialDaysRemaining: number;
  plan: string;
}

export interface Account {
  id: string;
  fullName: string;
  email: string;
  isOnboarded: boolean;
  business: BusinessSummary | null;
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
