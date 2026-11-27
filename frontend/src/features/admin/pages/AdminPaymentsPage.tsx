import { useRef, useState } from "react";
import { Link } from "react-router";
import { PLAN_LABEL } from "@/features/subscription";
import { ApiError, errorMessage } from "@/services/api/apiClient";
import { formatMoneyNumber } from "@/shared/lib/money";
import { useActionKey } from "@/shared/lib/useActionKey";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Chip } from "@/shared/ui/Chip";
import { useConfirm } from "@/shared/ui/confirm/ConfirmProvider";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { Money } from "@/shared/ui/Money";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { usePaymentDecision, usePayments, type AdminPayment } from "../api/adminApi";
import { ProofViewer } from "../components/ProofViewer";
import s from "../admin.module.css";

const FILTERS = [
  { code: "pending", label: "بانتظارك" },
  { code: "approved", label: "مقبولة" },
  { code: "rejected", label: "مرفوضة" },
  { code: "", label: "الكل" },
];

const when = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Amman" });

/** The payments queue (D-163): check the proof against the CliQ transfer, then approve or reject with a reason. */
export function AdminPaymentsPage() {
  const [status, setStatus] = useState("pending");
  const query = usePayments(status);

  return (
    <>
      <PageHeader title="الدفعات" subtitle="طابِق صورة التحويل مع حسابك على كليك قبل الموافقة" />
      <div className="row wrap" style={{ gap: 6 }} role="group" aria-label="الحالة">
        {FILTERS.map((f) => (
          <Chip key={f.code} selected={status === f.code} onClick={() => setStatus(f.code)}>
            {f.label}
          </Chip>
        ))}
      </div>
      {query.error ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <PageSkeleton />
      ) : query.data.length === 0 ? (
        <div className="card empty">
          <div className="empty__title">{status === "pending" ? "ما في دفعات بانتظارك 🎉" : "ما في دفعات هون"}</div>
        </div>
      ) : (
        <div className={s.payGrid}>
          {query.data.map((p) => (
            <PaymentCard key={p.id} payment={p} />
          ))}
        </div>
      )}
    </>
  );
}

function PaymentCard({ payment: p }: { payment: AdminPayment }) {
  const decide = usePaymentDecision();
  const confirm = useConfirm();
  const toast = useToast();
  const key = useActionKey();
  const reasonRef = useRef(""); // the dialog content keeps its own state; the latest reason is read on confirm

  const approve = () =>
    void confirm({
      title: "الموافقة على الدفعة",
      message: `بتتفعّل ${PLAN_LABEL[p.plan]} لـ«${p.businessName}» بعد التجربة أو الخطة الشغالة، وبيوصله إيميل.`,
      subject: `${p.referenceCode ?? ""} · ${formatMoneyNumber(p.amount)} د.أ`,
      tone: "neutral",
      icon: "check",
      confirmLabel: "وافق وفعّل",
      action: async () => {
        await decide.mutateAsync({ id: p.id, approve: true, key: key.keyFor({ approve: p.id }) });
        key.done();
        toast("تفعّلت الخطة", { type: "success" });
      },
    });

  const reject = () =>
    void confirm({
      title: "رفض الدفعة",
      message: "السبب بيوصل للمشترك بالإيميل وبيشوفه بصفحة الاشتراك.",
      subject: p.businessName,
      tone: "danger",
      icon: "x",
      content: <RejectReason onChange={(v) => (reasonRef.current = v)} />,
      confirmLabel: "ارفض",
      action: async () => {
        if (!reasonRef.current.trim()) throw new ApiError(422, "validation.failed", "اكتب سبب الرفض عشان يوصل للمشترك.");
        await decide.mutateAsync({ id: p.id, approve: false, reason: reasonRef.current.trim(), key: key.keyFor({ reject: p.id, reason: reasonRef.current.trim() }) });
        key.done();
        toast("انرفضت الدفعة", { type: "success" });
      },
    });

  return (
    <article className={s.payCard}>
      <div className={s.payTop}>
        <span>
          <Link to={`/admin/subscribers/${p.businessId}`}>
            <b>{p.businessName}</b>
          </Link>
          <small className="muted">{p.ownerName}</small>
        </span>
        <Badge tone={p.status === "approved" ? "success" : p.status === "rejected" ? "danger" : "attention"}>
          {p.status === "approved" ? "مقبولة" : p.status === "rejected" ? "مرفوضة" : "بانتظارك"}
        </Badge>
      </div>
      <div className="row between">
        <span>{PLAN_LABEL[p.plan]}</span>
        <b>
          <Money value={p.amount} />
        </b>
      </div>
      <div className="row between caption">
        <span>
          المرجع <b className="ltr">{p.referenceCode ?? "—"}</b>
        </span>
        <span>{when.format(new Date(p.submittedAt))}</span>
      </div>
      <ProofViewer paymentId={p.id} contentType={p.proofContentType} />
      {p.rejectReason && <p className="caption">السبب: {p.rejectReason}</p>}
      {p.status === "pending" && (
        <div className="row" style={{ gap: 8 }}>
          <Button block icon="check" onClick={approve}>
            وافق
          </Button>
          <Button block variant="outline" icon="x" onClick={reject}>
            ارفض
          </Button>
        </div>
      )}
    </article>
  );
}

function RejectReason({ onChange }: { onChange: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="field">
      <label className="field__label" htmlFor="reject-reason">
        سبب الرفض
      </label>
      <span className="control control--textarea">
        <textarea
          id="reject-reason"
          rows={3}
          maxLength={300}
          value={v}
          placeholder="مثلًا: التحويل ما وصل، أو المبلغ ناقص"
          onChange={(e) => {
            setV(e.target.value);
            onChange(e.target.value);
          }}
        />
      </span>
    </div>
  );
}
