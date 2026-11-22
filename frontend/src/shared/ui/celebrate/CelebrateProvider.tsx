import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Illustration } from "../brand/Illustration";
import { prefersReducedMotion } from "../CountUp";

/**
 * A short moment of joy on top of the page.
 * - `burst`: a sticker pops with confetti and a line, then leaves by itself (~2.6 s). Never blocks the page.
 * - `stage`: a one-time full-screen moment (a milestone) the user closes with a button, a click or Esc.
 * The text is also announced to screen readers. With reduced motion the moment shows without movement or confetti.
 */
export type Celebration = { kind: "burst" | "stage"; sticker: string; title: string; text?: string; action?: string };

const CelebrateContext = createContext<(c: Celebration) => void>(() => {});

/** Fires a celebration; a no-op outside the provider (tests). */
export function useCelebrate() {
  return useContext(CelebrateContext);
}

/** Deterministic 0–1 scatter per piece (render must stay pure), different for each `k`. */
const jitter = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

const CONFETTI_TONES = ["apricot", "olive", "green", "cream", "brick"] as const;

function Confetti({ count }: { count: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + jitter(i, 1) * 0.4;
        const dist = 90 + jitter(i, 2) * 130;
        return {
          x: Math.round(Math.cos(angle) * dist),
          y: Math.round(Math.sin(angle) * dist * 0.7 - 40),
          r: Math.round(jitter(i, 3) * 720 - 360),
          d: Math.round(jitter(i, 4) * 120),
          tone: CONFETTI_TONES[i % CONFETTI_TONES.length]!,
          round: i % 3 === 0,
        };
      }),
    [count],
  );
  return (
    <span className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i
          key={i}
          className={`confetti--${p.tone}${p.round ? " is-round" : ""}`}
          style={{
            ["--x" as string]: `${p.x}px`,
            ["--y" as string]: `${p.y}px`,
            ["--r" as string]: `${p.r}deg`,
            animationDelay: `${p.d}ms`,
          }}
        />
      ))}
    </span>
  );
}

export function CelebrateProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<(Celebration & { key: number }) | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const close = useCallback(() => setCurrent(null), []);

  const celebrate = useCallback((c: Celebration) => {
    window.clearTimeout(timer.current);
    setCurrent({ ...c, key: Date.now() });
    if (c.kind === "burst") timer.current = window.setTimeout(() => setCurrent(null), 2600);
  }, []);

  useEffect(() => {
    if (current?.kind !== "stage") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, close]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const still = prefersReducedMotion();

  return (
    <CelebrateContext.Provider value={celebrate}>
      {children}
      {current?.kind === "burst" && (
        <div key={current.key} className="cele-burst" role="status">
          <span className="cele-burst__stk">
            {!still && <Confetti count={22} />}
            <Illustration kind="sticker" name={current.sticker} />
          </span>
          <span className="cele-burst__text">
            <b>{current.title}</b>
            {current.text && <span>{current.text}</span>}
          </span>
        </div>
      )}
      {current?.kind === "stage" && (
        <div
          key={current.key}
          className="cele-stage"
          role="dialog"
          aria-modal="true"
          aria-label={current.title}
          onClick={close}
        >
          <div className="cele-stage__box" onClick={(e) => e.stopPropagation()}>
            <span className="cele-stage__stk">
              {!still && <Confetti count={36} />}
              <Illustration kind="sticker" name={current.sticker} />
            </span>
            <h2>{current.title}</h2>
            {current.text && <p>{current.text}</p>}
            <button type="button" className="btn btn--accent" onClick={close} autoFocus>
              {current.action ?? "يلا نكمّل"}
            </button>
          </div>
        </div>
      )}
    </CelebrateContext.Provider>
  );
}
