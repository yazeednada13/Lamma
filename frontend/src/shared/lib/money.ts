// Money on the client (DATABASE-DESIGN §3, D-080).
// The API sends JOD amounts as strings with exactly 3 decimals ("38.500"). Arithmetic is done in integer
// fils (1 JOD = 1000 fils) so JavaScript floating point never touches money. Display/input use 2 decimals (D-080).

export type MoneyString = string;

const MONEY_PATTERN = /^(-?)(\d{1,16})(?:\.(\d{1,3}))?$/;
const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC = "۰۱۲۳۴۵۶۷۸۹";

/** Converts Arabic-Indic and Eastern Arabic digits to Latin, and the Arabic decimal separator to ".". */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(EASTERN_ARABIC.indexOf(d)))
    .replace(/[٫,]/g, (c) => (c === "٫" ? "." : c));
}

/** "38.5" → 38500 fils. Throws on invalid input (more than 3 decimals, non-numeric). */
export function toFils(amount: MoneyString): number {
  const match = MONEY_PATTERN.exec(amount.trim());
  if (!match) {
    throw new Error(`Invalid money value: ${amount}`);
  }

  const [, sign, whole, fraction = ""] = match;
  const fils = Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
  return sign === "-" ? -fils : fils;
}

/** 38500 → "38.500" (the API wire format). */
export function fromFils(fils: number): MoneyString {
  if (!Number.isSafeInteger(fils)) {
    throw new Error("Fils must be a safe integer.");
  }

  const sign = fils < 0 ? "-" : "";
  const abs = Math.abs(fils);
  return `${sign}${Math.trunc(abs / 1000)}.${String(abs % 1000).padStart(3, "0")}`;
}

export function addMoney(...amounts: MoneyString[]): MoneyString {
  return fromFils(amounts.reduce((sum, a) => sum + toFils(a), 0));
}

/**
 * Display formatting: Latin digits, thousands separators, 2 decimals (D-080), half away from zero.
 * Returns the number part only; the currency sign is added by the <Money> component (after the number).
 */
export function formatMoneyNumber(amount: MoneyString, decimals: 2 | 3 = 2): string {
  const fils = toFils(amount);
  const abs = Math.abs(fils);
  const scaled = decimals === 3 ? abs : Math.floor(abs / 10) + (abs % 10 >= 5 ? 1 : 0); // 3dp → 2dp, half up on magnitude
  const divisor = decimals === 3 ? 1000 : 100;
  const whole = Math.trunc(scaled / divisor).toLocaleString("en-US");
  const fraction = String(scaled % divisor).padStart(decimals, "0");
  const sign = fils < 0 ? "−" : "";
  return `${sign}${whole}.${fraction}`;
}

/**
 * Parses what a merchant typed (Latin or Arabic digits, up to 2 decimals per D-080) into the API format.
 * Returns null when invalid.
 */
export function parseMoneyInput(input: string, maxDecimals = 2): MoneyString | null {
  const normalized = normalizeDigits(input).replace(/\s|,/g, "");
  const match = /^(\d{1,13})(?:\.(\d+))?$/.exec(normalized);
  if (!match) {
    return null;
  }

  const [, whole, fraction = ""] = match;
  if (fraction.length > maxDecimals) {
    return null;
  }

  return fromFils(Number(whole) * 1000 + Number(fraction.padEnd(3, "0")));
}
