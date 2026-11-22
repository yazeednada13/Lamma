import { z } from "zod";

// Pure rules of the public sign-up (D-160): the form schema, the Jordanian mobile check and the UTM source.

const ARABIC_DIGITS = /[٠-٩]/g;

/** Latin digits only, Arabic-Indic digits converted, spaces/dashes/brackets removed; a leading + is kept. */
function compact(input: string): string {
  const latin = input.replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660));
  const plus = latin.trim().startsWith("+");
  return (plus ? "+" : "") + latin.replace(/\D/g, "");
}

/** Mirrors the server: 07X…, 7X…, 9627X…, 009627X…, +9627X… with X in 7/8/9 → +9627XXXXXXXX, otherwise null. */
export function jordanMobile(input: string): string | null {
  let d = compact(input);
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("962")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);
  return /^7[789]\d{7}$/.test(d) ? `+962${d}` : null;
}

export const signupSchema = z.object({
  fullName: z.string().trim().min(1, "الاسم مطلوب.").max(100, "الاسم لازم يكون 100 حرف أو أقل."),
  email: z.string().trim().min(1, "الإيميل مطلوب.").email("اكتب إيميل صحيح، مثلًا name@example.com."),
  phone: z
    .string()
    .trim()
    .min(1, "رقم الموبايل مطلوب.")
    .refine((p) => jordanMobile(p) !== null, "اكتب رقم موبايل أردني، مثلًا 0791234567."),
  storeName: z.string().trim().max(100, "اسم المتجر لازم يكون 100 حرف أو أقل."),
  website: z.string(),
});

export type SignupFormValues = z.infer<typeof signupSchema>;

export interface Utm {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

/** Where the visitor came from (the Instagram bio link carries utm_*), trimmed to the server's 100 characters. */
export function readUtm(search: string): Utm {
  const p = new URLSearchParams(search);
  const get = (k: string) => {
    const v = p.get(k)?.trim();
    return v ? v.slice(0, 100) : null;
  };
  return { utmSource: get("utm_source"), utmMedium: get("utm_medium"), utmCampaign: get("utm_campaign") };
}

/** «r***@gmail.com»: enough to recognise the address on the success screen. */
export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.trim().split("@");
  if (!domain) return email;
  return `${user.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(5, user.length - 1)))}@${domain}`;
}

/** The order slip in the hero walks through these statuses (the real order flow). */
export const SLIP_STEPS = [
  { label: "جديد", icon: "receipt" },
  { label: "قيد التجهيز", icon: "gift" },
  { label: "مع المندوب", icon: "truck" },
  { label: "تم التسليم", icon: "circle-check" },
] as const;
