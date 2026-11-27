import { Link } from "react-router";
import { useCurrentAccount } from "@/features/auth";
import { Icon } from "@/shared/ui/Icon";
import { bannerFor } from "../domain/subscriptionDomain";

/** Top banner (D-162, D-186): the last days of the trial or plan, the grace days, and read-only. */
export function TrialBanner() {
  const banner = bannerFor(useCurrentAccount().business?.subscription);
  if (!banner) {
    return null;
  }

  return (
    <div className="trial trial--late" role="status">
      <Icon name={banner.tone === "ended" ? "lock" : "clock"} size={16} /> {banner.text} <Link to="/subscription">{banner.cta}</Link>
    </div>
  );
}
