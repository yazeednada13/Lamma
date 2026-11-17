import { createContext, useContext } from "react";
import type { Account } from "../api/sessionApi";

/**
 * Provided by the RequireAuth guard. Pages read the account from here (not from the query directly), so when
 * the session ends the guard redirects before any page renders without an account.
 */
export const CurrentAccountContext = createContext<Account | null>(null);

/** Inside the authenticated area the account is always present (the guard ensures it). */
export function useCurrentAccount(): Account {
  const account = useContext(CurrentAccountContext);
  if (!account) {
    throw new Error("useCurrentAccount used outside the authenticated area.");
  }

  return account;
}
