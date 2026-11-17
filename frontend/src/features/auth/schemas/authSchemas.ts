import { z } from "zod";
import { emailSchema, personNameSchema } from "@/shared/validation/fieldSchemas";
import { newPasswordSchema } from "./passwordSchema";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "الإيميل مطلوب."),
  password: z.string().min(1, "كلمة السر مطلوبة."),
  rememberMe: z.boolean(),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const signUpSchema = z.object({ fullName: personNameSchema, email: emailSchema, password: newPasswordSchema });
export type SignUpFormValues = z.infer<typeof signUpSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({ newPassword: newPasswordSchema });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
