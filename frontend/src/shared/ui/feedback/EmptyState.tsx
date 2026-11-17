import type { ReactNode } from "react";
import { GatherPieces } from "../brand/GatherPieces";

export function EmptyState({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="card empty">
      <GatherPieces />
      <div className="empty__title">{title}</div>
      {text && <p className="muted">{text}</p>}
      {children}
    </div>
  );
}
