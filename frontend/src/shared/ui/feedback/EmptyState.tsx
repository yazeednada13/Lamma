import type { ReactNode } from "react";
import { GatherPieces } from "../brand/GatherPieces";

/** Empty state card. `art` replaces the default "gather" animation with a scene that fits the screen. */
export function EmptyState({
  title,
  text,
  art,
  children,
}: {
  title: string;
  text?: string;
  art?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="card empty">
      {art ?? <GatherPieces />}
      <div className="empty__title">{title}</div>
      {text && <p className="muted">{text}</p>}
      {children}
    </div>
  );
}
