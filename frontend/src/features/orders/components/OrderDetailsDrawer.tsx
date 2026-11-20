import { useState } from "react";
import { errorMessage } from "@/services/api/apiClient";
import { Button } from "@/shared/ui/Button";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { TextField } from "@/shared/ui/form/TextField";
import { Toggle } from "@/shared/ui/form/Toggle";
import { Drawer } from "@/shared/ui/overlay/Drawer";
import { useUpdateOrderDetails, type OrderDetails } from "../api/ordersApi";

/** Address, gift and note of an order; editable until it is delivered or closed (D-127, D-129). */
export function OrderDetailsDrawer({ order, open, onClose, onSaved }: { order: OrderDetails; open: boolean; onClose: () => void; onSaved: () => void }) {
  return (
    <Drawer open={open} onClose={onClose} title="تفاصيل التوصيل والهدية">
      {open && <DetailsForm order={order} onClose={onClose} onSaved={onSaved} />}
    </Drawer>
  );
}

function DetailsForm({ order, onClose, onSaved }: { order: OrderDetails; onClose: () => void; onSaved: () => void }) {
  const save = useUpdateOrderDetails();
  const [address, setAddress] = useState(order.deliveryAddress ?? "");
  const [isGift, setIsGift] = useState(order.isGift);
  const [recipientName, setRecipientName] = useState(order.recipientName ?? "");
  const [recipientPhone, setRecipientPhone] = useState(order.recipientPhone ?? "");
  const [giftMessage, setGiftMessage] = useState(order.giftMessage ?? "");
  const [note, setNote] = useState(order.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const giftMissing = isGift && !recipientName.trim();

  const submit = async () => {
    setError(null);
    try {
      await save.mutateAsync({
        id: order.id,
        body: {
          deliveryAddress: address.trim() || null,
          isGift,
          recipientName: isGift ? recipientName.trim() || null : null,
          recipientPhone: isGift ? recipientPhone.trim() || null : null,
          giftMessage: isGift ? giftMessage.trim() || null : null,
          note: note.trim() || null,
        },
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <form
      className="col"
      style={{ gap: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!giftMissing) void submit();
      }}
    >
      {error && <FormAlert>{error}</FormAlert>}
      <TextField label="العنوان" icon="map-pin" maxLength={200} value={address} onChange={(e) => setAddress(e.target.value)} />
      <label className="row between" style={{ gap: 12 }}>
        <span>
          <b>هدية</b>
          <br />
          <span className="caption">مستلم ورسالة إهداء</span>
        </span>
        <Toggle checked={isGift} onChange={(e) => setIsGift(e.target.checked)} aria-label="هدية" />
      </label>
      {isGift && (
        <>
          <TextField label="اسم المستلم" required maxLength={100} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} error={giftMissing ? "اكتب اسم مستلم الهدية." : undefined} />
          <TextField label="رقم المستلم" icon="phone" ltr inputMode="tel" maxLength={30} value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} />
          <TextField label="رسالة الإهداء" maxLength={300} value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} />
        </>
      )}
      <TextField label="ملاحظة على الطلب" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="row" style={{ gap: 8 }}>
        <Button type="submit" loading={save.isPending} disabled={giftMissing}>
          حفظ
        </Button>
        <Button variant="ghost" onClick={onClose}>
          إلغاء
        </Button>
      </div>
    </form>
  );
}
