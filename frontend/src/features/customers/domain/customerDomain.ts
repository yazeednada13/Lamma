import type { SegmentCode } from "../api/customersApi";

// Customer presentation rules (D-114–D-117). The server computes segments; the client only labels them.

export const GOVERNORATES: { code: string; label: string }[] = [
  { code: "amman", label: "عمّان" },
  { code: "irbid", label: "إربد" },
  { code: "zarqa", label: "الزرقاء" },
  { code: "balqa", label: "البلقاء" },
  { code: "mafraq", label: "المفرق" },
  { code: "jerash", label: "جرش" },
  { code: "ajloun", label: "عجلون" },
  { code: "madaba", label: "مادبا" },
  { code: "karak", label: "الكرك" },
  { code: "tafilah", label: "الطفيلة" },
  { code: "maan", label: "معان" },
  { code: "aqaba", label: "العقبة" },
];

/** «عمّان · خلدا» (prototype format); "" when neither is set. */
export function placeLabel(city: string | null, area: string | null): string {
  const cityName = GOVERNORATES.find((g) => g.code === city)?.label;
  return [cityName, area].filter(Boolean).join(" · ");
}

/** Shows a Jordanian E.164 number the local way (079 123 4567); other numbers stay in E.164. */
export function phoneDisplay(e164: string | null): string {
  if (!e164) return "";
  const match = /^\+962(7\d)(\d{3})(\d{4})$/.exec(e164);
  return match ? `0${match[1]} ${match[2]} ${match[3]}` : e164;
}

export const SEGMENTS: { code: SegmentCode; label: string; tag: string; edge?: string; edgeBg?: string }[] = [
  { code: "vip", label: "مميزين", tag: "vip", edge: "var(--lamma-apricot-500)", edgeBg: "var(--lamma-apricot-100)" },
  { code: "owes", label: "عليهم ذمم", tag: "due", edge: "var(--lamma-brick-500)", edgeBg: "var(--lamma-brick-100)" },
  { code: "new", label: "جدد", tag: "new", edge: "var(--lamma-blue-500)", edgeBg: "var(--lamma-blue-100)" },
  { code: "dormant", label: "ما طلبوا من فترة", tag: "sleep", edge: "var(--lamma-stone-400)" },
];

/** Tag label for one customer (singular, gender-neutral). */
export function segmentTagLabel(code: SegmentCode): string {
  return { vip: "مميز", owes: "عليه ذمم", new: "جديد", dormant: "ما طلب من فترة" }[code];
}

export function segmentTagClass(code: SegmentCode): string {
  return `tag tag--${SEGMENTS.find((s) => s.code === code)!.tag}`;
}
