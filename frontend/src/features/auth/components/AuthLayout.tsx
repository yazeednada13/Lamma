import type { ReactNode } from "react";
import { Link } from "react-router";
import { Illustration } from "@/shared/ui/brand/Illustration";
import { Icon } from "@/shared/ui/Icon";

/** Split auth screen: brand side (prototype `authSide`) + form card. */
export function AuthLayout({ title, subtitle, children }: { title: ReactNode; subtitle: string; children: ReactNode }) {
  return (
    <div className="auth2">
      <aside className="auth2__side">
        <Link to="/login">
          <img src="/logo/lamma-wordmark-ar-reversed.svg" alt="لمّة" height={38} />
        </Link>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="auth2__stage" aria-hidden="true">
          <Illustration kind="gather" play />
          <div className="floaty" style={{ top: "6%", insetInlineStart: "4%", animationDelay: "0s,.2s" }}>
            <span className="chipi tone-blue">
              <Icon name="brand-whatsapp" size={16} />
            </span>
            <span>
              <b>طلب جديد من رنا</b>فستان كتان · M زيتي
            </span>
          </div>
          <div className="floaty" style={{ top: "40%", insetInlineEnd: "2%", animationDelay: "1.2s,.4s" }}>
            <span className="chipi tone-apricot">
              <Icon name="package" size={16} />
            </span>
            <span>
              <b>بلوزة حرير</b>ضل 2 · قرب يخلص
            </span>
          </div>
          <div className="floaty" style={{ bottom: "4%", insetInlineStart: "14%", animationDelay: "2.4s,.6s" }}>
            <span className="chipi tone-green">
              <Icon name="wallet" size={16} />
            </span>
            <span>
              <b>ربح الشهر</b>
              <bdi>+12%</bdi> عن الشهر الماضي
            </span>
          </div>
        </div>
        <div className="trust">
          <span>
            <Icon name="circle-check" size={16} /> أول شهر مجاني
          </span>
          <span>
            <Icon name="lock" size={16} /> بياناتك إلك
          </span>
          <span>
            <Icon name="phone" size={16} /> بيشتغل عالموبايل
          </span>
        </div>
      </aside>
      <div className="auth2__form">{children}</div>
    </div>
  );
}
