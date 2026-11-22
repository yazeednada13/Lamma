import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon, type IconName } from "@/shared/ui/Icon";
import s from "../journey.module.css";
import { useInViewOnce, useReducedMotion } from "./landingHooks";

/** The life of one order in Lamma, right to left: message → packing → courier → delivered → money in. */
const STAGES: {
  key: string;
  label: string;
  icon: IconName;
  bubble: string;
  status: string;
  tone: string;
  log: { time: string; text: string };
}[] = [
  {
    key: "order",
    label: "وصل الطلب",
    icon: "brand-whatsapp",
    bubble: "رنا: بدي الفستان الزيتي M 😍",
    status: "جديد",
    tone: s.tNew!,
    log: { time: "10:02", text: "انسجل طلب رنا من الواتساب" },
  },
  {
    key: "pack",
    label: "التجهيز",
    icon: "gift",
    bubble: "انحجز من المخزون وتغلّف 🎁",
    status: "قيد التجهيز",
    tone: s.tPrep!,
    log: { time: "11:30", text: "انحجزت القطعة وتغلّف الطلب" },
  },
  {
    key: "ride",
    label: "مع المندوب",
    icon: "truck",
    bubble: "المندوب بالطريق لخلدا 🛵",
    status: "مع المندوب",
    tone: s.tWay!,
    log: { time: "13:05", text: "طلع الطلب مع شركة التوصيل" },
  },
  {
    key: "drop",
    label: "التسليم",
    icon: "home",
    bubble: "توصّل لرنا، وصارت مبسوطة ✅",
    status: "توصّل",
    tone: s.tDone!,
    log: { time: "14:40", text: "توصّل الطلب، والمخزون نقص لحاله" },
  },
  {
    key: "cash",
    label: "استلام المصاري",
    icon: "wallet",
    bubble: "+24.00 د.أ وصلت إيدك 💰",
    status: "توصّل ومدفوع",
    tone: s.tDone!,
    log: { time: "17:15", text: "المندوب حوّل 24.00 د.أ وتسكّر الحساب" },
  },
];

const POS = [8, 29, 50, 71, 92]; // station centres, % from the inline start (the right in RTL)
const STEP_MS = 2600;
const HOLD_LAST_MS = 3400;
const RESUME_AFTER_MS = 9000;

export function JourneyScene() {
  const reduced = useReducedMotion();
  const [ref, seen] = useInViewOnce<HTMLDivElement>(0.35);
  const [stage, setStage] = useState(reduced ? STAGES.length - 1 : 0);
  const [playing, setPlaying] = useState(!reduced);
  const resumeTimer = useRef<number | null>(null);

  // Autoplay once the scene is visible: one stage at a time, a longer pause on «money in», then from the start.
  useEffect(() => {
    if (!seen || !playing || reduced) return;
    const last = stage === STAGES.length - 1;
    const t = window.setTimeout(() => setStage(last ? 0 : stage + 1), last ? HOLD_LAST_MS : STEP_MS);
    return () => window.clearTimeout(t);
  }, [seen, playing, stage, reduced]);

  useEffect(() => () => {
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
  }, []);

  // Picking a stage pauses the story for a while, then it carries on by itself.
  const pick = useCallback(
    (i: number) => {
      setStage(i);
      setPlaying(false);
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
      if (!reduced) resumeTimer.current = window.setTimeout(() => setPlaying(true), RESUME_AFTER_MS);
    },
    [reduced],
  );

  const cur = STAGES[stage]!;
  const parcelAt = Math.min(stage, 3); // the parcel ends at the house; the money goes on to the wallet
  const paid = stage === STAGES.length - 1;

  return (
    <div ref={ref} className={`${s.journey} ${seen ? s.seen : ""}`}>
      <div className={s.scene} data-stage={stage} role="img" aria-label={`رحلة الطلب، المرحلة الحالية: ${cur.label}. ${cur.bubble}`}>
        <span className={s.sun} style={{ insetInlineStart: `${8 + stage * 19}%` } as CSSProperties} aria-hidden="true" />
        <span className={`${s.cloud} ${s.cloudA}`} aria-hidden="true" />
        <span className={`${s.cloud} ${s.cloudB}`} aria-hidden="true" />
        <span className={s.hills} aria-hidden="true" />

        <span className={s.road} aria-hidden="true" />
        <span className={s.roadDone} style={{ width: `${(POS[Math.min(stage, 4)]! - POS[0]!)}%` }} aria-hidden="true" />

        {STAGES.map((st, i) => (
          <div
            key={st.key}
            className={`${s.station} ${i < stage ? s.stationDone : ""} ${i === stage ? s.stationOn : ""}`}
            style={{ insetInlineStart: `${POS[i]}%` }}
            aria-hidden="true"
          >
            <span className={s.pad}>
              <Icon name={i < stage ? "check" : st.icon} size={24} />
            </span>
            <span className={s.stationLabel}>{st.label}</span>
            <span className={`${s.bubble} ${i === 0 ? s.bubbleStart : i === STAGES.length - 1 ? s.bubbleEnd : ""}`}>{st.bubble}</span>
          </div>
        ))}

        <div className={`${s.mover} ${stage === 2 ? s.riding : ""} ${paid ? s.delivered : ""}`} style={{ insetInlineStart: `${POS[parcelAt]}%` }} aria-hidden="true">
          <span className={s.parcel}>
            <Icon name="package" size={20} />
          </span>
          <span className={s.scooter}>
            <Icon name="truck" size={20} />
          </span>
        </div>

        {paid && (
          <div className={s.coins} aria-hidden="true">
            {[0, 1, 2].map((c) => (
              <span key={c} className={s.coin} style={{ "--c": c } as CSSProperties}>
                د.أ
              </span>
            ))}
          </div>
        )}
      </div>

      <div className={s.below}>
        <div className={s.stepper} role="group" aria-label="مراحل الطلب">
          {STAGES.map((st, i) => (
            <button key={st.key} type="button" aria-pressed={i === stage} className={i < stage ? s.passed : undefined} onClick={() => pick(i)}>
              <Icon name={st.icon} size={16} />
              {st.label}
            </button>
          ))}
          {!reduced && (
            <button
              type="button"
              className={s.play}
              aria-label={playing ? "وقّف الحركة" : "شغّل الحركة"}
              onClick={() => setPlaying((p) => !p)}
            >
              <Icon name={playing ? "clock" : "arrow-left"} size={16} />
              {playing ? "وقّف" : "شغّل"}
            </button>
          )}
        </div>

        <div className={s.ticket} aria-live="polite">
          <div className={s.ticketHead}>
            <span>
              <b>طلب #1042</b>
              رنا الخطيب، فستان كتان M
            </span>
            <em key={cur.status} className={`${s.chip} ${cur.tone}`}>
              {cur.status}
            </em>
          </div>
          <div className={s.payRow}>
            <span>الدفع</span>
            <b key={String(paid)} className={paid ? s.paid : s.unpaid}>
              {paid ? "مدفوع 24.00 د.أ" : "عند التوصيل 24.00 د.أ"}
            </b>
          </div>
          <ol className={s.log}>
            {STAGES.slice(0, stage + 1).map((st) => (
              <li key={st.key}>
                <time>{st.log.time}</time>
                {st.log.text}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
