import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { AppProviders } from "@/app/providers/AppProviders";
import { routes } from "@/app/router/routes";
import { createQueryClient } from "@/services/query/queryClient";

/** Mounts the whole app (real routes, guards, providers) at a path, against the MSW fake API. */
export function renderApp(path = "/") {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false, refetchOnWindowFocus: false, staleTime: 0 }, mutations: { retry: false } });
  const user = userEvent.setup();
  // StrictMode as in main.tsx, so tests see the same double-invoked effects as the real app.
  const view = render(
    <StrictMode>
      <AppProviders client={client}>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  );
  return { ...view, user, router, client };
}
