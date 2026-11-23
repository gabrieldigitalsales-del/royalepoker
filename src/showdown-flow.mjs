// One deterministic presentation clock for Run It Twice, Three,
// Double Board and draw/discard variants. Server and client import this module.
import { revealDuration } from "./runout-reveal.mjs";

export const SHOWDOWN_CARDS_MS = 360;
export const FINAL_CARD_SETTLE_MS = 760;
export const SHOWDOWN_RESULTS_GAP_MS = 650;
export const SHOWDOWN_WINNER_HOLD_MS = 2300;
export const SHOWDOWN_AWARD_GAP_MS = 450;
export const REVIEW_HOLD_MS = 4400;

export function showdownFlow(frame, elapsed = Infinity, motionOff = false) {
  // Reduced motion may suppress cosmetic transitions; it MUST NOT
  // advance the reveal or settlement clock.
  void motionOff;
  if (!frame?.finished) return {
    cardsVisible: false, resultsReady: false, awardsReady: false,
    awardAt: Infinity, runoutEnd: 0, winnerAt: Infinity,
  };
  const from = Number.isInteger(frame.runoutFrom)
    ? Math.max(0, Math.min(5, frame.runoutFrom))
    : null;
  const boards = Math.max(1, frame.boards?.length ?? 1);
  const multiBoardReveal = from !== null && boards > 1;
  const lastCardAt = multiBoardReveal
    ? revealDuration({
        runs: boards,
        from,
        cardsPerBoard: Math.max(5, frame.board?.length ?? 0),
        delay: frame.runoutDelay ?? 650,
        step: frame.runoutStep ?? 530,
      })
    : 0;
  // Account for the final card flip/land animation, not only its appearance.
  // When from=4 (Watermelon after mandatory discards), each run reveals just
  // one river; when from=0, all 5 cards of each run must be shown first.
  const runoutEnd = multiBoardReveal ? lastCardAt + FINAL_CARD_SETTLE_MS : 0;
  const winnerAt = runoutEnd + SHOWDOWN_RESULTS_GAP_MS;
  const awardAt = winnerAt +
    (multiBoardReveal ? SHOWDOWN_WINNER_HOLD_MS : 650) +
    SHOWDOWN_AWARD_GAP_MS;
  return {
    cardsVisible: elapsed >= SHOWDOWN_CARDS_MS,
    resultsReady: elapsed >= winnerAt,
    awardsReady: elapsed >= awardAt,
    awardAt,
    winnerAt,
    runoutEnd,
    lastCardAt,
  };
}
