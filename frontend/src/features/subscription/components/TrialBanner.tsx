import { Link } from "react-router";
import { useCurrentAccount } from "@/features/auth";
import { Icon } from "@/shared/ui/Icon";
import { trialStatus } from "../trial";

/** Top banner in the last trial days, and once the trial has ended (informational; no blocking, D-011). */
export function TrialBanner() {
  const trial = trialStatus(useCurrentAccount().business!.trialDaysRemaining);
  if (trial.isLate) {
    return (
      <div className="trial trial--late" role="status">
        <Icon name="clock" size={16} /> ضل {trial.remaining} يوم بس من التجربة <Link to="/subscription">اشترك</Link>
      </div>
    );
  }

  if (trial.ended) {
    return (
      <div className="trial trial--late" role="status">
        <Icon name="clock" size={16} /> خلصت فترة التجربة المجانية <Link to="/subscription">شوف الخطط</Link>
      </div>
    );
  }

  return null;
}
