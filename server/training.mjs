import { randomInt } from "node:crypto";
import { makeRoom, sit, deal, move, handView, requireThat } from "./game.mjs";

export async function training(user, request) {
  if (request.cmd === "practiceStart") {
    requireThat(
      ["texas", "om4"].includes(request.game),
      "Escolha Texas ou Omaha.",
    );
    const users = {
      hero: { id: "hero", name: user.name, wallet: 1000 },
      bot: { id: "bot", name: "Rival de treino", wallet: 1000 },
    };
    const room = makeRoom(users.hero, {
      name: "Treino",
      game: request.game,
      capacity: 2,
      blind: 10,
      buy: 1000,
      seconds: 30,
    });
    room.practice = true;
    const data = { users, hands: {} };
    sit(data, users.hero, room);
    sit(data, users.bot, room);
    await deal(data, room);
    user.practice = { data, room };
  }
  const state = user.practice;
  requireThat(state, "Inicie um treino.");
  const { data, room } = state;
  if (request.cmd === "practiceMove") {
    requireThat(request.hand === room.hand?.h.id, "Mão de treino encerrada.");
    await move(data, room, "hero", request);
  }
  while (room.hand) {
    const h = room.hand.h,
      f = h.frames.at(-1);
    if (h.players[f.actor].id !== "bot") break;
    const roll = randomInt(100),
      legal = f.legal;
    const action =
      legal.min != null && roll < 22
        ? {
            type: "raise",
            amount: Math.min(
              legal.max,
              Math.max(legal.min, 2 * Math.max(...f.bets)),
            ),
          }
        : legal.fold && legal.call > room.blind * 3 && roll > 68
          ? { type: "fold" }
          : { type: "pass" };
    await move(data, room, "bot", { rev: room.rev, action });
  }
  const h = room.hand?.h ?? data.hands[room.last];
  return { rev: room.rev, ...handView(h, "hero") };
}
