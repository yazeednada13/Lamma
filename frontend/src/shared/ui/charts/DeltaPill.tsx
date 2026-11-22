import { delta } from "./chartMath";

/** Delta pill (prototype `LammaCards.delta`): «—» without a comparison; `invert` for costs, where a rise is bad. */
export function DeltaPill({ change, invert }: { change: number | null; invert?: boolean }) {
  const d = delta(change, invert);
  return (
    <span className={`dpill dpill--${d.tone}`}>
      <bdi>{d.text}</bdi>
    </span>
  );
}
