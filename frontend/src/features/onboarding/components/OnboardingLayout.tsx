import type { ReactNode } from "react";

/** Onboarding frame: logo, progress bar, "step x of 3" (prototype `.onb`). */
export function OnboardingLayout({ step, children }: { step: number; children: ReactNode }) {
  const shown = Math.min(step, 3);
  return (
    <div className="onb">
      <div className="onb__top">
        <img src="/logo/lamma-lockup-ar-horizontal.svg" alt="لمّة" height={34} />
        <div className="onb__bar" role="progressbar" aria-label="تقدّم التهيئة" aria-valuemin={1} aria-valuemax={3} aria-valuenow={shown}>
          <i style={{ width: `${(shown / 3) * 100}%` }} />
        </div>
        <span className="caption">خطوة {shown} من 3</span>
      </div>
      {children}
    </div>
  );
}
