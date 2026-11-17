import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "accent" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

function classes(variant: ButtonVariant, size: ButtonSize, extra: string | undefined, loading?: boolean, block?: boolean) {
  return [
    "btn",
    `btn--${variant}`,
    size !== "md" ? `btn--${size}` : "",
    loading ? "is-loading" : "",
    block ? "btn--block" : "",
    extra ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
  icon?: IconName;
  iconEnd?: IconName;
}

/** `.btn` from the design system. While loading it is disabled and shows the spinner. */
export function Button({ variant = "primary", size = "md", loading, block, icon, iconEnd, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={classes(variant, size, className, loading, block)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 20} />}
      {children}
      {iconEnd && <Icon name={iconEnd} size={16} />}
    </button>
  );
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: IconName;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
}

/** Icon-only button: always has an accessible label. */
export function IconButton({ icon, label, variant = "ghost", size = "md", className, type = "button", children, ...rest }: IconButtonProps) {
  return (
    <button type={type} className={classes(variant, size, `icon-btn ${className ?? ""}`.trim())} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={size === "sm" ? 16 : 20} />
      {children}
    </button>
  );
}

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconEnd?: IconName;
  block?: boolean;
}

export function ButtonLink({ variant = "primary", size = "md", icon, iconEnd, block, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={classes(variant, size, className, false, block)} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 20} />}
      {children}
      {iconEnd && <Icon name={iconEnd} size={16} />}
    </Link>
  );
}
