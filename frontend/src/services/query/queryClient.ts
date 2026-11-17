import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/apiClient";

/** The app's TanStack Query client with Lamma's retry policy. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Retry only transient network failures; HTTP errors are real answers.
        retry: (count, error) => error instanceof ApiError && error.isNetworkError && count < 2,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}
