import { useEffect, useState } from "react";
import { Illustration } from "@/shared/ui/brand/Illustration";
import { prefersReducedMotion } from "@/shared/ui/CountUp";

/** Lines per section (prototype `PEEK`), plus a few more in the same voice. Decorative only. */
const PEEK: Record<string, readonly (readonly [string, string])[]> = {
  dashboard: [
    ["shadda", "صباحك لمّة! كل شي بمكانه"],
    ["star", "جرّبت لوحة الحالات؟"],
    ["coin", "أرقامك اليوم بتحكي قصة"],
  ],
  orders: [
    ["parcel", "طلباتك مرتبة ومغلّفة"],
    ["van", "المندوب بالطريق!"],
  ],
  products: [
    ["fire", "منتجك الأول عم يطير"],
    ["star", "أضف صور لمنتجاتك"],
  ],
  inventory: [["parcel", "عيونك على المخزون"]],
  customers: [["heart", "زباينك بيحبوك"]],
  finance: [["coin", "كل دينار بمكانه"]],
  reports: [["coin", "أرقامك بتحكي قصة"]],
  settings: [["check", "إعداداتك محفوظة"]],
};

/**
 * A brand sticker that peeks in from the screen edge with a line about the current section, then leaves
 * (prototype `App.peek`): in after 2.2 s, out at 7.2 s, once per page. Off with reduced motion.
 */
export function PeekSticker({ section, pathname }: { section: string; pathname: string }) {
  const [shown, setShown] = useState<{ key: string; sticker: string; text: string } | null>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    // The subscription pages sit under the settings section, but «إعداداتك محفوظة» would read as a save message there.
    const lines = pathname.startsWith("/subscription") || pathname === "/trial-expired" ? undefined : PEEK[section];
    if (!lines || prefersReducedMotion()) return;
    const [sticker, text] = lines[Math.floor(Math.random() * lines.length)]!;
    const timers = [
      window.setTimeout(() => {
        setShown({ key: pathname, sticker, text });
        setOn(true);
      }, 2200),
      window.setTimeout(() => setOn(false), 7200),
    ];
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      setOn(false);
    };
  }, [section, pathname]);

  if (!shown) return null;
  return (
    <div className={`peek${on ? " is-on" : ""}`} aria-hidden="true">
      <span className="peek__stk">
        <Illustration kind="sticker" name={shown.sticker} />
      </span>
      <span className="peek__bubble">{shown.text}</span>
    </div>
  );
}
