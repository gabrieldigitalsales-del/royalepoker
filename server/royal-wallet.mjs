import { randomUUID } from "node:crypto";

// Royal Wallet works with existing VIRTUAL CHIPS only. No fiat conversion,
// Pix payment, refund or transfer can be performed by this module.
const requestId = () => randomUUID();
export const royalWalletView = (d, user) => ({
  available: user.wallet ?? 0,
  reserved: user.walletReserved ?? 0,
  chipsInPlay: Object.values(d.rooms ?? {}).reduce((sum, room) =>
    sum + (room.seats ?? []).filter(seat => seat.id === user.id).reduce(
      (sub, seat) => sub + (seat.stack ?? 0), 0), 0),
  depositsEnabled: false,
  pixConnected: false,
  requests: Object.values(d.walletRequests ?? {}).filter(r => r.userId === user.id)
    .sort((a,b) => b.createdAt-a.createdAt).slice(0,60)
    .map(({id,kind,status,amount,createdAt,updatedAt}) =>
      ({id,kind,status,amount,createdAt,updatedAt}))
});

export function requestRoyalWithdrawal(d, user, amount, reference = requestId()) {
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000)
    throw Error("Informe uma quantidade válida de fichas.");
  d.walletRequests ??= {};
  const existing = d.walletRequests[reference];
  if (existing) {
    if (existing.userId !== user.id || existing.kind !== "withdrawal" || existing.amount !== amount)
      throw Error("Referência de solicitação inválida.");
    return existing;
  }
  if ((user.wallet ?? 0) < amount) throw Error("Saldo de fichas insuficiente.");
  if (!Number.isSafeInteger((user.walletReserved ?? 0) + amount))
    throw Error("Saldo reservado inválido.");
  user.wallet -= amount;
  user.walletReserved = (user.walletReserved ?? 0) + amount;
  const item = {id:reference,kind:"withdrawal",userId:user.id,
    amount,status:"pending",createdAt:Date.now(),updatedAt:Date.now()};
  d.walletRequests[reference] = item;
  return item;
}
export function createDepositIntent(d,user,amount,reference=requestId()) {
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000)
    throw Error("Informe uma quantidade válida de fichas.");
  d.walletRequests ??= {};
  const existing = d.walletRequests[reference];
  if (existing) {
    if (existing.userId!==user.id || existing.kind!=="deposit" || existing.amount!==amount)
      throw Error("Referência de solicitação inválida.");
    return existing;
  }
  // An intent is NOT a charge. It cannot generate a QR code or credit chips.
  const item={id:reference,kind:"deposit",userId:user.id,amount,
    status:"awaiting_provider",createdAt:Date.now(),updatedAt:Date.now()};
  d.walletRequests[reference]=item;
  return item;
}
export function decideRoyalWithdrawal(d,operator,id,action) {
  const item=d.walletRequests?.[id];
  if (!item || item.kind!=="withdrawal") throw Error("Solicitação não encontrada.");
  const player=d.users[item.userId];
  if (!player) throw Error("Jogador não encontrado.");
  if (action==="approve") {
    if (item.status==="approved") return item; // idempotent
    if (item.status!=="pending") throw Error("Esta solicitação já foi finalizada.");
    item.status="approved"; // No cash paid, chips still reserved.
  } else if (action==="reject") {
    if (item.status==="rejected") return item;
    if (!["pending","approved"].includes(item.status))
      throw Error("Esta solicitação não pode ser rejeitada.");
    if ((player.walletReserved ?? 0) < item.amount)
      throw Error("Reserva insuficiente. Nenhuma ficha foi alterada.");
    if (!Number.isSafeInteger((player.wallet??0)+item.amount))
      throw Error("Saldo máximo excedido.");
    player.walletReserved-=item.amount;
    player.wallet+=item.amount;
    item.status="rejected";
  } else if (action==="complete") {
    // Only confirms a virtual-chip redemption, never a real-money Pix payment.
    if (item.status==="completed") return item;
    if (item.status!=="approved") throw Error("Aprove a solicitação primeiro.");
    if ((player.walletReserved??0)<item.amount) throw Error("Reserva insuficiente.");
    player.walletReserved-=item.amount;
    item.status="completed";
  } else throw Error("Ação administrativa inválida.");
  item.updatedAt=Date.now();
  item.adminId=operator.id;
  return item;
}
export function royalWalletAdminView(d) {
  return Object.values(d.walletRequests??{}).sort((a,b)=>b.createdAt-a.createdAt)
    .slice(0,200).map(r=>({
      ...r,playerName:d.users[r.userId]?.name??"Jogador indisponível"
    }));
}
