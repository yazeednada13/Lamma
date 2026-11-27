import { useState } from "react";
import { Link, useParams } from "react-router";
import { dateLabel, PLAN_LABEL, STATUS_LABEL, STATUS_TONE, statusDetail } from "@/features/subscription";
import { errorMessage } from "@/services/api/apiClient";
import { useActionKey } from "@/shared/lib/useActionKey";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { useConfirm } from "@/shared/ui/confirm/ConfirmProvider";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { Money } from "@/shared/ui/Money";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { useSubscriber, useSubscriberAction, type SubscriberAction } from "../api/adminApi";
import { ActionDrawer, type DrawerKind } from "../components/ActionDrawer";
import { actionLabel, auditSummary, localPhone, sinceLabel, whatsappLink } from "../domain/adminDomain";
import s from "../admin.module.css";

const when = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Amman" });

/** One subscriber (D-164, P-025): account and billing metadata, counts only, every admin action. */
export function SubscriberPage() {
  const { businessId = "" } = useParams();
  const query = useSubscriber(businessId);
  const action = useSubscriberAction(businessId);
  const confirm = useConfirm();
  const toast = useToast();
  const key = useActionKey();
  const [drawer, setDrawer] = useState<DrawerKind | null>(null);
  const crumbs = (
    <>
      <Link to="/admin/subscribers">المشتركين</Link> / التفاصيل
    </>
  );

  if (query.error) {
    return (
      <>
        <PageHeader title="المشترك" crumbs={crumbs} />
        <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      </>
    );
  }

  const d = query.data;
  if (!d) {
    return (
      <>
        <PageHeader title="المشترك" crumbs={crumbs} />
        <PageSkeleton />
      </>
    );
  }

  const r = d.row;
  const st = r.subscription;
  const wa = whatsappLink(r.ownerPhone);

  const run = (a: SubscriberAction, title: string, message: string, done: string, tone: "danger" | "warning" | "neutral" = "warning") =>
    void confirm({
      title,
      message,
      subject: r.businessName,
      tone,
      confirmLabel: title,
      action: async () => {
        await action.mutateAsync({ action: a, key: key.keyFor(a) });
        key.done();
        toast(done, { type: "success" });
      },
    });

  return (
    <div className={s.detail}>
      <PageHeader title={r.businessName} subtitle={r.ownerName} crumbs={crumbs} />

      <section className={s.headCard}>
        <div className="row wrap" style={{ gap: 10, alignItems: "center" }}>
          <Badge tone={STATUS_TONE[st.status]} dot large>
            {STATUS_LABEL[st.status]}
          </Badge>
          <p>{statusDetail(st)}</p>
        </div>
        {d.suspendReason && <p>سبب الإيقاف: {d.suspendReason}</p>}
        <div className={s.facts}>
          <div className={s.fact}>
            <small>الموبايل</small>
            <b className="ltr">{localPhone(r.ownerPhone)}</b>
          </div>
          <div className={s.fact}>
            <small>الإيميل</small>
            <b className="ltr" style={{ overflowWrap: "anywhere" }}>
              {r.ownerEmail}
            </b>
          </div>
          <div className={s.fact}>
            <small>الرقم المرجعي</small>
            <b className="ltr">{d.referenceCode ?? "—"}</b>
          </div>
          <div className={s.fact}>
            <small>آخر دخول</small>
            <b>{sinceLabel(r.lastLoginAt)}</b>
          </div>
          <div className={s.fact}>
            <small>التجربة</small>
            <b>
              {dateLabel(d.trialStartsAt.slice(0, 10))} ← {dateLabel(d.trialEndsAt.slice(0, 10))}
            </b>
          </div>
          <div className={s.fact}>
            <small>الطلبات / المنتجات</small>
            <b>
              {d.ordersCount} / {d.productsCount}
            </b>
          </div>
        </div>
        <div className={s.actions}>
          <Button variant="accent" icon="credit-card" onClick={() => setDrawer("activate")}>
            تفعيل خطة
          </Button>
          <Button variant="outline" icon="clock" onClick={() => setDrawer("extend-trial")}>
            تمديد التجربة
          </Button>
          <Button variant="outline" icon="plus" onClick={() => setDrawer("extend")}>
            تمديد الخطة
          </Button>
          <Button
            variant="outline"
            icon="x"
            onClick={() => run({ kind: "end-plan" }, "إنهاء الخطة", "الخطة الشغالة (أو الجاية) بتنلغى وبتضل بالسجل. إذا ما في خطة ثانية، الحساب بيصير للقراءة فقط بعد السماح.", "انتهت الخطة", "danger")}
          >
            إنهاء الخطة
          </Button>
          {st.status === "suspended" ? (
            <Button
              variant="outline"
              icon="check"
              onClick={() => run({ kind: "reactivate" }, "إرجاع الحساب", "الحساب برجع لحالته حسب التجربة أو الخطة.", "رجع الحساب", "neutral")}
            >
              إرجاع الحساب
            </Button>
          ) : (
            <Button variant="danger" icon="lock" onClick={() => setDrawer("suspend")}>
              إيقاف
            </Button>
          )}
          {wa && (
            <a className="btn btn--outline" href={wa} target="_blank" rel="noreferrer">
              واتساب
            </a>
          )}
        </div>
      </section>

      <div className={s.cols}>
        <div className="col" style={{ gap: 16 }}>
          <div className="table-wrap">
            <div className="toolbar">
              <h3>فترات الاشتراك</h3>
            </div>
            {d.periods.length === 0 ? (
              <p className="muted" style={{ padding: 16 }}>
                لسا ما في فترات مدفوعة.
              </p>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>الخطة</th>
                    <th>من</th>
                    <th>لحد</th>
                    <th>المبلغ</th>
                    <th>المصدر</th>
                  </tr>
                </thead>
                <tbody>
                  {d.periods.map((p) => (
                    <tr key={p.id} style={p.cancelled ? { opacity: 0.55 } : undefined}>
                      <td>
                        {PLAN_LABEL[p.plan]} {p.cancelled && <Badge tone="danger">ملغية</Badge>}
                      </td>
                      <td>{dateLabel(p.startsOn)}</td>
                      <td>{dateLabel(p.endsOn)}</td>
                      <td>
                        <Money value={p.amount} />
                      </td>
                      <td>{p.source === "payment" ? "دفعة كليك" : "يدوي"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="table-wrap">
            <div className="toolbar">
              <h3>الدفعات</h3>
              <Link to="/admin/payments" style={{ marginInlineStart: "auto" }}>
                طابور الدفعات
              </Link>
            </div>
            {d.payments.length === 0 ? (
              <p className="muted" style={{ padding: 16 }}>
                ما بعت ولا دفعة لسا.
              </p>
            ) : (
              <table className="tbl">
                <tbody>
                  {d.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{PLAN_LABEL[p.plan]}</td>
                      <td>
                        <Money value={p.amount} />
                      </td>
                      <td>{when.format(new Date(p.submittedAt))}</td>
                      <td>
                        <Badge tone={p.status === "approved" ? "success" : p.status === "rejected" ? "danger" : "attention"}>
                          {p.status === "approved" ? "مقبولة" : p.status === "rejected" ? "مرفوضة" : "بانتظارك"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <article className="card">
            <div className="shead">
              <div className="shead__t">
                <h2>ملاحظات</h2>
              </div>
              <Button size="sm" variant="outline" icon="plus" onClick={() => setDrawer("notes")}>
                ملاحظة
              </Button>
            </div>
            {d.notes.length === 0 ? (
              <p className="muted">ما في ملاحظات.</p>
            ) : (
              <ul className={s.timeline}>
                {d.notes.map((n) => (
                  <li key={n.id}>
                    <i />
                    <span>
                      {n.details}
                      <br />
                      <small>{when.format(new Date(n.at))}</small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
          <article className="card">
            <div className="shead">
              <div className="shead__t">
                <span className="overline">كل إجراء بيتسجّل</span>
                <h2>سجل العمليات</h2>
              </div>
            </div>
            {d.audit.length === 0 ? (
              <p className="muted">ما في عمليات لسا.</p>
            ) : (
              <ul className={s.timeline}>
                {d.audit.map((a) => (
                  <li key={a.id}>
                    <i />
                    <span>
                      <b>{actionLabel(a.action)}</b> {auditSummary(a.action, a.details)}
                      <br />
                      <small>{when.format(new Date(a.at))}</small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </div>

      {drawer && <ActionDrawer kind={drawer} businessId={businessId} onClose={() => setDrawer(null)} />}
    </div>
  );
}
