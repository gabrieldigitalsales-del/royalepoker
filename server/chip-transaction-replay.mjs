// Persisted in d.events, so a retry after a lost HTTP response cannot
// debit the user's wallet or credit a seat twice.
export function chipTransactionKey(actor, reference) {
  if (!/^[a-f0-9]{32}$/.test(reference ?? '')) throw Error('Comprovante de fichas inválido.');
  return `rebuy-${actor}-${reference}`;
}
export function findChipTransactionReplay(events, actor, reference, expected) {
  const existing = events[chipTransactionKey(actor, reference)];
  if (!existing) return null;
  if (existing.room !== expected.room || existing.recipient !== expected.recipient ||
    existing.amount !== expected.amount) {
    throw Error('Comprovante já usado com outro valor, destinatário ou mesa.');
  }
  return {credited: existing.credited, stack: existing.stack, pending: false};
}
export function recordChipTransaction(events, actor, reference, receipt) {
  const key = chipTransactionKey(actor, reference);
  if (events[key]) throw Error('Comprovante já registrado.');
  if (!Number.isSafeInteger(receipt.amount) || receipt.amount <= 0 ||
    receipt.credited !== receipt.amount || !Number.isSafeInteger(receipt.stack)) {
    throw Error('Crédito de fichas inválido.');
  }
  events[key] = { id: key, actor, action: 'Reposição de fichas',
    ...receipt, at: Date.now() };
  return events[key];
}
