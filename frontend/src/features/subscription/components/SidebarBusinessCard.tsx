import { Link } from "react-router";
import { useCurrentAccount } from "@/features/auth";
import { LammaMark } from "@/shared/ui/brand/LammaMark";
import { Icon } from "@/shared/ui/Icon";
import { STATUS_LABEL, daysText } from "../domain/subscriptionDomain";

/** Sidebar header card: the business name and its subscription status (D-183). */
export function SidebarBusinessCard() {
  const business = useCurrentAccount().business!;
  const s = business.subscription;
  const line = !s
    ? ""
    : s.status === "trial"
      ? `تجربة مجانية، ضل ${daysText(s.daysLeft)}`
      : s.status === "active"
        ? `مشترك، ضل ${daysText(s.daysLeft)}`
        : STATUS_LABEL[s.status];
  return (
    <Link className="sb__biz" to="/settings" data-tip={business.name}>
      <span className="sb__logo">
        <LammaMark color="#3F4F2A" size={24} />
      </span>
      <span className="sb__biz-txt">
        <b>{business.name}</b>
        <small>{line}</small>
      </span>
      <Icon name="chevron-down" size={16} className="sb__chev" />
    </Link>
  );
}
