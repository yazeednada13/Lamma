import { useState } from "react";
import { useNavigate } from "react-router";
import { useCurrentAccount } from "@/features/auth";
import { SALES_CHANNELS, useBusinessTypes, type SalesChannelCode } from "@/features/settings";
import { ApiError, errorMessage } from "@/services/api/apiClient";
import { useCompleteOnboarding } from "../api/onboardingApi";
import { BusinessNameStep } from "../components/BusinessNameStep";
import { BusinessTypeStep } from "../components/BusinessTypeStep";
import { OnboardingComplete } from "../components/OnboardingComplete";
import { OnboardingLayout } from "../components/OnboardingLayout";
import { SalesChannelsStep } from "../components/SalesChannelsStep";

type Step = 1 | 2 | 3 | "done";

/** 3-step onboarding in the approved order (D-081): name → one business type → sales channels. Owns step state and submit. */
export function OnboardingPage() {
  const navigate = useNavigate();
  const account = useCurrentAccount();
  const types = useBusinessTypes();
  const complete = useCompleteOnboarding();

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [type, setType] = useState<string | null>(null);
  const [channels, setChannels] = useState<SalesChannelCode[]>(["instagram", "whatsapp"]);
  const [error, setError] = useState<string | null>(null);

  const enterApp = () => {
    complete.enterApp();
    navigate("/", { replace: true });
  };

  const goToTypes = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("اسم المشروع مطلوب.");
      return;
    }

    if (trimmed.length > 100) {
      setNameError("اسم المشروع لازم يكون 100 حرف أو أقل.");
      return;
    }

    setNameError(undefined);
    setStep(2);
  };

  const toggleChannel = (channel: SalesChannelCode, on: boolean) =>
    setChannels((list) => (on ? [...list.filter((c) => c !== channel), channel] : list.filter((c) => c !== channel)));

  const submit = async () => {
    setError(null);
    try {
      await complete.mutateAsync({
        businessName: name.trim(),
        businessType: type!,
        salesChannels: SALES_CHANNELS.filter((c) => channels.includes(c)),
      });
      setStep("done");
    } catch (e) {
      if (e instanceof ApiError && e.code === "onboarding.already_completed") {
        enterApp();
        return;
      }

      setError(e instanceof ApiError && Object.keys(e.fieldErrors).length > 0 ? Object.values(e.fieldErrors)[0]?.[0] ?? e.message : errorMessage(e));
    }
  };

  if (step === "done") {
    return (
      <OnboardingLayout step={3}>
        <OnboardingComplete
          businessName={name.trim()}
          templateLabel={types.data?.find((t) => t.code === type)?.labelAr ?? ""}
          trialDays={complete.data?.business?.trialDaysRemaining ?? 30}
          onEnter={enterApp}
        />
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout step={step}>
      {step === 1 && <BusinessNameStep ownerName={account.fullName} name={name} error={nameError} onNameChange={setName} onContinue={goToTypes} />}
      {step === 2 && (
        <BusinessTypeStep
          options={types.data ?? []}
          loadError={types.isError ? errorMessage(types.error) : undefined}
          selected={type}
          onSelect={setType}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <SalesChannelsStep selected={channels} error={error} submitting={complete.isPending} onToggle={toggleChannel} onBack={() => setStep(2)} onSubmit={() => void submit()} />
      )}
    </OnboardingLayout>
  );
}
