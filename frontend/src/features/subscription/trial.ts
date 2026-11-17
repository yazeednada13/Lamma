// Free-trial display rules (D-010). Display only: trial-expiry enforcement is not approved (D-011).

export const TRIAL_LENGTH_DAYS = 30;

/** The trial is "late" (warning banner) in its last days. */
export const TRIAL_LATE_THRESHOLD_DAYS = 3;

export interface TrialStatus {
  /** Whole days left, as computed by the server in the business time zone. */
  remaining: number;
  /** Days used out of TRIAL_LENGTH_DAYS, clamped to 0..TRIAL_LENGTH_DAYS. */
  used: number;
  ended: boolean;
  isLate: boolean;
}

export function trialStatus(trialDaysRemaining: number): TrialStatus {
  const remaining = trialDaysRemaining;
  return {
    remaining,
    used: Math.min(TRIAL_LENGTH_DAYS, Math.max(0, TRIAL_LENGTH_DAYS - remaining)),
    ended: remaining <= 0,
    isLate: remaining > 0 && remaining <= TRIAL_LATE_THRESHOLD_DAYS,
  };
}
