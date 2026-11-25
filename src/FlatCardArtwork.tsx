import React from "react";

type Suit = "s" | "h" | "d" | "c";

/** One canonical front face for the table, hero hand, runs and showdown.
 * Matches the approved flat reference: upper-left rank + small suit,
 * oversized lower-right suit. Never draws a logo, crest or watermark.
 */
function SuitShape({ suit }: { suit: Suit }) {
  switch (suit) {
    case "h":
      return <path d="M12 22 2.55 12.4C-3.6 5.9 4.2-1 10 4.15L12 6.2l2-2.05C19.8-1 27.6 5.9 21.45 12.4Z" />;
    case "d":
      return <path d="M12 0 23.25 12 12 24 0.75 12Z" />;
    case "c":
      return <g><circle cx="12" cy="6.4" r="5.5"/><circle cx="6.3" cy="14.1" r="5.5"/><circle cx="17.7" cy="14.1" r="5.5"/><path d="M10 13.2h4v7.2h3.3V23H6.7v-2.6H10Z"/></g>;
    default:
      return <path d="M12 0C8.4 5.7 1.3 9.4 1.3 14.9c0 4 2.8 6.1 6.1 6.1 1.7 0 3.1-.7 4-2l-.65 2.8H7.7V24h8.6v-2.2h-3.15L12.5 19c.9 1.3 2.3 2 4 2 3.3 0 6.2-2.1 6.2-6.1C22.7 9.4 15.6 5.7 12 0Z" />;
  }
}

export function FlatCardArtwork({ rank, suit, showdown = false }: {
  rank: string;
  suit: string;
  showdown?: boolean;
}) {
  const resolved: Suit = ["s", "h", "d", "c"].includes(suit) ? suit as Suit : "s";
  return (
    <svg className={showdown ? "royal-reveal-card__art" : "royale-card-face-art"}
      viewBox="0 0 70 96" preserveAspectRatio="xMidYMid meet"
      aria-hidden="true" focusable="false" data-flat-card="reference-v1">
      <text className={showdown ? "royal-reveal-card__rank" : "royale-card-vector-rank"}
        x="7" y="28">{rank}</text>
      <g className="flat-card-corner-suit" transform="translate(8 33) scale(.49)">
        <SuitShape suit={resolved}/>
      </g>
      <g className={showdown ? "royal-reveal-card__suit" : "royale-card-vector-suit"}
        transform="translate(30 51) scale(1.47)">
        <SuitShape suit={resolved}/>
      </g>
    </svg>
  );
}
