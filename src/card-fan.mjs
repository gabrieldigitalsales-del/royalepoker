// One predictable fan geometry for 2-7 hole cards, used by opponents and
// the local runout fan. The shared CSS exposes the rank and ONE suit.
export function fanGeometry(count, kind = "opponent") {
  const n = Math.max(1, Math.min(7, Math.floor(Number(count) || 1)));
  const isHero = kind === "hero";
  const overlap = n <= 2 ? (isHero ? 3 : 4)
    : Math.min(isHero ? 12 : 17, Math.round((n - 1) * (isHero ? 2.1 : 2.75) + 1));
  const angleStep = n >= 6 ? 3.7 : n >= 4 ? 5 : 7;
  return {count: n, overlap, angleStep, lift: n >= 6 ? 0.8 : 1.4};
}
export function fanCardStyle(count, index, kind = "opponent") {
  const settings = fanGeometry(count, kind);
  const offset = index - (settings.count - 1) / 2;
  return {
    "--fan-overlap": settings.overlap + "px",
    "--fan-rotation": (offset * settings.angleStep).toFixed(2) + "deg",
    "--fan-angle": (offset * settings.angleStep).toFixed(2) + "deg",
    "--fan-lift": (offset * offset * settings.lift).toFixed(2) + "px",
  };
}
