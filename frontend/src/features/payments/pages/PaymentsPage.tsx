import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { errorMessage } from "@/services/api/apiClient";
import { toFils } from "@/shared/lib/money";
import { Button } from "@/shared/ui/Button";
import { Chip } from "@/shared/ui/Chip";
import { EmptyState } from "@/shared/ui/feedback/EmptyState";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { Icon } from "@/shared/ui/Icon";
import { Money } from "@/shared/ui/Money";
import { PageHeader } from "@/shared/ui/PageHeader";
import { usePayments, useReceivables, useReceivablesAging, type AgingBucket, type Receivable } from "../api/paymentsApi";
import { PaymentBadge } from "../components/PaymentBadge";
import { PaymentsTable } from "../components/PaymentsTable";
import { RecordPaymentDrawer, type PaymentTarget } from "../components/RecordPaymentDrawer";
import { AGING_BUCKETS, ageLabel, agingShares, bucketInfo } from "../domain/paymentDomain";

const PAGE_SIZE = 20;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav className="row" style={{ justifyContent: "center", gap: 12, marginTop: 16 }} aria-label="الصفحات">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        السابق
      </Button>
      <span className="caption">
        صفحة <bdi>{page}</bdi> من <bdi>{pages}</bdi>
      </span>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        التالي
      </Button>
    </nav>
  );
}

function DueCard({ r, index, onPay }: { r: Receivable; index: number; onPay: () => void }) {
  return (
    <div className="duecard" style={{ ["--i" as string]: index }}>
      <span className="avatar avatar--lg">{initials(r.customerName)}</span>
      <div>
        <Link to={`/customers/${r.customerId}`} style={{ color: "inherit" }}>
          <b>{r.customerName}</b>
        </Link>{" "}
        ·{" "}
        <Link className="ltr" to={`/orders/${r.orderId}`}>
          #{r.number}
        </Link>
        <div className="caption row" style={{ gap: 6, marginTop: 2 }}>
          <PaymentBadge status={r.paymentStatus} />
          <span className={`age ${bucketInfo(r.bucket).ageClass}`}>
            <Icon name="clock" size={16} /> {ageLabel(r.ageDays)}
          </span>
        </div>
      </div>
      <span className="caption">
        من <Money value={r.total} />
      </span>
      <div className="row" style={{ gap: 10 }}>
        <Money value={r.remaining} tone="neg" />
        <Button size="sm" onClick={onPay}>
          دفعة
        </Button>
      </div>
    </div>
  );
}

