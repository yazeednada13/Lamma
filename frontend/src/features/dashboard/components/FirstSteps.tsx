import { useCurrentAccount } from "@/features/auth";
import { businessTypeInfo, channelLabel, useBusinessTypeLabel, useSalesChannelSettings } from "@/features/settings";
import { firstName } from "@/shared/lib/personName";
import { SleepingCourier } from "@/shared/ui/brand/EmptyScenes";
import { Illustration } from "@/shared/ui/brand/Illustration";
import { LammaMark } from "@/shared/ui/brand/LammaMark";
import { ButtonLink } from "@/shared/ui/Button";
import { Icon } from "@/shared/ui/Icon";
import { Link } from "react-router";
import type { Dashboard } from "../api/dashboardApi";
import { greeting, todayLabel } from "../domain/dashboardDomain";
import type { FloatItem } from "./DashboardMotion";
import s from "./welcome.module.css";

interface Step {
  done: boolean;
  title: string;
  text: string;
  to: string;
  cta: string;
}

/**
 * The welcome page of a new account (before the first order): «فاتورة الافتتاح». The getting-started steps are printed
 * as the lines of an order slip (D-160): finished lines are stamped «تمّ», the next one is called out on the stage.
 * One orchestrated entrance (the slip prints, then the stamps land); everything is still under reduced motion.
 */
export function FirstSteps({ d, tips }: { d: Dashboard; tips: FloatItem[] }) {
  const account = useCurrentAccount();
  const channels = useSalesChannelSettings();
  const business = account.business!;
  const businessTypeLabel = useBusinessTypeLabel(business.businessType);
  const enabledChannels = channels.data?.channels.filter((c) => c.isEnabled).map((c) => channelLabel[c.channel]) ?? [];
  const art = businessTypeInfo[business.businessType]?.art ?? "other";

  const steps: Step[] = [
    {
      done: true,
      title: "جهّز مشروعك",
      text: `${businessTypeLabel}${enabledChannels.length > 0 ? ` · ${enabledChannels.join(" و")}` : ""}`,
      to: "/settings",
      cta: "عدّل",
    },
    { done: d.journey.products > 0, title: "أضف أول منتج", text: "بالمقاسات والألوان وكمية كل وحدة", to: "/products/new", cta: "أضف منتج" },
    { done: d.latestOrders.length > 0, title: "سجّل أول طلب", text: "من رسالة واتساب أو إنستغرام", to: "/orders/new", cta: "سجّل طلب" },
    {
      done: d.activity.some((a) => a.kind === "expense"),
      title: "سجّل مصروف",
      text: "عشان نحسبلك الربح الحقيقي",
      to: "/finance/expenses?add=1",
      cta: "سجّل مصروف",
    },
  ];
  const done = steps.filter((x) => x.done).length;
  const nextIndex = steps.findIndex((x) => !x.done);
  const next = nextIndex >= 0 ? steps[nextIndex] : null;

  return (
    <div className={s.page}>
      <section className={s.stage} aria-labelledby="welcome-title">
        <div className={s.hello}>
          <span className={s.kicker}>
            <LammaMark size={22} draw /> {greeting()}، {todayLabel(d.today)}
          </span>
          <h1 id="welcome-title" className={s.title}>
            أهلًا فيك بلمّة يا {firstName(account.fullName)}
          </h1>
          <p className={s.lead}>
            هاي فاتورة افتتاح «{business.name}». كل سطر فيها خطوة بتاخد أقل من دقيقة، ولما تخلص بيصير كل شغلك بمكانه.
          </p>

          {next && (
            <div className={s.next}>
              <span className={s.nextLabel}>الخطوة الجاية</span>
              <b className={s.nextTitle}>{next.title}</b>
              <span className={s.nextText}>{next.text}</span>
              <ButtonLink to={next.to} variant="accent" size="lg" iconEnd="arrow-left" className={s.nextCta}>
                يلا، {next.title}
              </ButtonLink>
            </div>
          )}

          <div className={s.meter} role="progressbar" aria-label="خطوات البداية" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}>
            {steps.map((x, i) => (
              <i key={x.title} className={x.done ? s.meterDone : i === nextIndex ? s.meterNow : undefined} />
            ))}
            <span>
              <bdi>
                {done} من {steps.length}
              </bdi>{" "}
              جاهزين
            </span>
          </div>
        </div>

        <div className={s.desk}>
          <div className={s.slot} aria-hidden="true" />
          <article className={s.slip} aria-label="خطوات البداية">
            <span className={s.productArt} aria-hidden="true">
              <Illustration kind="product" template={art} />
            </span>
            <span className={s.sticker} aria-hidden="true">
              <Illustration kind="sticker" name="star" />
            </span>
            <header className={s.slipHead}>
              <span className={s.slipBrand}>
                <LammaMark size={18} color="#3F4F2A" /> فاتورة الافتتاح
              </span>
              <b className={s.slipShop}>{business.name}</b>
              <span className={s.slipMeta}>{todayLabel(d.today)}</span>
            </header>

            <ol className={s.lines}>
              {steps.map((x, i) => (
                <li key={x.title} className={`${s.line} ${x.done ? s.isDone : ""} ${i === nextIndex ? s.isNext : ""}`} style={{ ["--i" as string]: i }}>
                  <span className={s.num}>{String(i + 1).padStart(2, "0")}</span>
                  <span className={s.what}>
                    <b>{x.title}</b>
                    <span className={s.caption}>{x.text}</span>
                  </span>
                  <span className={s.leader} aria-hidden="true" />
                  {x.done ? (
                    <span className={s.doneCell}>
                      <span className={s.stamp}>تمّ</span>
                      <Link to={x.to} className={s.edit}>
                        {x.cta}
                      </Link>
                    </span>
                  ) : (
                    <ButtonLink to={x.to} size="sm" variant={i === nextIndex ? "primary" : "outline"}>
                      {x.cta}
                    </ButtonLink>
                  )}
                </li>
              ))}
            </ol>

            <footer className={s.slipFoot}>
              <span>المجموع</span>
              <span className={s.leader} aria-hidden="true" />
              <b>
                <bdi>
                  {done}/{steps.length}
                </bdi>{" "}
                خطوات
              </b>
            </footer>
            <div className={s.barcode} aria-hidden="true" />
          </article>
        </div>
      </section>

      <section className={s.ribbon} aria-label="شو بتعمل لمّة عنك">
        <h2 className={s.ribbonTitle}>وبينما إنت بتبيع، لمّة بتعمل عنك:</h2>
        <div className={s.track}>
          <ul className={s.belt}>
            {[...tips, ...tips].map((t, i) => (
              <li key={`${t.title}-${i}`} className={s.tip} aria-hidden={i >= tips.length || undefined}>
                <span className={`chipi tone-${t.tone}`}>
                  <Icon name={t.icon} size={16} />
                </span>
                <span>
                  <b>{t.title}</b>
                  <small>{t.text}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={s.later}>
        <div className={s.laterArt}>
          <SleepingCourier />
        </div>
        <div>
          <h2>هون رح تشوف «لمّة اليوم»</h2>
          <p>أول ما تسجّل طلبات، بنجمعلك كل شي بجملة وحدة كل يوم: شو انباع، مين دفع، ووين المندوب.</p>
        </div>
      </section>
    </div>
  );
}
