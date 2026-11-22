import { useCurrentAccount } from "@/features/auth";
import { LatestOrdersGrid } from "@/features/orders";
import { channelLabel, useBusinessTypeLabel, useSalesChannelSettings } from "@/features/settings";
import { errorMessage } from "@/services/api/apiClient";
import { addMoney, formatMoneyNumber } from "@/shared/lib/money";
import { firstName } from "@/shared/lib/personName";
import { SleepingCourier } from "@/shared/ui/brand/EmptyScenes";
import { Illustration } from "@/shared/ui/brand/Illustration";
import { ButtonLink } from "@/shared/ui/Button";
import { CountUp, countFormat } from "@/shared/ui/CountUp";
import { EmptyState } from "@/shared/ui/feedback/EmptyState";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { Icon } from "@/shared/ui/Icon";
import { MetricCard } from "@/shared/ui/MetricCard";
import { Money } from "@/shared/ui/Money";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Link } from "react-router";
import { useDashboard, useLowProducts, type Dashboard } from "../api/dashboardApi";
import {
  AreaChart,
  AttentionCard,
  ActivityCard,
  ChannelsCard,
  DeltaPill,
  InsightCard,
  JourneyBar,
  LowStockCard,
  PromoCarousel,
  TopProductsCard,
  TrialPromo,
} from "../components/DashboardWidgets";
import { DeliveryLane, FloatTicker, type FloatItem } from "../components/DashboardMotion";
import { greeting, leadSentence, monthName, prevMonthName, todayLabel } from "../domain/dashboardDomain";

/** «لمّة اليوم» (prototype `#/dashboard`, D-153–D-158); a new account sees the getting-started checklist instead. */
export function DashboardPage() {
  const dashboard = useDashboard();
  if (dashboard.error)
    return <ErrorState message={errorMessage(dashboard.error)} onRetry={() => void dashboard.refetch()} />;
  const d = dashboard.data;
  if (!d) return <PageSkeleton />;
  return d.isEmpty || d.latestOrders.length === 0 ? <FirstSteps d={d} /> : <FullDashboard d={d} />;
}

/** How Lamma works, in one line each (the rules the app really applies). Shown as floating tips in the closing scene. */
const TIPS: FloatItem[] = [
  { icon: "package", tone: "olive", title: "المخزون بيتحجز لحاله", text: "أول ما تأكّد الطلب، بنحجزله الكمية" },
  { icon: "truck", tone: "blue", title: "المندوب محسوب أول بأول", text: "بتعرف كم معه لحد ما يحوّل" },
  { icon: "wallet", tone: "apricot", title: "ربح حقيقي مش تقديري", text: "التكلفة بتنحفظ يوم البيع والمصاريف بتنطرح" },
  { icon: "users", tone: "green", title: "كل زبون بملفه", text: "طلباته ودفعاته واللي عليه بمكان واحد" },
  {
    icon: "arrow-back-up",
    tone: "brick",
    title: "الإرجاع محسوب صح",
    text: "الكمية والمبلغ بينطرحوا من الطلب تلقائيًا",
  },
];

/** Live facts for the hero ticker, from this month's real figures; only facts worth saying are shown. */
function liveFacts(d: Dashboard): FloatItem[] {
  const j = d.journey;
  const facts: FloatItem[] = [];
  if (j.newOrders > 0)
    facts.push({ icon: "receipt", tone: "olive", title: `${j.newOrders} طلب جديد`, text: "بانتظار تأكيدك" });
  if (j.courier > 0)
    facts.push({ icon: "truck", tone: "blue", title: `${j.courier} مع المندوب`, text: "بالطريق لأصحابها" });
  if (d.topProducts[0])
    facts.push({ icon: "gift", tone: "apricot", title: "الأكثر طلبًا", text: d.topProducts[0].name });
  if (j.deliveredThisMonth > 0)
    facts.push({
      icon: "circle-check",
      tone: "green",
      title: `${j.deliveredThisMonth} توصّلت`,
      text: "هالشهر لحد اليوم",
    });
  if (j.lowStock > 0)
    facts.push({
      icon: "alert-triangle",
      tone: "brick",
      title: `${j.lowStock} قرب يخلص`,
      text: "شوف المخزون قبل ما ينفد",
    });
  return facts;
}

