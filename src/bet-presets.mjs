// Keep one button per legal amount, preserving the meaningful cap label.
export function betPresets(legal, frame, blind, limit) {
  const { min, max } = legal;
  const bet = Math.max(...frame.bets);
  const potAfterCall = frame.pot + (legal.call || 0);
  const capName =
    max === frame.stacks[frame.actor] + frame.bets[frame.actor]
      ? "All-in"
      : limit === "PL"
        ? "Máx. pote"
        : "Máximo";
  const values = new Map([[min, "Mínimo"]]);
  function add(name, value) {
    const total = Math.round(value);
    if (total > min && total < max && !values.has(total))
      values.set(total, name);
  }
  if (bet > 0) add("2× aposta", bet * 2);
  if (limit !== "FL") {
    if (!frame.board.length) {
      add("2,5× BB", blind * 2.5);
      add("3× BB", blind * 3);
    }
    for (const [label, fraction] of [
      ["½ pote", 0.5],
      ["¾ pote", 0.75],
      ["Pote", 1],
    ])
      add(label, bet + fraction * potAfterCall);
  }
  values.set(max, capName);
  return [...values]
    .sort(([a], [b]) => a - b)
    .map(([amount, name]) => [name, amount]);
}
