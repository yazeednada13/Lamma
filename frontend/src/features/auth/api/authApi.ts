import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, resetCsrfToken } from "@/services/api/apiClient";
import { accountKey, type Account } from "./sessionApi";

export interface SignUpBody {
  fullName: string;
  email: string;
  password: string;
}

export interface LoginBody {
  email: string;
  password: string;
  rememberMe: boolean;
}

/** After the signed-in identity changes the antiforgery token must be re-issued (it is bound to the user). */
function useSessionChange() {
  const queryClient = useQueryClient();
  return (account: Account | null) => {
    resetCsrfToken();
    if (account === null) {
      queryClient.clear();
    }

    queryClient.setQueryData(accountKey, account);
  };
}

export function useSignUp() {
  const onSession = useSessionChange();
  return useMutation({
    mutationFn: (body: SignUpBody) => api.post<Account>("/auth/signup", body),
    onSuccess: (account) => onSession(account),
  });
}

export function useLogin() {
  const onSession = useSessionChange();
  return useMutation({
    mutationFn: (body: LoginBody) => api.post<Account>("/auth/login", body),
    onSuccess: (account) => onSession(account),
  });
}

export function useLogout() {
  const onSession = useSessionChange();
  return useMutation({
    mutationFn: () => api.post<void>("/auth/logout"),
    // Even if the request fails (e.g. session already expired) the local session is cleared.
    onSettled: () => onSession(null),
  });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: (body: { email: string }) => api.post<void>("/auth/forgot-password", body) });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: { email: string; token: string; newPassword: string }) => api.post<void>("/auth/reset-password", body),
  });
}
