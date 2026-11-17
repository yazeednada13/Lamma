import { Link } from "react-router";
import { initials } from "@/shared/lib/personName";
import { Icon } from "@/shared/ui/Icon";
import { useCurrentAccount } from "../session/currentAccount";

/** Sidebar footer card for the signed-in owner (shows the email instead of a gendered role label). */
export function SidebarUserCard() {
  const account = useCurrentAccount();
  return (
    <Link className="sb__user" to="/account" data-tip={account.fullName}>
      <span className="avatar">{initials(account.fullName)}</span>
      <span className="sb__user-txt">
        <b>{account.fullName}</b>
        <span className="ltr">{account.email}</span>
      </span>
      <Icon name="settings" size={16} className="sb__chev" />
    </Link>
  );
}
