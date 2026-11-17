import type { ReactNode } from "react";

/** `.srow2` settings row: title + caption on the start side, control on the end side. */
export function SettingsRow({ title, caption, children, htmlFor }: { title: ReactNode; caption?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="srow2">
      <div>
        {htmlFor ? (
          <label htmlFor={htmlFor}>
            <b>{title}</b>
          </label>
        ) : (
          <b>{title}</b>
        )}
        {caption && <span className="caption">{caption}</span>}
      </div>
      {children}
    </div>
  );
}
