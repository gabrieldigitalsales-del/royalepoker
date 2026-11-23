// One presentation clock for a finished hand. Money and privacy are authoritative on the server.
export const SHOWDOWN_CARDS_MS = 360;
export const SHOWDOWN_RESULTS_GAP_MS = 540;
export const SHOWDOWN_AWARD_GAP_MS = 250;
export const REVIEW_HOLD_MS = 4400;
export function showdownFlow(frame, elapsed = Infinity, motionOff = false) {
  if (!frame?.finished) return { cardsVisible: false, resultsReady: false, awardAt: Infinity, runoutEnd: 0 };
  const from = frame.runoutFrom;
  const boards = Math.max(1, frame.boards?.length ?? 1);
  const cardsPerBoard = Math.max(0, (frame.board?.length ?? 0) - (from ?? (frame.board?.length ?? 0)));
  const runoutEnd = from == null || motionOff ? 0 :
    (frame.runoutDelay ?? 650) + Math.max(0, boards * cardsPerBoard - 1) * (frame.runoutStep ?? 530);
  const resultAt = runoutEnd + SHOWDOWN_RESULTS_GAP_MS;
  return {
    cardsVisible: motionOff || elapsed >= SHOWDOWN_CARDS_MS,
    resultsReady: motionOff || elapsed >= resultAt,
    awardAt: resultAt + SHOWDOWN_AWARD_GAP_MS,
    runoutEnd,
  };
}
