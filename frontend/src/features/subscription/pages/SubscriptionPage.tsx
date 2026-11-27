import { useState } from "react";
import { errorMessage } from "@/services/api/apiClient";
import { formatMoneyNumber, toFils } from "@/shared/lib/money";
import { Badge } from "@/shared/ui/Badge";
import { Illustration } from "@/shared/ui/brand/Illustration";
import { Button } from "@/shared/ui/Button";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { Icon } from "@/shared/ui/Icon";
import { Money } from "@/shared/ui/Money";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useSubscription } from "../api/subscriptionApi";
import { PayDrawer } from "../components/PayDrawer";
import {
  dateLabel,
  PLAN_LABEL,
  ringFor,
  STATUS_LABEL,
  STATUS_TONE,
  statusLine,
  yearlySaving,
  type PaidPlan,
} from "../domain/subscriptionDomain";

const FEATURES = ["طلبات ومنتجات بلا حدود", "المخزون والحجز التلقائي", "الزباين والديون والدفعات", "المندوب والمصاريف", "الأرباح والتقارير", "مساعدة بالواتساب"];

/** The subscription page (prototype `#/subscription`, D-163, D-165, D-183): status, plans, CliQ payment, history. */
export function SubscriptionPage() {
  const query = useSubscription();
  const [paying, setPaying] = useState<PaidPlan | null>(null);
  const header = <PageHeader title="الاشتراك" subtitle="تجربتك المجانية والخطط" />;

  if (query.error) {
    return (
      <>
        {header}
        <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      </>
    );
  }

  const data = query.data;
  if (!data) {
    return (
      <>
        {header}
        <PageSkeleton />
      </>
    );
  }

  const s = data.summary;
  const ring = ringFor(s);
  const monthly = toFils(data.plans.find((p) => p.plan === "monthly")?.price ?? "0") / 1000;
  const yearly = toFils(data.plans.find((p) => p.plan === "yearly")?.price ?? "0") / 1000;
  const pending = data.pending;
  const rejected = data.lastReviewed?.status === "rejected" && !pending ? data.lastReviewed : null;
  const title =
    s.status === "trial"
      ? "أول شهر علينا"
      : s.status === "active"
        ? "اشتراكك شغّال"
        : s.status === "suspended"
          ? "حسابك موقوف"
          : s.readOnly
            ? "حسابك للقراءة فقط"
            : "قرّب ينتهي";
  const suspended = s.status === "suspended";

  return (
    <>
      {header}
      <section className="subhero">
        <div className="bigring" style={{ ["--p" as string]: ring.percent }}>
          {suspended ? (
            <span>
              <Icon name="lock" size={24} />
              موقوف
            </span>
          ) : (
            <span>
              <b className="num">{ring.value}</b>
              {ring.caption}
            </span>
          )}
        </div>
        <div>
          <span className="overline" style={{ color: "var(--lamma-apricot-700)" }}>
            <Badge tone={STATUS_TONE[s.status]} dot>
              {STATUS_LABEL[s.status]}
            </Badge>
          </span>
          <h1 style={{ font: "var(--lamma-type-display)", marginTop: 8 }}>{title}</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            {suspended
              ? `${statusLine(s)}. كل بياناتك محفوظة وبتقدر تشوفها.`
              : `${statusLine(s)}. لما تخلص التجربة أو الخطة، بياناتك بتضل محفوظة وبتقدر تشوفها؛ الإضافة والتعديل بيرجعوا لما تشترك.`}
          </p>
          {ring.dots && (
            <div className="daysdots" aria-label={`${ring.dots.used} من ${ring.dots.total} يوم`}>
              {Array.from({ length: ring.dots.total }, (_, i) => (
                <i key={i} className={i < ring.dots!.used - 1 ? "used" : i === ring.dots!.used - 1 ? "is-today" : ""} />
              ))}
            </div>
          )}
        </div>
      </section>

      {pending && (
        <div className="insight" role="status" style={{ marginTop: 16 }}>
          <span className="overline">دفعتك بانتظار المراجعة</span>
          <p>
            وصلتنا صورة تحويل {PLAN_LABEL[pending.plan]} بقيمة <Money value={pending.amount} />. بنفعّل خطتك أول ما نتأكد منها، وبيوصلك إيميل.
          </p>
        </div>
      )}
      {rejected && (
        <div className="insight" role="alert" style={{ marginTop: 16, borderColor: "var(--lamma-status-danger-text)" }}>
          <span className="overline">ما قدرنا نفعّل الدفعة الأخيرة</span>
          <p>
            السبب: <b>{rejected.rejectReason}</b>. تقدر تبعت صورة تحويل جديدة.
          </p>
        </div>
      )}

      <div className="plans" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginTop: 20 }}>
        {(["monthly", "yearly"] as const).map((plan) => {
          const featured = plan === "yearly";
          const price = plan === "monthly" ? monthly : yearly;
          return (
            <div key={plan} className={`plan2 ${featured ? "is-featured" : ""}`}>
              {featured && <span className="plan2__ribbon badge badge--attention badge--lg">وفّر شهرين ({yearlySaving(monthly, yearly)} د.أ)</span>}
              <div>
                <h3>{plan === "monthly" ? "شهري" : "سنوي"}</h3>
                <span className="caption">{plan === "monthly" ? "مرونة كاملة" : `يعني ${formatMoneyNumber(String(price / 12))} د.أ بالشهر`}</span>
              </div>
              <div className="plan2__price">
                <bdi>{price}</bdi> <small>{plan === "monthly" ? "د.أ بالشهر" : "د.أ بالسنة"}</small>
              </div>
              <ul>
                {FEATURES.map((x) => (
                  <li key={x}>
                    <Icon name="circle-check" size={16} /> {x}
                  </li>
                ))}
              </ul>
              <Button variant={featured ? "accent" : "outline"} size="lg" disabled={Boolean(pending)} onClick={() => setPaying(plan)}>
                {pending ? "بانتظار مراجعة الدفعة" : `ادفع بكليك: ${plan === "monthly" ? "شهري" : "سنوي"}`}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="table-wrap" style={{ marginTop: 20 }}>
        <div className="toolbar">
          <h3>سجل الاشتراك</h3>
        </div>
        {data.periods.length === 0 ? (
          <div className="empty">
            <div style={{ width: 140 }}>
              <Illustration kind="parcel" />
            </div>
            <div className="empty__title">لسا ما في اشتراكات</div>
            <p className="muted">أول ما تتفعّل خطتك بتطلع هون.</p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>الخطة</th>
                <th>من</th>
                <th>لحد</th>
                <th>المبلغ</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {data.periods.map((p) => (
                <tr key={p.id}>
                  <td>{PLAN_LABEL[p.plan]}</td>
                  <td>{dateLabel(p.startsOn)}</td>
                  <td>{dateLabel(p.endsOn)}</td>
                  <td>
                    <Money value={p.amount} />
                  </td>
                  <td>{p.cancelled ? <Badge tone="danger">ملغية</Badge> : <Badge tone="success">مفعّلة</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {paying && <PayDrawer open onClose={() => setPaying(null)} plan={paying} data={data} />}
    </>
  );
}
