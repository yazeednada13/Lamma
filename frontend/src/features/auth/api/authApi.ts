import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, resetCsrfToken } from "@/services/api/apiClient";
import { accountKey, type Account } from "./sessionApi";

export interface RegisterBody {
  token: string;
  password: string;
  confirmPassword: string;
}

/** The invitation behind a registration link (D-160): who it is for. */
export interface Invitation {
  email: string;
  fullName: string;
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

/** 404 `invite.invalid` (unknown or used) and 410 `invite.expired` are shown on the page, so no retry. */
export const useInvitation = (token: string) =>
  useQuery({
    queryKey: ["invitation", token],
    queryFn: () => api.get<Invitation>(`/public/invitations/${encodeURIComponent(token)}`),
    enabled: token.length > 0,
    retry: false,
    staleTime: Infinity,
  });

/** Creates the account from the invitation and signs in; onboarding comes next (D-160, D-180). */
export function useRegister() {
  const onSession = useSessionChange();
  return useMutation({
    mutationFn: (body: RegisterBody) => api.post<Account>("/auth/register", body),
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
