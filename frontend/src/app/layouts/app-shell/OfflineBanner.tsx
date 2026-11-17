import { Icon } from "@/shared/ui/Icon";
import { useOnlineStatus } from "./useOnlineStatus";

/** Shown while the browser is offline (no drafts are kept; OQ-084). */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) {
    return null;
  }

  return (
    <div className="trial trial--late" role="status">
      <Icon name="cloud-off" size={16} /> النت مقطوع. بنكمّل أول ما يرجع الاتصال.
    </div>
  );
}
