import { useState } from "react";
import { phoneDisplay, placeLabel, QuickAddCustomerDrawer } from "@/features/customers";
import { channelIcon, channelLabel, type SalesChannelCode } from "@/features/settings";
import { errorMessage } from "@/services/api/apiClient";
import { formatMoneyNumber, toFils } from "@/shared/lib/money";
import { Button } from "@/shared/ui/Button";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { Icon } from "@/shared/ui/Icon";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { useCustomerOptions, type CustomerOption } from "../api/ordersApi";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

interface Props {
  done: boolean;
  customer: { data?: CustomerOption; error: unknown } | null;
  /** The customer can't change when editing an order. */
  locked: boolean;
  channels: readonly SalesChannelCode[];
  channel: SalesChannelCode | null;
  onChoose: (customer: CustomerOption) => void;
  onClear: () => void;
  onChannel: (channel: SalesChannelCode) => void;
}

/** Step 1: pick or quick-add the customer (search by name or number) and where the order came from. */
export function OrderCustomerSection({ done, customer, locked, channels, channel, onChoose, onClear, onChannel }: Props) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const options = useCustomerOptions(search.trim());
  const c = customer?.data;

  const choose = (x: CustomerOption) => {
    setSearch("");
    onChoose(x);
  };

  return (
    <section className={`card osec${done ? " is-done" : ""}`} id="s1" aria-labelledby="s1-title">
      <div className="osec__h">
        <span className="osec__n">1</span>
        <h2 id="s1-title">العميل</h2>
      </div>
      {customer ? (
        c ? (
          <>
            <div className="selcust">
              <span className="ring-av" style={{ ["--p" as string]: Math.min(100, c.orderCount * 10) }}>
                <span>{initialsOf(c.name)}</span>
              </span>
              <div className="grow">
                <b>{c.name}</b>
                <div className="caption">
                  {c.phone && <span className="ltr">{phoneDisplay(c.phone)}</span>}
                  {c.phone && " · "}
                  {placeLabel(c.city, c.area) || "بدون عنوان"} · {c.orderCount} طلبات
                </div>
              </div>
              {toFils(c.balanceDue) > 0 && (
                <span className="selcust__warn">
                  <Icon name="alert-triangle" size={16} /> عليه {formatMoneyNumber(c.balanceDue)} د.أ
                </span>
              )}
              {!locked && (
                <Button variant="ghost" size="sm" onClick={onClear}>
                  تغيير
                </Button>
              )}
            </div>
            {c.isArchived && <FormAlert>العميل مؤرشف. استرجعه من صفحته قبل ما تسجّل له طلب.</FormAlert>}
          </>
        ) : customer.error ? (
          <FormAlert>{errorMessage(customer.error)}</FormAlert>
        ) : (
          <p className="caption">بتحمّل…</p>
        )
      ) : (
        <>
          <span className="control">
            <Icon name="search" />
            <input placeholder="اسم العميل أو رقمه" aria-label="دوّر على عميل" value={search} onChange={(e) => setSearch(e.target.value)} />
          </span>
          <div className="select-list" style={{ boxShadow: "none", marginTop: 8 }} role="listbox" aria-label="العملاء">
            {(options.data?.items ?? [])
              .filter((x) => !x.isArchived)
              .map((x) => (
                <button key={x.id} type="button" role="option" aria-selected={false} className="select-list__item" onClick={() => choose(x)}>
                  <span className="avatar avatar--sm">{initialsOf(x.name)}</span>
                  {x.name}
                  <span className="caption ltr end">{x.phone ? phoneDisplay(x.phone) : ""}</span>
                </button>
              ))}
            <button type="button" className="select-list__item select-list__item--create" onClick={() => setAdding(true)}>
              <Icon name="plus" size={16} /> عميل جديد{search.trim() ? ` «${search.trim()}»` : ""}
            </button>
          </div>
        </>
      )}
      <div className="row wrap" style={{ marginTop: 12, gap: 6 }} role="radiogroup" aria-label="من وين إجى الطلب">
        {channels.map((ch) => (
          <button key={ch} type="button" role="radio" aria-checked={channel === ch} className={`chip${channel === ch ? " is-selected" : ""}`} onClick={() => onChannel(ch)}>
            <Icon name={channelIcon[ch]} size={16} /> {channelLabel[ch]}
          </button>
        ))}
      </div>
      <QuickAddCustomerDrawer
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={(saved) => {
          setAdding(false);
          choose(saved);
          toast(`انضاف «${saved.name}»`);
        }}
      />
    </section>
  );
}
