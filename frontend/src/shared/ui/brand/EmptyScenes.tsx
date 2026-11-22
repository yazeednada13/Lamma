/**
 * Small animated brand scenes for "nothing here yet" states. Decorative only (the empty state's text says the same);
 * they stand still with reduced motion.
 */

/** A courier dozing on a parked scooter, waiting for the first order. */
export function SleepingCourier() {
  return (
    <svg className="escene escene--courier" viewBox="0 0 200 120" aria-hidden="true">
      <ellipse className="escene__shadow" cx="100" cy="110" rx="70" ry="5" />
      <rect className="escene__ground" x="10" y="106" width="180" height="3" rx="1.5" />
      {/* scooter, parked, facing left */}
      <g className="escene__scooter">
        <rect className="escene__box" x="118" y="44" width="34" height="28" rx="4" />
        <path className="escene__tape" d="M135 44 V72" />
        <path className="escene__body" d="M110 96 Q110 74 136 74 Q152 75 156 96 Z" />
        <rect className="escene__floor" x="66" y="90" width="50" height="7" rx="3.5" />
        <path className="escene__body" d="M52 98 L62 60 L70 60 L68 92 Z" />
        <path className="escene__bar" d="M64 60 L59 50 M53 50 H66" />
        <circle className="escene__wheel" cx="58" cy="100" r="11" />
        <circle className="escene__wheel" cx="144" cy="100" r="11" />
        <path className="escene__stand" d="M100 97 L96 106" />
      </g>
      {/* rider, leaning back asleep */}
      <g className="escene__breathe">
        <path className="escene__leg" d="M108 80 L84 88 L80 90" />
        <path className="escene__jacket" d="M98 80 Q96 64 106 56 L116 60 Q118 72 114 82 Z" />
        <path className="escene__arm" d="M104 66 Q92 74 96 82" />
        <circle className="escene__helmet" cx="114" cy="48" r="10" />
        <path className="escene__visor" d="M104 46 Q106 40 112 40 L112 48 Z" />
      </g>
      <g className="escene__z">
        <text x="128" y="34">
          z
        </text>
        <text x="138" y="24">
          z
        </text>
        <text x="150" y="12">
          Z
        </text>
      </g>
    </svg>
  );
}

/** An empty shelf with a swinging price tag and a dashed spot waiting for the first product. */
export function EmptyShelf() {
  return (
    <svg className="escene escene--shelf" viewBox="0 0 200 120" aria-hidden="true">
      <rect className="escene__side" x="24" y="10" width="6" height="100" rx="2" />
      <rect className="escene__side" x="170" y="10" width="6" height="100" rx="2" />
      <rect className="escene__plank" x="20" y="56" width="160" height="7" rx="3" />
      <rect className="escene__plank" x="20" y="104" width="160" height="7" rx="3" />
      <rect className="escene__spot" x="80" y="18" width="40" height="36" rx="6" />
      <path className="escene__plus" d="M100 28 V44 M92 36 H108" />
      <g className="escene__tag">
        <path className="escene__string" d="M56 63 L56 72" />
        <path className="escene__label" d="M46 72 H66 V88 L56 94 L46 88 Z" />
        <circle className="escene__hole" cx="56" cy="77" r="2" />
      </g>
      <g className="escene__sparkle">
        <path d="M140 74 L143 82 L151 85 L143 88 L140 96 L137 88 L129 85 L137 82 Z" />
      </g>
    </svg>
  );
}
