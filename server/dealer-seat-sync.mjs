// Every new hand grants the NEXT active button/dealer a fresh choice.
// The previous valid mode is a fallback, not a locked orbit.
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
    openedAt: now, at: now + 5000,
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
