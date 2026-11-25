import React from "react";
import { FlatCardArtwork } from "./FlatCardArtwork";

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
      <FlatCardArtwork rank={rank} suit={suit} showdown />
    </span>
  );
}