function FullDashboard({ d }: { d: Dashboard }) {
  const account = useCurrentAccount();
  const low = useLowProducts();
  const month = monthName(d.today);
  return (
    <>
      <section className="hero" aria-label="مسار لمّة">
        <div className="hero__row">
          <div>
            <div className="hero__hello">
              <i />
              {greeting()}، {firstName(account.fullName)} · {todayLabel(d.today)}
            </div>
            <h1>كل شغلك اليوم، بمسار واحد</h1>
            <p className="hero__lead">{leadSentence(d.journey)}</p>
          </div>
          <FloatTicker items={liveFacts(d)} className="hero__live" />
          <div className="hero__kpi stk-host">
            <span
              className="stk stk--sm stk--wiggle hide-sm"
              style={{ top: -18, insetInlineStart: -40, ["--r" as string]: "-12deg" }}
              aria-hidden="true"
            >
              <Illustration kind="sticker" name="shadda" />
            </span>
            <div className="overline">صافي ربح {month} لحد اليوم</div>
            <div className="big">
              <CountUp
                value={Number(d.netProfit.current)}
                final={formatMoneyNumber(d.netProfit.current)}
                format={countFormat.money}
              />{" "}
              <small>د.أ</small>
            </div>
            <div style={{ marginTop: 8 }}>
              <DeltaPill change={d.netProfit.change} />{" "}
              <span className="caption" style={{ color: "#B9BDA8" }}>
                {d.netProfit.change === null
                  ? "ما في فترة سابقة للمقارنة"
                  : `عن نفس الفترة من ${prevMonthName(d.monthStart)}`}
              </span>
            </div>
          </div>
        </div>
        <JourneyBar d={d} />
      </section>

      <div className="quick" aria-label="إجراءات سريعة">
        <Link className="qa" to="/orders/new">
          <span className="chipi tone-olive">
            <Icon name="receipt" />
          </span>
          طلب جديد
        </Link>
        <Link className="qa" to="/products/new">
          <span className="chipi tone-apricot">
            <Icon name="package" />
          </span>
          منتج
        </Link>
        <Link className="qa" to="/finance/payments?pay=1">
          <span className="chipi tone-green">
            <Icon name="cash" />
          </span>
          دفعة
        </Link>
        <Link className="qa" to="/finance/expenses?add=1">
          <span className="chipi tone-brick">
            <Icon name="wallet" />
          </span>
          مصروف
        </Link>
        <Link className="qa" to="/inventory/receive">
          <span className="chipi tone-blue">
            <Icon name="truck" />
          </span>
          استلام بضاعة
        </Link>
      </div>

      <div className="dash">
        <div className="dash__a">
          <article className="card lift" style={{ padding: 20 }}>
            <div className="shead">
              <div className="shead__t">
                <span className="overline">آخر 14 يوم · حسب تاريخ التوصيل</span>
                <h2>المبيعات والربح</h2>
              </div>
              <span className="legend" style={{ marginInlineStart: "auto" }}>
                <span>
                  <i style={{ background: "var(--lamma-chart-1)" }} />
                  المبيعات
                </span>
                <span>
                  <i style={{ background: "var(--lamma-chart-2)" }} />
                  الربح قبل المصاريف
                </span>
              </span>
            </div>
            <div className="row" style={{ gap: 28, marginBottom: 6 }}>
              <div>
                <span className="caption">مبيعات الشهر</span>
                <div style={{ font: "var(--lamma-type-number-lg)" }}>
                  <Money value={d.sales.current} />
                </div>
              </div>
              <div>
                <span className="caption">إجمالي الربح</span>
                <div style={{ font: "var(--lamma-type-number-lg)", color: "var(--lamma-apricot-700)" }}>
                  <Money value={d.grossProfit} />
                </div>
              </div>
              <div className="hide-sm">
                <DeltaPill change={d.sales.change} /> <span className="caption">مبيعات</span>
              </div>
            </div>
            <AreaChart d={d} />
          </article>
          <div className="dash__m">
            <MetricCard
              icon="receipt"
              tone="blue"
              label="طلبات مفتوحة"
              value={d.openOrders}
              foot={`بقيمة ${formatMoneyNumber(d.openValue)} د.أ`}
              to="/orders"
            />
            <MetricCard
              icon="building-bank"
              tone="green"
              label="استلمت فعليًا هالشهر"
              value={formatMoneyNumber(d.cashReceived)}
              unit="د.أ"
              to="/finance"
            />
            <MetricCard
              icon="cash"
              tone="apricot"
              label="مستحق إلك"
              value={formatMoneyNumber(addMoney(d.receivables, d.courierHeld))}
              unit="د.أ"
              foot={`زباين ${formatMoneyNumber(d.receivables)} · شركة ${formatMoneyNumber(d.courierHeld)}`}
              to="/finance/payments"
            />
          </div>
        </div>

        <div className="dash__b">
          <AttentionCard d={d} />
          <LowStockCard products={low.data} />
        </div>

        <PromoCarousel d={d} />

        <section className="stk-host">
          <span
            className="stk stk--sm hide-sm"
            style={{ top: -6, insetInlineStart: 150, ["--r" as string]: "10deg", ["--d" as string]: "800ms" }}
            aria-hidden="true"
          >
            <Illustration kind="sticker" name="parcel" />
          </span>
          <div className="shead">
            <div className="shead__t">
              <span className="overline">ملصقات الشحن · مع مسار كل طلب</span>
              <h2>آخر الطلبات</h2>
            </div>
            <Link className="shead__more" to="/orders/board">
              لوحة الحالات <Icon name="arrow-left" size={16} />
            </Link>
          </div>
          <LatestOrdersGrid />
        </section>

        <div className="dash__c">
          <div className="col" style={{ gap: 16 }}>
            <InsightCard d={d} />
            <ChannelsCard d={d} month={month} />
          </div>
          <TopProductsCard d={d} month={month} />
          <ActivityCard d={d} />
        </div>

        <TrialPromo daysLeft={d.trialDaysLeft} />

        <DeliveryLane delivered={d.journey.deliveredThisMonth} onTheWay={d.journey.courier} tips={TIPS} />
      </div>
    </>
  );
}

