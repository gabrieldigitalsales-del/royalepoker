// Totals belong to the room's completed hands. A seat can be reused.
// Players who sat in this room remain on the scoreboard after cashing out.
// Live hands and seated players are included even before their first result.
export function tableBalances(view, users, online) {
  const seats = new Set((view.seats ?? []).map((seat) => seat.id));
  const players = new Map();
  const remember = (p) => {
    if (p?.id && !players.has(p.id)) players.set(p.id, p.name ?? "Jogador");
  };
  for (const p of view.seats ?? []) remember(p);
  for (const h of [view.live, ...(view.history ?? [])]) {
    for (const p of h?.players ?? h?.participants ?? []) remember(p);
  }
  for (const [id, stats] of Object.entries(view.results ?? {})) {
    if ((stats.hands ?? 0) > 0 && !players.has(id)) remember({ id, name: users[id]?.name });
  }
  return Array.from(players, ([id, name]) => {
    const { won = 0, lost = 0, hands = 0 } = view.results?.[id] ?? {};
    return {
      id,
      name: users[id]?.name ?? name,
      net: won - lost,
      won,
      lost,
      hands,
      online: online.has(id),
      seated: seats.has(id),
    };
  }).sort((a, b) => Number(b.online) - Number(a.online) || b.net - a.net || a.name.localeCompare(b.name, "pt-BR"));
}
