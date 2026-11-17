import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountKey } from "@/features/auth";
import { api } from "@/services/api/apiClient";
import type { PaymentMethodCode } from "../domain/paymentMethods";
import type { SalesChannelCode } from "../domain/salesChannels";

// Business settings contracts (API-DESIGN §11).

export interface BusinessSettings {
  name: string;
  businessType: string;
  defaultLowStockThreshold: number;
  currency: string;
}

export interface SalesChannelSettings {
  channels: { channel: SalesChannelCode; isEnabled: boolean }[];
}

export interface PaymentMethodSettings {
  methods: { method: PaymentMethodCode; isEnabled: boolean }[];
}

export const settingsKeys = {
  business: ["settings", "business"] as const,
  channels: ["settings", "sales-channels"] as const,
  methods: ["settings", "payment-methods"] as const,
};

export function useBusinessSettings() {
  return useQuery({ queryKey: settingsKeys.business, queryFn: () => api.get<BusinessSettings>("/settings/business") });
}

export function useSalesChannelSettings() {
  return useQuery({ queryKey: settingsKeys.channels, queryFn: () => api.get<SalesChannelSettings>("/settings/sales-channels") });
}

export function usePaymentMethodSettings() {
  return useQuery({ queryKey: settingsKeys.methods, queryFn: () => api.get<PaymentMethodSettings>("/settings/payment-methods") });
}

/** Saves only the sections that changed. The account is refreshed because it shows the business name. */
export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (changes: { business?: Omit<BusinessSettings, "currency">; channels?: SalesChannelSettings; methods?: PaymentMethodSettings }) => {
      if (changes.business) {
        queryClient.setQueryData(settingsKeys.business, await api.put<BusinessSettings>("/settings/business", changes.business));
      }

      if (changes.channels) {
        queryClient.setQueryData(settingsKeys.channels, await api.put<SalesChannelSettings>("/settings/sales-channels", changes.channels));
      }

      if (changes.methods) {
        queryClient.setQueryData(settingsKeys.methods, await api.put<PaymentMethodSettings>("/settings/payment-methods", changes.methods));
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: accountKey }),
  });
}
