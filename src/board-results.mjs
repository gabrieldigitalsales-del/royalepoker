/** Derive per-board results exclusively from the engine's settled awards.
 * A draw exists when the SAME pot award is split among multiple winners.
 * Different side-pot winners are not necessarily a tie.
 */
export function boardResults(awards = [], players = [], boardCount = 1) {
  return Array.from({length: Math.max(1, boardCount)}, (_, boardIndex) => {
    const entries = awards.filter(a => (a.boardIndex ?? 0) === boardIndex);
    const winners = entries.flatMap(a => (a.winners ?? []).map(w => ({
      index: w.index, name: players[w.index]?.name ?? `Jogador ${w.index + 1}`,
      amount: w.amount ?? 0, cards: w.cards ?? [], label: w.label ?? null,
      pot: a.pot ?? 0,
    })));
    const totals = new Map();
    for (const w of winners) {
      const old = totals.get(w.index) ?? {...w, amount: 0, cards: [], bestCards: [], bestAward: -1};
      old.amount += w.amount;
      old.cards = [...new Set([...old.cards, ...w.cards])];
      // Side pots can award the same player multiple times on one board.
      // Keep exactly one authoritative five-card combination for the small score.
      if (w.cards.length === 5 && (w.amount > old.bestAward || old.bestCards.length !== 5)) {
        old.bestCards = [...w.cards];
        old.bestAward = w.amount;
        old.label = w.label;
      }
      totals.set(w.index, old);
    }
    return {
      boardIndex, winners: [...totals.values()],
      tied: entries.some(a => (a.winners ?? []).length > 1),
      winningCards: [...new Set(winners.flatMap(w => w.cards))],
    };
  });
}
