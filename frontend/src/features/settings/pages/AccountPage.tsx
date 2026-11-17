import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useCurrentAccount } from "@/features/auth";
import { applyServerErrors } from "@/shared/lib/formErrors";
import { initials } from "@/shared/lib/personName";
import { Button } from "@/shared/ui/Button";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { TextField } from "@/shared/ui/form/TextField";
import { Icon } from "@/shared/ui/Icon";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { useUpdateAccount } from "../api/accountApi";
import { ChangePasswordDrawer } from "../components/ChangePasswordDrawer";
import { SettingsGroup } from "../components/SettingsGroup";
import { SettingsRow } from "../components/SettingsRow";
import { profileSchema, type ProfileFormValues } from "../schemas/accountSchemas";

/** The owner's profile and security (prototype `#/account`; devices, language and notification sections are out of scope). */
export function AccountPage() {
  const account = useCurrentAccount();
  const update = useUpdateAccount();
  const toast = useToast();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState, reset } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: { fullName: account.fullName },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const updated = await update.mutateAsync({ fullName: values.fullName.trim() });
      reset({ fullName: updated.fullName });
      toast("انحفظ الملف الشخصي");
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ["fullName"]));
    }
  });

  return (
    <>
      <PageHeader title="الحساب" subtitle="معلوماتك الشخصية والأمان" />
      <section className="chero">
        <span className="ring-av" style={{ ["--p" as string]: 100 }}>
          <span>{initials(account.fullName)}</span>
        </span>
        <div>
          <span className="overline">حسابك</span>
          <h1>{account.fullName}</h1>
          <div className="chero__meta">
            <span className="ltr">{account.email}</span>
            {account.business && (
              <span>
                <Icon name="home" size={16} />
                {account.business.name}
              </span>
            )}
          </div>
        </div>
      </section>
      <div className="grid g-2">
        <SettingsGroup id="ap" icon="user-circle" tone="tone-olive" title="الملف الشخصي">
          <form className="col" style={{ gap: 12 }} onSubmit={onSubmit} noValidate>
            {formError && <FormAlert>{formError}</FormAlert>}
            <TextField label="الاسم" required autoComplete="name" error={formState.errors.fullName?.message} {...register("fullName")} />
            <TextField label="الإيميل" value={account.email} readOnly disabled ltr help="الإيميل اللي بتسجّل فيه" />
            <div>
              <Button type="submit" loading={update.isPending} disabled={!formState.isDirty}>
                حفظ
              </Button>
            </div>
          </form>
        </SettingsGroup>
        <SettingsGroup id="as" icon="lock" tone="tone-brick" title="كلمة السر والأمان">
          <SettingsRow title="كلمة السر" caption="لما تغيّرها، بتنقفل الجلسات على كل الأجهزة الثانية">
            <Button variant="outline" size="sm" onClick={() => setPasswordOpen(true)}>
              تغيير
            </Button>
          </SettingsRow>
        </SettingsGroup>
      </div>
      <ChangePasswordDrawer open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </>
  );
}
