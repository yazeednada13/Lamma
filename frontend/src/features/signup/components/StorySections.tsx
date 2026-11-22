import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Icon, type IconName } from "@/shared/ui/Icon";
import s from "../landing.module.css";
import { useInViewOnce } from "./landingHooks";

const v = (vars: Record<string, string | number>) => vars as CSSProperties;

// ---------- the band of businesses (D-009 types) ----------

const KINDS = ["ملابس وأزياء", "عطور", "تجميل وعناية", "إكسسوارات", "هدايا وبوكسات", "أكل وحلويات بيتية", "شغل يدوي", "أحذية وشنط", "أطفال وألعاب", "ديكور", "كتب وقرطاسية", "إلكترونيات"];

export function Ticker() {
  const items = [...KINDS, ...KINDS];
  return (
    <div className={s.ticker} aria-label={`لمّة لكل اللي بيبيع: ${KINDS.join("، ")}`}>
      <div className={s.tickerTrack} aria-hidden="true">
        {items.map((k, i) => (
          <span key={i} className={s.tickerItem}>
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- before / after ----------

const PAIRS: { icon: IconName; before: string; after: string }[] = [
  { icon: "receipt", before: "الطلبات ضايعة بين رسايل الواتساب والإنستغرام", after: "كل طلب بمكانه وبحالته: جديد، تجهيز، مع المندوب، توصّل" },
  { icon: "package", before: "ما بتعرف شو ضل بالمخزون إلا لما الزبون يسأل", after: "المخزون بينقص لحاله مع كل طلب، وبينبهك قبل ما يخلص" },
  { icon: "users", before: "مين عليه مصاري ومن متى؟ كله براسك", after: "رصيد كل زبون محسوب، والدفعات الجزئية مسجّلة" },
  { icon: "truck", before: "حساب شركة التوصيل آخر الشهر وجع راس", after: "بتعرف كم مع المندوب، وبتسكّر الحساب بكبسة" },
  { icon: "chart-bar", before: "بتبيع كثير، بس فعلًا ربحان؟ مش متأكد", after: "ربحك الحقيقي بعد التكلفة والمصاريف، كل يوم" },
];

export function BeforeAfter() {
  const [after, setAfter] = useState(false);
  const [ref, seen] = useInViewOnce<HTMLDivElement>(0.35);
  const touched = useRef(false);

  // Shows the change once by itself when the section comes into view, unless the visitor already used the switch.
  useEffect(() => {
    if (!seen) return;
    const t = window.setTimeout(() => {
      if (!touched.current) setAfter(true);
    }, 1400);
    return () => window.clearTimeout(t);
  }, [seen]);

  const choose = (value: boolean) => {
    touched.current = true;
    setAfter(value);
  };

  return (
    <div ref={ref} className={after ? s.isAfter : s.isBefore}>
      <div className={`${s.switch} ${after ? s.switchAfter : s.switchBefore}`} role="group" aria-label="قبل لمّة ومعها">
        <span className={s.switchKnob} aria-hidden="true" />
        <button type="button" aria-pressed={!after} onClick={() => choose(false)}>
          قبل لمّة
        </button>
        <button type="button" aria-pressed={after} onClick={() => choose(true)}>
          مع لمّة
        </button>
      </div>
      <div className={s.baGrid}>
        <ul className={s.baList} aria-live="polite">
          {PAIRS.map((p, i) => (
            <li key={p.icon} className={s.baItem} style={v({ "--i": i })}>
              <span className={s.baIcon}>
                <Icon name={after ? "check" : p.icon} size={20} />
              </span>
              <span className={s.baText}>
                <span className={s.baBeforeTxt} aria-hidden={after}>
                  {p.before}
                </span>
                <span className={s.baAfterTxt} aria-hidden={!after}>
                  {p.after}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <div className={s.baVisual} aria-hidden="true">
          <div className={s.mess}>
            <span className={`${s.scrap} ${s.scrapNote}`} style={{ top: "8%", insetInlineStart: "8%", rotate: "-6deg" }}>
              رنا: فستان M <s>زيتي</s> أسود؟
            </span>
            <span className={s.scrap} style={{ top: "22%", insetInlineEnd: "6%", rotate: "4deg" }}>
              <Icon name="brand-whatsapp" size={16} /> وين طلبي؟؟ 😡
            </span>
            <span className={`${s.scrap} ${s.scrapPaper}`} style={{ top: "42%", insetInlineStart: "14%", rotate: "3deg" }}>
              ديون: سارة 15، لينا <s>8</s> 10؟
            </span>
            <span className={`${s.scrap} ${s.scrapNote}`} style={{ top: "60%", insetInlineEnd: "6%", rotate: "-4deg" }}>
              بلوزات حرير: 5؟ 3؟
            </span>
            <span className={s.scrap} style={{ bottom: "8%", insetInlineStart: "6%", rotate: "-2deg" }}>
              <Icon name="brand-instagram" size={16} /> لسا متوفر؟
            </span>
            <span className={`${s.scrap} ${s.scrapPaper}`} style={{ bottom: "6%", insetInlineEnd: "34%", rotate: "5deg" }}>
              المندوب: 86 ولا 68 🤯
            </span>
          </div>
          <div className={s.neat}>
            <div className={s.neatCard}>
              <div className={s.neatRow}>
                <Icon name="brand-whatsapp" size={16} /> طلب رنا · فستان M <em className={s.tNew}>جديد</em>
              </div>
              <div className={s.neatRow}>
                <Icon name="brand-instagram" size={16} /> طلب لينا · عطر <em className={s.tPrep}>قيد التجهيز</em>
              </div>
              <div className={s.neatRow}>
                <Icon name="truck" size={16} /> طلب سارة · بوكس هدية <em className={s.tWay}>مع المندوب</em>
              </div>
              <div className={s.neatRow}>
                <Icon name="circle-check" size={16} /> طلب دانة · شنطة <em className={s.tDone}>توصّل</em>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- feature story: a sticky phone that follows the chapters ----------

function Row({ i, children, className }: { i: number; children: ReactNode; className?: string }) {
  return (
    <div className={`${s.miniRow} ${className ?? ""}`} style={v({ "--i": i })}>
      {children}
    </div>
  );
}

const SCREENS: ReactNode[] = [
  <div className={s.mini} key="orders">
    <div className={s.miniHead}>
      الطلبات <small>اليوم</small>
    </div>
    <Row i={0} className={s.newRow}>
      <span className={s.miniAva}>ر</span>
      <span>
        <b>رنا الخطيب</b>فستان كتان M
      </span>
      <em className={s.tNew}>جديد</em>
    </Row>
    <Row i={1}>
      <span className={s.miniAva}>ل</span>
      <span>
        <b>لينا</b>عطر عود 50 مل
      </span>
      <em className={s.tPrep}>تجهيز</em>
    </Row>
    <Row i={2}>
      <span className={s.miniAva}>س</span>
      <span>
        <b>سارة</b>بوكس هدية
      </span>
      <em className={s.tWay}>مع المندوب</em>
    </Row>
    <Row i={3}>
      <span className={s.miniAva}>د</span>
      <span>
        <b>دانة</b>شنطة جلد
      </span>
      <em className={s.tDone}>توصّل</em>
    </Row>
  </div>,
  <div className={s.mini} key="stock">
    <div className={s.miniHead}>
      المخزون <small>12 منتج</small>
    </div>
    {[
      ["فستان كتان", "18 قطعة", "72%", false],
      ["عطر عود", "9 قطع", "45%", false],
      ["بلوزة حرير", "ضل 2", "12%", true],
      ["شنطة جلد", "6 قطع", "38%", false],
    ].map(([name, left, w, low], i) => (
      <Row key={String(name)} i={i} className={low ? s.pulse : undefined}>
        <span style={{ flex: 1 }}>
          <b>{name}</b>
          {left}
          <span className={`${s.stockBar} ${low ? s.stockLow : ""}`}>
            <i style={v({ "--w": String(w) })} />
          </span>
        </span>
      </Row>
    ))}
  </div>,
  <div className={s.mini} key="customers">
    <div className={s.miniHead}>
      الزباين <small>عليهم 33.00</small>
    </div>
    {[
      ["س", "سارة", "عليها 15.00", s.tPrep],
      ["ل", "لينا", "عليها 10.00", s.tPrep],
      ["ر", "رنا", "دفعت كله", s.tDone],
      ["ه", "هبة", "عليها 8.00", s.tPrep],
    ].map(([a, n, b, t], i) => (
      <Row key={String(n)} i={i}>
        <span className={s.miniAva}>{a}</span>
        <span>
          <b>{n}</b>4 طلبات
        </span>
        <em className={String(t)}>{b}</em>
      </Row>
    ))}
  </div>,
  <div className={s.mini} key="courier">
    <div className={s.miniHead}>
      شركة التوصيل <small>هالأسبوع</small>
    </div>
    <div className={s.miniCard}>
      <small>المصاري اللي مع المندوب</small>
      <div className={s.bigNum}>86.00</div>
      <small>من 7 طلبات توصّلت</small>
      <span className={s.miniBtn}>
        <Icon name="check" size={16} /> سكّر الحساب
      </span>
    </div>
    <Row i={1}>
      <Icon name="receipt" size={16} /> مصروف إعلانات <em className={s.tWay}>6.00</em>
    </Row>
    <Row i={2}>
      <Icon name="package" size={16} /> مصروف تغليف <em className={s.tWay}>4.50</em>
    </Row>
  </div>,
  <div className={s.mini} key="profit">
    <div className={s.miniHead}>
      ربحك هالشهر <small>مقارنة بالشهر الماضي</small>
    </div>
    <div className={s.miniCard}>
      <small>صافي الربح</small>
      <div className={s.bigNum} style={{ color: "#F4A261" }}>
        386.00
      </div>
      <small>↑ 18% عن الشهر الماضي</small>
    </div>
    <div className={s.miniBars}>
      {[38, 52, 44, 66, 58, 74, 92].map((h, i) => (
        <i key={i} style={v({ "--h": `${h}%`, "--i": i })} />
      ))}
    </div>
  </div>,
];

const CHAPTERS: { icon: IconName; title: string; text: string; items: string[] }[] = [
  {
    icon: "receipt",
    title: "الطلبات، من رسالة لطلب مرتب",
    text: "انسخ اللي بعته الزبون وسجّله بأربع خطوات. كل طلب إله حالة، وبتعرف بنظرة شو لازم تجهّز اليوم.",
    items: ["لوحة حالات من التأكيد للتوصيل", "طلبات مسبقة مع عربون وتاريخ تسليم", "مرتجعات كاملة أو جزئية"],
  },
  {
    icon: "package",
    title: "المخزون بيعدّ عنك",
    text: "لما تأكد الطلب بتنحجز القطع، ولما يتوصّل بتنقص من المخزون. وقبل ما يخلص منتج، لمّة بتنبهك.",
    items: ["مقاسات وألوان لكل منتج", "سجل كل حركة استلام وتعديل", "تواريخ الانتهاء للعطور والتجميل"],
  },
  {
    icon: "users",
    title: "الزباين والديون بدون ما تتذكر",
    text: "كل زبون إله ملف بطلباته ودفعاته. الدفعات الجزئية بتتسجل، والدين بيتسكّر لحاله لما الزبون يدفع.",
    items: ["مين عليه مصاري ومن متى", "مين أكثر زبون بيشتري منك، ومين ما رجع اشترى من فترة", "دفعات كاش وكليك ومحافظ"],
  },
  {
    icon: "truck",
    title: "المندوب والمصاريف، ولا قرش بيضيع",
    text: "بتعرف كم مصاري عند شركة التوصيل، وبتسكّر الحساب بكبسة. والمصاريف بتنسجل حسب نوعها.",
    items: ["تسوية حساب المندوب طلب بطلب", "إعلانات، تغليف، إيجار، توصيل", "الفرق بالتسوية بينحسب مصروف"],
  },
  {
    icon: "chart-bar",
    title: "ربحك الحقيقي، كل يوم",
    text: "مش بس كم بعت: كم ربحت بعد تكلفة البضاعة والمصاريف والمرتجعات، ومقارنة بالفترة اللي قبلها.",
    items: ["شلال الربح من المبيعات للصافي", "أقوى منتج وقناة ويوم بالأسبوع", "تقارير لأي فترة بدك إياها"],
  },
];

export function FeatureStory() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className={s.story}>
      <div className={s.chapters}>
        {CHAPTERS.map((c, i) => (
          <article
            key={c.title}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-i={i}
            className={`${s.chapter} ${active === i ? s.chapterOn : ""}`}
          >
            <span className={s.chapterIcon}>
              <Icon name={c.icon} size={24} />
            </span>
            <h3>{c.title}</h3>
            <p>{c.text}</p>
            <ul>
              {c.items.map((it) => (
                <li key={it}>
                  <Icon name="check" size={16} />
                  {it}
                </li>
              ))}
            </ul>
            <div className={s.chapterScreen} aria-hidden="true">
              <div className={`${s.screenFrame} ${s.screenOn}`} style={{ position: "static", padding: 0 }}>
                {SCREENS[i]}
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className={s.phoneCol} aria-hidden="true">
        <div className={s.phone}>
          <div className={s.screen}>
            {SCREENS.map((screen, i) => (
              <div key={i} className={`${s.screenFrame} ${active === i ? s.screenOn : ""}`}>
                {screen}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
