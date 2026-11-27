import { Link } from "react-router";
import { useCurrentAccount } from "@/features/auth";
import { Illustration } from "@/shared/ui/brand/Illustration";
import { Icon } from "@/shared/ui/Icon";
import { TRIAL_LENGTH_DAYS } from "../trial";
import { STATUS_LABEL, statusLine } from "../domain/subscriptionDomain";

/** Sidebar footer card: trial progress while in trial; a one-line status otherwise (hidden while a plan runs). */
export function SidebarTrialCard() {
  const s = useCurrentAccount().business?.subscription;
  if (!s || (s.status === "active" && s.daysLeft > 7)) {
    return null;
  }

  if (s.status === "trial") {
    const used = Math.min(TRIAL_LENGTH_DAYS, Math.max(0, TRIAL_LENGTH_DAYS - s.daysLeft));
    return (
      <div className="sb__trial">
        <Illustration kind="route" steps={5} />
        <b>
          {used} من {TRIAL_LENGTH_DAYS} يوم تجربة
        </b>
        <span>{s.paidUntil ? "وبعدها اشتراكك جاهز" : "كل الميزات مفتوحة لحد ما تخلص"}</span>
        <div className="sb__meter" role="progressbar" aria-label="أيام التجربة المستخدمة" aria-valuemin={0} aria-valuemax={TRIAL_LENGTH_DAYS} aria-valuenow={used}>
          <i style={{ width: `${(used / TRIAL_LENGTH_DAYS) * 100}%` }} />
        </div>
        <Link to="/subscription">
          <Icon name="credit-card" size={16} /> {s.paidUntil ? "تفاصيل الاشتراك" : "شوف الخطط"}
        </Link>
      </div>
    );
  }

  return (
    <div className="sb__trial">
      <b>{STATUS_LABEL[s.status]}</b>
      <span>{statusLine(s)}</span>
      <Link to="/subscription">
        <Icon name="credit-card" size={16} /> {s.status === "suspended" ? "التفاصيل" : s.readOnly ? "اشترك الآن" : "جدّد اشتراكك"}
      </Link>
    </div>
  );
}
