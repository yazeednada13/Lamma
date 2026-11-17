import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router";
import { applyServerErrors } from "@/shared/lib/formErrors";
import { Button } from "@/shared/ui/Button";
import { Checkbox } from "@/shared/ui/form/Checkbox";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { PasswordField } from "@/shared/ui/form/PasswordField";
import { TextField } from "@/shared/ui/form/TextField";
import { useLogin } from "../api/authApi";
import { AuthLayout } from "../components/AuthLayout";
import { loginSchema, type LoginFormValues } from "../schemas/authSchemas";

export function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: true },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const account = await login.mutateAsync(values);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(account.isOnboarded ? (from ?? "/") : "/onboarding", { replace: true });
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ["email", "password"]));
    }
  });

  return (
    <AuthLayout
      title={
        <>
          كل شغلك <em>بمكان واحد</em>
        </>
      }
      subtitle="طلبات واتساب وإنستغرام، المخزون، الزباين والأرباح… مرتبين ومجموعين، وبيتحدّثوا لحالهم."
    >
      <form className="auth2__card" onSubmit={onSubmit} noValidate>
        <img src="/logo/lamma-lockup-ar-horizontal.svg" alt="" height={42} style={{ alignSelf: "flex-start" }} />
        <h1>أهلًا فيك من جديد</h1>
        <p className="muted">سجّل دخولك وكمّل من وين وقفت.</p>
        {formError && <FormAlert>{formError}</FormAlert>}
        <TextField label="الإيميل" icon="user-circle" type="email" ltr autoComplete="username" error={formState.errors.email?.message} {...register("email")} />
        <PasswordField label="كلمة السر" placeholder="8 خانات على الأقل" autoComplete="current-password" error={formState.errors.password?.message} {...register("password")} />
        <div className="row between">
          <Checkbox label="تذكّرني" {...register("rememberMe")} />
          <Link to="/forgot-password" className="caption">
            نسيت كلمة السر؟
          </Link>
        </div>
        <Button type="submit" size="lg" loading={login.isPending} iconEnd="arrow-left">
          دخول
        </Button>
        <div className="divider-or">أو</div>
        <p className="muted" style={{ textAlign: "center" }}>
          جديد على لمّة؟ <Link to="/signup">ابدأ تجربتك المجانية</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
