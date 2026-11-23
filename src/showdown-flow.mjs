// Server determines payouts immediately; the UI presents them only after the
// complete board reveal, winning-hand identification and winner announcement.
export const SHOWDOWN_CARDS_MS = 360;
export const SHOWDOWN_RESULTS_GAP_MS = 540;
export const SHOWDOWN_WINNER_HOLD_MS = 1900;
export const SHOWDOWN_AWARD_GAP_MS = 350;
export const REVIEW_HOLD_MS = 4400;

export function showdownFlow(frame, elapsed = Infinity, motionOff = false) {
  // Reduced motion removes transitions, never the game's result/payout sequence.
  void motionOff;
  if (!frame?.finished) return {
    cardsVisible: false, resultsReady: false, awardsReady: false,
    awardAt: Infinity, runoutEnd: 0, winnerAt: Infinity,
  };
  const from = frame.runoutFrom;
  const boards = Math.max(1, frame.boards?.length ?? 1);
  const cardsPerBoard = Math.max(0, (frame.board?.length ?? 0) - (from ?? (frame.board?.length ?? 0)));
  const runoutEnd = from == null ? 0 :
    (frame.runoutDelay ?? 650) + Math.max(0, boards * cardsPerBoard - 1) * (frame.runoutStep ?? 530);
  const winnerAt = runoutEnd + SHOWDOWN_RESULTS_GAP_MS;
  // The result panel must display the winning hand before the pot moves.
  const multiRun = from != null && boards > 1;
  const awardAt = winnerAt + (multiRun ? SHOWDOWN_WINNER_HOLD_MS : 650) + SHOWDOWN_AWARD_GAP_MS;
  return {
    cardsVisible: elapsed >= SHOWDOWN_CARDS_MS,
    resultsReady: elapsed >= winnerAt,
    awardsReady: elapsed >= awardAt,
    awardAt,
    winnerAt,
    runoutEnd,
  };
}
