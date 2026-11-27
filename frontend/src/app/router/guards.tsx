import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { CurrentAccountContext, useAccount, type Account } from "@/features/auth";
import { errorMessage } from "@/services/api/apiClient";
import { LammaMark } from "@/shared/ui/brand/LammaMark";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";

function FullPageLoading() {
  return (
    <div className="boot" role="status" aria-live="polite">
      <LammaMark color="#3F4F2A" size={48} draw />
      <span className="sr-only">بتحمّل…</span>
    </div>
  );
}

function FullPageError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="boot">
      <ErrorState message={errorMessage(error)} onRetry={onRetry} />
    </div>
  );
}

/** Shared loading/error handling for the account query used by every guard. */
function WithAccount({ children }: { children: (account: Account | null | undefined) => ReactNode }) {
  const query = useAccount();
  if (query.isPending) {
    return <FullPageLoading />;
  }

  if (query.isError) {
    return <FullPageError error={query.error} onRetry={() => void query.refetch()} />;
  }

  return <>{children(query.data)}</>;
}

/**
 * Signed-in owners only; anonymous users go to /login (and come back afterwards). Provides the current account.
 * `anonymousHome` is shown instead at `/` to anonymous visitors (the public landing page, D-174).
 */
export function RequireAuth({ anonymousHome }: { anonymousHome?: ReactNode }) {
  const location = useLocation();
  return (
    <WithAccount>
      {(account) =>
        account ? (
          <CurrentAccountContext.Provider value={account}>
            <Outlet />
          </CurrentAccountContext.Provider>
        ) : anonymousHome && location.pathname === "/" ? (
          <>{anonymousHome}</>
        ) : (
          <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
        )
      }
    </WithAccount>
  );
}

/** Onboarded owners only (has a business); others finish onboarding first. The platform admin goes to /admin. */
export function RequireBusiness() {
  return (
    <WithAccount>
      {(account) =>
        account?.isPlatformAdmin ? <Navigate to="/admin" replace /> : account?.isOnboarded ? <Outlet /> : <Navigate to="/onboarding" replace />
      }
    </WithAccount>
  );
}

/** Onboarding is for signed-in owners without a business (never the platform admin, D-182). */
export function RequireNotOnboarded() {
  return (
    <WithAccount>
      {(account) => (account?.isPlatformAdmin ? <Navigate to="/admin" replace /> : account?.isOnboarded ? <Navigate to="/" replace /> : <Outlet />)}
    </WithAccount>
  );
}

/** The platform admin area (D-175): everyone else goes home. */
export function RequirePlatformAdmin() {
  return <WithAccount>{(account) => (account?.isPlatformAdmin ? <Outlet /> : <Navigate to="/" replace />)}</WithAccount>;
}

/** Login/sign-up pages redirect away when already signed in. */
export function RedirectIfAuthenticated() {
  return (
    <WithAccount>
      {(account) => (account ? <Navigate to={account.isPlatformAdmin ? "/admin" : account.isOnboarded ? "/" : "/onboarding"} replace /> : <Outlet />)}
    </WithAccount>
  );
}
