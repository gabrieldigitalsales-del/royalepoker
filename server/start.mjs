import {closingSummary} from "./closing-summary.mjs";
import { findChipTransactionReplay, recordChipTransaction } from "./chip-transaction-replay.mjs";
import {tableBalances} from "./table-balances.mjs";
import { royalWalletView, requestRoyalWithdrawal, createDepositIntent, decideRoyalWithdrawal, royalWalletAdminView } from "./royal-wallet.mjs";
import { prototypeLedger } from "./rake-prototype.mjs";
import { training } from "./training.mjs";
import { rakeReport } from "./cash-updates.mjs";
import {
  avatars,
  progress,
  rakeAdmin,
  avatarFor,
  publicGrossResult,
  grossPayoutsFor,
} from "./progression.mjs";
import http from "node:http";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { catalog } from "./catalog.mjs";
import { syncDealerChoiceAfterSeatChange, prepareDealerChoice, nextDealerSeat, holdDealerChoice, resumeDealerChoice, choiceTimeLeft, DEALER_PAUSE_MS, DEALER_CHOICE_MS } from "./dealer-seat-sync.mjs";
import { upgradeDealerRotation } from "./dealer-rotation.mjs";
import { ensureDealerChoiceModes } from "./dealer-choice-modes.mjs";
import { statistics } from "./stats.mjs";
import { storage } from "./store.mjs";
import {
  deal,
  move,
  makeRoom,
  MAX_TABLE_PLAYERS,
  availableSeats,
  automatic,
  sit,
  seatSlots,
  nextUtg,
  prepareUtgStraddle,
  leave,
  notify,
  roomView,
  pendingPrizeHand,
  handView,
  uid,
  token,
  requireThat as check,
} from "./game.mjs";
import { balance, startTour } from "./tournaments.mjs";
import { stop } from "./worker.mjs";
const base = fileURLToPath(new URL("../", import.meta.url));
process.chdir(base);
if (existsSync(".env")) process.loadEnvFile(".env");
const store = await storage();
// Existing rooms created with the former default should receive the new games.
// Deliberately customized rotations are never rewritten.
const upgradedRooms = structuredClone(store.value);
let upgraded = false;
for (const room of Object.values(upgradedRooms.rooms)) {
  if (room.game !== "choice") continue;
  const next = upgradeDealerRotation(room.rotation);
  if (JSON.stringify(next) !== JSON.stringify(room.rotation)) {
    room.rotation = next;
    upgraded = true;
  }
}
if (upgraded && store.active) await store.commit(upgradedRooms, "dealer rotation catalog upgrade");
// Upgrade old Dealer's Choice rooms so newly implemented games are selectable.
const migrated = structuredClone(store.value);
let changed = false;
for (const room of Object.values(migrated.rooms)) {
  if (ensureDealerChoiceModes(room)) changed = true;
}
if (changed && store.active) await store.commit(migrated, "Dealer’s Choice catalog upgrade");
const port = Number(process.env.PORT || 4190),
  host = process.env.HOST || "127.0.0.1";
const cloud =
  process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
const wss = new WebSocketServer({ noServer: true }),
  online = new Map(),
  attempts = new Map();
const tableMetrics = { actions: 0, duplicates: 0, actionMs: 0, sockets: 0 };
const digest = (s) => createHash("sha256").update(s).digest("hex");
const nameSchema = z.string().trim().min(2).max(32);
const options = z.object({
  name: nameSchema,
  game: z.string().max(24),
  capacity: z.number().int().min(2).max(9),
  blind: z
    .number()
    .int()
    .min(2)
    .max(1000)
    .refine((n) => n % 2 === 0),
  rakeEnabled: z.boolean().optional(),
  bombInterval: z.number().int().min(0).max(50).optional(),
  bombAnteMultiplier: z.number().int().min(1).max(20).optional(),
  cucuruchoEnabled: z.boolean().optional(),
  cucuruchoAnteMultiplier: z.number().int().min(1).max(20).optional(),
  buy: z.number().int().min(20).max(1000000),
  entryAmount: z.number().int().min(20).optional(),
  seconds: z.union([z.literal(15), z.literal(25), z.literal(30)]),
  timeBank: z.union([z.literal(0), z.literal(10), z.literal(20)]).optional(),
  watch: z.boolean().optional(),
  private: z.boolean().optional(),
  password: z.string().max(72).optional(),
  rotation: z.array(z.string().max(24)).max(32).optional(),
});
const hashed = (pw, salt = randomBytes(16).toString("hex")) =>
  salt + ":" + scryptSync(pw, salt, 32).toString("hex");
