// Each settled pot is independent. Combine high/low awards for the same
// recipient in that pot, before calculating whole diamond units.
export function diamondAwards(frame) {
  const pots = new Map();
  for (const award of frame.awards ?? []) {
    const shares = pots.get(award.pot) ?? new Map();
    pots.set(award.pot, shares);
    for (const w of award.winners)
      shares.set(w.index, (shares.get(w.index) ?? 0) + w.amount);
  }
  const result = frame.payouts.map(() => 0);
  if (!pots.size) return frame.payouts.map((n) => Math.floor(n / 100000));
  for (const shares of pots.values())
    for (const [i, chips] of shares) result[i] += Math.floor(chips / 100000);
  return result;
}
