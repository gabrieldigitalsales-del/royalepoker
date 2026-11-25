import React from "react";

/**
 * Isolated reveal-only card. Not a .card and intentionally has no shared
 * card selectors: historical table CSS cannot resize or blur its SVG.
 * The game engine decides which cards may be disclosed; this component only
 * paints the string explicitly supplied by PortraitBoard.
 */
export function RoyalShowdownCard({ card, winning = false }: { card: string; winning?: boolean }) {
  const rank = card?.[0] === "T" ? "10" : card?.[0] || "?";
  const suit = card?.[1] || "s";
  const names: Record<string, string> = {s:"espadas",h:"copas",d:"ouros",c:"paus"};
  return (
    <span
      className={"royal-reveal-card" + (winning ? " royal-reveal-card--winning" : "")}
      data-rank={rank}
      data-suit={suit}
      aria-label={rank + " de " + (names[suit] || "naipe desconhecido")}
    >
      <svg className="royal-reveal-card__art" viewBox="0 0 64 90" role="presentation" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
        <text className="royal-reveal-card__rank" x="8" y="29">{rank}</text>
        <g className="royal-reveal-card__suit" transform="translate(19 42) scale(1.10)">
          {suit === "h" ? (
            <path d="M12 21.1 3.6 12.5C-1 7.5 3.5 1.7 8.4 3.4c1.6.5 2.8 1.7 3.6 3.1.8-1.4 2-2.6 3.6-3.1 4.9-1.7 9.4 4.1 4.8 9.1Z" />
          ) : suit === "d" ? (
            <path d="M12 1.1 21 12 12 22.9 3 12Z" />
          ) : suit === "c" ? (
            <g><circle cx="12" cy="7.4" r="5.1"/><circle cx="7.2" cy="13.4" r="5.1"/><circle cx="16.8" cy="13.4" r="5.1"/><path d="M10.2 13h3.6l-.4 6h3.2v2.3H7.4V19h3.2Z"/></g>
          ) : (
            <path d="M12 1.4C9.7 5.5 3 9.7 2.3 14.3c-.5 3.3 1.7 5.7 4.6 5.7 2 0 3.5-1.2 4.2-2.7l-.4 2.7H7.8v2h8.4v-2h-2.9l-.4-2.7c.7 1.5 2.2 2.7 4.2 2.7 2.9 0 5.1-2.4 4.6-5.7C21 9.7 14.3 5.5 12 1.4Z" />
          )}
        </g>
        <g className="royal-reveal-card__crest" transform="translate(39 73) scale(.040)">
          <path d="M303 102 340 32 391 77 410 14 429 77 480 32 517 102 500 144 320 144Z"/>
          <path d="M410 89 C376 62 350 101 376 125 L410 156 444 125 C470 101 444 62 410 89Z"/>
        </g>
      </svg>
    </span>
  );
}
