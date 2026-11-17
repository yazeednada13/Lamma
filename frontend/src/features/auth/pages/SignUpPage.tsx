import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { ApiError } from "@/services/api/apiClient";
import { applyServerErrors } from "@/shared/lib/formErrors";
import { Button } from "@/shared/ui/Button";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { PasswordField } from "@/shared/ui/form/PasswordField";
import { PasswordStrength } from "@/shared/ui/form/PasswordStrength";
import { TextField } from "@/shared/ui/form/TextField";
import { useSignUp } from "../api/authApi";
import { AuthLayout } from "../components/AuthLayout";
import { signUpSchema, type SignUpFormValues } from "../schemas/authSchemas";

export function SignUpPage() {
  const signUp = useSignUp();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState, control } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });
  const password = useWatch({ control, name: "password" });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signUp.mutateAsync(values);
      navigate("/onboarding", { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.code === "auth.email_taken") {
        setError("email", { type: "server", message: error.message });
        return;
      }

      setFormError(applyServerErrors(error, setError, ["fullName", "email", "password"]));
    }
  });

  return (
    <AuthLayout
      title={
        <>
          ابدأ <em>ببلاش</em> لمدة شهر
        </>
      }
      subtitle="سجّل، اختار نوع مشروعك، وسجّل أول طلب خلال دقايق — بدون بطاقة."
    >
      <form className="auth2__card" onSubmit={onSubmit} noValidate>
        <h1>إنشاء حساب</h1>
        <p className="muted">3 حقول بس، وبنبلّش.</p>
        {formError && <FormAlert>{formError}</FormAlert>}
        <TextField label="اسمك" icon="user-circle" placeholder="ريم" autoComplete="name" error={formState.errors.fullName?.message} {...register("fullName")} />
        <TextField label="الإيميل" type="email" ltr autoComplete="email" placeholder="name@example.com" error={formState.errors.email?.message} {...register("email")} />
        <PasswordField label="كلمة السر" placeholder="8 خانات على الأقل" autoComplete="new-password" help="8 أحرف على الأقل، وفيها حرف ورقم" error={formState.errors.password?.message} {...register("password")} />
        <PasswordStrength password={password} />
        <Button type="submit" size="lg" loading={signUp.isPending} iconEnd="arrow-left">
          إنشاء الحساب
        </Button>
        <p className="caption" style={{ textAlign: "center" }}>
          بإنشاء الحساب بتوافق على الشروط وسياسة الخصوصية
        </p>
        <p className="muted" style={{ textAlign: "center" }}>
          عندك حساب؟ <Link to="/login">سجّل دخول</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
