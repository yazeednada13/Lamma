import { useState } from "react";
import { channelIcon, channelLabel, SALES_CHANNELS, useSalesChannelSettings, type SalesChannelCode } from "@/features/settings";
import { ApiError, errorMessage } from "@/services/api/apiClient";
import { Button, ButtonLink } from "@/shared/ui/Button";
import { Chip } from "@/shared/ui/Chip";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { SelectField } from "@/shared/ui/form/SelectField";
import { TextField } from "@/shared/ui/form/TextField";
import { Icon } from "@/shared/ui/Icon";
import { Drawer } from "@/shared/ui/overlay/Drawer";
import { useSaveCustomer, type CustomerDetails } from "../api/customersApi";
import { GOVERNORATES, phoneDisplay } from "../domain/customerDomain";
import { CustomerAvatar } from "./CustomerBits";

interface CustomerFormDrawerProps {
  open: boolean;
  /** The customer to edit; omitted for a new customer (quick add). */
  customer?: CustomerDetails;
  onClose: () => void;
  onSaved?: (customer: CustomerDetails) => void;
}

/** Quick add / edit customer (prototype `App.addCustomer`, D-116–D-118). Reused by the Phase 5 new-order flow. */
export function CustomerFormDrawer({ open, customer, onClose, onSaved }: CustomerFormDrawerProps) {
  return (
    <Drawer open={open} onClose={onClose} title={customer ? "تعديل العميل" : "عميل جديد"}>
      {open && <CustomerForm key={customer?.id ?? "new"} customer={customer} onClose={onClose} onSaved={onSaved} />}
    </Drawer>
  );
}

function CustomerForm({ customer, onClose, onSaved }: Omit<CustomerFormDrawerProps, "open">) {
  const channels = useSalesChannelSettings();
  const save = useSaveCustomer();
  const defaultChannel = channels.data?.channels.find((c) => c.isEnabled)?.channel ?? "instagram";
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(phoneDisplay(customer?.phone ?? null));
  const [channel, setChannel] = useState<SalesChannelCode | null>(customer?.channel ?? null);
  const [city, setCity] = useState(customer?.city ?? "");
  const [area, setArea] = useState(customer?.area ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const chosenChannel = channel ?? defaultChannel;

  const submit = async () => {
    if (!name.trim()) return setErrors({ name: "الاسم مطلوب." });
    setErrors({});
    setDuplicate(null);
    setFormError(null);
    try {
      const saved = await save.mutateAsync({
        id: customer?.id,
        body: { name: name.trim(), phone: phone.trim() || null, channel: chosenChannel, city: city || null, area: area.trim() || null, notes: notes.trim() || null },
      });
      onSaved?.(saved);
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.code === "customer.duplicate_phone") {
        const id = e.problem.existingCustomerId;
        setErrors({ phone: "الرقم مستخدم لعميل ثاني عندك." });
        if (typeof id === "string") setDuplicate({ id, name: String(e.problem.existingCustomerName ?? "") });
      } else if (e instanceof ApiError && e.code === "customer.invalid_phone") {
        setErrors({ phone: e.message });
      } else if (e instanceof ApiError && Object.keys(e.fieldErrors).length > 0) {
        setErrors(Object.fromEntries(Object.entries(e.fieldErrors).map(([k, v]) => [k, v[0] ?? ""])));
      } else {
        setFormError(errorMessage(e));
      }
    }
  };

  return (
    <form
      className="col"
      style={{ gap: 14 }}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {formError && <FormAlert>{formError}</FormAlert>}
      <TextField label="الاسم" required autoFocus maxLength={100} placeholder="الاسم زي ما بتعرفه" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
      <TextField label="رقم الهاتف" ltr inputMode="tel" affix="+962" placeholder="7X XXX XXXX" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
      {duplicate && (
        <div className="dup-notice" role="status">
          <CustomerAvatar name={duplicate.name} percent={0} size={40} />
          <span className="dup-notice__text">
            <span className="caption">هاد الرقم مسجّل عندك باسم</span>
            <b>{duplicate.name}</b>
          </span>
          <ButtonLink to={`/customers/${duplicate.id}`} onClick={onClose} variant="outline" size="sm" iconEnd="arrow-left">
            عرض ملفه
          </ButtonLink>
        </div>
      )}
      <div className="field">
        <span className="field__label">من وين إجى؟</span>
        <div className="row wrap" role="group" aria-label="القناة">
          {SALES_CHANNELS.map((c) => (
            <Chip key={c} selected={chosenChannel === c} onClick={() => setChannel(c)}>
              <Icon name={channelIcon[c]} size={16} /> {channelLabel[c]}
            </Chip>
          ))}
        </div>
      </div>
      <div className="grid g-2">
        <SelectField label="المحافظة" options={[{ value: "", label: "—" }, ...GOVERNORATES.map((g) => ({ value: g.code, label: g.label }))]} value={city} onChange={(e) => setCity(e.target.value)} error={errors.city} />
        <TextField label="المنطقة" maxLength={100} placeholder="مثلًا خلدا" value={area} onChange={(e) => setArea(e.target.value)} error={errors.area} />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="customer-notes">
          ملاحظات
        </label>
        <span className="control control--textarea">
          <textarea id="customer-notes" rows={3} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثلًا بتحب المقاس M، التوصيل بعد 5" />
        </span>
      </div>
      <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={onClose}>
          إلغاء
        </Button>
        <Button type="submit" loading={save.isPending}>
          حفظ
        </Button>
      </div>
    </form>
  );
}
