import { Link } from "react-router";
import { useCurrentAccount } from "@/features/auth";
import { Illustration } from "@/shared/ui/brand/Illustration";
import { Icon } from "@/shared/ui/Icon";
import { TRIAL_LENGTH_DAYS, trialStatus } from "../trial";

/** Sidebar footer card with trial progress; hidden once the trial has ended. */
export function SidebarTrialCard() {
  const trial = trialStatus(useCurrentAccount().business!.trialDaysRemaining);
  if (trial.ended) {
    return null;
  }

  return (
    <div className="sb__trial">
      <Illustration kind="route" steps={5} />
      <b>
        {trial.used} من {TRIAL_LENGTH_DAYS} يوم تجربة
      </b>
      <span>كل الميزات مفتوحة لحد ما تخلص</span>
      <div className="sb__meter" role="progressbar" aria-label="أيام التجربة المستخدمة" aria-valuemin={0} aria-valuemax={TRIAL_LENGTH_DAYS} aria-valuenow={trial.used}>
        <i style={{ width: `${(trial.used / TRIAL_LENGTH_DAYS) * 100}%` }} />
      </div>
      <Link to="/subscription">
        <Icon name="credit-card" size={16} /> شوف الخطط
      </Link>
    </div>
  );
}
