import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { accountKey } from "@/features/auth";
import { setUnauthorizedHandler } from "@/services/api/apiClient";
import { createQueryClient } from "@/services/query/queryClient";
import { ToastProvider } from "@/shared/ui/toast/ToastProvider";

/** Query client, toasts, and the "session expired" hook (a 401 anywhere returns the app to login). */
export function AppProviders({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [queryClient] = useState(() => client ?? createQueryClient());

  useEffect(() => {
    setUnauthorizedHandler(() => queryClient.setQueryData(accountKey, null));
    return () => setUnauthorizedHandler(null);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
