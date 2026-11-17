import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { ApiError, errorMessage } from "@/services/api/apiClient";
import { applyServerErrors } from "@/shared/lib/formErrors";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { useBusinessSettings, usePaymentMethodSettings, useSalesChannelSettings, useSaveSettings } from "../api/businessSettingsApi";
import { BusinessProfileSection } from "../components/BusinessProfileSection";
import { InventorySection } from "../components/InventorySection";
import { PaymentMethodsSection } from "../components/PaymentMethodsSection";
import { SalesChannelsSection } from "../components/SalesChannelsSection";
import { SettingsSectionNav, type SettingsSection } from "../components/SettingsSectionNav";
import { UnsavedChangesBar } from "../components/UnsavedChangesBar";
import { PAYMENT_METHODS } from "../domain/paymentMethods";
import { SALES_CHANNELS } from "../domain/salesChannels";
import { businessSettingsSchema, type BusinessSettingsFormValues } from "../schemas/businessSettingsSchema";

const SECTIONS: readonly SettingsSection[] = [
  { id: "sp", icon: "home", label: "الملف التعريفي" },
  { id: "sc", icon: "brand-instagram", label: "قنوات البيع" },
  { id: "spay", icon: "cash", label: "طرق الدفع" },
  { id: "sinv", icon: "building-warehouse", label: "المخزون" },
];

/**
 * Business settings (Phase 1 scope; prototype `#/settings`). This page owns the data: it loads the three
 * settings resources, builds the form, saves only the changed sections and maps server errors.
 * The sections only render their fields.
 */
export function BusinessSettingsPage() {
  const business = useBusinessSettings();
  const channels = useSalesChannelSettings();
  const methods = usePaymentMethodSettings();
  const save = useSaveSettings();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const loaded = useMemo<BusinessSettingsFormValues | null>(() => {
    if (!business.data || !channels.data || !methods.data) {
      return null;
    }

    return {
      name: business.data.name,
      businessType: business.data.businessType,
      defaultLowStockThreshold: business.data.defaultLowStockThreshold,
      channels: Object.fromEntries(channels.data.channels.map((c) => [c.channel, c.isEnabled])),
      methods: Object.fromEntries(methods.data.methods.map((m) => [m.method, m.isEnabled])),
    };
  }, [business.data, channels.data, methods.data]);

  const { register, handleSubmit, reset, formState, setError } = useForm<BusinessSettingsFormValues>({ resolver: zodResolver(businessSettingsSchema) });

  useEffect(() => {
    if (loaded) {
      reset(loaded);
    }
  }, [loaded, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const dirty = formState.dirtyFields;
    try {
      await save.mutateAsync({
        business:
          dirty.name || dirty.businessType || dirty.defaultLowStockThreshold
            ? { name: values.name.trim(), businessType: values.businessType, defaultLowStockThreshold: values.defaultLowStockThreshold }
            : undefined,
        channels: dirty.channels ? { channels: SALES_CHANNELS.map((c) => ({ channel: c, isEnabled: Boolean(values.channels[c]) })) } : undefined,
        methods: dirty.methods ? { methods: PAYMENT_METHODS.map((m) => ({ method: m, isEnabled: Boolean(values.methods[m]) })) } : undefined,
      });
      reset(values);
      toast("انحفظت الإعدادات");
    } catch (error) {
      if (error instanceof ApiError && error.code === "settings.channel_required") {
        setError("channels", { type: "server", message: error.message });
        return;
      }

      if (error instanceof ApiError && error.code === "settings.payment_method_required") {
        setError("methods", { type: "server", message: error.message });
        return;
      }

      setFormError(applyServerErrors(error, setError, ["name", "businessType", "defaultLowStockThreshold"]));
    }
  });

  const failed = business.error ?? channels.error ?? methods.error;
  if (failed) {
    return (
      <>
        <PageHeader title="إعدادات المشروع" />
        <ErrorState
          message={errorMessage(failed)}
          onRetry={() => {
            void business.refetch();
            void channels.refetch();
            void methods.refetch();
          }}
        />
      </>
    );
  }

  if (!loaded || !formState.defaultValues) {
    return <PageSkeleton />;
  }

  const sectionProps = { register, errors: formState.errors };
  return (
    <>
      <PageHeader title="إعدادات المشروع" subtitle={`${loaded.name} · كل اللي بيخص طريقة شغلك`} />
      <form className="settings" onSubmit={onSubmit} noValidate>
        <SettingsSectionNav sections={SECTIONS} />
        <div className="col" style={{ gap: 16 }}>
          {formError && <FormAlert>{formError}</FormAlert>}
          <BusinessProfileSection {...sectionProps} />
          <SalesChannelsSection {...sectionProps} />
          <PaymentMethodsSection {...sectionProps} />
          <InventorySection {...sectionProps} />
          <UnsavedChangesBar visible={formState.isDirty} saving={save.isPending} onDiscard={() => reset(loaded)} />
        </div>
      </form>
    </>
  );
}
