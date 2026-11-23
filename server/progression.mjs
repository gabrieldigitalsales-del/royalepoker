export const avatars = [
  { id: "gold", symbol: "♠", name: "Ás dourado", price: 1 },
  { id: "rocket", symbol: "🚀", name: "Foguete", price: 3 },
  { id: "crown", symbol: "👑", name: "Coroa", price: 5 },
];
avatars.push(
  { id: "sapphire", symbol: "💎", name: "Safira do clube", price: 0, level: 3 },
  { id: "phoenix", symbol: "🔥", name: "Fênix da mesa", price: 0, level: 6 },
);
export const vipPrice = 10;
export function progress(hands) {
  const level = 1 + Math.floor(hands / 10);
  return { hands, level, next: level * 10 };
}
export function rakeAdmin(users) {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  return email
    ? Object.values(users).find((user) => user.admin && user.email === email)
    : undefined;
}
export function avatarFor(user) {
  return (
    avatars.find((item) => item.id === user.shopAvatar)?.symbol ??
    user.avatar ??
    ""
  );
}
export function takeRake(frame, ratePercent = 3) {
  if (!Number.isInteger(ratePercent) || ratePercent < 0 || ratePercent > 10)
    throw new Error("Percentual de rake inválido.");
  const total = frame.payouts.reduce((sum, amount) => sum + amount, 0);
  if (!total || !ratePercent) return 0;
  const fee = Number((BigInt(total) * BigInt(ratePercent)) / 100n);
  if (!fee) return 0;
  let cumulative = 0n,
    collected = 0;
  const portion = (amount) => {
    cumulative += BigInt(amount);
    const next = Number((cumulative * BigInt(fee)) / BigInt(total));
    const take = next - collected;
    collected = next;
    return take;
  };
  const shares = Array(frame.payouts.length).fill(0);
  if (frame.awards?.length) {
    for (const pot of frame.awards)
      for (const winner of pot.winners) {
        const take = portion(winner.amount);
        shares[winner.index] += take;
        winner.amount -= take;
      }
  } else {
    frame.payouts.forEach((amount, index) => {
      shares[index] = portion(amount);
    });
  }
  frame.payouts = frame.payouts.map((amount, index) => amount - shares[index]);
  frame.stacks = frame.stacks.map((amount, index) => amount - shares[index]);
  frame.rake = fee;
  frame.rakePercent = ratePercent;
  frame.grossPot = total;
  return fee;
}
