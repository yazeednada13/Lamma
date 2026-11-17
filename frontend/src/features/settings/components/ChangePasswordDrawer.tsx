import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { applyServerErrors } from "@/shared/lib/formErrors";
import { Button } from "@/shared/ui/Button";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { PasswordField } from "@/shared/ui/form/PasswordField";
import { PasswordStrength } from "@/shared/ui/form/PasswordStrength";
import { Drawer } from "@/shared/ui/overlay/Drawer";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { useChangePassword } from "../api/accountApi";
import { changePasswordSchema, type ChangePasswordFormValues } from "../schemas/accountSchemas";

/** Password-change flow in a drawer (other sessions end on success). */
export function ChangePasswordDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const change = useChangePassword();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState, control, reset } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  });
  const newPasswordValue = useWatch({ control, name: "newPassword" });

  const close = () => {
    reset();
    setFormError(null);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await change.mutateAsync(values);
      toast("تغيّرت كلمة السر، وانقفلت الجلسات على الأجهزة الثانية");
      close();
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ["currentPassword", "newPassword"]));
    }
  });

  return (
    <Drawer
      open={open}
      onClose={close}
      title="تغيير كلمة السر"
      footer={
        <>
          <Button onClick={() => void onSubmit()} loading={change.isPending}>
            حفظ كلمة السر
          </Button>
          <Button variant="ghost" onClick={close}>
            إلغاء
          </Button>
        </>
      }
    >
      <form id="change-password-form" className="col" style={{ gap: 16 }} onSubmit={onSubmit} noValidate>
        {formError && <FormAlert>{formError}</FormAlert>}
        <PasswordField label="كلمة السر الحالية" autoComplete="current-password" error={formState.errors.currentPassword?.message} {...register("currentPassword")} />
        <PasswordField label="كلمة السر الجديدة" autoComplete="new-password" help="8 أحرف على الأقل، وفيها حرف ورقم" error={formState.errors.newPassword?.message} {...register("newPassword")} />
        <PasswordStrength password={newPasswordValue} />
      </form>
    </Drawer>
  );
}
