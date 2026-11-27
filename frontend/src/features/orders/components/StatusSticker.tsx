import type { ReactNode } from "react";
import type { OrderStatus } from "../api/ordersApi";

/** Column colours of the board: a soft base and an ink, per status (matches the column bars). */
const TONE: Record<OrderStatus, { base: string; ink: string }> = {
  new: { base: "#DCE8F5", ink: "#2F6FA6" },
  confirmed: { base: "#E7E9D8", ink: "#3F4F2A" },
  preparing: { base: "#FDEBDB", ink: "#B8702E" },
  courier: { base: "#DCE8F5", ink: "#2F6FA6" },
  delivered: { base: "#DFF0E4", ink: "#3E8E5E" },
  cancelled: { base: "#F6E0DA", ink: "#C8553D" },
  returned: { base: "#E7E9D8", ink: "#55604A" },
};

const DARK = "#1F2617";
const APRICOT = "#F4A261";
const KRAFT = "#E9C9A0";
const KRAFT_2 = "#D9B286";

function art(status: OrderStatus, ink: string): ReactNode {
  switch (status) {
    case "new":
      // A chat bubble with an unread dot: the order just came in from a message.
      return (
        <>
          <path
            d="M28 33h44a6 6 0 0 1 6 6v21a6 6 0 0 1-6 6H48l-11 9v-9h-9a6 6 0 0 1-6-6V39a6 6 0 0 1 6-6z"
            fill="#fff"
            stroke={ink}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <circle cx="39" cy="50" r="3.4" fill={ink} />
          <circle cx="50" cy="50" r="3.4" fill={ink} />
          <circle cx="61" cy="50" r="3.4" fill={ink} />
          <circle cx="74" cy="31" r="8" fill={APRICOT} stroke="#fff" strokeWidth="3" />
        </>
      );
    case "confirmed":
      // A receipt with an olive check: confirmed, the pieces are reserved.
      return (
        <>
          <path d="M33 23h32v51l-5.3-4-5.3 4-5.4-4-5.3 4-5.4-4-5.3 4z" fill="#fff" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          <path d="M40 34h18M40 42h12M40 50h15" stroke="#CDD3BC" strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="64" cy="62" r="12.5" fill={ink} stroke="#fff" strokeWidth="3" />
          <path d="M58 62.5l4.3 4.3 8-8.3" fill="none" stroke={APRICOT} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "preparing":
      // A kraft parcel being taped and labelled.
      return (
        <>
          <ellipse cx="50" cy="76" rx="26" ry="3" fill={DARK} opacity=".1" />
          <rect x="25" y="42" width="50" height="32" rx="4" fill={KRAFT} />
          <path d="M25 42l7-11h36l7 11z" fill={KRAFT_2} />
          <rect x="45" y="31" width="10" height="43" fill={APRICOT} />
          <rect x="57" y="55" width="14" height="11" rx="2" fill="#fff" stroke={DARK} strokeWidth="1.2" />
          <path d="M60 59h8M60 62.5h5" stroke={DARK} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M28 24l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" fill={ink} />
        </>
      );
    case "courier":
      // A scooter carrying the parcel, heading forward (to the left in RTL), with speed lines behind it.
      return (
        <>
          <path d="M80 50h9M83 58h7M81 66h5" stroke={ink} strokeWidth="3" strokeLinecap="round" opacity=".55" />
          <rect x="50" y="38" width="24" height="20" rx="3.5" fill={KRAFT} />
          <rect x="59.5" y="38" width="5" height="20" fill={APRICOT} />
          <path d="M74 63H40l-8-19" fill="none" stroke={ink} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M26 44h10" stroke={DARK} strokeWidth="4" strokeLinecap="round" />
          <circle cx="34" cy="67" r="8" fill={DARK} />
          <circle cx="34" cy="67" r="3" fill="#fff" />
          <circle cx="68" cy="67" r="8" fill={DARK} />
          <circle cx="68" cy="67" r="3" fill="#fff" />
        </>
      );
    case "delivered":
      // A shopping bag with a check and a small heart: delivered, and the customer is happy.
      return (
        <>
          <path d="M42 39v-5a8 8 0 0 1 16 0v5" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <path d="M31 39h38l-3 36H34z" fill="#fff" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          <path d="M41 57l6.5 6.5L60 51" fill="none" stroke={ink} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M72 23.5c-1.8-3.6-7.5-3-7.5 1.2 0 4 7.5 8.3 7.5 8.3s7.5-4.3 7.5-8.3c0-4.2-5.7-4.8-7.5-1.2z" fill={APRICOT} stroke="#fff" strokeWidth="2" />
        </>
      );
    case "cancelled":
      return <path d="M38 38l24 24M62 38L38 62" stroke={ink} strokeWidth="6" strokeLinecap="round" />;
    case "returned":
      return <path d="M62 40H42l8-8M42 40l8 8M42 40h20a10 10 0 0 1 0 20H48" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />;
  }
}

/** A die-cut status sticker (white edge, round base in the column colour). One size for every status. Decorative. */
export function StatusSticker({ status }: { status: OrderStatus }) {
  const { base, ink } = TONE[status];
  return (
    <svg className={`stk-status stk-${status}`} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="47" fill="#fff" />
      <circle cx="50" cy="50" r="41" fill={base} />
      {art(status, ink)}
    </svg>
  );
}
