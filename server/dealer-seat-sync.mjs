// Every new hand grants the NEXT active button/dealer a fresh choice.
// The previous valid mode is a fallback, not a locked orbit.
export const DEALER_CHOICE_MS = 5000;
export const DEALER_REVIEW_MS = 9000;
export const DEALER_PAUSE_MS = 20000;

export function choiceTimeLeft(choice, now = Date.now()) {
  if (!choice) return 0;
  // Review runs BEFORE the five-second choice window, not during it.
  if (now < choice.openedAt) return DEALER_CHOICE_MS;
  if (choice.heldAt) {
    const elapsed = Math.min(DEALER_PAUSE_MS, Math.max(0, now - choice.heldAt));
    return Math.max(0, (choice.remainingMs ?? 0) - Math.max(0, elapsed - DEALER_PAUSE_MS));
  }
  return Math.max(0, choice.at - now);
}

export function holdDealerChoice(choice, now = Date.now()) {
  if (!choice?.selecting || choice.heldAt || now < choice.openedAt || choice.at <= now) return false;
  choice.remainingMs = choice.at - now;
  choice.heldAt = now;
  choice.holdUntil = now + DEALER_PAUSE_MS;
  return true;
}

export function resumeDealerChoice(choice, now = Date.now()) {
  if (!choice?.heldAt) return false;
  // The pause can never exceed twenty seconds, even if the worker wakes late.
  choice.at = Math.min(now, choice.holdUntil ?? (choice.heldAt + DEALER_PAUSE_MS)) + Math.max(0, choice.remainingMs ?? 0);
  delete choice.heldAt;
  delete choice.holdUntil;
  delete choice.remainingMs;
  return true;
}
export function nextDealerSeat(room) {
  const eligible = room.seats.filter(s => !s.away && s.stack > 0);
  if (eligible.length < 2) return null;
  const index = room.seats.findIndex(s => s.id === room.button);
  const clockwise = [...room.seats.slice(index + 1), ...room.seats.slice(0, index + 1)];
  return clockwise.find(s => eligible.includes(s)) ?? null;
}

export function prepareDealerChoice(room, modeCatalog, now = Date.now(), previous = null) {
  const next = nextDealerSeat(room);
  if (!next) { delete room.nextChoice; return false; }
  const active = room.seats.filter(s => !s.away && s.stack > 0).length;
  const valid = id => !!id && room.rotation.includes(id) && !!modeCatalog[id] && active <= modeCatalog[id].max;
  const chosen = [previous, room.nextChoice?.id, ...room.rotation].find(valid);
  if (!chosen) { delete room.nextChoice; return false; }
  room.nextChoice = {
    id: chosen, dealer: next.id, selecting: true,
    openedAt: now, at: now + DEALER_CHOICE_MS,
  };
  return true;
}

// A player entering/leaving sit out may change the next dealer. Keep the
// currently selected mode/timer if ownership is unchanged; otherwise hand
// a fresh five-second window to the newly entitled player.
export function syncDealerChoiceAfterSeatChange(room, modeCatalog, now = Date.now()) {
  if (room.game !== 'choice' || room.hand || room.closed || room.paused || !room.choiceStarted) return false;
  const next = nextDealerSeat(room);
  if (!next) { const had = !!room.nextChoice; delete room.nextChoice; return had; }
  const active = room.seats.filter(s => !s.away && s.stack > 0).length;
  const valid = id => !!id && room.rotation.includes(id) && !!modeCatalog[id] && active <= modeCatalog[id].max;
  const existing = room.nextChoice;
  const chosen = [existing?.id, ...room.rotation].find(valid);
  if (!chosen) { delete room.nextChoice; return true; }
  if (!existing || existing.dealer !== next.id || !existing.selecting) {
    return prepareDealerChoice(room, modeCatalog, now, chosen);
  }
  if (existing.id !== chosen) { existing.id = chosen; return true; }
  return false;
}
