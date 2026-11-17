import { AccountMenu, SidebarUserCard } from "@/features/auth";
import { SidebarBusinessCard, SidebarTrialCard, TrialBanner } from "@/features/subscription";
import { AppShell } from "./app-shell/AppShell";

/**
 * Container for the signed-in, onboarded area: fills the AppShell's slots with the features' widgets.
 * This is the only layout that knows about features; AppShell itself stays pure layout.
 */
export function AuthenticatedLayout() {
  return (
    <AppShell
      sidebarHeader={<SidebarBusinessCard />}
      sidebarFooter={
        <>
          <SidebarTrialCard />
          <SidebarUserCard />
        </>
      }
      banners={<TrialBanner />}
      topbarEnd={<AccountMenu />}
    />
  );
}
