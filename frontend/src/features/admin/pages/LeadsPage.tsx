import { useState } from "react";
import { useSearchParams } from "react-router";
import { errorMessage } from "@/services/api/apiClient";
import { useActionKey } from "@/shared/lib/useActionKey";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Chip } from "@/shared/ui/Chip";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { TextField } from "@/shared/ui/form/TextField";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { useLeads, useResendInvite, type Lead } from "../api/adminApi";
import { localPhone, sinceLabel, timesText, whatsappLink } from "../domain/adminDomain";
import s from "../admin.module.css";

const FILTERS = [
  { code: "pending", label: "ما كمّلوا" },
  { code: "registered", label: "سجّلوا" },
  { code: "", label: "الكل" },
];

/** Sign-ups from the landing form (D-161): who has not finished, with a resend and a WhatsApp link to follow up. */
export function LeadsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "pending";
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(1);
  const query = useLeads(applied, status, page);

  return (
    <>
      <PageHeader title="المسجّلين" subtitle="اللي عبّوا النموذج بالصفحة التعريفية" />
      <div className={s.filters}>
        <form
          className={s.search}
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setApplied(search.trim());
          }}
        >
          <TextField label="بحث" icon="search" placeholder="الاسم، الإيميل، الرقم أو المتجر" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        <div className="row wrap" style={{ gap: 6 }} role="group" aria-label="الحالة">
          {FILTERS.map((f) => (
            <Chip
              key={f.code}
              selected={status === f.code}
              onClick={() => {
                setPage(1);
                setParams(f.code ? { status: f.code } : { status: "" }, { replace: true });
              }}
            >
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
                <th>الاسم</th>
                <th>التواصل</th>
                <th>المصدر</th>
                <th>الحالة</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {query.data.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: "center", padding: 28 }}>
                    ما في حدا هون.
                  </td>
                </tr>
              )}
              {query.data.items.map((l) => (
                <LeadRow key={l.id} lead={l} />
              ))}
            </tbody>
          </table>
          <div className={s.pager}>
            <span>{query.data.totalCount} شخص</span>
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

function LeadRow({ lead: l }: { lead: Lead }) {
  const resend = useResendInvite();
  const toast = useToast();
  const key = useActionKey();
  const wa = whatsappLink(l.phoneE164);
  return (
    <tr>
      <td className={s.who}>
        <b>{l.fullName}</b>
        <small>{l.storeName ?? "—"}</small>
      </td>
      <td className={s.who}>
        <b className="ltr">{localPhone(l.phoneE164)}</b>
        <small className="ltr">{l.email}</small>
      </td>
      <td className="muted">{l.utmSource ?? "مباشر"}</td>
      <td>
        {l.status === "registered" ? <Badge tone="success">سجّل</Badge> : <Badge tone="attention">ما كمّل</Badge>}
        <br />
        <small className="muted">
          {l.status === "registered" ? `سجّل ${sinceLabel(l.registeredAt)}` : `آخر رابط ${sinceLabel(l.lastSentAt)} · انبعت ${timesText(l.sendCount)}`}
        </small>
      </td>
      <td>
        <span className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
          {wa && (
            <a className="btn btn--sm btn--ghost" href={wa} target="_blank" rel="noreferrer">
              واتساب
            </a>
          )}
          {l.status === "pending" && (
            <Button
              size="sm"
              variant="outline"
              loading={resend.isPending}
              onClick={() =>
                resend.mutate(
                  { id: l.id, key: key.keyFor({ resend: l.id }) },
                  {
                    onSuccess: () => {
                      key.done();
                      toast(`انبعت رابط جديد لـ${l.fullName}`, { type: "success" });
                    },
                    onError: (e) => toast(errorMessage(e), { type: "error" }),
                  },
                )
              }
            >
              ابعت الرابط
            </Button>
          )}
        </span>
      </td>
    </tr>
  );
}
