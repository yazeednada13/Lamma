/** Same 4 rules as the approved prototype meter: ≥8 chars, a digit, a letter, ≥12 chars. */
export function passwordScore(password: string): number {
  return [password.length >= 8, /\d/.test(password), /\p{L}/u.test(password), password.length >= 12].filter(Boolean).length;
}

const STRENGTH_LABELS = ["", "ضعيفة", "مقبولة", "جيدة", "قوية"];

/** Visual strength meter (`.pwmeter`). Display only; the password policy lives in the auth feature. */
export function PasswordStrength({ password }: { password: string }) {
  const score = passwordScore(password);
  return (
    <div className="pwmeter" role="meter" aria-label="قوة كلمة السر" aria-valuemin={0} aria-valuemax={4} aria-valuenow={score} aria-valuetext={STRENGTH_LABELS[score] || "فاضية"}>
      {[0, 1, 2, 3].map((i) => (
        <i key={i} className={i < score ? "on" : undefined} />
      ))}
    </div>
  );
}
