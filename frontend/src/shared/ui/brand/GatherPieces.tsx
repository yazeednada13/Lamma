import { Icon } from "../Icon";

/** The animated "gather" empty-state art used across the prototype (pieces flying into a card). */
export function GatherPieces() {
  return (
    <div className="gather" aria-hidden="true">
      <div className="gather__card" />
      <div className="gather__piece">
        <Icon name="brand-whatsapp" size={16} />
      </div>
      <div className="gather__piece">
        <Icon name="receipt" size={16} />
      </div>
      <div className="gather__piece">
        <Icon name="package" size={16} />
      </div>
    </div>
  );
}
