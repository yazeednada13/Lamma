import { useEffect, useState } from "react";

/** True when the user asked the system for less motion. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * Counts a number up from 0 (prototype `Lamma.countUp`, ease-out cubic). Display only: while running it shows
 * `format(intermediate)`, and it always ends on `final`, the exact server-formatted text, so money is never rounded
 * by the animation. With reduced motion it shows `final` at once.
 */
export function CountUp({
  value,
  final,
  format,
  durationMs = 700,
}: {
  value: number;
  final: string;
  format: (n: number) => string;
  durationMs?: number;
}) {
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (prefersReducedMotion() || !Number.isFinite(value) || value === 0) return;
    let frame = 0;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      if (p < 1) {
        setShown(format(value * eased));
        frame = requestAnimationFrame(step);
      } else {
        setShown(null);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs, format]);

  return <bdi>{shown ?? final}</bdi>;
}

const two = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Formatters for intermediate frames (Latin digits, D-080). */
export const countFormat = {
  money: (n: number) => two.format(n),
  count: (n: number) => whole.format(Math.round(n)),
};
