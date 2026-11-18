import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api/apiClient";

// Business types come from the API only (D-103): code, Arabic label and the default product template.

export interface BusinessTypeOption {
  code: string;
  labelAr: string;
  defaultTemplateCode: string;
}

export const businessTypesKey = ["business-types"] as const;

export function useBusinessTypes() {
  return useQuery({
    queryKey: businessTypesKey,
    queryFn: () => api.get<BusinessTypeOption[]>("/onboarding/business-types"),
    staleTime: Infinity,
  });
}

/** The API label of a business type ("" while loading or when unknown). */
export function useBusinessTypeLabel(code: string | undefined): string {
  const types = useBusinessTypes();
  return types.data?.find((t) => t.code === code)?.labelAr ?? "";
}