/** New account (prototype `#/dashboard-new`): the steps tick off from real data. */
function FirstSteps({ d }: { d: Dashboard }) {
  const account = useCurrentAccount();
  const channels = useSalesChannelSettings();
  const business = account.business!;
  const businessTypeLabel = useBusinessTypeLabel(business.businessType);
  const enabledChannels = channels.data?.channels.filter((c) => c.isEnabled).map((c) => channelLabel[c.channel]) ?? [];
  const steps = [
    {
      done: true,
      title: "جهّز مشروعك",
      text: `${businessTypeLabel}${enabledChannels.length > 0 ? ` · ${enabledChannels.join(" و")}` : ""}`,
      to: "/settings",
      cta: "عدّل",
    },
    {
      done: d.journey.products > 0,
      title: "أضف أول منتج",
      text: "بالمقاسات والألوان وكمية كل وحدة",
      to: "/products/new",
      cta: "أضف منتج",
    },
    {
      done: d.latestOrders.length > 0,
      title: "سجّل أول طلب",
      text: "من رسالة واتساب أو إنستغرام",
      to: "/orders/new",
      cta: "سجّل طلب",
    },
    {
      done: d.activity.some((a) => a.kind === "expense"),
      title: "سجّل مصروف",
      text: "عشان نحسبلك الربح الحقيقي",
      to: "/finance/expenses?add=1",
      cta: "سجّل مصروف",
    },
  ];
  const done = steps.filter((s) => s.done).length;

  return (
    <>
      <PageHeader
        title={`أهلًا فيك بلمّة يا ${firstName(account.fullName)}`}
        subtitle="خطوات قليلة وبكون كل شغلك بمكانه"
      />
      <div className="grid g-main">
        <div className="card">
          <div className="row" style={{ gap: 16, marginBottom: 8 }}>
            <div className="ring" style={{ ["--p" as string]: Math.round((done / steps.length) * 100) }}>
              <span>
                <bdi>
                  {done}/{steps.length}
                </bdi>
              </span>
            </div>
            <div>
              <h3>ابدأ هون</h3>
              <p className="muted">كل خطوة بتاخد أقل من دقيقة</p>
            </div>
          </div>
          <ul className="checklist">
            {steps.map((s, i) => (
              <li key={s.title}>
                {s.done ? (
                  <span className="done">
                    <Icon name="check" size={16} />
                  </span>
                ) : (
                  <span className="todo" />
                )}
                <span className="grow">
                  <b>{s.title}</b>
                  <br />
                  <span className="caption">{s.text}</span>
                </span>
                <ButtonLink
                  to={s.to}
                  variant={s.done ? "ghost" : i === steps.findIndex((x) => !x.done) ? "primary" : "outline"}
                  size="sm"
                >
                  {s.cta}
                </ButtonLink>
              </li>
            ))}
          </ul>
        </div>
        <EmptyState
          art={<SleepingCourier />}
          title="هون رح تشوف «لمّة اليوم»"
          text="أول ما تسجّل طلبات، بنجمعلك كل شي بجملة وحدة كل يوم."
        />
      </div>
    </>
  );
}
