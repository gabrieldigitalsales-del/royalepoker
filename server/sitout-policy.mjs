/**
 * Cash-table idle-seat policy. Server authoritative, persisted on each seat.
 * Timeouts count distinct hands rather than turns/actions inside one hand.
 * Three missed hands -> sit out; three minutes of sit out -> cash out.
 */
export const MISSED_HANDS_BEFORE_SITOUT = 3;
export const SITOUT_EVICTION_MS = 3 * 60_000;

export function recordSeatAction(seat, { expired, handId, now = Date.now() }) {
  if (!seat) return false;
  if (!expired) {
    seat.timeouts = 0;
    delete seat.lastTimeoutHandId;
    return false;
  }
  // One Omaha draw/street sequence must not count as multiple absent hands.
  if (seat.lastTimeoutHandId === handId) return false;
  seat.lastTimeoutHandId = handId;
  seat.timeouts = (seat.timeouts ?? 0) + 1;
  if (seat.timeouts >= MISSED_HANDS_BEFORE_SITOUT && !seat.away) {
    seat.away = true;
    seat.awaySince = now;
    return true;
  }
  return false;
}

export function setSeatAway(seat, away, now = Date.now()) {
  seat.away = away;
  if (away) {
    seat.awaySince = now;
  } else {
    delete seat.awaySince;
    seat.timeouts = 0;
    delete seat.lastTimeoutHandId;
  }
}

export function isExpiredSitoutSeat(seat, now = Date.now()) {
  return !!seat?.away &&
    Number.isFinite(seat.awaySince) &&
    now - seat.awaySince >= SITOUT_EVICTION_MS;
}

/** Old persisted sit-out seats receive a new grace period on migration. */
export function backfillSitoutTimestamp(seat, now = Date.now()) {
  if (!seat?.away || Number.isFinite(seat.awaySince)) return false;
  seat.awaySince = now;
  return true;
}
