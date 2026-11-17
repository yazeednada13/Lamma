import { z } from "zod";

/** The password policy (mirrors the server's: ≥8, ≤128, a letter in any script, a digit). */
export const newPasswordSchema = z
  .string()
  .min(1, "كلمة السر مطلوبة.")
  .min(8, "كلمة السر لازم تكون 8 أحرف على الأقل.")
  .max(128, "كلمة السر طويلة كثير (الحد 128).")
  .refine((p) => /\p{L}/u.test(p), "كلمة السر لازم يكون فيها حرف واحد على الأقل.")
  .refine((p) => /\d/.test(p), "كلمة السر لازم يكون فيها رقم واحد على الأقل.");
