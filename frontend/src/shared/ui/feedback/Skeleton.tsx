export function Skeleton({ width, height = 12, radius }: { width?: number | string; height?: number; radius?: number }) {
  return <div className="skel" style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}

/** Full-area loading placeholder (prototype `#/loading`). */
export function PageSkeleton({ label = "بتحمّل…" }: { label?: string }) {
  return (
    <div className="page-skeleton" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton width="40%" height={28} />
      <div className="grid g-3" style={{ marginTop: 16 }}>
        {[0, 1, 2].map((i) => (
          <div className="card" key={i}>
            <Skeleton width={34} height={34} radius={11} />
            <Skeleton width="60%" height={20} />
            <Skeleton height={36} />
          </div>
        ))}
      </div>
    </div>
  );
}
