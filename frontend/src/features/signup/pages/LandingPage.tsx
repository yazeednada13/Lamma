import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { Icon } from "@/shared/ui/Icon";
import { GatherHero } from "../components/GatherHero";
import { JourneyScene } from "../components/JourneyScene";
import { useInViewOnce } from "../components/landingHooks";
import { SignupForm } from "../components/SignupForm";
import { BeforeAfter, FeatureStory, Ticker } from "../components/StorySections";
import { Faq, Pricing, ProfitMoment, Steps } from "../components/ValueSections";
import s from "../landing.module.css";

/** A section heading block that rises into place the first time it is seen. */
function Intro({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  const [ref, seen] = useInViewOnce<HTMLDivElement>(0.4);
  return (
    <div ref={ref} className={`${s.reveal} ${seen ? s.revealOn : ""}`}>
      <h2 className={s.h2}>{title}</h2>
      {sub && <p className={s.sub}>{sub}</p>}
    </div>
  );
}

/** Each word rises in turn; plain spaces between them keep the heading's accessible name readable. */
const words = (text: string, from: number) =>
  text.split(" ").flatMap((w, i) => [
    i > 0 ? " " : null,
    <span key={w + i} className={s.word} style={{ "--w": from + i } as CSSProperties}>
      {w}
    </span>,
  ]);

/** Public landing page (D-160, D-174): the Instagram bio link. Anonymous visitors at `/` see it. */
export function LandingPage() {
  const joinRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [joinVisible, setJoinVisible] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = joinRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setJoinVisible(Boolean(e?.isIntersecting)), { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (window.location.hash === "#join") joinRef.current?.scrollIntoView();
  }, []);

  const toJoin = () => joinRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const toFeatures = () => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });

  // The hero glow follows the pointer (mouse only).
  const onHeroMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !heroRef.current) return;
    const r = heroRef.current.getBoundingClientRect();
    heroRef.current.style.setProperty("--px", `${e.clientX - r.left}px`);
    heroRef.current.style.setProperty("--py", `${e.clientY - r.top}px`);
  };

  return (
    <div className={s.page}>
      <header className={`${s.top} ${scrolled ? s.topSolid : ""}`}>
        <div className={`${s.wrap} ${s.topIn}`}>
          <Link to="/" aria-label="لمّة، الصفحة الرئيسية">
            <img src="/logo/lamma-lockup-ar-horizontal-reversed.svg" alt="لمّة" />
          </Link>
          <nav className={s.topLinks} aria-label="الحساب">
            <Link className={s.login} to="/login">
              تسجيل الدخول
            </Link>
            <button type="button" className={`${s.cta} ${s.ctaSm}`} onClick={toJoin}>
              جرّب مجانًا
            </button>
          </nav>
        </div>
      </header>

      <main>
        <section className={s.hero} ref={heroRef} onPointerMove={onHeroMove}>
          <span className={s.spot} aria-hidden="true" />
          <div className={`${s.wrap} ${s.heroGrid}`}>
            <div>
              <span className={s.badge}>
                <i>
                  <Icon name="gift" size={16} />
                </i>
                أول شهر علينا، بدون بطاقة
              </span>
              <h1 className={s.h1}>
                <span className={s.h1Line}>{words("كل شغلك", 0)}</span>
                <span className={s.h1Accent}>
                  {words("بمكان واحد", 2)}
                  <svg viewBox="0 0 300 22" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M4 14 C 70 4, 150 22, 296 8" />
                  </svg>
                </span>
              </h1>
              <p className={s.lead}>
                بتبيع عالإنستغرام والواتساب؟ لمّة بتلمّلك <b>الطلبات والمخزون والزباين والديون وحساب المندوب</b>، وبتحسبلك ربحك الحقيقي لحالها.
              </p>
              <div className={s.ctas}>
                <button type="button" className={s.cta} onClick={toJoin}>
                  ابدأ شهرك المجاني
                </button>
                <button type="button" className={s.ghost} onClick={toFeatures}>
                  شو بتعمل لمّة؟
                </button>
              </div>
              <div className={s.trust}>
                <span>
                  <Icon name="circle-check" size={16} /> كل المزايا مفتوحة
                </span>
                <span>
                  <Icon name="phone" size={16} /> بتشتغل عالموبايل
                </span>
                <span>
                  <Icon name="lock" size={16} /> بياناتك إلك لحالك
                </span>
              </div>
            </div>
            <GatherHero />
          </div>
        </section>

        <Ticker />

        <section className={s.section}>
          <div className={s.wrap}>
            <Intro
              title="بتبيع أونلاين؟ حلو… لحد ما تكثر الطلبات"
              sub="رسايل، ملاحظات بالموبايل، دفتر ديون، وحسابات براسك. جرّب الزر وشوف الفرق."
            />
            <BeforeAfter />
          </div>
        </section>

        <section className={`${s.section} ${s.dark}`} id="features">
          <div className={s.wrap}>
            <Intro title="كل إشي مربوط ببعضه" sub="الطلب بيحجز المخزون، التوصيل بيحسب الربح، والدفعة بتسكّر الدين. بدون ما تعيد تكتب إشي مرتين." />
            <FeatureStory />
          </div>
        </section>

        <section className={s.section}>
          <div className={s.wrap}>
            <Intro
              title="طلب واحد، من أول رسالة لآخر قرش"
              sub="تابع طلب رنا وهو بيمشي بلمّة: كل خطوة بتنسجل لحالها، والمصاري بتنحسب لما توصل إيدك. اكبس على أي مرحلة."
            />
            <JourneyScene />
          </div>
        </section>

        <section className={s.section} style={{ paddingTop: 0 }}>
          <div className={s.wrap}>
            <Intro title="مش كم بعت… كم ربحت" sub="لمّة بتطرح المرتجعات وتكلفة البضاعة والمصاريف، وبتعطيك الرقم الحقيقي اللي ضل إلك." />
            <ProfitMoment />
          </div>
        </section>

        <section className={s.section} style={{ paddingTop: 0 }}>
          <div className={s.wrap}>
            <Intro title="ثلاث خطوات، وبتكون جاهز" />
            <Steps />
          </div>
        </section>

        <section className={s.section} style={{ paddingTop: 0 }}>
          <div className={s.wrap}>
            <Intro title="جرّب شهر كامل، وبعدين قرّر" sub="سعر واحد فيه كل إشي. بدون باقات معقدة وبدون رسوم مخفية." />
            <Pricing />
          </div>
        </section>

        <section className={s.section} style={{ paddingTop: 0 }}>
          <div className={s.wrap}>
            <Intro title="عندك سؤال؟" />
            <Faq />
          </div>
        </section>

        <section className={`${s.section} ${s.dark} ${s.join}`} id="join" ref={joinRef}>
          <svg className={s.joinMark} viewBox="0 0 100 100" aria-hidden="true">
            <path d="M18 44C16 74 44 76 48 54C52 76 80 72 84 24" fill="none" stroke="#F4A261" strokeWidth="13" strokeLinecap="round" />
          </svg>
          <div className={`${s.wrap} ${s.joinGrid}`}>
            <div>
              <h2 className={s.h2}>جاهز تلمّ شغلك؟</h2>
              <p className={s.sub}>عبّي اسمك وإيميلك ورقمك، وبيوصلك رابط التسجيل خلال لحظات.</p>
              <ul className={s.perks}>
                <li>
                  <i>
                    <Icon name="gift" size={20} />
                  </i>
                  شهر كامل مجاني بكل المزايا
                </li>
                <li>
                  <i>
                    <Icon name="credit-card" size={20} />
                  </i>
                  بدون بطاقة وبدون التزام
                </li>
                <li>
                  <i>
                    <Icon name="brand-whatsapp" size={20} />
                  </i>
                  مساعدة بالواتساب إذا احتجت
                </li>
              </ul>
            </div>
            <SignupForm />
          </div>
        </section>
      </main>

      <footer className={s.foot}>
        <div className={`${s.wrap} ${s.footIn}`}>
          <span>لمّة، كل شغلك بمكان واحد</span>
          <Link to="/login">عندك حساب؟ سجّل دخول</Link>
        </div>
      </footer>

      <div className={`${s.sticky} ${joinVisible ? s.stickyHidden : ""}`}>
        <button type="button" className={s.cta} onClick={toJoin}>
          ابدأ شهرك المجاني
        </button>
      </div>
    </div>
  );
}
