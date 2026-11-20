import { initials } from "@/shared/lib/personName";
import type { SegmentCode } from "../api/customersApi";
import { segmentTagClass, segmentTagLabel } from "../domain/customerDomain";

/** Ring avatar with initials (prototype `.ring-av`); the ring shows the order count relative to the best customer. */
export function CustomerAvatar({ name, percent, size }: { name: string; percent: number; size?: number }) {
  return (
    <span className="ring-av" style={{ ["--p" as string]: Math.min(100, Math.max(0, percent)), ...(size ? { width: size, height: size, padding: 2 } : {}) }}>
      <span style={size ? { fontSize: 12 } : undefined}>{initials(name)}</span>
    </span>
  );
}

export function SegmentTags({ segments }: { segments: readonly SegmentCode[] }) {
  return (
    <div className="row wrap" style={{ gap: 4 }}>
      {segments.map((s) => (
        <span key={s} className={segmentTagClass(s)}>
          {segmentTagLabel(s)}
        </span>
      ))}
    </div>
  );
}
