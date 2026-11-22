import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { channelLabel } from "@/features/settings";
import { formatMoneyNumber, toFils } from "@/shared/lib/money";
import { Illustration } from "@/shared/ui/brand/Illustration";
import { ButtonLink } from "@/shared/ui/Button";
import { CountUp, countFormat } from "@/shared/ui/CountUp";
import { Donut } from "@/shared/ui/charts/Donut";
import { Icon, type IconName } from "@/shared/ui/Icon";
import { Money } from "@/shared/ui/Money";
import type { Dashboard, LowProduct } from "../api/dashboardApi";
import {
  activityView,
  areaGeometry,
  attentionView,
  chartDay,
  delta,
  filsOf,
  insightSentence,
  smoothPath,
} from "../domain/dashboardDomain";

const CHART = ["var(--lamma-chart-1)", "var(--lamma-chart-2)", "var(--lamma-chart-3)", "var(--lamma-chart-4)"] as const;

/** Delta pill (prototype `LammaCards.delta`). */
export function DeltaPill({ change, invert }: { change: number | null; invert?: boolean }) {
  const d = delta(change, invert);
  return (
    <span className={`dpill dpill--${d.tone}`}>
      <bdi>{d.text}</bdi>
    </span>
  );
}

/** Journey (prototype `.journey`, D-154): stages now, each a link; the end node is the month's net profit. */
export function JourneyBar({ d }: { d: Dashboard }) {
  const j = d.journey;
  const nodes: { icon: IconName; title: string; n: number; sub: string; to: string; hot?: boolean }[] = [
    { icon: "package", title: "المنتجات", n: j.products, sub: `${j.lowStock} قرب يخلص`, to: "/products" },
    { icon: "receipt", title: "طلبات جديدة", n: j.newOrders, sub: "بانتظار التأكيد", to: "/orders" },
    {
      icon: "gift",
      title: "بالتجهيز",
      n: j.preparing,
      sub: "مؤكدة ومحجوزة",
      to: "/orders/board",
      hot: j.preparing > 0,
    },
    { icon: "truck", title: "مع المندوب", n: j.courier, sub: "بالطريق", to: "/orders/board" },
    { icon: "circle-check", title: "توصّلت", n: j.deliveredThisMonth, sub: "هالشهر", to: "/orders" },
    { icon: "users", title: "زباين", n: j.activeCustomers, sub: "اشتروا هالشهر", to: "/customers" },
  ];
  // The packet runs from the first stage to the profit node: 6/7 of the bar (prototype sets `--run` the same way).
  const ref = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setRun(Math.round((el.offsetWidth * 6) / 7));
    measure();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  return (
    <div className="journey" ref={ref}>
      <div className="journey__line">
        <svg viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M0 3 H100"
            stroke="#F4A261"
            strokeOpacity=".45"
            strokeWidth="2"
            strokeDasharray="1.2 1.6"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      {run !== null && <span className="journey__packet is-loop" style={{ ["--run" as string]: `${run}px` }} />}
      {nodes.map((n, i) => (
        <Link key={n.title} className={`jnode${n.hot ? " is-hot" : ""}`} to={n.to} style={{ ["--i" as string]: i }}>
          <span className="jnode__dot">
            <Icon name={n.icon} size={24} />
            <span className="jnode__n num">
              <CountUp value={n.n} final={String(n.n)} format={countFormat.count} />
            </span>
          </span>
          <span className="jnode__t">{n.title}</span>
          <span className="jnode__s">{n.sub}</span>
        </Link>
      ))}
      <Link className="jnode jnode--end" to="/finance" style={{ ["--i" as string]: 6 }}>
        <span className="jnode__dot">
          <Icon name="wallet" size={24} />
        </span>
        <span className="jnode__t">الربح</span>
        <span className="jnode__s num">
          <Money value={d.netProfit.current} />
        </span>
      </Link>
    </div>
  );
}

