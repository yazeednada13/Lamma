import { Link } from "react-router";
import { useCurrentAccount } from "@/features/auth";
import { LammaMark } from "@/shared/ui/brand/LammaMark";
import { Icon } from "@/shared/ui/Icon";
import { trialStatus } from "../trial";

/** Sidebar header card: the business name and its trial state. */
export function SidebarBusinessCard() {
  const business = useCurrentAccount().business!;
  const trial = trialStatus(business.trialDaysRemaining);
  return (
    <Link className="sb__biz" to="/settings" data-tip={business.name}>
      <span className="sb__logo">
        <LammaMark color="#3F4F2A" size={24} />
      </span>
      <span className="sb__biz-txt">
        <b>{business.name}</b>
        <small>{trial.ended ? "خلصت التجربة المجانية" : `تجربة مجانية · ضل ${trial.remaining} يوم`}</small>
      </span>
      <Icon name="chevron-down" size={16} className="sb__chev" />
    </Link>
  );
}