/** Payments & receivables (prototype `#/finance/payments`): aging (D-038), receivables due, received payments. */
export function PaymentsPage() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<"due" | "received">("due");
  const [bucket, setBucket] = useState<AgingBucket | undefined>();
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [duePage, setDuePage] = useState(1);
  const [paidPage, setPaidPage] = useState(1);
  const [target, setTarget] = useState<PaymentTarget | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(searchText.trim());
      setDuePage(1);
    }, 250);
    return () => window.clearTimeout(id);
  }, [searchText]);

  // «دفعة» from the quick actions opens the drawer in pick mode (/finance/payments?pay=1).
  const fromLink = params.has("pay");
  const activeTarget: PaymentTarget | null = target ?? (fromLink ? { kind: "pick" } : null);
  const closeDrawer = () => {
    setTarget(null);
    if (fromLink) setParams({}, { replace: true });
  };

  const aging = useReceivablesAging();
  const due = useReceivables({ search: search || undefined, bucket, page: duePage, pageSize: PAGE_SIZE });
  const received = usePayments({ page: paidPage, pageSize: PAGE_SIZE });

  const a = aging.data;
  const header = (
    <PageHeader
      title="المدفوعات والذمم"
      subtitle="مين عليه مصاري، ومن قديش"
      crumbs={
        <>
          <Link to="/finance">المالية</Link> / المدفوعات
        </>
      }
      actions={
        <Button icon="cash" onClick={() => setTarget({ kind: "pick" })}>
          تسجيل دفعة
        </Button>
      }
    />
  );
  const drawer = <RecordPaymentDrawer open={activeTarget !== null} target={activeTarget} onClose={closeDrawer} />;

  if (aging.error || due.error || received.error) {
    return (
      <>
        {header}
        <ErrorState message={errorMessage(aging.error ?? due.error ?? received.error)} onRetry={() => void Promise.all([aging.refetch(), due.refetch(), received.refetch()])} />
      </>
    );
  }

  if (!a || !due.data || !received.data) {
    return (
      <>
        {header}
        <PageSkeleton />
      </>
    );
  }

  const buckets = AGING_BUCKETS.map((b) => ({ ...b, value: a[b.code] }));
  const shares = agingShares(buckets.map((b) => b.value.amount));
  const duePages = Math.max(1, Math.ceil(due.data.totalCount / PAGE_SIZE));
  const paidPages = Math.max(1, Math.ceil(received.data.totalCount / PAGE_SIZE));

  return (
    <>
      {header}
      <article className="card">
        <div className="shead">
          <div className="shead__t">
            <span className="overline">عمر الذمم</span>
            <h2>
              <Money value={a.total} /> مستحقة
            </h2>
          </div>
          <span className="caption">
            {a.count} طلب · {a.customerCount} عميل
          </span>
        </div>
        <div className="agebar" role="img" aria-label="توزيع الذمم حسب العمر">
          {buckets.map((b, i) => (
            <span key={b.code} style={{ width: `${shares[i]}%`, background: b.color, animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
        <div className="row wrap" style={{ gap: 18, marginTop: 12 }}>
          {buckets.map((b) => (
            <span key={b.code} className="legend">
              <span>
                <i style={{ background: b.color }} />
                {b.label} · <Money value={b.value.amount} />
              </span>
            </span>
          ))}
        </div>
        {toFils(a.courierHeld) > 0 && (
          <p className="caption" style={{ marginTop: 10 }}>
            <Icon name="truck" size={16} /> وعند شركة التوصيل <Money value={a.courierHeld} /> ({a.courierHeldCount} طلب عند الاستلام)، بتنسجّل مع التسوية.
          </p>
        )}
      </article>
      <div className="tabs" role="tablist" style={{ marginTop: 16 }}>
        <button type="button" role="tab" aria-selected={tab === "due"} className={`tab${tab === "due" ? " is-active" : ""}`} onClick={() => setTab("due")}>
          الذمم المستحقة <span className="num">{a.count}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "received"} className={`tab${tab === "received" ? " is-active" : ""}`} onClick={() => setTab("received")}>
          الدفعات المستلمة <span className="num">{received.data.totalCount}</span>
        </button>
      </div>
      {tab === "due" ? (
        <section>
          <div className="toolbar" style={{ padding: "12px 0" }}>
            <span className="control control--search" style={{ height: 40, width: "min(300px, 100%)" }}>
              <Icon name="search" />
              <input placeholder="اسم العميل أو رقمه أو رقم الطلب" aria-label="ابحث عن ذمة" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
            </span>
            <div className="row wrap" style={{ gap: 6 }} role="group" aria-label="عمر الذمة">
              <Chip selected={!bucket} onClick={() => { setBucket(undefined); setDuePage(1); }}>
                الكل
              </Chip>
              {AGING_BUCKETS.map((b) => (
                <Chip key={b.code} selected={bucket === b.code} onClick={() => { setBucket(b.code); setDuePage(1); }}>
                  {b.label}
                </Chip>
              ))}
            </div>
          </div>
          {due.data.items.length === 0 ? (
            a.count === 0 ? (
              <EmptyState title="ما في ذمم" text="كل الزباين دافعين، كل شي بمكانه." />
            ) : (
              <EmptyState title="ما في ذمم هون" text="جرّب تغيّر الفلتر أو البحث." />
            )
          ) : (
            due.data.items.map((r, i) => (
              <DueCard
                key={r.orderId}
                r={r}
                index={i}
                onPay={() => setTarget({ kind: "order", orderId: r.orderId, number: r.number, customerName: r.customerName, remaining: r.remaining, paymentStatus: r.paymentStatus })}
              />
            ))
          )}
          <Pager page={duePage} pages={duePages} onPage={setDuePage} />
        </section>
      ) : (
        <section style={{ marginTop: 12 }}>
          {received.data.items.length === 0 ? (
            <EmptyState title="لسا ما في دفعات" text="سجّل أول دفعة من صفحة الطلب أو من هون." />
          ) : (
            <PaymentsTable payments={received.data.items} />
          )}
          <Pager page={paidPage} pages={paidPages} onPage={setPaidPage} />
        </section>
      )}
      {drawer}
    </>
  );
}
