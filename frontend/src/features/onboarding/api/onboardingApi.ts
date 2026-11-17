import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountKey, type Account } from "@/features/auth";
import type { SalesChannelCode } from "@/features/settings";
import { api } from "@/services/api/apiClient";

// Onboarding contracts (API-DESIGN §11).

export interface BusinessTypeOption {
  code: string;
  labelAr: string;
}

export interface OnboardingBody {
  businessName: string;
  businessType: string;
  salesChannels: SalesChannelCode[];
}

export function useBusinessTypes() {
  return useQuery({
    queryKey: ["onboarding", "business-types"],
    queryFn: () => api.get<BusinessTypeOption[]>("/onboarding/business-types"),
    staleTime: Infinity,
  });
}

/**
 * Completes onboarding. The account cache is NOT updated here: the page shows its "done" step first and
 * then calls `enterApp`, otherwise the onboarding guard would redirect before the done step renders.
 */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  const mutation = useMutation({ mutationFn: (body: OnboardingBody) => api.post<Account>("/onboarding", body) });
  const enterApp = () => {
    if (mutation.data) {
      queryClient.setQueryData(accountKey, mutation.data);
    } else {
      void queryClient.invalidateQueries({ queryKey: accountKey });
    }
  };
  return { ...mutation, enterApp };
}
