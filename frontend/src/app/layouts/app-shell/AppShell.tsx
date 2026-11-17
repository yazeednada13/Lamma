import type { ReactNode } from "react";
import { Outlet, useLocation } from "react-router";
import { sectionOf } from "@/app/navigation/navigation";
import { BottomBar } from "./BottomBar";
import { OfflineBanner } from "./OfflineBanner";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useSidebarCollapse } from "./useSidebarCollapse";

export interface AppShellSlots {
  /** Under the sidebar brand row. */
  sidebarHeader?: ReactNode;
  /** Bottom of the sidebar. */
  sidebarFooter?: ReactNode;
  /** End of the top bar (e.g. the account menu). */
  topbarEnd?: ReactNode;
  /** Banners above the top bar (after the offline banner). */
  banners?: ReactNode;
}

/**
 * The authenticated app frame (prototype shell): sidebar, top bar, page outlet and mobile bottom bar.
 * Layout composition only — it holds no session, auth or business logic; features fill the slots.
 */
export function AppShell({ sidebarHeader, sidebarFooter, topbarEnd, banners }: AppShellSlots) {
  const { pathname } = useLocation();
  const section = sectionOf(pathname);
  const { collapsed, toggle } = useSidebarCollapse();

  return (
    <div className={`app${collapsed ? " is-collapsed" : ""}`} id="app">
      <Sidebar section={section} pathname={pathname} collapsed={collapsed} onToggleCollapse={toggle} header={sidebarHeader} footer={sidebarFooter} />
      <div className="main">
        <OfflineBanner />
        {banners}
        <Topbar end={topbarEnd} />
        <main className="page" id="page">
          <Outlet />
        </main>
      </div>
      <BottomBar section={section} />
    </div>
  );
}
