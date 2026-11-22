import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon, type IconName } from "@/shared/ui/Icon";
import { SLIP_STEPS } from "../domain/signupDomain";
import s from "../landing.module.css";
import { useReducedMotion } from "./landingHooks";

type Piece = { kind: string; icon: IconName; title: string; text: string; x: number; y: number; r: number; d: number };

/** The scattered work of a seller before Lamma: they float, then gather into one order card («لمّة»). */
const PIECES: Piece[] = [
  { kind: s.pieceWa!, icon: "brand-whatsapp", title: "رنا · واتساب", text: "بدي الفستان الزيتي M 😍", x: 120, y: -170, r: -6, d: 0.6 },
  { kind: s.pieceIg!, icon: "brand-instagram", title: "دايركت", text: "كم السعر مع التوصيل؟", x: -140, y: -120, r: 5, d: 1 },
  { kind: s.pieceNote!, icon: "pencil", title: "ملاحظة", text: "سارة لسا عليها 15 دينار", x: 150, y: 10, r: 4, d: 0.8 },
  { kind: s.pieceSlip!, icon: "receipt", title: "مصروف", text: "إعلان ريلز 6.00", x: -150, y: 40, r: -5, d: 1.2 },
  { kind: s.pieceQ!, icon: "package", title: "مخزون؟", text: "ضل بلوزات حرير؟ 🤔", x: 110, y: 160, r: -3, d: 0.9 },
  { kind: s.pieceSlip!, icon: "truck", title: "المندوب", text: "معه 86 دينار… ولا 68؟", x: -110, y: 175, r: 6, d: 0.7 },
];

const GATHER_AFTER = 1500;
const STEP_EVERY = 1600;

/** Hero visual: chaos → gather → an order moving through Lamma's real statuses. Replayable; still under reduced motion. */
export function GatherHero() {
  const reduced = useReducedMotion();
  const [round, setRound] = useState(0);
  const [gathered, setGathered] = useState(reduced);
  const [step, setStep] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(() => setGathered(true), GATHER_AFTER);
    return () => window.clearTimeout(t);
  }, [round, reduced]);

  useEffect(() => {
    if (!gathered || reduced) return;
    const id = window.setInterval(() => setStep((x) => (x + 1) % SLIP_STEPS.length), STEP_EVERY);
    return () => window.clearInterval(id);
  }, [gathered, reduced]);

  // Pieces lean towards the pointer while they float (depth per piece).
  const onMove = (e: React.PointerEvent) => {
    if (reduced || gathered || e.pointerType !== "mouse") return;
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return;
    stageRef.current!.style.setProperty("--mx", `${((e.clientX - r.left) / r.width - 0.5) * 40}px`);
    stageRef.current!.style.setProperty("--my", `${((e.clientY - r.top) / r.height - 0.5) * 40}px`);
  };

  const replay = () => {
    setGathered(false);
    setStep(0);
    setRound((n) => n + 1);
  };

  const shown = reduced ? SLIP_STEPS.length - 1 : step;

  return (
    <div
      ref={stageRef}
      className={`${s.stage} ${gathered ? s.gathered : s.floating}`}
      onPointerMove={onMove}
      aria-label="القطع المتفرقة بتتلم بطلب واحد مرتب"
      role="img"
    >
      {PIECES.map((p, i) => (
        <div
          key={`${round}-${i}`}
          className={`${s.piece} ${p.kind}`}
          style={{ "--x": `${p.x}px`, "--y": `${p.y}px`, "--r": `${p.r}deg`, "--d": p.d, "--delay": `${i * 70}ms` } as CSSProperties}
        >
          <span className={s.ico}>
            <Icon name={p.icon} size={16} />
          </span>
          <span>
            <b>{p.title}</b>
            {p.text}
          </span>
        </div>
      ))}

      <div className={s.card}>
        <div className={s.cardTop}>
          <span className="chipi tone-blue">
            <Icon name="brand-instagram" size={16} />
          </span>
          <b>رنا الخطيب</b>
          <span className={s.cardNo}>#1042</span>
        </div>
        <div className={s.cardLines}>
          <div>
            <span>فستان كتان · M زيتي</span>
            <span>
              <bdi>22.00</bdi>
            </span>
          </div>
          <div>
            <span>توصيل عمّان</span>
            <span>
              <bdi>2.00</bdi>
            </span>
          </div>
        </div>
        <div className={s.cardTotal}>
          <span>المجموع</span>
          <span>
            <bdi>24.00</bdi> د.أ
          </span>
        </div>
        <div className={s.rail}>
          <i style={{ width: `${(shown / (SLIP_STEPS.length - 1)) * 100}%` }} />
        </div>
        <div className={s.track}>
          {SLIP_STEPS.map((st, i) => (
            <div key={st.label} className={`${s.step} ${i < shown ? s.stepDone : ""} ${i === shown ? s.stepOn : ""}`}>
              <span className={s.dot}>
                <Icon name={i < shown ? "check" : st.icon} size={16} />
              </span>
              {st.label}
            </div>
          ))}
        </div>
      </div>

      <svg className={s.shadda} viewBox="0 0 100 100" aria-hidden="true">
        <path d="M18 44C16 74 44 76 48 54C52 76 80 72 84 24" />
      </svg>

      <div className={`${s.orbit} ${s.orbitA}`}>
        <span className="chipi tone-green">
          <Icon name="wallet" size={16} />
        </span>
        <span>
          <b>سارة دفعت 15</b>الدين تسكّر لحاله
        </span>
      </div>
      <div className={`${s.orbit} ${s.orbitB}`}>
        <span className="chipi tone-apricot">
          <Icon name="package" size={16} />
        </span>
        <span>
          <b>البلوزة الحرير</b>ضل 2، قرب يخلص
        </span>
      </div>

      {!reduced && (
        <button type="button" className={s.replay} onClick={replay}>
          <Icon name="arrow-back-up" size={16} /> شوف اللمّة كمان مرة
        </button>
      )}
    </div>
  );
}