/** Two-series area chart with hover tooltips (prototype `LammaCards.area`). */
export function AreaChart({ d }: { d: Dashboard }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 640;
  const h = 220;
  const series = d.series.map((s) => ({ a: filsOf(s.sales), b: filsOf(s.grossProfit) }));
  const g = areaGeometry(series, w, h);
  const step = (w - 28) / Math.max(series.length - 1, 1);
  const labelEvery = Math.ceil(series.length / 7);
  const tip = hover === null ? null : d.series[hover];
  return (
    <div className="area" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="المبيعات والربح آخر 14 يوم">
        <defs>
          <linearGradient id="dash-gA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3F4F2A" stopOpacity=".22" />
            <stop offset="1" stopColor="#3F4F2A" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} className="grid-line" x1="0" x2={w} y1={g.y((g.max * f) / 1.15)} y2={g.y((g.max * f) / 1.15)} />
        ))}
        <path
          className="fade-up"
          d={`${smoothPath(g.a)} L${g.a[g.a.length - 1]![0]} ${h - 28} L${g.a[0]![0]} ${h - 28}Z`}
          fill="url(#dash-gA)"
        />
        <path
          className="draw"
          d={smoothPath(g.a)}
          fill="none"
          stroke="var(--lamma-chart-1)"
          strokeWidth="2.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          className="draw"
          style={{ animationDelay: "350ms" }}
          d={smoothPath(g.b)}
          fill="none"
          stroke="var(--lamma-chart-2)"
          strokeWidth="2.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {d.series.map((s, i) => (
          <g key={s.day}>
            <rect
              className="hit"
              x={g.x(i) - step / 2}
              y="0"
              width={step}
              height={h}
              onMouseEnter={() => setHover(i)}
            />
            <circle
              className={`dot${hover === i ? " is-on" : ""}`}
              cx={g.x(i)}
              cy={g.a[i]![1]}
              r="4.5"
              stroke="var(--lamma-chart-1)"
            />
            {(i % labelEvery === 0 || i === d.series.length - 1) && (
              <text className="lbl" x={g.x(i)} y={h - 6} textAnchor="middle">
                {chartDay(s.day, d.today)}
              </text>
            )}
          </g>
        ))}
      </svg>
      {tip && hover !== null && (
        <div
          className="area__tip is-on"
          style={{ left: `${(g.x(hover) / w) * 100}%`, top: `${(g.a[hover]![1] / h) * 100}%` }}
        >
          <b>{chartDay(tip.day, d.today)}</b>
          المبيعات: <bdi>{formatMoneyNumber(tip.sales)}</bdi> د.أ
          <br />
          الربح: <bdi>{formatMoneyNumber(tip.grossProfit)}</bdi> د.أ
        </div>
      )}
    </div>
  );
}

/** «يحتاج انتباهك» (D-157), in the server's order. */
export function AttentionCard({ d }: { d: Dashboard }) {
  return (
    <article className="card" style={{ padding: "18px 20px" }}>
      <div className="shead">
        <div className="shead__t">
          <span className="overline">رتّبناها حسب الأهمية</span>
          <h2>يحتاج انتباهك</h2>
        </div>
        <span className="count">{d.attention.length}</span>
      </div>
      <div className="alist">
        {d.attention.length === 0 ? (
          <p className="muted">ما في إشي مستعجل، كل شي بمكانه.</p>
        ) : (
          d.attention.map((a, i) => {
            const v = attentionView(a);
            return (
              <Link key={`${a.kind}-${i}`} className="aitem" to={v.to}>
                <span className={`prio prio--${a.priority}`} />
                <span
                  className={`chipi ${a.priority === "high" ? "tone-brick" : a.priority === "mid" ? "tone-apricot" : "tone-olive"}`}
                >
                  <Icon name={v.icon} />
                </span>
                <span className="aitem__t">
                  <b>{v.title}</b>
                  <span>{v.subtitle}</span>
                </span>
                <Icon name="chevron-left" size={16} />
              </Link>
            );
          })
        )}
      </div>
    </article>
  );
}

