import { formatMoneyNumber, type MoneyString } from "../lib/money";

/** JOD amount: Latin digits, 2 decimals (D-080), "د.أ" after the number, sign isolated with <bdi> (D-008). */
export function Money({ value, tone }: { value: MoneyString; tone?: "pos" | "neg" | "exp" }) {
  return (
    <span className={`money${tone ? ` money--${tone}` : ""}`}>
      <bdi>{formatMoneyNumber(value)}</bdi> د.أ
    </span>
  );
}
