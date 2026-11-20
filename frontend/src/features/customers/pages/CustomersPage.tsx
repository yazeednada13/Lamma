import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { channelIcon } from "@/features/settings";
import { errorMessage } from "@/services/api/apiClient";
import { formatMoneyNumber, toFils } from "@/shared/lib/money";
import { Button } from "@/shared/ui/Button";
import { EmptyState } from "@/shared/ui/feedback/EmptyState";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { Icon } from "@/shared/ui/Icon";
import { MetricCard } from "@/shared/ui/MetricCard";
import { Money } from "@/shared/ui/Money";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { useCustomers, useCustomersSummary, type SegmentCode } from "../api/customersApi";
import { CustomerAvatar, SegmentTags } from "../components/CustomerBits";
import { CustomerFormDrawer } from "../components/CustomerFormDrawer";
import { placeLabel, SEGMENTS } from "../domain/customerDomain";

const PAGE_SIZE = 30;
const date = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { day: "numeric", month: "long", timeZone: "UTC" });

/** Customers (prototype `#/customers`): metrics, top customers, segment rail, search, table. `/customers/new` opens quick add. */
export function CustomersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const adding = location.pathname === "/customers/new";
  const [segment, setSegment] = useState<SegmentCode | undefined>();
  const [archived, setArchived] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const summary = useCustomersSummary();
  const list = useCustomers({ search: search || undefined, segment, archived, page, pageSize: PAGE_SIZE });
  const top = useCustomers({ pageSize: 3 });

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchText.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchText]);

  const s = summary.data;
  const pages = list.data ? Math.max(1, Math.ceil(list.data.totalCount / PAGE_SIZE)) : 1;
  const maxOrders = Math.max(1, ...(list.data?.items.map((c) => c.orderCount) ?? [1]));
  const topCustomers = (top.data?.items ?? []).filter((c) => toFils(c.totalSpent) > 0);
  const choose = (next: SegmentCode | undefined, showArchived = false) => {
    setSegment(next);
    setArchived(showArchived);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="العملاء"
        subtitle={s ? `${s.total} عميل · ${s.activeThisMonth} اشتروا هالشهر` : undefined}
        actions={
          <Button icon="plus" onClick={() => navigate("/customers/new")}>
            عميل
          </Button>
        }
      />
      {summary.error || list.error ? (
        <ErrorState message={errorMessage(summary.error ?? list.error)} onRetry={() => void Promise.all([summary.refetch(), list.refetch()])} />
      ) : !s || !list.data ? (
        <PageSkeleton />
      ) : s.total === 0 && !archived ? (
        <EmptyState title="لسا ما أضفت عملاء" text="أضف عملاءك عشان تتابع طلباتهم وذممهم من مكان واحد.">
          <Button icon="plus" onClick={() => navigate("/customers/new")}>
            أضف عميل
          </Button>
        </EmptyState>
      ) : (
        <>
          <div className="grid g-3">
            <MetricCard icon="users" tone="olive" label="كل العملاء" value={s.total} foot={`${s.activeThisMonth} نشطين هالشهر`} />
            <MetricCard icon="cash" tone="green" label="متوسط شراء العميل" value={formatMoneyNumber(s.averageSpent)} unit="د.أ" />
            <MetricCard icon="wallet" tone="brick" label="ذمم على العملاء" value={formatMoneyNumber(s.totalDue)} unit="د.أ" foot={`${s.customersWithDue} عملاء`} />
          </div>
          {topCustomers.length > 0 && (
            <>
              <div className="shead" style={{ margin: 0 }}>
                <div className="shead__t">
                  <span className="overline">حسب الشراء</span>
                  <h2>أهم الزباين</h2>
                </div>
              </div>
              <div className="customers-strip stagger">
                {topCustomers.map((c, i) => (
                  <a key={c.id} className="ccard" href={`/customers/${c.id}`} onClick={(e) => { e.preventDefault(); navigate(`/customers/${c.id}`); }} style={{ ["--i" as string]: i }}>
                    <div className="ccard__top">
                      <CustomerAvatar name={c.name} percent={(c.orderCount / maxOrders) * 100} />
                      <div className="grow">
                        <b style={{ font: "var(--lamma-type-body-strong)" }}>{c.name}</b>
                        <div className="caption row" style={{ gap: 6 }}>
                          <Icon name={channelIcon[c.channel]} size={16} />
                          {placeLabel(c.city, c.area)}
                        </div>
                      </div>
                    </div>
                    <div className="ccard__stats">
                      <div><b>{c.orderCount}</b><span>طلبات</span></div>
                      <div><b><bdi>{formatMoneyNumber(c.totalSpent)}</bdi></b><span>د.أ شراء</span></div>
                      <div><b>{c.lastOrderOn ? date.format(new Date(`${c.lastOrderOn}T00:00:00Z`)) : "—"}</b><span>آخر طلب</span></div>
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}
          <div className="srail" role="group" aria-label="الفئات">
            <button type="button" className={`sopt sopt--all${!segment && !archived ? " is-active" : ""}`} onClick={() => choose(undefined)}>
              <i />الكل <b>{s.total}</b>
            </button>
            {SEGMENTS.map((seg) => (
              <button
                key={seg.code}
                type="button"
                className={`sopt${segment === seg.code ? " is-active" : ""}`}
                style={{ ["--edge" as string]: seg.edge, ["--edge-bg" as string]: seg.edgeBg }}
                onClick={() => choose(seg.code)}
              >
                <i />
                {seg.label} <b>{s.segments[seg.code]}</b>
              </button>
            ))}
            <button type="button" className={`sopt${archived ? " is-active" : ""}`} onClick={() => choose(undefined, true)}>
              <i />المؤرشفين
            </button>
          </div>
          <div className="table-wrap">
            <div className="toolbar">
              <span className="control control--search" style={{ height: 40, width: "min(300px, 100%)" }}>
                <Icon name="search" />
                <input placeholder="الاسم أو الرقم" aria-label="ابحث بالاسم أو الرقم" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
              </span>
            </div>
            {list.data.items.length === 0 ? (
              <p className="muted" style={{ padding: 18 }}>
                ما في عملاء هون.
              </p>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>العميل</th>
                    <th className="hide-md">وسوم</th>
                    <th>الطلبات</th>
                    <th className="num hide-sm">مجموع الشراء</th>
                    <th className="hide-sm">آخر طلب</th>
                    <th className="num">المستحق</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((c) => (
                    <tr key={c.id} onClick={() => navigate(`/customers/${c.id}`)} style={{ cursor: "pointer" }}>
                      <td>
                        <div className="row" style={{ gap: 10 }}>
                          <CustomerAvatar name={c.name} percent={c.orderCount * 5} size={40} />
                          <span>
                            <a href={`/customers/${c.id}`} onClick={(e) => { e.preventDefault(); navigate(`/customers/${c.id}`); }} style={{ color: "inherit", textDecoration: "none" }}>
                              <b>{c.name}</b>
                            </a>
                            <br />
                            <span className="caption row" style={{ gap: 4 }}>
                              <Icon name={channelIcon[c.channel]} size={16} />
                              {placeLabel(c.city, c.area) || "—"}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="hide-md">
                        <SegmentTags segments={c.segments} />
                      </td>
                      <td>{c.orderCount}</td>
                      <td className="num hide-sm">
                        <Money value={c.totalSpent} />
                      </td>
                      <td className="hide-sm">{c.lastOrderOn ? date.format(new Date(`${c.lastOrderOn}T00:00:00Z`)) : "—"}</td>
                      <td className="num">{toFils(c.balanceDue) > 0 ? <Money value={c.balanceDue} tone="neg" /> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {pages > 1 && (
            <nav className="row" style={{ justifyContent: "center", gap: 12, marginTop: 16 }} aria-label="الصفحات">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                السابق
              </Button>
              <span className="caption">
                صفحة <bdi>{page}</bdi> من <bdi>{pages}</bdi>
              </span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                التالي
              </Button>
            </nav>
          )}
        </>
      )}
      <CustomerFormDrawer
        open={adding}
        onClose={() => navigate("/customers", { replace: true })}
        onSaved={(c) => {
          toast(`انضاف «${c.name}»`);
          navigate(`/customers/${c.id}`);
        }}
      />
    </>
  );
}