/** «قرب يخلص» with the prototype stock meter. */
export function LowStockCard({ products }: { products: LowProduct[] | undefined }) {
  return (
    <article className="card" style={{ padding: "18px 20px" }}>
      <div className="shead">
        <div className="shead__t">
          <span className="overline">تحت الحد</span>
          <h2>قرب يخلص</h2>
        </div>
        <Link className="shead__more" to="/inventory">
          المخزون <Icon name="arrow-left" size={16} />
        </Link>
      </div>
      {!products || products.length === 0 ? (
        <p className="muted">كل المنتجات فوق الحد.</p>
      ) : (
        products.map((p) => {
          const max = Math.max(p.onHand, p.lowStockThreshold * 4, 1);
          const cls = p.onHand === 0 ? "stock--out" : "stock--low";
          return (
            <Link
              key={p.productId}
              className="lowrow"
              to={`/products/${p.productId}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <span className="lowrow__thumb">
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                  />
                ) : (
                  <Illustration kind="product" template={p.templateCode} />
                )}
              </span>
              <div className="grow col" style={{ gap: 4 }}>
                <b style={{ font: "var(--lamma-type-body-strong)" }}>{p.name}</b>
                <div className={`stock ${cls}`}>
                  <div className="stock__bar">
                    <span className="stock__avail" style={{ width: `${(Math.max(p.available, 0) / max) * 100}%` }} />
                    <span className="stock__res" style={{ width: `${(p.reserved / max) * 100}%` }} />
                  </div>
                  <span className="stock__txt">
                    {p.onHand === 0 ? (
                      <b>نفد</b>
                    ) : (
                      <>
                        <b>{Math.max(p.available, 0)}</b> متوفر · قرب يخلص
                      </>
                    )}
                    {p.reserved > 0 ? ` · ${p.reserved} محجوز` : ""}
                  </span>
                </div>
              </div>
            </Link>
          );
        })
      )}
    </article>
  );
}

export function InsightCard({ d }: { d: Dashboard }) {
  return (
    <div className="insight">
      <span className="overline">ملاحظة لمّة</span>
      <p>{insightSentence(d.insight)}</p>
    </div>
  );
}

export function ChannelsCard({ d, month }: { d: Dashboard; month: string }) {
  const total = d.channels.reduce((s, c) => s + toFils(c.amount), 0);
  const segs = d.channels.map((c, i) => ({
    label: channelLabel[c.channel],
    value: toFils(c.amount),
    color: CHART[i % CHART.length]!,
  }));
  return (
    <article className="card" style={{ padding: "18px 20px" }}>
      <div className="shead">
        <div className="shead__t">
          <span className="overline">{month}</span>
          <h2>المبيعات حسب القناة</h2>
        </div>
      </div>
      {segs.length === 0 ? (
        <p className="muted">لسا ما توصّل ولا طلب هالشهر.</p>
      ) : (
        <div className="row" style={{ gap: 20 }}>
          <Donut segments={segs} center={<bdi>{formatMoneyNumber(d.sales.current).split(".")[0]}</bdi>} sub="د.أ" />
          <div className="col" style={{ gap: 10, flex: 1 }}>
            {segs.map((s) => (
              <div key={s.label} className="row" style={{ gap: 10 }}>
                <i style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flex: "none" }} />
                <span className="grow">{s.label}</span>
                <b className="num" style={{ font: "var(--lamma-type-number-table)" }}>
                  <bdi>{total > 0 ? Math.round((s.value / total) * 100) : 0}%</bdi>
                </b>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export function TopProductsCard({ d, month }: { d: Dashboard; month: string }) {
  const max = Math.max(1, ...d.topProducts.map((p) => toFils(p.revenue)));
  return (
    <article className="card stk-host" style={{ padding: "18px 20px" }}>
      <span
        className="stk stk--sm"
        style={{ top: -14, insetInlineStart: -10, ["--r" as string]: "-14deg", ["--d" as string]: "1000ms" }}
      >
        <Illustration kind="sticker" name="fire" />
      </span>
      <div className="shead">
        <div className="shead__t">
          <span className="overline">{month}</span>
          <h2>الأكثر مبيعًا</h2>
        </div>
      </div>
      {d.topProducts.length === 0 ? (
        <p className="muted">بيظهر هون أول ما تتوصّل طلبات.</p>
      ) : (
        <div className="col" style={{ gap: 14 }}>
          {d.topProducts.map((p, i) => (
            <Link
              key={p.productId}
              to={`/products/${p.productId}`}
              style={{ textDecoration: "none", color: "inherit" }}
              className="col"
            >
              <div className="row" style={{ gap: 10 }}>
                <span className="grow">
                  <b style={{ font: "var(--lamma-type-body-strong)" }}>{p.name}</b>
                  <br />
                  <span className="caption">{p.quantity} قطعة</span>
                </span>
                <Money value={p.revenue} />
              </div>
              <div className="flowbar" style={{ height: 6, marginTop: 8 }}>
                <span
                  style={{
                    width: `${(toFils(p.revenue) / max) * 100}%`,
                    background: `var(--lamma-chart-${i === 0 ? 2 : 1})`,
                    animationDelay: `${i * 90}ms`,
                  }}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}

export function ActivityCard({ d }: { d: Dashboard }) {
  return (
    <article className="card" style={{ padding: "18px 20px" }}>
      <div className="shead">
        <div className="shead__t">
          <span className="overline">آخر شي صار</span>
          <h2>آخر النشاطات</h2>
        </div>
      </div>
      {d.activity.length === 0 ? (
        <p className="muted">لسا ما في نشاطات.</p>
      ) : (
        <ul className="feed">
          {d.activity.map((a, i) => {
            const v = activityView(a);
            return (
              <li key={`${a.kind}-${a.at}-${i}`} className={v.tone}>
                <span className="feed__ic">
                  <Icon name={v.icon} size={16} />
                </span>
                <div>
                  <b>{v.title}</b>
                  <span>{v.subtitle}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

const SLIDES = [
  {
    icon: "layout-kanban",
    tag: "ميزة · لوحة الحالات",
    title: ["انقل طلباتك ", "بضغطة", "، والمخزون بيتحدّث لحاله"],
    text: "«مؤكد» بيحجز القطع، و«تم التوصيل» بيخصمها ويحسب المبيعة. ما في دفتر ولا نسيان.",
    to: "/orders/board",
    cta: "افتح لوحة الحالات",
  },
  {
    icon: "truck",
    tag: "ميزة · شركة التوصيل",
    title: ["مصاريك عند المندوب ", "تحت عينك", ""],
    text: "شوف كم إلك عند شركة التوصيل، وسوّي التسوية بضغطة، والفرق بينسجّل لحاله كمصروف.",
    to: "/finance/courier",
    cta: "شوف المستحقات",
  },
  {
    icon: "chart-bar",
    tag: "ميزة · النظرة المالية",
    title: ["اعرف وين بتروح ", "كل دينار", ""],
    text: "من المبيعات للصافي خطوة بخطوة، والمصاريف حسب النوع.",
    to: "/finance",
    cta: "افتح النظرة المالية",
  },
] as const;

/** Feature promo (prototype `.promo`), with real figures in the captions. */
export function PromoCarousel({ d }: { d: Dashboard }) {
  const [slide, setSlide] = useState(0);
  const captions = [
    `${d.journey.newOrders + d.journey.preparing} طلبات مستنية حركة`,
    `${formatMoneyNumber(d.courierHeld)} د.أ بانتظار التحويل`,
    "",
  ];
  return (
    <section className="promo" aria-label="ميزات لمّة">
      <span
        className="stk stk--sm stk--wiggle"
        style={{ top: 14, insetInlineEnd: "2%", ["--r" as string]: "12deg", ["--d" as string]: "900ms" }}
        aria-hidden="true"
      >
        <Illustration kind="sticker" name="star" />
      </span>
      <div className="promo__slides">
        {SLIDES.map((s, i) => (
          <div key={s.tag} className={`promo__slide${slide === i ? " is-on" : ""}`} aria-hidden={slide !== i}>
            <span className="promo__tag">
              <Icon name={s.icon} size={16} /> {s.tag}
            </span>
            <h3>
              {s.title[0]}
              <em>{s.title[1]}</em>
              {s.title[2]}
            </h3>
            <p>{s.text}</p>
            <div className="promo__cta">
              <ButtonLink to={s.to} variant="accent" iconEnd="arrow-left" tabIndex={slide === i ? undefined : -1}>
                {s.cta}
              </ButtonLink>
              {captions[i] && (
                <span className="caption" style={{ color: "#B9BDA8" }}>
                  {captions[i]}
                </span>
              )}
            </div>
          </div>
        ))}
        <div className="promo__dots" role="tablist">
          {SLIDES.map((s, i) => (
            <button
              key={s.tag}
              type="button"
              role="tab"
              aria-selected={slide === i}
              className={slide === i ? "is-on" : ""}
              aria-label={`ميزة ${i + 1}`}
              onClick={() => setSlide(i)}
            />
          ))}
        </div>
      </div>
      <div className="promo__art">
        <Illustration kind="packing" template="clothing" play />
      </div>
    </section>
  );
}

const TRIAL_DAYS = 30;

/**
 * Trial promo: days used out of 30. The prototype's apricot `.promo--warm` fill is replaced by the olive banner
 * of the hero and features promo (founder request, 2026-11-22); layout, copy, day strip and the heart sticker stay as in the prototype.
 */
export function TrialPromo({ daysLeft }: { daysLeft: number }) {
  if (daysLeft <= 0) return null;
  const used = TRIAL_DAYS - daysLeft;
  return (
    <section className="promo promo--trial" aria-label="الاشتراك">
      <span
        className="stk stk--wiggle hide-sm"
        style={{ bottom: 12, insetInlineEnd: 280, ["--r" as string]: "-10deg", ["--d" as string]: "1200ms" }}
        aria-hidden="true"
      >
        <Illustration kind="sticker" name="heart" />
      </span>
      <div>
        <span className="promo__tag">
          <Icon name="credit-card" size={16} /> تجربتك المجانية
        </span>
        <h3>
          ضل <em>{daysLeft} يوم</em>، وكل اللي بنيته بيضل محفوظ
        </h3>
        <p>اشترك قبل ما تخلص التجربة وكمّل بدون ولا توقّف.</p>
        <div className="promo__cta">
          <ButtonLink to="/subscription" variant="accent" iconEnd="arrow-left">
            شوف الخطط
          </ButtonLink>
        </div>
      </div>
      <div className="promo__art">
        <div
          className="promo__days"
          style={{ width: 260 }}
          role="img"
          aria-label={`استخدمت ${used} من ${TRIAL_DAYS} يوم`}
        >
          {Array.from({ length: TRIAL_DAYS }, (_, i) => (
            <i
              key={i}
              className={i < used - 1 ? "used" : i === used - 1 ? "is-today" : ""}
              style={{ animationDelay: `${i * 20}ms` }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