function passwordOk(pw, hash) {
  return (
    !!hash &&
    timingSafeEqual(
      Buffer.from(hashed(pw, hash.split(":")[0])),
      Buffer.from(hash),
    )
  );
}
const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  avatar: avatarFor(u),
  customAvatar: u.avatar || "",
  shopAvatar: u.shopAvatar,
  freeAvatar: Number.isInteger(u.freeAvatar) ? u.freeAvatar : null,
  diamonds: u.diamonds ?? 0,
  photo: u.shopAvatar ? null : u.photoId,
  appearance: u.appearance,
  ownedAvatars: u.ownedAvatars ?? [],
  vip: !!u.vip,
  wallet: u.wallet,
  admin: u.admin,
  preferences: u.preferences || {},
  friends: u.friends || [],
  blocked: u.blocked || [],
  invites: u.invites || [],
  notices: (u.notices ?? []).filter(
    (notice) => notice.at > (u.noticesReadAt ?? 0),
  ),
});
function session(d, raw) {
  const sess = raw && d.sessions[digest(raw)];
  const user = sess && d.users[sess.user];
  if (!user || sess.until <= Date.now() || user.banned) return null;
  // An existing account can be promoted by a private Render-only setting.
  // Never expose or accept ADMIN_EMAIL from the browser.
  if (process.env.ADMIN_EMAIL && user.email?.toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase())
    user.admin = true;
  return user;
}
function authorizeRoom(r, u) {
  check(r && (!r.private || r.allowed.includes(u.id)), "Mesa indisponível.");
}
function signed(d, u) {
  check(!u.banned, "Conta suspensa.");
  // Do not invalidate an active phone or desktop when this account signs in
  // from another device. Expired sessions are pruned without forcing logout.
  for (const [k, s] of Object.entries(d.sessions))
    if (s.until < Date.now()) delete d.sessions[k];
  const raw = token();
  d.sessions[digest(raw)] = { user: u.id, until: Date.now() + 30 * 86400000 };
  u.last = Date.now();
  return { token: raw };
}
function newUser(d, email, name, hash, id = uid()) {
  check(
    !Object.values(d.users).some(
      (x) => x.email === email || x.name.toLowerCase() === name.toLowerCase(),
    ),
    "E-mail ou apelido já cadastrado.",
  );
  const u = {
    id,
    email,
    name,
    hash,
    wallet: 10000,
    created: Date.now(),
    admin: email === process.env.ADMIN_EMAIL?.toLowerCase(),
  };
  d.users[id] = u;
  return u;
}
function summary(h, id) {
  const i = h.players.findIndex((p) => p.id === id),
    f = h.frames.at(-1);
  return {
    id: h.id,
    room: h.room,
    game: h.game,
    name: h.name,
    ended: h.ended,
    tour: h.tour,
    points: !!f.rows,
    net: f.rows ? f.payouts[i] : f.stacks[i] - h.players[i].stack,
    won: f.payouts[i] > 0,
    winners: h.players
      .filter((p, j) =>
        f.rows ? f.payouts[j] === Math.max(...f.payouts) : f.payouts[j] > 0,
      )
      .map((p) => p.name),
    payout: f.payouts[i],
    grossNet: publicGrossResult(f, h.players[i], i),
    grossPayout: grossPayoutsFor(f)[i],
    diamonds: f.diamonds?.[i] ?? 0,
    cards: f.hole?.[i] ?? [],
    blind: h.blind,
  };
}
function playerProgress(d, u) {
  return progress(
    Object.values(d.hands).filter(
      (hand) =>
        !hand.tour &&
        !hand.frames.at(-1)?.rows &&
        hand.players.some((player) => player.id === u.id),
    ).length,
  );
}
function dashboard(d, u) {
  const pendingHistory = new Set(Object.values(d.rooms)
    .map(room => pendingPrizeHand(d, room)?.id).filter(Boolean));
  return {
    me: publicUser(u),
    practiceAvailable: !!u.practice,
    shop: { avatars: avatars.map(({ id, symbol, name }) => ({ id, symbol, name })) },
    progress: playerProgress(d, u),
    rakeAvailable: !!rakeAdmin(d.users),
    rakePercent: Number.isInteger(d.cashier?.globalRakePercent) ? d.cashier.globalRakePercent : 3,
    clubChips: d.cashier.club?.balance ?? 0,
    catalog: Object.values(catalog),
    rooms: Object.values(d.rooms)
      .filter((r) => !r.closed && (!r.private || r.allowed.includes(u.id)))
      .map((r) => roomView(d, r, u)),
    history: Object.values(d.hands)
      .filter((h) => h.players.some((p) => p.id === u.id) && !pendingHistory.has(h.id))
      .reverse()
      .map((h) => summary(h, u.id)),
    tours: Object.values(d.tours),
    people: Object.values(d.users)
      .filter((x) => !x.banned)
      .map((x) => ({
        id: x.id,
        name: x.name,
        avatar:
          avatars.find((item) => item.id === x.shopAvatar)?.symbol ?? x.avatar,
        vip: !!x.vip,
        customAvatar: x.avatar || "",
        shopAvatar: x.shopAvatar || "",
        photo: x.shopAvatar ? null : x.photoId,
        online: online.has(x.id),
        chips:
          x.wallet +
          Object.values(d.rooms)
            .filter((r) => !r.tour)
            .reduce(
              (n, r) => n + (roomView(d, r, u).seats.find((s) => s.id === x.id)?.stack || 0),
              0,
            ),
      })),
  };
}
async function command(d, u, b) {
  const r = d.rooms[b.room],
    t = d.tours[b.tour];
  switch (b.cmd) {
    case "register":
    case "login": {
      check(!cloud, "Use o login Supabase.");
      const email = z.string().email().max(200).parse(b.email).toLowerCase(),
        pw = z.string().min(8).max(128).parse(b.password);
      if (b.cmd === "register") {
        check(
          !process.env.CLUB_BETA_CODE || b.beta === process.env.CLUB_BETA_CODE,
          "Código de acesso ao beta inválido.",
        );
        const account = newUser(d, email, nameSchema.parse(b.name), hashed(pw));
        const recovery = token();
        account.recovery = digest(recovery);
        return { ...signed(d, account), recovery };
      }
      const account = Object.values(d.users).find((x) => x.email === email);
      check(
        account && passwordOk(pw, account.hash),
        "E-mail ou senha incorretos.",
      );
      return signed(d, account);
    }
    case "recover": {
      check(!cloud, "Use a recuperação por e-mail.");
      const account = Object.values(d.users).find(
        (x) => x.email === b.email?.toLowerCase(),
      );
      check(
        account?.recovery === digest(z.string().min(20).parse(b.recovery)),
        "Código inválido.",
      );
      account.hash = hashed(z.string().min(8).max(128).parse(b.password));
      // Password recovery must revoke *all* old sessions. Otherwise a
      // stolen token still controls the wallet after the password is reset.
      for (const [key, session] of Object.entries(d.sessions))
        if (session.user === account.id) delete d.sessions[key];
      const recovery = token();
      account.recovery = digest(recovery);
      return { ...signed(d, account), recovery };
    }
    case "cloud": {
      check(cloud, "Supabase indisponível.");
      const { data, error } = await cloud.auth.getUser(z.string().parse(b.jwt));
      check(
        !error && data.user?.email_confirmed_at,
        "Confirme seu e-mail para entrar.",
      );
      const p = data.user;
      return signed(
        d,
        d.users[p.id] ||
          newUser(
            d,
            p.email.toLowerCase(),
            nameSchema.parse(p.user_metadata.name || p.email.split("@")[0]),
            null,
            p.id,
          ),
      );
    }
  }
  check(u, "Entre novamente.");
  switch (b.cmd) {
    case "practiceResume":
    case "practiceStart":
    case "practiceMove":
      return training(u, b);
    case "walletHistory":
      return { entries: (u.walletLog ?? []).slice(-200).reverse() };
    case "royalWallet":
      return royalWalletView(d, u);
    case "royalWithdrawalRequest": {
      const amount = z.number().int().positive().max(1000000).parse(b.amount);
      const reference = z.string().uuid().parse(b.reference);
      const item = requestRoyalWithdrawal(d, u, amount, reference);
      return { id:item.id, status:item.status, reserved:item.amount };
    }
    case "royalDepositIntent": {
      const amount = z.number().int().positive().max(1000000).parse(b.amount);
      const reference = z.string().uuid().parse(b.reference);
      const item = createDepositIntent(d,u,amount,reference);
      return {id:item.id,status:item.status,providerConnected:false};
    }
    case "royalWalletAdmin":
      check(u.admin, "Acesso administrativo restrito.");
      return { requests: royalWalletAdminView(d) };
    case "royalWalletDecision": {
      check(u.admin, "Acesso administrativo restrito.");
      const action = z.enum(["approve","reject","complete"]).parse(b.action);
      const id = z.string().uuid().parse(b.id);
      const item = decideRoyalWithdrawal(d,u,id,action);
      const evId=uid();
      d.events[evId]={id:evId,by:u.name,action:"royalWallet:"+action,
        target:item.userId,amount:item.amount,at:Date.now()};
      return {id:item.id,status:item.status};
    }
    case "feedback": {
      const text = z.string().trim().min(5).max(400).parse(b.text);
      const id = uid();
      d.reports[id] = {
        id,
        by: u.id,
        target: u.id,
        text: "Feedback beta · " + text,
        at: Date.now(),
      };
      break;
    }
    case "appearance":
      u.appearance = z
        .object({
          theme: z.enum(["wood", "blue", "violet", "lagoon", "ruby"]),
          cards: z.enum(["classic", "vivid", "ivory", "night"]),
        })
        .parse(b.appearance);
      break;
    case "photo": {
      if (!b.jpeg) {
        delete u.photoId;
        delete u.photoBytes;
        break;
      }
      const jpeg = z
        .string()
        .max(14000)
        .regex(/^[A-Za-z0-9+/]+=*$/)
        .parse(b.jpeg);
      const bytes = Buffer.from(jpeg, "base64");
      check(
        bytes.length > 10 &&
          bytes[0] === 255 &&
          bytes[1] === 216 &&
          bytes.at(-2) === 255 &&
          bytes.at(-1) === 217,
        "Imagem inválida.",
      );
      u.photoId = uid();
      u.photoBytes = jpeg;
      u.shopAvatar = "";
      u.freeAvatar = null;
      break;
    }
    case "selectFreeAvatar": {
      const selection = z.number().int().min(0).max(15).nullable().parse(b.selection);
      u.freeAvatar = selection;
      if (selection !== null) u.shopAvatar = "";
      break;
    }
    case "grantChips": {
      const target = d.users[b.id],
        seat = r?.seats.find((s) => s.id === b.id);
      check(
        target &&
          !target.banned &&
          (u.admin ||
            (r &&
              !r.closed &&
              !r.tour &&
              r.owner === u.id &&
              (seat || r.waitlist?.includes(b.id)))),
        "Crédito indisponível.",
      );
      const amount = z.number().int().positive().safe().parse(b.amount);
      const ref = z
        .string()
        .regex(/^[a-f0-9]{32}$/)
        .parse(b.reference);
      const key = "credito-" + u.id + "-" + ref;
      const previous = d.events[key];
      if (previous) {
        check(
          previous.amount === amount &&
            previous.recipient === target.id &&
            previous.room === b.room,
          "Comprovante já utilizado.",
        );
        return { destination: previous.destination };
      }
      const onTable =
        seat &&
        !r.hand &&
        !pendingPrizeHand(d, r) &&
        !r.closed &&
        !r.tour &&
        catalog[r.game].family !== "Chinês";
      const destination = onTable ? "mesa" : "carteira";
      check(
        b.destination === destination,
        "A situação da mesa mudou. Confira o destino e confirme novamente.",
      );
      if (onTable) {
        check(
          Number.isSafeInteger(seat.stack + amount) &&
            Number.isSafeInteger((seat.bought ?? r.buy) + amount),
          "Valor fora da precisão suportada.",
        );
        seat.stack += amount;
        seat.bought = (seat.bought ?? r.buy) + amount;
        (seat.funding ??= []).push({ type: "crédito", amount, at: Date.now() });
      } else {
        check(
          Number.isSafeInteger(target.wallet + amount),
          "Valor fora da precisão suportada.",
        );
        target.wallet += amount;
      }
      d.events[key] = {
        id: key,
        room: b.room,
        at: Date.now(),
        by: u.name,
        action: "Crédito de fichas",
        target: target.name,
        recipient: target.id,
        amount,
        destination,
      };
      notify(
        target,
        amount.toLocaleString("pt-BR") + " fichas adicionadas à " + destination,
        r?.id,
      );
      return { destination };
    }
    case "buyShop":
      check(false, "Loja de diamantes em breve. Os resgates ainda estão bloqueados.");
      break;
    case "equipAvatar":
      check(
        b.item === "" || u.ownedAvatars?.includes(b.item),
        "Avatar indisponível.",
      );
      u.shopAvatar = b.item;
      break;
    case "stats": {
      check(
        !b.target ||
          b.target === u.id ||
          (u.vip &&
            d.users[b.target] &&
            !d.users[b.target].banned &&
            !d.users[b.target].blocked?.includes(u.id)),
        "Consulta disponível para VIP.",
      );
      const stats = statistics(
        Object.values(d.hands).filter((h) => !b.game || h.game === b.game),
        b.target || u.id,
      );
      if (!b.target || b.target === u.id) return stats;
      const { vpip, pfr, cbet, af, three, wtsd, wsd, handsCount, favoriteGame } = stats;
      return { vpip, pfr, cbet, af, three, wtsd, wsd, handsCount, favoriteGame };
    }
    case "home":
      return dashboard(d, u);
    case "room":
      authorizeRoom(r, u);
      {
        const view = roomView(d, r, u, true);
        view.seats = view.seats.map((seat) => ({
          ...seat,
          connected: online.has(seat.id),
        }));
        if (!r.tour && !view.restricted && catalog[r.game].family!=="Chinês") view.balances=tableBalances(view,d.users,online);
        return view;
      }
    case "replay": {
      const h = d.hands[b.hand];
      check(
        h?.players.some((p) => p.id === u.id),
        "Histórico privado.",
      );
      // A replay is a private endpoint too: a finished 2/3-board frame
      // exists on the server before its last river and award animation.
      // Do not leak the future board/results through the replay API.
      const originalRoom = d.rooms[h.room];
      check(!originalRoom || pendingPrizeHand(d, originalRoom)?.id !== h.id,
        "Aguarde a última carta e a premiação antes de rever a mão.");
      return handView(h, u.id, true);
    }
    case "logout":
      for (const [k, s] of Object.entries(d.sessions))
        if (s.user === u.id) delete d.sessions[k];
      break;
    case "create": {
      const opt = options.parse(b);
      opt.rakeEnabled = false; // administrative projection only; no invisible fees
      const room = makeRoom(u, opt);
      if (opt.password) {
        room.passhash = hashed(opt.password);
        room.private = true;
      }
      d.rooms[room.id] = room;
      sit(d, u, room, { amount: opt.entryAmount });
      return { id: room.id };
    }
    case "unlock": {
      const room = Object.values(d.rooms).find(
        (x) =>
          x.code === b.code &&
          !x.closed &&
          (!x.codeExpires || x.codeExpires > Date.now()),
      );
      check(
        room &&
          (!room.passhash ||
            passwordOk(String(b.password || ""), room.passhash)),
        "Convite ou senha inválidos.",
      );
      if (!room.allowed.includes(u.id)) room.allowed.push(u.id);
      u.invites = (u.invites ?? []).filter((invite) => invite.room !== room.id);
      return { id: room.id };
    }
    case "waitlist": {
      authorizeRoom(r, u);
      check(
        !r.tour && !r.closed && !r.seats.some((s) => s.id === u.id),
        "Fila indisponível.",
      );
      r.waitlist ??= [];
      if (r.waitlist.includes(u.id))
        r.waitlist = r.waitlist.filter((id) => id !== u.id);
      else {
        check(r.waitlist.length < 50, "Fila cheia.");
        r.waitlist.push(u.id);
      }
      break;
    }
    case "rotateInvite":
      authorizeRoom(r, u);
      check(r.owner === u.id, "Somente o criador pode renovar o convite.");
      r.code = token().slice(0, 12);
      r.codeExpires = Date.now() + 86400000;
      break;
    case "cohost":
      authorizeRoom(r, u);
      check(
        r.owner === u.id && b.id !== u.id && r.seats.some((s) => s.id === b.id),
        "Escolha um jogador sentado.",
      );
      r.cohosts ??= [];
      r.cohosts = r.cohosts.includes(b.id)
        ? r.cohosts.filter((id) => id !== b.id)
        : [...r.cohosts, b.id];
      break;
    case "rebuy":
    case "autoRefill": {
      authorizeRoom(r, u);
      // Idempotency is checked before looking up the current seat/stack. A
      // successful operation can be retried after an ambiguous network error.
      const chipReference = b.cmd === "rebuy" && b.reference != null
        ? z.string().regex(/^[a-f0-9]{32}$/).parse(b.reference)
        : null;
      const chipReceipt = chipReference && findChipTransactionReplay(
        d.events, u.id, chipReference,
        { room: r.id, recipient: b.recipient ?? u.id, amount: b.amount }
      );
      if (chipReceipt) return chipReceipt;
      const recipient =
        b.cmd === "rebuy" && b.recipient != null ? b.recipient : u.id;
      check(
        recipient === u.id || r.owner === u.id,
        "Apenas o dono pode enviar fichas.",
      );
      const seat = r.seats.find((s) => s.id === recipient);
      check(
        seat && !r.tour && catalog[r.game].family !== "Chinês",
        "Reposição indisponível.",
      );
      if (b.cmd === "autoRefill") seat.autoRefill = seat.autoRefill ? 0 : r.buy;
      else {
        check(!r.hand && !pendingPrizeHand(d, r), "Aguarde a premiação antes de repor as fichas.");
        check(
          b.expectedStack == null || b.expectedStack === seat.stack,
          "O saldo do jogador na mesa mudou. Confira o valor e tente novamente.",
        );
        const minimum = Math.max(1, r.buy - seat.stack);
        const maximum = u.wallet;
        const amount =
          b.amount == null
            ? Math.max(0, r.buy - seat.stack)
            : z.number().int().parse(b.amount);
        check(
          amount >= minimum && amount <= maximum,
          "A reposição deve respeitar a entrada mínima e o saldo disponível.",
        );
        check(
          amount > 0 && u.wallet >= amount,
          "Sem fichas suficientes ou entrada já completa.",
        );
        check(
          Number.isSafeInteger(seat.stack + amount) &&
          Number.isSafeInteger((seat.bought ?? r.buy) + amount) &&
          Number.isSafeInteger(u.wallet - amount),
          "Valor fora da precisão suportada.",
        );
        seat.bought = (seat.bought ?? r.buy) + amount;
        seat.stack += amount;
        (seat.funding ??= []).push({
          type: recipient === u.id ? "reposição" : "recebida",
          amount,
          at: Date.now(),
        });
        u.wallet -= amount;
        const result = {credited: amount, stack: seat.stack, pending: false};
        if (chipReference) recordChipTransaction(d.events, u.id, chipReference, {
          room: r.id, recipient, amount, ...result,
        });
        return result;
      }
      break;
    }
    case "timeBank": {
      authorizeRoom(r, u);
      const hand = r.hand;
      check(
        hand &&
          hand.deadline > Date.now() &&
          hand.h.players[hand.h.frames.at(-1).actor]?.id === u.id &&
          r.timeBank,
        "Banco de tempo indisponível.",
      );
      hand.timeBankUsed ??= [];
      check(
        !hand.timeBankUsed.includes(u.id),
        "Banco de tempo já usado nesta mão.",
      );
      hand.timeBankUsed.push(u.id);
      hand.turnExtended = true;
      hand.deadline += r.timeBank * 1000;
      break;
    }
    case "queueEntry": {
      authorizeRoom(r, u);
      check(!r.closed && !r.tour && !r.seats.some(s => s.id === u.id), "Entrada indisponível.");
      check(availableSeats(r) > 0, "Mesa cheia (máximo de 9 jogadores).");
      const position = z.number().int().min(0).max(Math.min(r.capacity, MAX_TABLE_PLAYERS) - 1).parse(b.position);
      const amount = z.number().int().min(r.buy).max(100000000).parse(b.amount);
      check(u.wallet >= amount, "Saldo insuficiente para o buy-in.");
      check(!r.waitlist?.length || r.waitlist[0] === u.id, "Aguarde sua vez na fila.");
      check(!r.seats.some(s => s.position === position), "Assento ocupado.");
      check(!(r.pendingEntries ?? []).some(e => e.position === position && e.id !== u.id), "Assento já reservado.");
      r.pendingEntries = [...(r.pendingEntries ?? []).filter(e => e.id !== u.id), {id:u.id,position,amount,at:Date.now()}];
      break;
    }
    case "cancelEntry": {
      authorizeRoom(r, u);
      r.pendingEntries = (r.pendingEntries ?? []).filter(e => e.id !== u.id);
      break;
    }
    case "requestChips": {
      authorizeRoom(r, u);
      check(!r.closed && !r.tour && (r.seats.some(s => s.id === u.id) || r.waitlist?.includes(u.id)), "Entre na mesa ou na fila.");
      const amount = z.number().int().min(1).max(100000000).parse(b.amount);
      r.chipRequests = [...(r.chipRequests ?? []).filter(e => e.id !== u.id), {id:u.id, amount, at:Date.now()}];
      notify(d.users[r.owner], u.name + " solicitou " + amount + " fichas", r.id);
      break;
    }
    case "resolveChips": {
      authorizeRoom(r, u);
      check(r.owner === u.id || u.admin, "Somente o responsável pela mesa.");
      const request = (r.chipRequests ?? []).find(e => e.id === b.id);
      check(request, "Pedido não encontrado.");
      const amount = z.number().int().min(0).max(100000000).parse(b.amount);
      const target = d.users[request.id];
      check(target, "Jogador indisponível.");
      if (amount > 0) {
        // Credit player's wallet using the existing administrator balance, never mint chips.
        check(u.wallet >= amount, "Saldo do responsável insuficiente.");
        u.wallet -= amount; target.wallet += amount;
        notify(target, "Pedido de fichas aprovado: " + amount + " creditadas na carteira", r.id);
      } else notify(target, "Pedido de fichas recusado", r.id);
      r.chipRequests = r.chipRequests.filter(e => e !== request);
      break;
    }
    case "sit": {
      authorizeRoom(r, u);
      const walletBefore = u.wallet;
      sit(d, u, r, b);
      const seat = r.seats.find(s => s.id === u.id);
      return { credited: walletBefore - u.wallet, stack: seat.stack, pending: false };
    }
    case "readNotices":
      u.noticesReadAt = Date.now();
      break;
    case "leaveAfterHand": {
      authorizeRoom(r, u);
      const seat = r.seats.find((entry) => entry.id === u.id);
      check(seat && !r.tour && !r.closed, "Saída indisponível.");
      if (!r.hand) leave(d, u, r);
      else seat.leaveAfterHand = !seat.leaveAfterHand;
      return { pending: r.hand ? !!seat.leaveAfterHand : undefined };
    }
    case "leave":
      authorizeRoom(r, u);
      leave(d, u, r);
      break;
    case "seat": {
      authorizeRoom(r, u);
      check(
        !r.hand && !r.tour && !pendingPrizeHand(d, r),
        "Mude de assento após a premiação e no intervalo de uma mesa livre.",
      );
      const mine = r.seats.findIndex((p) => p.id === u.id);
      const at = z
        .number()
        .int()
        .min(0)
        .max(Math.min(r.capacity, MAX_TABLE_PLAYERS) - 1)
        .parse(b.position);
      const slots = seatSlots(r);
      check(mine >= 0, "Sente-se primeiro.");
      check(!slots.includes(at) || slots[mine] === at, "Assento ocupado.");
      r.seats.forEach((seat, index) => {
        seat.position = index === mine ? at : slots[index];
      });
      r.seats.sort((a, b) => a.position - b.position);
      break;
    }
    case "away":
      authorizeRoom(r, u);
      check(!r.tour && !r.hand && !pendingPrizeHand(d, r), "Aguarde a premiação para alterar o assento.");
      {
        const s = r.seats.find((s) => s.id === u.id);
        check(s, "Sente-se primeiro.");
        s.away = !s.away;
        // A returning player changes the clockwise eligible-player order.
        // Keep the pending selector in sync with the server before the next hand.
        // Next dealer is recomputed after sit out / return.
        if (r.game === "choice" && r.choiceStarted && !r.paused) {
          syncDealerChoiceAfterSeatChange(r, catalog);
        }
      }
      break;
    case "close":
      authorizeRoom(r, u);
      check(r.owner === u.id && !r.hand && !r.tour, "Fechamento indisponível.");
      check(!pendingPrizeHand(d, r), "Aguarde a premiação final antes de fechar a mesa.");
      // Snapshot before returning seated stacks to wallets; previous departures
      // already appear in cashLedger. Keep a durable summary on the closed room.
      r.closingSummary = closingSummary(r, d.users, avatarFor);
      for (const s of [...r.seats]) leave(d, d.users[s.id], r);
      r.closed = true;
      return { ok: true, closingResults: r.closingSummary };
    case "pauseTable":
      authorizeRoom(r, u);
      check(
        r.owner === u.id &&
          !r.tour &&
          (r.count > 0 || r.choiceStarted) &&
          !r.closed,
        "Só o criador pode pausar esta mesa.",
      );
      r.paused = true;
      delete r.nextChoice;
      break;
    case "deal":
      authorizeRoom(r, u);
      check(
        r.tour
          ? r.seats.some((s) => s.id === u.id && !s.away)
          : r.owner === u.id,
        "Somente o dono pode iniciar ou retomar a mesa.",
      );
      check(!r.hand && !r.closed && !r.roundDone && Date.now() >= (r.reviewUntil ?? 0), "Aguarde a revisão da mão e a premiação antes de iniciar a próxima.");
      if (r.game === "choice") {
        const resuming = !!r.paused;
        r.paused = false;
        r.choiceStarted = true;
        const previous = r.nextChoice?.id ?? d.hands[r.last]?.game;
        const started = prepareDealerChoice(r, catalog, Date.now(), previous);
        check(started, "Não há modalidade válida ou jogadores suficientes para escolher.");
      } else {
        r.paused = false;
        r.preHandStarted = true;
        if (!prepareUtgStraddle(r)) await deal(d, r);
      }
      break;
    case "showCards": {
      authorizeRoom(r, u);
      // Players may also choose cards during the server-authoritative post-hand
      // review window. Only the latest finished hand may be modified.
      const hand = r.hand?.h ?? (r.last && !r.hand && Date.now() < (r.reviewUntil ?? 0) ? d.hands[r.last] : null);
      check(hand && hand.players.some((p) => p.id === u.id), "A seleção de cartas só está disponível durante a mão ou sua revisão.");
      check(b.handId === hand.id, "Esta seleção pertence a outra mão.");
      const index = hand.players.findIndex((p) => p.id === u.id);
      const count = Math.max(0, ...hand.frames.map(frame => frame.hole?.[index]?.length ?? 0));
      check(Array.isArray(b.indices) && b.indices.every((i) => Number.isInteger(i) && i >= 0 && i < count), "Seleção de cartas inválida.");
      (hand.showCards ??= {})[u.id] = [...new Set(b.indices)];
      break;
    }
    case "preStraddle": {
      authorizeRoom(r, u);
      const gate = r.preStraddle;
      check(gate && !r.hand && !r.closed && !r.paused && gate.handCount === r.count,
        "A decisão de straddle não está aberta.");
      check(gate.playerId === u.id && nextUtg(r)?.id === u.id, "Somente o próximo UTG pode escolher.");
      check(Date.now() < gate.expiresAt, "O tempo de escolha acabou.");
      const decision = z.enum(["fold", "check", "straddle"]).parse(b.choice);
      const seat = r.seats.find(s => s.id === u.id);
      check(seat && !seat.away, "Jogador indisponível.");
      if (decision === "straddle") {
        check(seat.stack >= 2 * r.blind, "Fichas insuficientes para o straddle.");
        seat.wantsStraddle = true;
      } else {
        seat.wantsStraddle = false;
      }
      if (decision === "fold") {
        // Before cards are dealt, FOLD means sitting out this upcoming hand.
        // The player can return using the avatar between hands.
        seat.away = true;
        delete r.preStraddle;
        delete r.preStraddleHandledFor;
        if (r.game === "choice") syncDealerChoiceAfterSeatChange(r, catalog);
      } else {
        r.preStraddle = { ...gate, resolved: true, decision };
        r.preStraddleHandledFor = r.count;
      }
      break;
    }
    case "straddleOpt": {
      authorizeRoom(r,u);
      check(!r.tour && !r.closed && r.straddleEnabled, "Straddle desativado nesta mesa.");
      const seat = nextUtg(r);
      check(seat?.id === u.id, "Somente o próximo UTG pode decidir o straddle.");
      check(!seat.away && seat.stack >= 2 * r.blind, "UTG precisa de pelo menos 2× BB em fichas.");
      seat.wantsStraddle = !!b.enabled;
      break;
    }
    case "configureStraddle": {
      authorizeRoom(r, u);
      check(r.owner === u.id && !r.tour && !r.hand && !r.count, "O straddle só pode ser configurado pelo dono antes da primeira mão.");
      r.straddleEnabled = !!b.enabled;
      break;
    }
    case "choiceHold": {
      authorizeRoom(r, u);
      check(r.game === "choice" && !r.closed && !r.hand && !r.paused && r.nextChoice?.selecting, "Escolha indisponível.");
      check(r.nextChoice.dealer === u.id, "Somente o dealer pode escolher.");
      if (!r.nextChoice.heldAt) {
        check(holdDealerChoice(r.nextChoice), "O tempo de escolha ainda não começou ou terminou.");
      }
      break;
    }
    case "choiceExtend": {
      authorizeRoom(r, u);
      check(r.game === "choice" && !r.closed && !r.hand && !r.paused && r.nextChoice?.selecting, "Escolha indisponível.");
      check(r.nextChoice.dealer === u.id, "Somente o dealer pode pedir tempo.");
      check(!r.nextChoice.extraTimeUsed, "Tempo extra já utilizado nesta escolha.");
      const now = Date.now();
      check((r.nextChoice.heldAt && now < (r.nextChoice.holdUntil ?? 0)) ||
        (!r.nextChoice.heldAt && now < r.nextChoice.at && now >= r.nextChoice.openedAt),
        "Tempo de escolha encerrado.");
      if (r.nextChoice.heldAt) r.nextChoice.holdUntil += 10000;
      else r.nextChoice.at += 10000;
      r.nextChoice.extraTimeUsed = true;
      break;
    }
    case "choiceResume": {
      authorizeRoom(r, u);
      check(r.game === "choice" && !r.hand && !r.closed, "Escolha indisponível.");
      if (!r.nextChoice?.selecting || r.nextChoice.dealer !== u.id) break;
      resumeDealerChoice(r.nextChoice);
      break;
    }
    case "chooseNext": {
      authorizeRoom(r, u);
      check(r.game === "choice" && (r.choiceStarted || r.count) && !r.closed && !r.hand && !r.paused, "Escolha indisponível.");
      const next = nextDealerSeat(r);
      check(next?.id === u.id && r.nextChoice?.dealer === u.id, "Somente o próximo dealer pode escolher.");
      check(r.nextChoice?.selecting, "Aguarde a próxima mão para escolher.");
      const eligible = r.seats.filter(s => !s.away && s.stack > 0);
      check(r.rotation.includes(b.choice) && eligible.length<=catalog[b.choice].max, "Modalidade indisponível para o número de jogadores.");
      // Every hand grants a choice; selecting a game never restarts the five seconds.
      const now=Date.now();
      const openedAt=r.nextChoice?.openedAt ?? now;
      const at=r.nextChoice?.at ?? now+DEALER_CHOICE_MS;
      check(r.nextChoice?.heldAt || now < at, "Tempo de escolha encerrado.");
      // Confirming a choice releases the held clock, without losing the previously selected game.
      r.nextChoice.id = b.choice; // Preserve review, hold and remaining seconds.
      r.nextChoice.confirmed = true; // Visible announcement only for an explicit choice.
      // A confirmed choice closes the selection pause immediately, retaining only the remaining five-second clock.
      if (r.nextChoice.heldAt) resumeDealerChoice(r.nextChoice, now);
      break;
    }
    case "move": {
      authorizeRoom(r, u);
      const requestId =
        b.requestId == null ? null : z.string().uuid().parse(b.requestId);
      const fingerprint = JSON.stringify([b.rev, b.action]);
      const prior =
        requestId &&
        r.moveReceipts?.find(
          (receipt) => receipt.id === requestId && receipt.player === u.id,
        );
      if (prior) {
        check(
          prior.fingerprint === fingerprint,
          "Ação já registrada com outro conteúdo.",
        );
        tableMetrics.duplicates++;
        return { accepted: true, rev: prior.rev, repeated: true };
      }
      check(
        r.hand && Date.now() < r.hand.deadline,
        "O tempo da jogada acabou.",
      );
      const started = performance.now();
      await move(d, r, u.id, b);
      tableMetrics.actions++;
      tableMetrics.actionMs += performance.now() - started;
      if (requestId) {
        r.moveReceipts = [
          ...(r.moveReceipts ?? []),
          { id: requestId, player: u.id, rev: r.rev, fingerprint },
        ].slice(-128);
      }
      if (r.tour && !r.hand) {
        r.roundDone = true;
        balance(d, d.tours[r.tour]);
      }
      return { accepted: true, rev: r.rev };
    }
    case "chat":
      authorizeRoom(r, u);
      check(r.watch || r.seats.some((s) => s.id === u.id), "Mesa restrita.");
      const channel = r.seats.some((s) => s.id === u.id)
        ? "chat"
        : "spectatorChat";
      r[channel] ??= [];
      r[channel].push({
        id: uid(),
        by: u.id,
        name: u.name,
        text: z.string().trim().min(1).max(300).parse(b.text),
        at: Date.now(),
      });
      r[channel] = r[channel].slice(-100);
      break;
    case "profile": {
      const n = nameSchema.parse(b.name);
      check(
        !Object.values(d.users).some(
          (x) => x.id !== u.id && x.name.toLowerCase() === n.toLowerCase(),
        ),
        "Apelido ocupado.",
      );
      u.name = n;
      u.avatar = z.string().max(4).parse(b.avatar);
      u.preferences = z
        .object({
          felt: z.enum(["verde", "azul", "vinho"]),
          mute: z.boolean(),
          bb: z.boolean(),
          motion: z.boolean(),
          largeCards: z.boolean().default(false),
          shortcuts: z
            .string()
            .regex(/^(off|[a-z]{3})$/)
            .refine((v) => v === "off" || new Set(v).size === 3)
            .default("fcr"),
          back: z.enum(["verde", "bordo", "azul"]).default("verde"),
          chip: z.enum(["ouro", "jade", "rubi"]).default("ouro"),
          face: z.enum(["classica", "quatro"]).default("classica"),
          theme: z.enum(["clube", "grafite"]).default("clube"),
          volume: z.number().int().min(0).max(100).default(50),
          speed: z.enum(["normal", "rapida"]).default("normal"),
          chatMuted: z.boolean().default(false),
          confirmAllIn: z.boolean().default(false),
          turnVolume: z.number().int().min(0).max(100).optional(),
          chipVolume: z.number().int().min(0).max(100).default(35),
          handVolume: z.number().int().min(0).max(100).default(35),
        })
        .parse(b.preferences);
      break;
    }
    case "friend":
    case "block": {
      check(d.users[b.id] && b.id !== u.id, "Jogador inválido.");
      const key = b.cmd === "friend" ? "friends" : "blocked";
      const a = u[key] || [];
      u[key] = a.includes(b.id) ? a.filter((x) => x !== b.id) : [...a, b.id];
      break;
    }
    case "invite": {
      authorizeRoom(r, u);
      check(
        r.seats.some((s) => s.id === u.id),
        "Sente-se primeiro.",
      );
      const dest = d.users[b.id];
      check(dest && !dest.blocked?.includes(u.id), "Indisponível.");
      dest.invites = [
        ...(dest.invites || []).filter((v) => v.room !== r.id),
        { room: r.id, name: r.name, from: u.name, code: r.code },
      ].slice(-30);
      break;
    }
    case "report": {
      check(d.users[b.id], "Jogador inválido.");
      const id = uid();
      const hand = b.hand && d.hands[b.hand];
      check(
        !b.hand ||
          (hand &&
            hand.room === r?.id &&
            hand.players.some((p) => p.id === u.id) &&
            hand.players.some((p) => p.id === b.id)),
        "Mão indisponível para denúncia.",
      );
      d.reports[id] = {
        id,
        by: u.id,
        target: b.id,
        hand: hand ? hand.id : undefined,
        text: z.string().trim().min(3).max(400).parse(b.text),
        at: Date.now(),
      };
      break;
    }
    case "tourCreate": {
      const o = options.parse(b);
      makeRoom(u, o);
      const id = uid();
      d.tours[id] = {
        ...o,
        id,
        owner: u.id,
        state: "open",
        entries: [],
        start: z.number().finite().parse(b.start),
        stack: 1000,
        blindMinutes: z
          .union([z.literal(5), z.literal(10), z.literal(15)])
          .default(10)
          .parse(b.blindMinutes),
      };
      return { id };
    }
    case "enroll":
      check(
        t?.state === "open" &&
          !t.entries.includes(u.id) &&
          u.wallet >= t.buy &&
          (catalog[t.game].family !== "Chinês" ||
            t.entries.length < t.capacity),
        "Inscrição indisponível.",
      );
      u.wallet -= t.buy;
      t.entries.push(u.id);
      break;
    case "withdraw":
      check(
        t?.state === "open" && t.entries.includes(u.id),
        "Inscrição encerrada.",
      );
      t.entries = t.entries.filter((id) => id !== u.id);
      u.wallet += t.buy;
      break;
    case "startTour":
      check(t?.owner === u.id, "Somente o organizador.");
      startTour(d, t);
      break;
    case "globalRake": {
      check(u.admin, "Sem permissão.");
      return {
        percent: Number.isInteger(d.cashier?.globalRakePercent) ? d.cashier.globalRakePercent : 3,
        collected: d.cashier?.rakeCollected ?? 0,
        chargedHands: d.cashier?.rakeHands ?? 0,
        hands: rakeReport(d.hands),
        changes: Object.values(d.events).filter(e => e.action === "globalRake").slice(-30).reverse(),
      };
    }
    case "setGlobalRake": {
      check(u.admin, "Sem permissão.");
      const percent = z.number().int().min(0).max(10).parse(b.percent);
      const previous = Number.isInteger(d.cashier?.globalRakePercent) ? d.cashier.globalRakePercent : 3;
      if (percent === previous) return { ok: true, percent };
      d.cashier.globalRakePercent = percent;
      const id = uid();
      d.events[id] = {
        id, by: u.name, action: "globalRake", target: "Poker Royale",
        previous, percent, at: Date.now(),
      };
      return { ok: true, percent };
    }
    case "adminFeePreview": {
      check(u?.admin && r, "Sem permissão.");
      const code = process.env.POKER_ROYALE_ADMIN_CODE;
      check(code && code.length >= 8, "Configure POKER_ROYALE_ADMIN_CODE no servidor.");
      check(typeof b.code === "string" && b.code.length <= 128, "Código inválido.");
      const left = createHash("sha256").update(b.code).digest();
      const right = createHash("sha256").update(code).digest();
      check(timingSafeEqual(left, right), "Código inválido.");
      return prototypeLedger(r);
    }
    case "admin":
      check(u.admin, "Sem permissão.");
      return {
        health: {
          connections: wss.clients.size,
          online: online.size,
          activeCash24: new Set(
            Object.values(d.hands)
              .filter((h) => !h.tour && h.ended >= Date.now() - 86400000)
              .flatMap((h) => h.players.map((p) => p.id)),
          ).size,
          handsCash24: Object.values(d.hands).filter(
            (h) => !h.tour && h.ended >= Date.now() - 86400000,
          ).length,
          activeRooms: Object.values(d.rooms).filter((r) => !r.closed).length,
          overdueHands: Object.values(d.rooms).filter(
            (r) => r.hand?.deadline < Date.now() - 3000,
          ).length,
          uptime: Math.floor(process.uptime()),
          actions: tableMetrics.actions,
          duplicates: tableMetrics.duplicates,
          socketConnections: tableMetrics.sockets,
          meanActionMs: tableMetrics.actions
            ? Math.round(tableMetrics.actionMs / tableMetrics.actions)
            : 0,
        },
        reports: Object.values(d.reports),
        events: Object.values(d.events).slice(-100),
        clubChips: d.cashier.club?.balance ?? 0,
        rakeEarned: u.rakeEarned ?? 0,
        rakeHands: rakeReport(d.hands),
        cashier: Object.values(d.events)
          .filter((event) => event.cashier)
          .reverse()
          .slice(0, 100),
        users: Object.values(d.users).map((x) => ({
          id: x.id,
          name: x.name,
          banned: !!x.banned,
          wallet: x.wallet,
        })),
        hands: Object.keys(d.hands).length,
      };
    case "cashier": {
      check(u.admin, "Sem permissão.");
      const action = z.enum(["fund", "send", "receive"]).parse(b.action);
      const amount = z.number().int().positive().parse(b.amount);
      const reference =
        b.reference == null
          ? null
          : z
              .string()
              .regex(/^[a-f0-9]{32}$/)
              .parse(b.reference);
      const eventId = reference ? "caixa-" + u.id + "-" + reference : uid();
      const previous = d.events[eventId];
      if (previous) {
        check(
          previous.action === action &&
            previous.amount === amount &&
            previous.recipient === (b.id || null),
          "Este comprovante já foi usado em outra operação.",
        );
        return { ok: true, reference };
      }
      const club = (d.cashier.club ??= { balance: 0 });
      const target = d.users[b.id];
      if (action === "fund") {
        check(
          Number.isSafeInteger(club.balance + amount),
          "Saldo demasiado alto.",
        );
        club.balance += amount;
      } else {
        check(target, "Selecione um jogador.");
        const from = action === "send" ? club : target;
        const to = action === "send" ? target : club;
        const fromKey = action === "send" ? "balance" : "wallet";
        const toKey = action === "send" ? "wallet" : "balance";
        check(from[fromKey] >= amount, "Saldo insuficiente.");
        check(
          Number.isSafeInteger(to[toKey] + amount),
          "Saldo demasiado alto.",
        );
        from[fromKey] -= amount;
        to[toKey] += amount;
      }
      if (action !== "fund")
        notify(
          target,
          action === "send"
            ? "Você recebeu " + amount + " fichas do clube"
            : "O clube recebeu " + amount + " fichas da sua carteira",
        );
      const id = eventId;
      d.events[id] = {
        id,
        recipient: b.id || null,
        cashier: true,
        at: Date.now(),
        by: u.name,
        action,
        amount,
        target: action === "fund" ? "Clube" : target.name,
      };
      break;
    }
    case "moderate": {
      check(u.admin && d.users[b.id] && b.id !== u.id, "Sem permissão.");
      const target = d.users[b.id];
      if (b.kind === "suspend") target.banned = !target.banned;
      else if (b.kind === "credit")
        target.wallet += z.number().int().min(1).max(10000).parse(b.amount);
      else if (b.kind === "clear")
        for (const room of Object.values(d.rooms))
          room.chat = room.chat.filter((m) => m.by !== b.id);
      else throw Error("Operação inválida.");
      const id = uid();
      d.events[id] = {
        id,
        by: u.name,
        target: target.name,
        action: b.kind,
        reason: z.string().trim().max(300).optional().parse(b.reason),
        at: Date.now(),
      };
      break;
    }
    default:
      throw Error("Operação desconhecida.");
  }
  return { ok: true };
}
let queue = Promise.resolve();
function locked(fn) {
  const job = queue.then(fn);
  queue = job.catch(() => {});
  return job;
}
function broadcast() {
  for (const ws of wss.clients)
    if (ws.readyState === 1) {
      if (!session(store.value, ws.raw)) ws.close();
      else ws.send("update");
    }
}
const rejectedMoves = new Map();
// Secondary admin unlock is tied to the authenticated session (not the
// browser's local storage), with a thirty-minute idle-safe expiry.
const ADMIN_UNLOCK_MS = 30 * 60 * 1000;
const adminCommands = new Set(["admin","globalRake","setGlobalRake","cashier","moderate","adminFeePreview","royalWalletAdmin","royalWalletDecision"]);
function adminUnlocked(d, raw) {
  const session = raw && d.sessions[digest(raw)];
  return !!session && session.adminUntil > Date.now();
}
function adminPasswordMatches(value) {
  const secret = process.env.POKER_ROYALE_ADMIN_CODE;
  if (typeof secret !== "string" || secret.length < 8 ||
      typeof value !== "string" || value.length > 128) return false;
  return timingSafeEqual(createHash("sha256").update(value).digest(),
    createHash("sha256").update(secret).digest());
}
const reads = new Set([
  "home",
  "room",
  "replay",
  "admin",
  "stats",
  "walletHistory",
  "royalWallet",
  "royalWalletAdmin",
  "practiceResume",
  "adminFeePreview",
  "globalRake",
  "adminAuthStatus",
]);
const server = http.createServer(async (req, res) => {
  // NEXOR baseline: protection applies to SPA routes and API alike.
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Content-Security-Policy", "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'");
  if (req.socket.encrypted || req.headers["x-forwarded-proto"] === "https")
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  const requestPath = new URL(req.url ?? "/", "http://localhost").pathname;
  if (/^\/(?:admin|mesa|perfil|historico|jogadores|torneios|convite|api|avatar)(?:\/|$)/.test(requestPath))
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  const send = (status, obj) => {
    res.writeHead(status, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    res.end(JSON.stringify(obj));
  };
  const origin = process.env.FRONTEND_ORIGIN;
  if (origin && req.headers.origin === origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type",
    );
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  if (req.method === "GET" && req.url === "/health")
    return send(200, { ok: true, service: "poker-royale", active: store.active });
  if (req.method === "GET" && /^\/avatar\/[a-f0-9-]{36}$/.test(req.url)) {
    const photo = Object.values(store.value.users).find(
      (u) => u.photoId === req.url.slice(8),
    );
    if (!photo) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, {
      "Content-Type": "image/jpeg",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
    });
    return res.end(Buffer.from(photo.photoBytes, "base64"));
  }
  if (req.url === "/api/config")
    return send(200, {
      betaLocal: !cloud && !!process.env.CLUB_BETA_CODE,
      supabase: cloud
        ? { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY }
        : null,
    });
  if (req.url === "/api" && req.method === "POST") {
    if (!store.active) return send(503, { error: "Servidor atualizando; tente novamente." });
    try {
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        check(size < 16384, "Pedido grande demais.");
        chunks.push(chunk);
      }
      const b = JSON.parse(Buffer.concat(chunks).toString());
      check(typeof b?.cmd === "string", "Pedido inválido.");
      const key =
        req.socket.remoteAddress +
        (["register", "login", "recover"].includes(b.cmd) ? ":auth" : ":api");
      const now = Date.now(),
        rate = attempts.get(key) || { n: 0, end: now + 60000 };
      if (rate.end < now) {
        rate.n = 0;
        rate.end = now + 60000;
      }
      attempts.set(key, rate);
      check(
        ++rate.n <= (key.endsWith("auth") ? 60 : 2400),
        "Aguarde um minuto.",
      );
      const raw = req.headers.authorization?.slice(7);
      const run = async () => {
        const d = reads.has(b.cmd) ? store.value : structuredClone(store.value);
        const actor = session(d, raw);
        if (b.cmd === "adminAuthStatus") {
          check(actor?.admin, "Sem permissão.");
          return { unlocked: adminUnlocked(d, raw) };
        }
        if (b.cmd === "adminUnlock") {
          check(actor?.admin, "Sem permissão.");
          check(adminPasswordMatches(b.password), "Senha administrativa incorreta.");
          d.sessions[digest(raw)].adminUntil = Date.now() + ADMIN_UNLOCK_MS;
          await store.commit(d, "adminUnlock");
          return { unlocked: true };
        }
        if (adminCommands.has(b.cmd)) {
          check(actor?.admin && adminUnlocked(d, raw), "Desbloqueie o painel administrativo com a senha.");
        }
        let result;
        try {
          result = await command(d, actor, b);
        } catch (error) {
          if (
            actor &&
            b.cmd === "move" &&
            error.message !== "A mesa foi atualizada. Confira sua vez."
          ) {
            const minute = Math.floor(Date.now() / 60000),
              previous = rejectedMoves.get(actor.id),
              count = previous?.minute === minute ? previous.count + 1 : 1;
            rejectedMoves.set(actor.id, { minute, count });
            if (count === 12) {
              const record = structuredClone(store.value),
                id = uid();
              record.events[id] = {
                id,
                by: "Monitor da mesa",
                target: actor.name,
                action: "12 ações rejeitadas no mesmo minuto",
                at: Date.now(),
              };
              await store.commit(record);
            }
          }
          throw error;
        }
        if (!reads.has(b.cmd)) {
          await store.commit(d, b.cmd);
          if (b.cmd === "practiceStart" || b.cmd === "practiceMove") {
            for (const socket of wss.clients)
              if (socket.raw === raw && socket.readyState === 1)
                socket.send("update");
          } else broadcast();
        }
        return result;
      };
      send(200, await locked(run));
    } catch (e) {
      send(400, {
        error:
          e instanceof z.ZodError ? "Confira os campos informados." : e.message,
      });
    }
    return;
  }
  if (dev) return dev.middlewares(req, res);
  try {
    const root = resolve(base, "dist"),
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    let path = resolve(root, "." + pathname);
    check(path === root || path.startsWith(root + sep), "Caminho inválido.");
    if (!existsSync(path) || !statSync(path).isFile())
      path = resolve(root, "index.html");
    res.setHeader(
      "Content-Type",
      {
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".webmanifest": "application/manifest+json",
        ".png": "image/png",
        ".html": "text/html; charset=utf-8",
      }[extname(path)] || "application/octet-stream",
    );
    if (pathname === "/" || path.endsWith("index.html")) res.setHeader("Cache-Control", "no-store");
    else if (/\/assets\/[^/]+-[a-zA-Z0-9_-]{8,}\.(?:js|css)$/.test(pathname))
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(readFileSync(path));
  } catch {
    res.writeHead(404);
    res.end("Execute npm run build.");
  }
});
let dev = null;
if (process.argv.includes("--dev")) {
  const { createServer } = await import("vite");
  dev = await createServer({
    server: { middlewareMode: true, hmr: { server } },
    appType: "spa",
  });
}
server.on("upgrade", (req, socket, head) => {
  if (req.url !== "/live") {
    if (!dev) socket.destroy();
    return;
  }
  if (!store.active) return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => {
    const timeout = setTimeout(() => ws.close(), 5000);
    ws.once("message", (msg) => {
      clearTimeout(timeout);
      const raw = msg.toString();
      const u = session(store.value, raw);
      if (!u) return ws.close();
      ws.raw = raw;
      tableMetrics.sockets++;
      online.set(u.id, (online.get(u.id) || 0) + 1);
      broadcast();
      ws.on("close", () => {
        const n = online.get(u.id) - 1;
        if (n) online.set(u.id, n);
        else online.delete(u.id);
        broadcast();
      });
    });
  });
});
const readySince = new Map();
const dealDelay = 3500;
function autoDealReady(room) {
  if (
    room.hand ||
    room.closed ||
    room.paused ||
    (!room.count && !room.tour && !room.choiceStarted && !room.preHandStarted) ||
    room.roundDone ||
    (room.game === "choice" && !room.nextChoice)
  )
    return false;
  return (
    room.seats.filter(
      (seat) =>
        !seat.away &&
        online.has(seat.id) &&
        !store.value.users[seat.id]?.banned &&
        (seat.stack > 0 ||
          (seat.autoRefill && store.value.users[seat.id]?.wallet > 0) ||
          catalog[room.game].family === "Chinês"),
    ).length >= 2
  );
}
let ticking = false;
setInterval(() => {
  if (ticking || !store.active) return;
  ticking = true;
  locked(async () => {
    const now = Date.now();
    const due = new Set();
    const pendingCashouts = new Set();
    const expiredDealerPauses = new Set();
    for (const room of Object.values(store.value.rooms)) {
      if (room.game === "choice" && room.nextChoice?.heldAt &&
          now >= (room.nextChoice.holdUntil ?? room.nextChoice.heldAt + DEALER_PAUSE_MS))
        expiredDealerPauses.add(room.id);
    }
    for (const room of Object.values(store.value.rooms)) {
      if (!room.hand && room.seats.some(s => s.leaveAfterHand) &&
          !pendingPrizeHand(store.value, room, now))
        pendingCashouts.add(room.id);
    }
    for (const room of Object.values(store.value.rooms)) {
      if (room.preStraddle && !room.hand && !room.paused && !room.closed && now >= (room.reviewUntil ?? 0)) {
        if (room.preStraddle.resolved || room.preStraddle.expiresAt <= now) due.add(room.id);
        continue;
      }
      if (room.preHandStarted && !room.hand && !room.paused && !room.closed && now >= (room.reviewUntil ?? 0)) {
        due.add(room.id);
        continue;
      }
      if (room.game === "choice" && room.choiceStarted && !room.hand && !room.paused && !room.closed) {
        // Recover if a seat change or a prior invalid mode cleared the selection.
        if (!room.nextChoice && now >= (room.reviewUntil ?? 0)) due.add(room.id);
        else if (room.nextChoice && !room.nextChoice.heldAt && room.nextChoice.at <= now && now >= (room.reviewUntil ?? 0)) due.add(room.id);
        continue;
      }
      if (!autoDealReady(room)) {
        readySince.delete(room.id);
        continue;
      }
      const ready = readySince.get(room.id);
      if (ready?.revision !== room.rev)
        readySince.set(room.id, { revision: room.rev, time: now });
      else if (now - ready.time >= dealDelay && now >= (room.reviewUntil ?? 0))
        due.add(room.id);
    }
    if (
      !due.size && !pendingCashouts.size && !expiredDealerPauses.size &&
      !Object.values(store.value.rooms).some((r) => r.hand?.deadline < now)
    )
      return;
    const d = structuredClone(store.value);
    for (const r of Object.values(d.rooms)) {
      if (expiredDealerPauses.has(r.id)) resumeDealerChoice(r.nextChoice, now);
      if (pendingCashouts.has(r.id)) {
        for (const seat of [...r.seats].filter(s => s.leaveAfterHand))
          leave(d, d.users[seat.id], r);
        readySince.delete(r.id);
        continue;
      }
      if (due.has(r.id)) {
        // If seating changed (leave/sit out/reconnect), discard a stale gate.
        if (r.preStraddle && !r.preStraddle.resolved &&
          nextUtg(r)?.id !== r.preStraddle.playerId) {
          delete r.preStraddle;
          delete r.preStraddleHandledFor;
        }
        // Server gate for the UTG: wait for FOLD / CHECK / STRADDLE,
        // or use CHECK by default after seven seconds.
        if (r.preStraddle && !r.preStraddle.resolved && r.preStraddle.expiresAt <= now) {
          r.preStraddle.resolved = true;
          r.preStraddle.decision = "check";
          r.preStraddleHandledFor = r.count;
          const target = r.seats.find(s => s.id === r.preStraddle.playerId);
          if (target) target.wantsStraddle = false;
        }
        if (!r.preStraddle && !r.tour && r.straddleEnabled &&
          (r.game !== "choice" || (r.nextChoice && !r.nextChoice.heldAt && r.nextChoice.at <= now))) {
          if (prepareUtgStraddle(r, now)) { readySince.delete(r.id); continue; }
        }
        if (r.preStraddle && !r.preStraddle.resolved) continue;
        if (r.game === "choice") {
          // Revalidate selection after sit out, departure or player count changes.
          syncDealerChoiceAfterSeatChange(r, catalog, now);
          if (r.nextChoice && !r.nextChoice.heldAt && r.nextChoice.at <= now && now >= (r.reviewUntil ?? 0)) {
            await deal(d, r, r.nextChoice.id);
          }
        } else await deal(d, r);
        readySince.delete(r.id);
      } else if (r.hand?.deadline < now) {
        const h = r.hand.h,
          f = h.frames.at(-1);
        await move(
          d,
          r,
          h.players[f.actor].id,
          {
            rev: r.rev,
            action: automatic(f, true),
          },
          true,
        );
        if (!r.hand && r.tour) {
          r.roundDone = true;
          balance(d, d.tours[r.tour]);
        }
      }
    }
    await store.commit(d);
    broadcast();
  })
    .catch((e) => console.error(e.message))
    .finally(() => (ticking = false));
}, 500).unref();
server.listen(port, host, () =>
  console.log("Mesa Real em http://" + host + ":" + port),
);
process.on("exit", stop);
