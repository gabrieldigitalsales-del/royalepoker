const reasons = {
  grantChips: "Crédito de fichas",
  moderate: "Crédito administrativo",
  register: "Abertura da carteira",
  cloud: "Abertura da carteira",
  create: "Entrada na mesa",
  sit: "Buy-in",
  leave: "Saída da mesa",
  close: "Encerramento da mesa",
  rebuy: "Adição de fichas",
  buyShop: "Compra na loja",
  cashier: "Transferência do caixa",
  enroll: "Inscrição",
  withdraw: "Cancelamento da inscrição",
  deal: "Recarga automática",
};
export function recordWallets(before, next, command) {
  for (const [id, user] of Object.entries(next.users)) {
    let balance = before.users[id]?.wallet ?? 0;
    const fee = (user.rakeEarned ?? 0) - (before.users[id]?.rakeEarned ?? 0);
    const add = (amount, reason) => {
      if (!amount) return;
      balance += amount;
      (user.walletLog ??= []).push({ at: Date.now(), amount, balance, reason });
    };
    add(fee, "Rake administrativo");
    add(user.wallet - balance, reasons[command] ?? "Acerto da sessão");
  }
}
export function rakeReport(hands) {
  return Object.values(hands)
    .filter((h) => h.frames.at(-1).rake > 0)
    .sort((a, b) => b.ended - a.ended)
    .slice(0, 100)
    .map((h) => {
      const f = h.frames.at(-1);
      return {
        id: h.id,
        name: h.name,
        number: h.number,
        at: h.ended,
        gross: f.grossPot,
        fee: f.rake,
        distributed: f.payouts.reduce((a, b) => a + b, 0),
      };
    });
}
