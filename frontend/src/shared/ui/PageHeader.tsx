import type { ReactNode } from "react";

/** `.page__head` from the prototype (`App.head`). */
export function PageHeader({ title, subtitle, actions, crumbs }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; crumbs?: ReactNode }) {
  return (
    <div className="page__head">
      <div>
        {crumbs && <div className="crumbs">{crumbs}</div>}
        {title && <h1>{title}</h1>}
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page__actions">{actions}</div>}
    </div>
  );
}
