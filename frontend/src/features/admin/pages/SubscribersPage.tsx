import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { STATUS_LABEL, STATUS_TONE, statusDetail } from "@/features/subscription";
import { errorMessage } from "@/services/api/apiClient";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Chip } from "@/shared/ui/Chip";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { TextField } from "@/shared/ui/form/TextField";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useSubscribers } from "../api/adminApi";
import { localPhone, sinceLabel } from "../domain/adminDomain";
import s from "../admin.module.css";

const FILTERS: { code: string; label: string }[] = [
  { code: "", label: "الكل" },
  { code: "trial", label: "تجربة" },
  { code: "active", label: "مشتركين" },
  { code: "read_only", label: "للقراءة فقط" },
  { code: "trial_grace", label: "سماح بعد التجربة" },
  { code: "active_grace", label: "سماح بعد الاشتراك" },
  { code: "suspended", label: "موقوفين" },
];

/** Subscribers (D-164): search by store, owner, email or mobile; filter by status; pending payments first. */
export function SubscribersPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [page, setPage] = useState(1);
  const query = useSubscribers(params.get("search") ?? "", status, page);

  const apply = (next: { search?: string; status?: string }) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }

    setPage(1);
    setParams(p, { replace: true });
  };

  return (
    <>
      <PageHeader title="المشتركين" subtitle="كل المتاجر وحالة اشتراكها" />
      <div className={s.filters}>
        <form
          className={s.search}
          onSubmit={(e) => {
            e.preventDefault();
            apply({ search: search.trim() });
          }}
        >
          <TextField label="بحث" icon="search" placeholder="اسم المتجر، الاسم، الإيميل أو الرقم" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        <div className="row wrap" style={{ gap: 6 }} role="group" aria-label="الحالة">
          {FILTERS.map((f) => (
            <Chip key={f.code} selected={status === f.code} onClick={() => apply({ status: f.code })}>
              {f.label}
            </Chip>
          ))}
        </div>
      </div>

      {query.error ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <PageSkeleton />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>المتجر</th>
                <th>التواصل</th>
                <th>الحالة</th>
                <th>آخر دخول</th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted" style={{ textAlign: "center", padding: 28 }}>
                    ما في مشتركين بهالبحث.
                  </td>
                </tr>
              )}
              {query.data.items.map((r) => (
                <tr
                  key={r.businessId}
                  className={s.rowLink}
                  tabIndex={0}
                  onClick={() => navigate(`/admin/subscribers/${r.businessId}`)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/admin/subscribers/${r.businessId}`)}
                >
                  <td className={s.who}>
                    <b>{r.businessName}</b>
                    <small>{r.ownerName}</small>
                    {r.hasPendingPayment && (
                      <span style={{ marginInlineStart: 6 }}>
                        <Badge tone="attention">دفعة بانتظارك</Badge>
                      </span>
                    )}
                  </td>
                  <td className={s.who}>
                    <b className="ltr">{localPhone(r.ownerPhone)}</b>
                    <small className="ltr">{r.ownerEmail}</small>
                  </td>
                  <td>
                    <Badge tone={STATUS_TONE[r.subscription.status]} dot>
                      {STATUS_LABEL[r.subscription.status]}
                    </Badge>
                    <br />
                    <small className="muted">{statusDetail(r.subscription)}</small>
                  </td>
                  <td className="muted">{sinceLabel(r.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={s.pager}>
            <span>
              {query.data.totalCount} مشترك · صفحة {query.data.page}
            </span>
            <span className="row" style={{ gap: 6 }}>
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                السابق
              </Button>
              <Button size="sm" variant="outline" disabled={page * query.data.pageSize >= query.data.totalCount} onClick={() => setPage((p) => p + 1)}>
                التالي
              </Button>
            </span>
          </div>
        </div>
      )}
    </>
  );
}
