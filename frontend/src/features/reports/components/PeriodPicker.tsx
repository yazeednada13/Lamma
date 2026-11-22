import { useState } from "react";
import { Button } from "@/shared/ui/Button";
import { Chip } from "@/shared/ui/Chip";
import { TextField } from "@/shared/ui/form/TextField";
import { Icon } from "@/shared/ui/Icon";
import type { PeriodCode } from "../api/reportsApi";
import { businessToday, PERIODS, rangeLabel, type PeriodSelection } from "../domain/reportsDomain";

const MAX_DAYS = 366;
const days = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5) + 1;

/** Same check as the server (D-168), so the merchant sees the reason before asking. */
function rangeError(from: string, to: string, today: string): string | null {
  if (!from || !to) return "اختار تاريخ البداية والنهاية.";
  if (to < from) return "تاريخ النهاية قبل تاريخ البداية.";
  if (to > today) return "ما بنقدر نعرض تقرير لأيام لسا ما إجت.";
  if (days(from, to) > MAX_DAYS) return "أطول فترة للتقرير سنة وحدة.";
  return null;
}

/** Period chips (D-168) plus a custom from–to panel; the selection lives in the URL. */
export function PeriodPicker({ value, onChange }: { value: PeriodSelection; onChange: (s: PeriodSelection) => void }) {
  const today = businessToday();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value.from ?? `${today.slice(0, 8)}01`);
  const [to, setTo] = useState(value.to ?? today);
  const [tried, setTried] = useState(false);
  const error = rangeError(from, to, today);

  const pick = (code: PeriodCode) => {
    if (code === "custom") {
      setOpen((o) => !o);
      return;
    }
    setOpen(false);
    onChange({ period: code });
  };

  const apply = () => {
    setTried(true);
    if (error) return;
    setOpen(false);
    onChange({ period: "custom", from, to });
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div className="row wrap" style={{ gap: 6 }} role="group" aria-label="الفترة">
        {PERIODS.map((p) => (
          <Chip
            key={p.code}
            selected={value.period === p.code}
            aria-expanded={p.code === "custom" ? open : undefined}
            onClick={() => pick(p.code)}
          >
            {p.code === "month" && <Icon name="calendar" size={16} />}{" "}
            {p.code === "custom" && value.period === "custom" && value.from && value.to ? rangeLabel(value.from, value.to) : p.label}
          </Chip>
        ))}
      </div>
      {open && (
        <div className="card" style={{ marginTop: 10, padding: 16, maxWidth: 520 }}>
          <div className="grid g-2" style={{ gap: 12 }}>
            <TextField label="من" type="date" ltr value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
            <TextField label="لحد" type="date" ltr value={to} max={today} onChange={(e) => setTo(e.target.value)} />
          </div>
          {tried && error ? (
            <p className="caption" role="alert" style={{ color: "var(--lamma-status-danger-text)", marginTop: 8 }}>
              {error}
            </p>
          ) : (
            <p className="caption" style={{ marginTop: 8 }}>
              أطول فترة سنة، وبنقارنها بنفس عدد الأيام اللي قبلها.
            </p>
          )}
          <div className="row" style={{ gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={apply}>اعرض التقرير</Button>
          </div>
        </div>
      )}
    </div>
  );
}
