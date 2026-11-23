import { catalog } from "./catalog.mjs";
import { makeRoom, requireThat as check } from "./game.mjs";
export function startTour(d, t) {
  check(
    t.state === "open" && Date.now() >= t.start && t.entries.length >= 2,
    "Aguarde o horário e ao menos dois inscritos.",
  );
  t.round = 0;
  t.state = "playing";
  t.started = Date.now();
  t.rooms = [];
  t.out = [];
  const count = Math.ceil(t.entries.length / t.capacity);
  for (let i = 0; i < count; i++) {
    const r = makeRoom(d.users[t.owner], {
      ...t,
      name: t.name + " · " + (i + 1),
      private: false,
      seconds: t.seconds ?? 25,
      buy: t.buy,
    });
    r.tour = t.id;
    t.rooms.push(r.id);
    d.rooms[r.id] = r;
  }
  for (const [i, id] of t.entries.entries())
    d.rooms[t.rooms[i % count]].seats.push({ id, stack: t.stack, points: 0 });
  for (const id of t.rooms) {
    const r = d.rooms[id];
    if (r.seats.length === 1) r.roundDone = true;
  }
}
export function balance(d, t) {
  const rooms = t.rooms.map((id) => d.rooms[id]).filter((r) => !r.closed);
  if (rooms.some((r) => r.hand || !r.roundDone)) return;
  for (const r of rooms) r.roundDone = false;
  t.round++;
  if (catalog[t.game].family === "Chinês") {
    if (t.round >= 8) {
      const ranking = rooms
          .flatMap((r) => r.seats)
          .sort((a, b) => b.points - a.points),
        winners = ranking.filter((s) => s.points === ranking[0].points),
        prize = t.buy * t.entries.length;
      for (const [i, s] of winners.entries())
        d.users[s.id].wallet +=
          Math.floor(prize / winners.length) +
          (i < prize % winners.length ? 1 : 0);
      t.ranking = ranking.map((s) => s.id);
      t.state = "finished";
      for (const r of rooms) r.closed = true;
    }
    return;
  }
  for (const r of rooms) {
    for (const s of r.seats.filter((s) => !s.stack)) t.out.push(s.id);
    r.seats = r.seats.filter((s) => s.stack);
  }
  const seats = rooms.flatMap((r) => r.seats);
  if (seats.length === 1) {
    const champion = seats[0].id;
    d.users[champion].wallet += t.buy * t.entries.length;
    t.ranking = [champion, ...t.out.slice().reverse()];
    t.state = "finished";
    for (const r of rooms) r.closed = true;
    return;
  }
  const count = Math.ceil(seats.length / t.capacity);
  if (
    rooms.some((r) => r.seats.length === 1) ||
    rooms.length !== count ||
    Math.max(...rooms.map((r) => r.seats.length)) -
      Math.min(...rooms.map((r) => r.seats.length)) >
      1
  ) {
    rooms.forEach((r, i) => {
      r.seats = [];
      r.closed = i >= count;
    });
    seats.push(seats.shift());
    seats.forEach((s, i) => rooms[i % count].seats.push(s));
    for (const r of rooms) if (r.seats.length === 1) r.roundDone = true;
  }
  for (const r of rooms)
    r.blind = Math.min(
      t.blind *
        2 **
          Math.min(
            12,
            Math.floor(
              (Date.now() - t.started) / ((t.blindMinutes ?? 10) * 60000),
            ),
          ),
      1000000,
    );
}
