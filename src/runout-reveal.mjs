/** Deterministic reveal schedule shared by the main board and extra runs.
 * Cards already dealt before the all-in remain visible on every run.
 */
export function revealAt({runIndex=0, cardIndex, from=0, elapsed=Infinity, delay=650, step=530, cardsPerBoard=5}) {
  if (cardIndex < from) return true;
  const newCards = Math.max(0, cardsPerBoard - from);
  return elapsed >= delay + (runIndex * newCards + cardIndex - from) * step;
}
export function revealDuration({runs=1, from=0, delay=650, step=530, cardsPerBoard=5}) {
  return delay + Math.max(0, runs * (cardsPerBoard - from) - 1) * step;
}
