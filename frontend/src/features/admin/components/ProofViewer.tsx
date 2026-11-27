import { useEffect, useState } from "react";
import { Icon } from "@/shared/ui/Icon";
import { proofBlob } from "../api/adminApi";
import s from "../admin.module.css";

/** The private proof file (D-178): fetched with the session, shown from an object URL; images open full screen. */
export function ProofViewer({ paymentId, contentType }: { paymentId: string; contentType: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    proofBlob(paymentId)
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [paymentId]);

  // The full-screen image closes with Escape too.
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  if (failed) return <p className="muted">ما قدرنا نفتح ملف الإثبات.</p>;
  if (!url) return <div className={s.proof} aria-busy="true" />;

  if (contentType === "application/pdf") {
    return (
      <a className="btn btn--outline" href={url} target="_blank" rel="noreferrer">
        <Icon name="receipt" size={16} /> افتح ملف PDF
      </a>
    );
  }

  return (
    <>
      <button type="button" className={s.proof} onClick={() => setFull(true)} aria-label="كبّر صورة التحويل">
        <img src={url} alt="صورة التحويل" />
      </button>
      {full && (
        <button type="button" className={s.proofFull} onClick={() => setFull(false)} aria-label="سكّر الصورة" autoFocus>
          <img src={url} alt="صورة التحويل" />
        </button>
      )}
    </>
  );
}
