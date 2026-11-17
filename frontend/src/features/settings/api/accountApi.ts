import { useMutation, useQueryClient } from "@tanstack/react-query";
import { accountKey, type Account } from "@/features/auth";
import { api } from "@/services/api/apiClient";

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { fullName: string }) => api.put<Account>("/account", body),
    onSuccess: (account) => queryClient.setQueryData(accountKey, account),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) => api.post<void>("/account/change-password", body),
  });
}
