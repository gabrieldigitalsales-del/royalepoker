// Closing cash totals are independent of hand-by-hand profit statistics.
// Count every cash-in and cash-out, including previous departures and reentries.
export function closingSummary(room, users, avatarFor = (u) => u?.avatar ?? '') {
  const totals = new Map();
  const collect = (entry) => {
    if (!entry?.id) return;
    const existing = totals.get(entry.id) ?? {id:entry.id, name: users[entry.id]?.name ?? entry.name ?? 'Jogador', bought:0, cashedOut:0, visits:0};
    existing.bought += Number(entry.bought ?? 0);
    existing.cashedOut += Number(entry.cashedOut ?? 0);
    existing.visits += 1;
    totals.set(entry.id,existing);
  };
  for (const entry of room.cashLedger ?? []) collect(entry);
  for (const seat of room.seats ?? []) collect({id:seat.id,name:users[seat.id]?.name,bought:seat.bought ?? room.buy,cashedOut:seat.stack});
  const players=[...totals.values()].map(p=>({
    ...p,
    avatar:avatarFor(users[p.id] ?? {}),
    photo:users[p.id]?.shopAvatar ? null : users[p.id]?.photoId ?? null,
    net:p.cashedOut-p.bought,
  })).sort((a,b)=>b.net-a.net||a.name.localeCompare(b.name,'pt-BR'));
  return {
    roomId:room.id,
    name:room.name,
    finishedAt:Date.now(),
    players,
    totalBuyins:players.reduce((sum,p)=>sum+p.bought,0),
    totalCashouts:players.reduce((sum,p)=>sum+p.cashedOut,0),
    net:players.reduce((sum,p)=>sum+p.net,0),
  };
}
