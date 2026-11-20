import { paymentMethodLabel, type PaymentMethodCode } from "@/features/settings";
import { MoneyField } from "@/shared/ui/form/MoneyField";
import { TextField } from "@/shared/ui/form/TextField";
import { Icon } from "@/shared/ui/Icon";
import type { OrderFormState } from "../domain/orderFormModel";

type Patch = (patch: Partial<OrderFormState>) => void;

const MONEY_ERROR = "اكتب مبلغ صحيح بمنزلتين عشريتين بالأكثر.";

/** Step 3: delivery fee, discount (D-126), address (prefilled) and the gift option (D-129). */
export function OrderDeliverySection({ done, form, set, feeInvalid, discountInvalid, discountTooHigh }: { done: boolean; form: OrderFormState; set: Patch; feeInvalid: boolean; discountInvalid: boolean; discountTooHigh: boolean }) {
  const giftMissing = form.isGift && !form.recipientName.trim();
  return (
    <section className={`card osec${done ? " is-done" : ""}`} id="s3" aria-labelledby="s3-title">
      <div className="osec__h">
        <span className="osec__n">3</span>
        <h2 id="s3-title">التوصيل والإضافات</h2>
      </div>
      <div className="grid g-2">
        <MoneyField label="رسوم التوصيل (على الزبون)" value={form.fee} onChange={(e) => set({ fee: e.target.value })} error={feeInvalid ? MONEY_ERROR : undefined} />
        <MoneyField label="خصم" value={form.discount} onChange={(e) => set({ discount: e.target.value })} error={discountInvalid ? MONEY_ERROR : discountTooHigh ? "الخصم أكبر من مجموع المنتجات." : undefined} />
      </div>
      <div style={{ marginTop: 12 }}>
        <TextField label="العنوان" icon="map-pin" maxLength={200} value={form.address} onChange={(e) => set({ address: e.target.value })} />
      </div>
      <div className="opts" style={{ marginTop: 14 }}>
        <label className={`opt${form.isGift ? " is-on" : ""}`}>
          <span className="chipi tone-brick">
            <Icon name="gift" />
          </span>
          <span>
            <b>هدية</b>
            <span>مستلم ورسالة إهداء</span>
          </span>
          <input type="checkbox" role="switch" className="toggle" checked={form.isGift} onChange={(e) => set({ isGift: e.target.checked })} aria-label="هدية" />
        </label>
      </div>
      {form.isGift && (
        <div className="grid g-2" style={{ marginTop: 12 }}>
          <TextField label="اسم المستلم" required maxLength={100} value={form.recipientName} onChange={(e) => set({ recipientName: e.target.value })} error={giftMissing ? "اكتب اسم مستلم الهدية." : undefined} />
          <TextField label="رقم المستلم" icon="phone" ltr inputMode="tel" maxLength={30} value={form.recipientPhone} onChange={(e) => set({ recipientPhone: e.target.value })} />
          <TextField label="رسالة الإهداء" placeholder="كل سنة وإنتِ بخير" maxLength={300} value={form.giftMessage} onChange={(e) => set({ giftMessage: e.target.value })} />
        </div>
      )}
    </section>
  );
}

export interface DepositState {
  /** Methods a deposit can be recorded with (enabled, never COD, D-138). */
  methods: readonly PaymentMethodCode[];
  method: PaymentMethodCode | null;
  error?: string;
  help?: string;
}

/** Step 4: the expected payment method (enabled methods only), an optional deposit for a new order (D-135), and a note. */
export function OrderPaymentSection({ done, form, set, methods, deposit }: { done: boolean; form: OrderFormState; set: Patch; methods: readonly PaymentMethodCode[]; deposit?: DepositState }) {
  return (
    <section className={`card osec${done ? " is-done" : ""}`} id="s4" aria-labelledby="s4-title">
      <div className="osec__h">
        <span className="osec__n">4</span>
        <h2 id="s4-title">الدفع والملاحظة</h2>
      </div>
      <div className="field">
        <span className="field__label">طريقة الدفع المتوقعة</span>
        <div className="row wrap" style={{ gap: 6 }} role="radiogroup" aria-label="طريقة الدفع المتوقعة">
          {methods.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={form.paymentMethod === m} className={`chip${form.paymentMethod === m ? " is-selected" : ""}`} onClick={() => set({ paymentMethod: form.paymentMethod === m ? null : m })}>
              {paymentMethodLabel[m]}
            </button>
          ))}
        </div>
        <span className="field__help">«عند الاستلام» يعني المندوب بيجمع المبلغ، وبيضل عند شركة التوصيل لحد التسوية.</span>
      </div>
      {deposit && (
        <div className="grid g-2" style={{ marginTop: 12 }}>
          <MoneyField label="المدفوع هلأ (عربون)" placeholder="0.00" value={form.depositAmount} onChange={(e) => set({ depositAmount: e.target.value })} error={deposit.error} help={deposit.help ?? "اختياري: إذا دفع جزء أو كل المبلغ وقت الطلب"} />
          {form.depositAmount.trim() !== "" && (
            <div className="field">
              <span className="field__label">طريقة دفع العربون</span>
              {deposit.methods.length === 0 ? (
                <span className="field__error">فعّل طريقة دفع غير «عند الاستلام» من الإعدادات.</span>
              ) : (
                <div className="row wrap" style={{ gap: 6 }} role="radiogroup" aria-label="طريقة دفع العربون">
                  {deposit.methods.map((m) => (
                    <button key={m} type="button" role="radio" aria-checked={deposit.method === m} className={`chip${deposit.method === m ? " is-selected" : ""}`} onClick={() => set({ depositMethod: m })}>
                      {paymentMethodLabel[m]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <TextField label="ملاحظة على الطلب" maxLength={500} value={form.note} onChange={(e) => set({ note: e.target.value })} />
      </div>
    </section>
  );
}
