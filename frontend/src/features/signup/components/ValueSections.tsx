import { useState, type CSSProperties } from "react";
import { Icon } from "@/shared/ui/Icon";
import s from "../landing.module.css";
import { useCountUp, useInViewOnce } from "./landingHooks";

const v = (vars: Record<string, string | number>) => vars as CSSProperties;

// ---------- profit: a waterfall that grows and counts when it comes into view ----------

/** An example month (illustration only): sales → returns → cost → expenses → net. Heights are % of sales. */
const WATERFALL = [
  { label: "المبيعات", value: 1240, h: 100, b: 0, kind: "wTotal" },
  { label: "المرتجعات", value: -64, h: 5, b: 95, kind: "wOut" },
  { label: "تكلفة البضاعة", value: -610, h: 49, b: 46, kind: "wOut" },
  { label: "المصاريف", value: -180, h: 15, b: 31, kind: "wOut" },
  { label: "صافي الربح", value: 386, h: 31, b: 0, kind: "wNet" },
] as const;

export function ProfitMoment() {
  const [ref, seen] = useInViewOnce<HTMLDivElement>(0.35);
  const net = useCountUp(386, seen);
  return (
    <div ref={ref} className={s.profit}>
      <div className={s.netBox}>
        <div className={s.netLabel}>صافي ربحك هالشهر (مثال)</div>
        <div className={s.netValue}>
          {net.toLocaleString("en-US")}
          <small>د.أ</small>
        </div>
        <p style={{ margin: 0, color: "var(--sage-pale)", font: "400 15px/1.8 var(--lamma-font)" }}>
          بعت بـ <bdi>1,240</bdi> د.أ، بس اللي ضل بجيبتك بعد المرتجعات والتكلفة والإعلانات هو هاد الرقم. لمّة بتحسبه لحالها مع كل طلب بيتوصّل.
        </p>
      </div>
      <div className={`${s.wfall} ${seen ? s.wOn : ""}`} role="img" aria-label="مثال: مبيعات 1240، مرتجعات 64، تكلفة 610، مصاريف 180، صافي 386">
        {WATERFALL.map((w, i) => (
          <div key={w.label} className={s.wcol}>
            <div className={`${s.wbar} ${s[w.kind]}`} style={v({ "--h": `${w.h * 0.78}%`, "--b": `${w.b * 0.78}%`, "--i": i })}>
              <span>
                {w.value < 0 ? "−" : ""}
                {Math.abs(w.value).toLocaleString("en-US")}
              </span>
            </div>
            <label>{w.label}</label>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- three steps (a real sequence) ----------

const STEPS = [
  { title: "عبّي النموذج", text: "اسمك وإيميلك ورقم موبايلك، بنص دقيقة." },
  { title: "افتح الإيميل", text: "بيوصلك رابط، بتختار منه كلمة السر لحسابك." },
  { title: "سجّل أول طلب", text: "عرّفنا على متجرك، وتجربتك المجانية بتبلّش فورًا." },
];

export function Steps() {
  const [ref, seen] = useInViewOnce<HTMLDivElement>(0.3);
  return (
    <div ref={ref} className={`${s.stepsWrap} ${s.reveal} ${seen ? s.revealOn : ""}`}>
      <svg className={s.stepsPath} viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 20 C 160 -10, 340 50, 500 20 S 840 -10, 1000 20" />
      </svg>
      <ol className={s.steps} style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {STEPS.map((st, i) => (
          <li key={st.title} className={s.stepCard} style={v({ "--i": i })}>
            <span className={s.stepNum}>{i + 1}</span>
            <div>
              <h3>{st.title}</h3>
              <p>{st.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------- pricing with a monthly/yearly switch (D-165) ----------

const INCLUDED = ["طلبات ومنتجات بلا حدود", "المخزون والزباين والديون", "المندوب والمصاريف والتقارير", "مساعدة بالواتساب"];

export function Pricing() {
  const [yearly, setYearly] = useState(true);
  return (
    <>
      <div className={s.billing} role="group" aria-label="طريقة الدفع">
        <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>
          شهري
        </button>
        <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>
          سنوي <em>وفّر شهرين</em>
        </button>
      </div>
      <div className={s.prices}>
        <div className={`${s.price} ${s.priceFree}`}>
          <h3>أول شهر</h3>
          <div className={s.amount}>
            مجاني <small>بكل المزايا</small>
          </div>
          <p>بدون بطاقة وبدون التزام. جرّب لمّة على طلباتك الحقيقية.</p>
          <ul className={s.priceList}>
            {INCLUDED.map((x) => (
              <li key={x}>
                <Icon name="check" size={16} />
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div className={s.price}>
          <h3>{yearly ? "الخطة السنوية" : "الخطة الشهرية"}</h3>
          <div className={s.amount}>
            <span key={yearly ? "y" : "m"} className={s.flip}>
              {yearly ? "90" : "9"}
            </span>
            <small>{yearly ? "د.أ بالسنة" : "د.أ بالشهر"}</small>
          </div>
          <p>{yearly ? "يعني 7.50 د.أ بالشهر، وبتوفّر شهرين كاملين." : "مرونة كاملة، بتجدّد كل شهر."}</p>
          <ul className={s.priceList}>
            {INCLUDED.map((x) => (
              <li key={x}>
                <Icon name="check" size={16} />
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div className={s.price}>
          <h3>بعد ما يخلص الشهر</h3>
          <div className={s.amount} style={{ fontSize: 30, direction: "rtl", justifyContent: "flex-start" }}>
            بياناتك محفوظة
          </div>
          <p>إذا ما اشتركت، بتضل تشوف كل طلباتك وزباينك وأرقامك. الإضافة والتعديل بيرجعوا أول ما تشترك.</p>
          <ul className={s.priceList}>
            <li>
              <Icon name="eye" size={16} />
              بتشوف وبتدوّر بكل إشي
            </li>
            <li>
              <Icon name="lock" size={16} />
              ولا معلومة بتنحذف
            </li>
          </ul>
        </div>
      </div>
      <p className={s.note}>
        <Icon name="info-circle" size={16} />
        الدفع بكليك من حسابك البنكي: بتحوّل وبترفع صورة التحويل من داخل لمّة، وبنفعّل خطتك.
      </p>
    </>
  );
}

// ---------- FAQ ----------

const FAQ = [
  { q: "بدّي بطاقة بنكية عشان أجرّب؟", a: "لا. الشهر الأول مجاني بالكامل وبكل المزايا، وما بنطلب منك أي بطاقة." },
  { q: "شو بصير لما يخلص الشهر المجاني؟", a: "بتختار الخطة اللي بتناسبك. وإذا ما اشتركت، بياناتك بتضل محفوظة وبتقدر تشوفها، بس الإضافة والتعديل بيرجعوا لما تشترك." },
  { q: "كيف بدفع الاشتراك؟", a: "بتحوّل بكليك من حسابك البنكي، وبترفع صورة التحويل من داخل لمّة، وبنفعّل خطتك." },
  { q: "بيشتغل عالموبايل؟", a: "أكيد. لمّة مصممة للموبايل أول، وبتشتغل من المتصفح بدون ما تنزّل أي تطبيق." },
  { q: "مين بيشوف بيانات متجري؟", a: "إنت بس. طلباتك وزباينك وأرقامك إلك لحالك." },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className={s.faq}>
      {FAQ.map((f, i) => (
        <div key={f.q} className={s.faqItem} data-open={open === i}>
          <button type="button" className={s.faqQ} aria-expanded={open === i} aria-controls={`faq-${i}`} onClick={() => setOpen(open === i ? null : i)}>
            {f.q}
            <i aria-hidden="true">
              <Icon name="plus" size={16} />
            </i>
          </button>
          <div className={s.faqA} id={`faq-${i}`} role="region">
            <div>
              <p>{f.a}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
