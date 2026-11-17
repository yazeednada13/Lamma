import { PageHeader } from "@/shared/ui/PageHeader";
import { BUSINESS_NAV, DAILY_NAV } from "../navigation";
import { NavTiles, type NavTile } from "../NavTiles";

/** Mobile "المزيد" hub (prototype `#/more`). */
export function MoreHubPage() {
  const items: NavTile[] = [
    ...[...DAILY_NAV.slice(3), ...BUSINESS_NAV].map((n) => ({ icon: n.icon, label: n.label, to: n.to })),
    { icon: "settings", label: "إعدادات المشروع", to: "/settings" },
    { icon: "user-circle", label: "الحساب", to: "/account" },
    { icon: "credit-card", label: "الاشتراك", to: "/subscription" },
  ];
  return (
    <>
      <PageHeader title="المزيد" />
      <NavTiles items={items} />
    </>
  );
}
