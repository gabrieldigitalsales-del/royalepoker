import { showdownFlow } from "../src/showdown-flow.mjs";
import { diamondAwards } from "./rewards.mjs";
import { prepareDealerChoice } from "./dealer-seat-sync.mjs";
import { takeRake, rakeAdmin, avatarFor } from "./progression.mjs";
import { randomBytes, randomUUID, randomInt } from "node:crypto";
import { step } from "./worker.mjs";
import { catalog, rotations, dealerGames } from "./catalog.mjs";
export const uid = () => randomUUID();
export function requireThat(ok, message) {
  if (!ok) throw Error(message);
}
const check = requireThat;
export const token = () => randomBytes(24).toString("hex");
export function makeRoom(u, b) {
  const g = catalog[b.game];
  check(g, "Modalidade inválida.");
  const list =
    g.family === "Mistos"
      ? rotations[g.id] ||
        (b.rotation?.length ? b.rotation : g.id === "choice" ? dealerGames : [])
      : [];
  if (g.id === "custom" || g.id === "choice")
    check(
      list.length &&
        list.every(
          (id) =>
            catalog[id] && !["Chinês", "Mistos"].includes(catalog[id].family),
        ),
      "Escolha jogos de fichas para a rotação.",
    );
  const limit =
    g.id === "choice"
      ? g.max
      : Math.min(g.max, ...list.map((id) => catalog[id].max));
  check(b.capacity <= limit, "Quantidade de assentos incompatível.");
  return {
    id: uid(),
    owner: u.id,
    name: b.name,
    game: g.id,
    rotation: list,
    blind: b.blind,
    buy: b.buy,
    created: Date.now(),
    rakeEnabled: true, // Global house rake applies to every cash table.
    capacity: b.capacity,
    private: !!b.private,
    code: token().slice(0, 12),
    seconds: b.seconds,
    timeBank: b.timeBank ?? 0,
    waitlist: [],
    pendingEntries: [],
    chipRequests: [],
    straddleEnabled: !b.tour,
    runoutEnabled: true,
    bombInterval: Number.isInteger(b.bombInterval) && b.bombInterval >= 0 && b.bombInterval <= 50 ? b.bombInterval : 0,
    bombAnteMultiplier: Number.isInteger(b.bombAnteMultiplier) && b.bombAnteMultiplier >= 1 && b.bombAnteMultiplier <= 20 ? b.bombAnteMultiplier : 2,
    cucuruchoEnabled: !!b.cucuruchoEnabled,
    cucuruchoAnteMultiplier: Number.isInteger(b.cucuruchoAnteMultiplier) && b.cucuruchoAnteMultiplier >= 1 && b.cucuruchoAnteMultiplier <= 20 ? b.cucuruchoAnteMultiplier : 5,
    cucuruchoMarker: null,
    choiceOrbit: null,
    cashLedger: [],
    cohosts: [],
    codeExpires: Date.now() + 86400000,
    watch: b.watch !== false,
    seats: [],
    chat: [],
    count: 0,
    rev: 0,
    hand: null,
    last: null,
    allowed: [u.id],
    closed: false,
  };
}
// Returns the player who will be UTG at the start of the NEXT hand.
// Button moves to the first active seat clockwise, followed by SB, BB, UTG.
export function nextUtg(r) {
  const active = r.seats.filter(s => !s.away && (s.stack > 0 || s.autoRefill));
  if (active.length < 3) return null;
  const buttonIndex = r.seats.findIndex(s => s.id === r.button);
  const clockwise = [...r.seats.slice(buttonIndex + 1), ...r.seats.slice(0, buttonIndex + 1)]
    .filter(s => active.includes(s));
  return clockwise[3 % clockwise.length] ?? null;
}
// The next UTG must have a pre-deal decision window, even on an auto-dealt table.
// The marker prevents accidentally charging twice for the same upcoming hand.
export function prepareUtgStraddle(r, now = Date.now()) {
  if (r.tour || r.closed || r.hand || !r.straddleEnabled) return false;
  if (r.preStraddleHandledFor === r.count) return false;
  const utg = nextUtg(r);
  if (!utg || utg.stack < r.blind * 2) {
    r.preStraddleHandledFor = r.count;
    delete r.preStraddle;
    return false;
  }
  if (r.preStraddle?.playerId === utg.id && r.preStraddle.handCount === r.count) return true;
  r.preStraddle = { playerId: utg.id, handCount: r.count, expiresAt: now + 7000 };
  r.rev++;
  return true;
}
export function seatSlots(r) {
  const used = new Set(
    r.seats.map((seat) => seat.position).filter(Number.isInteger),
  );
  return r.seats.map((seat) => {
    if (Number.isInteger(seat.position)) return seat.position;
    const position = Array.from({ length: r.capacity }, (_, i) => i).find(
      (i) => !used.has(i),
    );
    used.add(position);
    return position;
  });
}
export function sit(d, u, r, options = {}) {
  check(!r.closed && !r.hand && !r.tour, "Aguarde o intervalo entre mãos.");
  check(r.seats.length < r.capacity, "Mesa cheia.");
  check(
    !r.waitlist?.length || r.waitlist[0] === u.id,
    "A vaga está reservada para o primeiro da fila.",
  );
  check(!r.seats.some((s) => s.id === u.id), "Você já está na mesa.");
  const slots = seatSlots(r);
  const position =
    options.position ??
    Array.from({ length: r.capacity }, (_, i) => i).find(
      (i) => !slots.includes(i),
    );
  check(
    Number.isInteger(position) &&
      position >= 0 &&
      position < r.capacity &&
      !slots.includes(position),
    "Escolha um assento livre.",
  );
  const chinese = catalog[r.game].family === "Chinês";
  const buy = chinese ? 0 : (options.amount ?? r.buy);
  check(
    chinese || (Number.isSafeInteger(buy) && buy >= r.buy),
    "Valor fora dos limites de buy-in.",
  );
  r.seats.forEach((seat, index) => {
    seat.position = slots[index];
  });
  check(u.wallet >= buy, "Saldo insuficiente.");
  u.wallet -= buy;
  r.seats.push({
    id: u.id,
    stack: buy,
    points: 0,
    bought: buy,
    initialBuy: buy,
    funding: buy ? [{ type: "buy-in", amount: buy, at: Date.now() }] : [],
    position,
  });
  r.seats.sort((a, b) => a.position - b.position);
  r.waitlist = (r.waitlist ?? []).filter((id) => id !== u.id);
}
export function notify(user, message, room) {
  user.notices = [
    ...(user.notices ?? []),
    { id: uid(), message, room, at: Date.now() },
  ].slice(-30);
}
export function leave(d, u, r) {
  check(!r.hand && !r.tour, "Aguarde o fim da mão ou torneio.");
  const seat = r.seats.find((s) => s.id === u.id);
  check(seat, "Assento inválido.");
  u.wallet += seat.stack;
  if (seat.leaveAfterHand)
    notify(
      u,
      "Saída concluída · " +
        seat.stack.toLocaleString("pt-BR") +
        " fichas devolvidas à carteira",
      r.id,
    );
  const next = d.users[r.waitlist?.[0]];
  if (next) notify(next, "Vaga disponível em " + r.name, r.id);
  if (!r.tour) (r.cashLedger ??= []).push({ id: u.id, name: u.name, bought: seat.bought ?? r.buy, cashedOut: seat.stack, at: Date.now() });
  r.seats = r.seats.filter((s) => s !== seat);
  r.cohosts = (r.cohosts ?? []).filter((id) => id !== u.id);
  if (r.owner === u.id && r.seats.length) r.owner = r.seats[0].id;
}
export async function deal(d, r, choice) {
  check(!r.hand && !r.closed, "Mesa indisponível.");
  if (!r.tour && r.pendingEntries?.length) {
    const queued = r.pendingEntries.splice(0);
    for (const entry of queued) {
      const user = d.users[entry.id];
      if (!user || r.seats.length >= r.capacity || r.seats.some(s => s.id === entry.id)) continue;
      try { sit(d, user, r, {position: entry.position, amount: entry.amount}); }
      catch (err) { notify(user, "Entrada na próxima mão: " + err.message, r.id); }
    }
  }
  if (!r.tour)
    for (const seat of r.seats) {
      const user = d.users[seat.id];
      const refill = Math.min(
        user.wallet,
        Math.max(0, (seat.autoRefill ?? 0) - seat.stack),
      );
      if (!seat.away && refill > 0) {
        seat.bought = (seat.bought ?? r.buy) + refill;
        seat.stack += refill;
        (seat.funding ??= []).push({
          type: "automática",
          amount: refill,
          at: Date.now(),
        });
        user.wallet -= refill;
      }
    }
  let seated = r.seats.filter(
    (s) => !s.away && (s.stack > 0 || catalog[r.game].family === "Chinês"),
  );
  check(
    seated.length >= 2,
    "São necessários dois jogadores com assento ativo.",
  );
  const pos = r.seats.findIndex((s) => s.id === r.button);
  const clockwise = [...r.seats.slice(pos + 1), ...r.seats.slice(0, pos + 1)];
  const dealer = seated.indexOf(clockwise.find((s) => seated.includes(s)));
  r.button = seated[dealer].id;
  const off = (dealer + 1) % seated.length;
  seated = [...seated.slice(off), ...seated.slice(0, off)];
  const game =
    r.game === "choice"
      ? choice
      : r.rotation.length
        ? r.rotation[r.count % r.rotation.length]
        : r.game;
  check(
    game && catalog[game] && (r.game !== "choice" || r.rotation.includes(game)),
    "Escolha uma modalidade válida.",
  );
  check(
    seated.length <= catalog[game].max,
    "Jogadores demais para esta modalidade.",
  );
  // Never deal while an eligible UTG is still deciding. The server timer
  // defaults to CHECK when the decision window expires.
  check(!r.preStraddle || r.preStraddle.expiresAt <= Date.now() || r.preStraddle.resolved,
    "Aguarde a decisão pré-mão do UTG.");
  // Bomb Pot is a table-level event on scheduled hands of eligible games.
  // It never combines with an UTG straddle or an ordinary preflop round.
  // The Cucurucho marker belongs to an active seat and is independent of D.
  // First activation is deterministic once seats are occupied; it stays fixed
  // until its seat departs, when it moves to the next active participant.
  if (r.cucuruchoEnabled && !seated.some(s => s.id === r.cucuruchoMarker)) {
    // Heads-up: the first Cucurucho occurs immediately. A random marker
    // otherwise makes a two-player test look as though the mode is broken.
    // Keep the marker fixed after this initial selection, so future hands
    // activate again whenever the dealer button reaches its seat.
    r.cucuruchoMarker = seated.length === 2
      ? r.button
      : seated[randomInt(seated.length)].id;
  }
  const cucurucho = !r.tour && !!r.cucuruchoEnabled &&
    r.cucuruchoMarker === r.button && /^(texas|om[4-7])$/.test(game);
  const cucuruchoAnte = cucurucho ? Math.max(1, r.blind * r.cucuruchoAnteMultiplier) : 0;
  const bomb = !cucurucho && !r.tour && !!r.bombInterval && (r.count + 1) % r.bombInterval === 0 &&
    /^(texas|om[3-7](db)?)$/.test(game);
  const bombAnte = bomb ? Math.max(1, r.blind * (r.bombAnteMultiplier ?? 2)) : 0;
  const postedStraddle = !bomb && !cucurucho && !!r.straddleEnabled && !r.tour && seated.length >= 3 && !!seated[2]?.wantsStraddle;
  const { frame, state } = await step({
    game: catalog[game].base || game,
    blind: r.blind,
    stacks: seated.map((s) => s.stack),
    fantasy: seated.map((s) => !!s.fantasy),
    straddle: postedStraddle,
    bomb,
    bombAnte,
    cucurucho,
    cucuruchoAnte,
    runout: !!r.runoutEnabled && !r.tour && !game.endsWith("db") && /^(texas|limit|om[3-7]|cour|pine|crazy|super|watermelon|short)/.test(game),
  });
  r.paused = false;
  for (const player of r.seats) player.wantsStraddle = false;
  delete r.preStraddle;
  delete r.preHandStarted;
  delete r.nextChoice;
  // No orbital lock: the button holder chooses again before EVERY hand.
  if (r.game === "choice") r.choiceOrbit = null;
  r.count++;
  r.rev++;
  const physicalSlots = seatSlots(r);
  const h = {
    id: uid(),
    game,
    version: 1,
    number: r.count,
    room: r.id,
    name: r.name,
    button: r.button,
    blind: r.blind,
    straddle: postedStraddle ? r.blind * 2 : 0,
    bomb,
    bombAnte,
    cucurucho,
    cucuruchoAnte,
    tour: r.tour || null,
    rakePercent: Number.isInteger(d.cashier?.globalRakePercent) ? d.cashier.globalRakePercent : 3,
    players: seated.map((s) => ({
      id: s.id,
      name: d.users[s.id].name,
      avatar: avatarFor(d.users[s.id]),
      photo: d.users[s.id].shopAvatar ? null : d.users[s.id].photoId,
      shopAvatar: d.users[s.id].shopAvatar || "",
      freeAvatar: Number.isInteger(d.users[s.id].freeAvatar) ? d.users[s.id].freeAvatar : null,
      customAvatar: d.users[s.id].avatar || "",
      position: physicalSlots[r.seats.indexOf(s)],
      stack: s.stack,
    })),
    started: Date.now(),
    frames: [{ ...frame, label: "Distribuição inicial" }],
  };
  r.hand = {
    h,
    state,
    timeBankUsed: [],
    deadline: Date.now() + r.seconds * 1000,
  };
  if (frame.finished) finish(d, r);
}
function finish(d, r) {
  const h = r.hand.h,
    f = h.frames.at(-1);
  check(
    f.stacks.every((n) => Number.isSafeInteger(n) && n >= 0) &&
      f.stacks.reduce((a, b) => a + b, 0) ===
        h.players.reduce((sum, p) => sum + p.stack, 0),
    "A mão não fechou com o mesmo total de fichas.",
  );
  if (!r.tour && !r.practice && !f.rows) {
    f.diamonds = diamondAwards(f);
    h.players.forEach((p, i) => {
      const u = d.users[p.id];
      u.diamonds = (u.diamonds ?? 0) + f.diamonds[i];
    });
  }
  // House rake is global, never assigned to an agent or room owner.
  // The percentage is captured when the hand is dealt, so a configuration
  // change cannot alter a hand already in progress.
  if (!r.tour && !r.practice && !f.rows) {
    const rake = takeRake(f, h.rakePercent ?? 3);
    if (rake > 0) {
      d.cashier ??= {};
      d.cashier.rakeCollected = (d.cashier.rakeCollected ?? 0) + rake;
      d.cashier.rakeHands = (d.cashier.rakeHands ?? 0) + 1;
    }
  }
  for (const [i, p] of h.players.entries()) {
    let s = r.seats.find((s) => s.id === p.id);
    s.stack = f.stacks[i];
    if (f.rows) {
      s.points += f.payouts[i];
      s.fantasy = f.nextFantasy[i];
    }
  }
  h.ended = Date.now();
  d.hands[h.id] = h;
  r.last = h.id;
  // Keep the same finished hand on the table throughout the full presentation:
  // all runout cards, winning five-card hands, then the visual transfer of chips.
  // The settlement itself stays authoritative on the server.
  const runoutBoards = Math.max(1, f.boards?.length ?? 1);
  const multiRun = f.runoutFrom != null && runoutBoards > 1;
  const newCardsPerBoard = f.runoutFrom == null ? 0 : Math.max(0, f.board.length - f.runoutFrom);
  const runoutRevealEnd = f.runoutFrom == null ? 0 :
    (f.runoutDelay ?? 650) +
    Math.max(0, runoutBoards * newCardsPerBoard - 1) * (f.runoutStep ?? 530);
  r.reviewUntil = h.ended + runoutRevealEnd + (multiRun ? 7700 : 4400);
  r.hand = null;
  // The selection countdown is server-authoritative and survives reconnects.
  if (r.game === "choice" && !r.paused && !r.closed) {
    // Start the next dealer's five seconds only AFTER the hand/replay finishes.
    prepareDealerChoice(r, catalog, r.reviewUntil, h.game);
  }
  for (const seat of r.seats.filter((entry) => entry.leaveAfterHand))
    leave(d, d.users[seat.id], r);
}
export function automatic(f, expired = false) {
  const l = f.legal;
  if (l.place) {
    const capacities = [3, 5, 5].map((n, i) => n - f.rows[f.actor][i].length);
    const lines = [];
    for (const _ of f.hole[f.actor].slice(
      0,
      f.hole[f.actor].length - l.discard,
    )) {
      const i = capacities.findIndex((x) => x > 0);
      lines.push(i);
      capacities[i]--;
    }
    if (l.discard) lines.push(-1);
    return { type: "place", lines };
  }
  if ("runout" in l) return {type:"runout",count:1};
  if (f.cucurucho && (l.fold || l.cucu != null)) return { type: "fold" };
  if ("draw" in l)
    return { type: "draw", cards: f.hole[f.actor].slice(0, l.required) };
  if ("bring" in l) return { type: "bring" };
  return { type: expired ? "timeoutFold" : l.call === 0 ? "pass" : "fold" };
}
export async function move(d, r, id, b, expired = false) {
  const live = r.hand;
  check(live && r.rev === b.rev, "A mesa foi atualizada. Confira sua vez.");
  const h = live.h,
    f = h.frames.at(-1),
    i = f.actor;
  check(h.players[i]?.id === id, "Aguarde sua vez.");
  const a = b.action,
    l = f.legal;
  const allowed = {
    pass: "call" in l,
    fold: l.fold,
    timeoutFold: expired && (l.fold || "call" in l),
    raise: l.min != null,
    bring: l.bring != null,
    draw: "draw" in l,
    place: l.place,
    runout: Array.isArray(l.runout),
    cucuStay: l.cucu != null,
  };
  check(allowed[a.type], "Ação indisponível.");
  if (a.type === "runout") check(l.runout.includes(a.count), "Não há cartas suficientes para essa quantidade de corridas.");
  if (a.type === "raise")
    check(
      Number.isSafeInteger(a.amount) && a.amount >= l.min && a.amount <= l.max,
      "Valor fora dos limites.",
    );
  if (a.type === "draw")
    check(
      Array.isArray(a.cards) &&
        new Set(a.cards).size === a.cards.length &&
        a.cards.length >= l.required &&
        a.cards.length <= l.draw &&
        a.cards.every((c) => f.hole[i].includes(c)),
      "Descarte inválido.",
    );
  const seat = r.seats.find((s) => s.id === id);
  if (seat && !r.tour) {
    seat.timeouts = expired ? (seat.timeouts ?? 0) + 1 : 0;
    if (seat.timeouts >= 2) seat.away = true;
  }
  const result = await step({ state: live.state, action: a });
  const labels = {
    pass: l.call ? "Call " + l.call : "Check",
    fold: "Fold",
    timeoutFold: "Desistiu por tempo",
    bring: "Bring-in " + l.bring,
    raise: (Math.max(...f.bets) ? "Raise" : "Bet") + " para " + a.amount,
    draw: "Troca de " + (a.cards?.length || 0) + " carta(s)",
    place: "Organizou as linhas",
    runout: "Escolheu " + a.count + " corrida(s) · Deal",
    cucuStay: "Cucurucho · Ficou e pagou " + l.cucu,
  };
  const paid =
    a.type === "raise"
      ? a.amount - f.bets[i]
      : a.type === "cucuStay"
        ? l.cucu
      : a.type === "pass"
        ? l.call
        : a.type === "bring"
          ? l.bring
          : 0;
  const refunds = result.frame.rows
    ? []
    : result.frame.stacks.flatMap((stack, index) => {
        const amount =
          stack -
          f.stacks[index] +
          (index === i ? paid : 0) -
          (result.frame.payouts[index] - f.payouts[index]);
        return amount > 0 ? [{ index, amount }] : [];
      });
  h.frames.push({
    ...result.frame,
    ...(result.frame.finished &&
    result.frame.board.length > f.board.length &&
    (result.frame.boards?.length ?? 0) > 1 &&
    result.frame.awards?.some((pot) => !pot.uncontested)
      ? {
          // A forced all-in runout and Double Board showdown must follow
          // the same reveal → winning hand → payout sequence.
          runoutFrom: f.board.length,
          runoutDelay: 650,
          runoutStep: 530,
        }
      : {}),
    paid,
    refunds,
    sequence: h.frames.length,
    label: h.players[i].name + " · " + labels[a.type],
    action: a.type,
    by: id,
  });
  live.state = result.state;
  live.turnExtended = false;
  live.deadline = Date.now() + r.seconds * 1000;
  r.rev++;
  if (result.frame.finished) finish(d, r);
}
export function viewFrame(h, f, id) {
  const idx = h.players.findIndex((p) => p.id === id);
  const { public: up, hiddenRows, combinations, awards, ...view } = f;
  const contestedShowdown = !!(f.finished && awards?.some((award) => !award.uncontested));
  const publicCards = up.map((flags, i) => flags.map((flag, j) => {
    // An uncontested pot (everyone else folded) must never auto-show hidden
    // hole cards. A player's explicit selection is still respected.
    const volunteered = !!(f.finished && h.showCards?.[h.players[i].id]?.includes(j));
    return volunteered || (!!flag && (!f.finished || contestedShowdown));
  }));
  return {
    ...view,
    awards: f.finished
      ? awards?.map((pot) => ({
          ...pot,
          winners: pot.winners.map((winner) =>
            winner.index === idx ||
            (up[winner.index].length && up[winner.index].every(Boolean))
              ? winner
              : { ...winner, cards: [], label: null },
          ),
        }))
      : undefined,
    combinations: combinations?.map((labels, i) =>
      i === idx || (f.finished && publicCards[i].length && publicCards[i].every(Boolean))
        ? labels
        : [],
    ),
    hole: f.hole.map((cs, i) =>
      cs.map((c, j) => (i === idx || publicCards[i][j] ? c : null)),
    ),
    rows: f.rows?.map((rs, i) =>
      hiddenRows[i] && i !== idx ? rs.map((row) => row.map(() => null)) : rs,
    ),
    legal: idx === f.actor ? f.legal : {},
  };
}
export function handView(h, id, all = false) {
  const { frames, ...meta } = h;
  const finished = !!frames.at(-1)?.finished;
  return {
    ...meta,
    // Other players must not see preselected cards before the hand concludes.
    showCards: finished ? (h.showCards ?? {}) : { [id]: h.showCards?.[id] ?? [] },
    frames: (all ? frames : [frames.at(-1)]).map((f) => viewFrame(h, f, id)),
  };
}
export function roomView(d, r, u, detail = false) {
  const own = r.owner === u.id;
  const joined = r.seats.some((s) => s.id === u.id);
  const {
    hand,
    chat,
    spectatorChat,
    code,
    allowed,
    passhash,
    waitlist,
    moveReceipts,
    chipRequests,
    cashLedger,
    pendingEntries,
    ...info
  } = r;
  const slots = seatSlots(r);
  // Between an all-in showdown and its visual award, keep the public stack
  // at the post-bet/pre-award amount.  The server has settled the hand once,
  // but must not visually credit winners before the last board and the
  // winning five-card combination have been presented.
  const settlingHand = !hand && r.last ? d.hands[r.last] : null;
  const settlingFrame = settlingHand?.frames.at(-1);
  const settlingPresentation = settlingFrame && showdownFlow(
    settlingFrame, Date.now() - (settlingHand.ended ?? Date.now()),
  );
  const pendingAward = !!(
    settlingHand && settlingFrame?.finished &&
    settlingFrame.runoutFrom != null &&
    (settlingFrame.boards?.length ?? 0) > 1 &&
    !settlingPresentation.awardsReady
  );
  const preAwardStacks = new Map();
  if (pendingAward) settlingHand.players.forEach((player, index) => {
    const current = r.seats.find(seat => seat.id === player.id);
    if (current && current.stack === settlingFrame.stacks[index])
      preAwardStacks.set(player.id, Math.max(0, settlingFrame.stacks[index] - settlingFrame.payouts[index]));
  });
  const out = {
    ...info,
    seats: r.seats.map(({ funding, initialBuy, ...seat }, i) => ({
      ...seat,
      stack: preAwardStacks.get(seat.id) ?? seat.stack,
      position: slots[i],
      name: d.users[seat.id].name,
      avatar: avatarFor(d.users[seat.id]),
      photo: d.users[seat.id].shopAvatar ? null : d.users[seat.id].photoId,
      shopAvatar: d.users[seat.id].shopAvatar || "",
      freeAvatar: Number.isInteger(d.users[seat.id].freeAvatar) ? d.users[seat.id].freeAvatar : null,
      customAvatar: d.users[seat.id].avatar || "",
      vip: !!d.users[seat.id].vip,
    })),
    inHand: !!hand,
    joined,
    own,
    canHost: own || !!r.cohosts?.includes(u.id),
    queuePosition: (waitlist ?? []).indexOf(u.id) + 1,
    queueLength: (waitlist ?? []).length,
  };
  if (detail) {
    out.myPendingEntry = (pendingEntries ?? []).find(e => e.id === u.id) ?? null;
    out.pendingPositions = (pendingEntries ?? []).map(e => e.position);
    if (own || u.admin) {
      out.chipRequests = (chipRequests ?? []).map(e => ({ ...e, name: d.users[e.id]?.name ?? "Jogador" }));
      out.cashReport = [...(cashLedger ?? []), ...r.seats.map(s => ({id:s.id,name:d.users[s.id]?.name,bought:s.bought ?? r.buy,cashedOut:s.stack,active:true}))];
    }
  }
  if (detail && (own || u.admin))
    out.waitingPlayers = (waitlist ?? []).map((id) => ({
      id,
      name: d.users[id].name,
    }));
  if (detail) {
    check(!r.private || allowed.includes(u.id), "Convite necessário.");
    if (!r.watch && !joined && !own)
      return { ...out, chat: [], live: null, lastHand: null, restricted: true };
    const results = {};
    const history = [];
    for (const completed of Object.values(d.hands)) {
      if (completed.room !== r.id || (pendingAward && completed.id === settlingHand.id)) continue;
      const frame = completed.frames.at(-1);
      const best = Math.max(...frame.payouts);
      const ownIndex = completed.players.findIndex(
        (player) => player.id === u.id,
      );
      const payouts = completed.players.flatMap((player, index) => {
        const amount = frame.payouts[index];
        const won = frame.rows ? amount === best : amount > 0;
        return won ? [{ name: player.name, amount }] : [];
      });
      // History uses the same card-visibility filter as live/replay views.
      // Never expose a folded opponent's private cards from the raw engine frame.
      const visibleFinal = viewFrame(completed, frame, u.id);
      const foldedIds = new Set(completed.frames.filter((event) =>
        event.action === "fold" || event.action === "timeoutFold"
      ).map((event) => event.by));
      const participants = completed.players.map((player, index) => {
        const received = frame.rows ? 0 : (frame.payouts[index] ?? 0);
        const net = frame.rows ? received : frame.stacks[index] - player.stack;
        const invested = frame.rows ? 0 : Math.max(0, player.stack + received - frame.stacks[index]);
        return {
          id: player.id, name: player.name, avatar: player.avatar,
          won: frame.rows ? frame.payouts[index] === best : received > 0,
          folded: foldedIds.has(player.id),
          cards: visibleFinal.hole?.[index] ?? [],
          invested, received, net, stack: frame.stacks[index],
        };
      });
      const boardSets = visibleFinal.boards?.length ? visibleFinal.boards : [visibleFinal.board ?? []];
      const winningCombos = (visibleFinal.awards ?? []).flatMap((award) =>
        (award.winners ?? []).filter((winner) => winner.cards?.length).map((winner) => ({
          playerId: completed.players[winner.index]?.id,
          boardIndex: award.boardIndex ?? 0,
          cards: winner.cards,
          label: winner.label,
          amount: winner.amount,
        }))
      );
      history.push({
        id: completed.id,
        number: completed.number,
        game: completed.game,
        ended: completed.ended,
        board: visibleFinal.board ?? [],
        boards: boardSets,
        winningCombos,
        ownCards: ownIndex < 0 ? [] : (visibleFinal.hole?.[ownIndex] ?? []),
        blind: completed.blind,
        points: !!frame.rows,
        winners: payouts.map((p) => p.name),
        payouts,
        participants,
        diamonds: ownIndex < 0 ? 0 : (frame.diamonds?.[ownIndex] ?? 0),
        totalPot: frame.rows
          ? null
          : (frame.grossPot ??
            frame.payouts.reduce((total, amount) => total + amount, 0)),
        net:
          ownIndex < 0
            ? null
            : frame.rows
              ? frame.payouts[ownIndex]
              : frame.stacks[ownIndex] - completed.players[ownIndex].stack,
      });
      completed.players.forEach((player, index) => {
        const totals = (results[player.id] ??= { won: 0, lost: 0, hands: 0 });
        const net = frame.rows
          ? frame.payouts[index]
          : frame.stacks[index] - player.stack;
        totals.hands++;
        totals.won += Math.max(net, 0);
        totals.lost += Math.max(-net, 0);
      });
    }
    Object.assign(out, {
      results,
      history: history.sort((a, b) => b.number - a.number),
      code: own || joined ? code : undefined,
      chat: (joined ? chat : (spectatorChat ?? [])).filter(
        (m) => !u.blocked?.includes(m.by),
      ),
      canExtend: !!(
        r.timeBank &&
        hand &&
        hand.h.players[hand.h.frames.at(-1).actor]?.id === u.id &&
        !hand.timeBankUsed?.includes(u.id)
      ),
      session:
        joined && !r.tour
          ? (() => {
              const seat = r.seats.find((s) => s.id === u.id);
              return {
                bought: seat.bought ?? r.buy,
                initialBuy: seat.initialBuy,
                funding: (seat.funding ?? []).slice(-30),
                leaveAfterHand: !!seat.leaveAfterHand,
                stack: seat.stack,
              };
            })()
          : undefined,
      live: hand ? handView(hand.h, u.id) : null,
      lastHand: !hand && r.last ? (() => {
        const view = handView(d.hands[r.last], u.id);
        if (pendingAward && view.frames[0]?.stacks) {
          view.frames[0].stacks = [...view.frames[0].stacks];
          settlingHand.players.forEach((player, i) => {
            if (preAwardStacks.has(player.id)) view.frames[0].stacks[i] = preAwardStacks.get(player.id);
          });
        }
        return view;
      })() : null,
      deadline: hand?.deadline,
      turnSeconds: hand
        ? r.seconds + (hand.turnExtended ? r.timeBank : 0)
        : r.seconds,
    });
  }
  return out;
}
