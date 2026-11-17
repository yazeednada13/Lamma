import { LAMMA_ICONS } from "@/assets/icons/iconData";

/** The 53 Tabler icons shipped with the Lamma design system (MIT). */
export type IconName =
  | "adjustments" | "alert-triangle" | "arrow-back-up" | "arrow-left" | "arrow-right" | "bell" | "brand-facebook"
  | "brand-instagram" | "brand-whatsapp" | "building-bank" | "building-warehouse" | "calendar" | "cash" | "chart-bar"
  | "check" | "chevron-down" | "chevron-left" | "chevron-right" | "circle-check" | "clock" | "cloud-off" | "credit-card"
  | "dots-vertical" | "eye" | "filter" | "gift" | "home" | "info-circle" | "language" | "layout-grid" | "layout-kanban"
  | "list" | "lock" | "logout" | "map-pin" | "package" | "palette" | "pencil" | "phone" | "photo" | "plus" | "receipt"
  | "ruler" | "search" | "settings" | "tag" | "trash" | "truck" | "upload" | "user-circle" | "users" | "wallet" | "x";

const DIRECTIONAL = new Set<string>(["chevron-right", "chevron-left", "arrow-right", "arrow-left", "arrow-back-up"]);

interface IconProps {
  name: IconName | string;
  size?: 16 | 20 | 24;
  className?: string;
}

/**
 * Decorative icon (aria-hidden). Icon-only buttons must carry their own aria-label.
 * Markup comes from the static, generated icon set (never from user input).
 */
export function Icon({ name, size = 20, className = "" }: IconProps) {
  const sizeClass = size === 16 ? " ic--16" : size === 24 ? " ic--24" : "";
  const dir = DIRECTIONAL.has(name) ? " ic--dir" : "";
  return (
    <svg
      className={`ic${sizeClass}${dir}${className ? ` ${className}` : ""}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      data-icon={name}
      dangerouslySetInnerHTML={{ __html: LAMMA_ICONS[name] ?? "" }}
    />
  );
}
