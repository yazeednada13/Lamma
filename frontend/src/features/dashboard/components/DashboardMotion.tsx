import { useEffect, useState } from "react";
import { Illustration } from "@/shared/ui/brand/Illustration";
import { prefersReducedMotion } from "@/shared/ui/CountUp";
import { Icon, type IconName } from "@/shared/ui/Icon";
import { dayPhase } from "../domain/dashboardDomain";

export type FloatItem = { icon: IconName; tone: string; title: string; text: string };

/**
 * Floating note cards (prototype `.floaty`) that take turns: one card floats in, stays a few seconds, and the next
 * one replaces it. Decorative: the same facts are on the page as text. With reduced motion only the first card shows.
 */
export function FloatTicker({
  items,
  everyMs = 4600,
  className,
}: {
  items: FloatItem[];
  everyMs?: number;
  className?: string;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2 || prefersReducedMotion()) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % items.length), everyMs);
    return () => window.clearInterval(t);
  }, [items.length, everyMs]);
  const item = items[i % Math.max(items.length, 1)];
  if (!item) return null;
  return (
    <div className={`fticker ${className ?? ""}`} aria-hidden="true">
      <div key={i} className="floaty fticker__card">
        <span className={`chipi tone-${item.tone}`}>
          <Icon name={item.icon} size={16} />
        </span>
        <span>
          <b>{item.title}</b>
          {item.text}
        </span>
      </div>
    </div>
  );
}

/** Rider on a scooter with a Lamma parcel box, drawn facing the travel direction (towards the left, RTL). */
function Scooter() {
  return (
    <svg className="lane__scooter" viewBox="0 0 124 84" aria-hidden="true">
      <ellipse className="lane__shadow" cx="62" cy="78" rx="46" ry="4" />
      <g className="lane__speed">
        <path d="M108 40 H122" />
        <path d="M112 50 H124" />
        <path d="M106 60 H118" />
      </g>
      <g className="lane__bob">
        {/* parcel box */}
        <rect className="lane__box" x="76" y="18" width="28" height="24" rx="4" />
        <path className="lane__tape" d="M90 18 V42" />
        <text className="lane__boxtext" x="90" y="34" textAnchor="middle">
          لمّة
        </text>
        {/* rear cowl, floor, front shield */}
        <path className="lane__body" d="M68 62 Q68 44 90 44 Q104 45 106 62 Z" />
        <rect className="lane__floor" x="36" y="56" width="40" height="6" rx="3" />
        <path className="lane__body" d="M26 62 L34 30 L41 30 L39 58 Z" />
        <circle className="lane__light" cx="33" cy="37" r="3" />
        <path className="lane__bar" d="M35 30 L31 22 M26 22 H37" />
        {/* rider */}
        <path className="lane__leg" d="M72 46 L52 54 L48 56" />
        <path className="lane__jacket" d="M64 46 Q58 32 64 24 L74 25 Q78 36 78 46 Z" />
        <path className="lane__arm" d="M66 30 L36 24" />
        <circle className="lane__helmet" cx="68" cy="16" r="9" />
        <path className="lane__visor" d="M59 15 Q60 10 66 10 L66 17 Z" />
      </g>
      <g className="lane__wheel" style={{ transformOrigin: "28px 66px" }}>
        <circle cx="28" cy="66" r="10" />
        <path d="M28 57 V75 M19 66 H37" />
      </g>
      <g className="lane__wheel" style={{ transformOrigin: "94px 66px" }}>
        <circle cx="94" cy="66" r="10" />
        <path d="M94 57 V75 M85 66 H103" />
      </g>
    </svg>
  );
}

/** A small stone house (Amman style: flat roof, arched door) where the parcel is dropped. */
function House() {
  return (
    <svg className="lane__house" viewBox="0 0 90 86" aria-hidden="true">
      <rect className="lane__wall" x="8" y="22" width="74" height="60" rx="3" />
      <rect className="lane__roof" x="4" y="16" width="82" height="8" rx="2" />
      <path className="lane__door" d="M36 82 V58 Q45 48 54 58 V82 Z" />
      <rect className="lane__win" x="16" y="34" width="14" height="14" rx="2" />
      <rect className="lane__win" x="60" y="34" width="14" height="14" rx="2" />
      <path className="lane__plant" d="M70 82 Q66 70 72 64 Q78 70 74 82 Z" />
    </svg>
  );
}

/**
 * Closing scene of «لمّة اليوم»: a courier rides across the city, drops a parcel at a door, a check pops, and rides
 * on. The captions carry the month's real counts; tips about how Lamma works float in turns. Decorative motion only;
 * with reduced motion the scene stands still.
 */
export function DeliveryLane({
  delivered,
  onTheWay,
  tips,
}: {
  delivered: number;
  onTheWay: number;
  tips: FloatItem[];
}) {
  // The sky follows the Amman hour: morning sun, high noon, sunset, and a moon with lit windows at night.
  const [phase] = useState(() => dayPhase());
  return (
    <section className={`lane lane--${phase} stk-host`} aria-label="مسار التوصيل">
      <div className="lane__copy">
        <span className="overline">مسار التوصيل · هالشهر</span>
        <h3>
          <bdi>{delivered}</bdi> طلب وصل لأصحابه
          {onTheWay > 0 && (
            <>
              {" "}
              و<bdi>{onTheWay}</bdi> بالطريق هلّق
            </>
          )}
        </h3>
        <p className="caption">ورا كل طلب زبون مستني، ولمّة بتلحقلك كل خطوة من الرسالة لباب البيت.</p>
      </div>
      <FloatTicker items={tips} everyMs={5200} className="lane__tips" />

      <div className="lane__scene" aria-hidden="true">
        <span className="lane__orb" />
        {phase === "night" && (
          <span className="lane__stars">
            {Array.from({ length: 9 }, (_, i) => (
              <i
                key={i}
                style={{ top: 8 + ((i * 23) % 50), insetInlineStart: `${6 + i * 10}%`, animationDelay: `${i * 300}ms` }}
              />
            ))}
          </span>
        )}
        <svg className="lane__city" viewBox="0 0 600 70" preserveAspectRatio="xMidYMax slice">
          <path d="M0 70 V44 H40 V30 H70 V48 H100 V22 H122 V14 H130 V22 H150 V50 H190 V36 H230 V56 H260 V26 H300 V46 H330 V18 H344 Q352 6 360 18 H372 V48 H410 V32 H452 V54 H480 V28 H520 V44 H560 V34 H600 V70 Z" />
        </svg>
        <div className="lane__road" />
        <House />
        <span className="lane__drop">
          <Illustration kind="sticker" name="parcel" />
        </span>
        <span className="lane__done">
          <Illustration kind="sticker" name="check" />
        </span>
        <div className="lane__rider">
          <Scooter />
        </div>
      </div>
    </section>
  );
}
