import { Link } from "react-router";
import { Icon, type IconName } from "@/shared/ui/Icon";

const TONES = ["tone-olive", "tone-apricot", "tone-blue", "tone-green", "tone-brick"];

export interface NavTile {
  icon: IconName;
  label: string;
  to: string;
  tone?: string;
}

/** Grid of navigation tiles used by the mobile hubs (prototype `.tiles`). */
export function NavTiles({ items }: { items: readonly NavTile[] }) {
  return (
    <div className="tiles">
      {items.map((item, i) => (
        <Link key={item.to} className="tile2" to={item.to}>
          <span className={`chipi ${item.tone ?? TONES[i % TONES.length]}`}>
            <Icon name={item.icon} />
          </span>
          <b>{item.label}</b>
        </Link>
      ))}
    </div>
  );
}
