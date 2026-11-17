const SHADDA = "M18 44C16 74 44 76 48 54C52 76 80 72 84 24";

/** The Lamma mark: the hand-drawn slanted shadda (D-090). */
export function LammaMark({ color = "#F4A261", size = 28, draw = false }: { color?: string; size?: number; draw?: boolean }) {
  return (
    <svg className={draw ? "shadda-draw" : undefined} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path d={SHADDA} fill="none" stroke={color} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
