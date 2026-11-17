import { Link, useNavigate } from "react-router";
import { initials } from "@/shared/lib/personName";
import { Icon } from "@/shared/ui/Icon";
import { Menu } from "@/shared/ui/Menu";
import { useLogout } from "../api/authApi";
import { useCurrentAccount } from "../session/currentAccount";

/** Topbar avatar menu: account, subscription, and the logout flow. */
export function AccountMenu() {
  const account = useCurrentAccount();
  const logout = useLogout();
  const navigate = useNavigate();

  const onLogout = () => {
    logout.mutate(undefined, { onSettled: () => navigate("/login", { replace: true }) });
  };

  return (
    <Menu
      label="الحساب"
      trigger={(props) => (
        <button type="button" className="btn btn--ghost" style={{ paddingInline: 4 }} aria-label="الحساب" {...props}>
          <span className="avatar">{initials(account.fullName)}</span>
        </button>
      )}
    >
      <div className="palette__label">
        {account.business?.name} · {account.fullName}
      </div>
      <Link className="menu__item" role="menuitem" to="/account">
        <Icon name="user-circle" /> الحساب
      </Link>
      <Link className="menu__item" role="menuitem" to="/subscription">
        <Icon name="credit-card" /> الاشتراك
      </Link>
      <div className="menu__sep" />
      <button type="button" className="menu__item menu__item--danger" role="menuitem" onClick={onLogout} disabled={logout.isPending}>
        <Icon name="logout" /> تسجيل الخروج
      </button>
    </Menu>
  );
}
