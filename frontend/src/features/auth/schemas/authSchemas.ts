import { z } from "zod";
import { emailSchema } from "@/shared/validation/fieldSchemas";
import { newPasswordSchema } from "./passwordSchema";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "الإيميل مطلوب."),
  password: z.string().min(1, "كلمة السر مطلوبة."),
  rememberMe: z.boolean(),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

/** Registration from an invitation (D-160): the email is fixed by the link, so only the password and its confirmation. */
export const registerSchema = z
  .object({ password: newPasswordSchema, confirmPassword: z.string().min(1, "أكّد كلمة السر.") })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "تأكيد كلمة السر مش مطابق." });
export type RegisterFormValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({ newPassword: newPasswordSchema });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
