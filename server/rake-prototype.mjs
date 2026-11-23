// Administrative simulation only: no player stack, pot, or wallet is changed.
export function previewFee(grossPot, handId = "") {
  if (!Number.isSafeInteger(grossPot) || grossPot < 0) throw new Error("Pote inválido");
  const hash = [...String(handId)].reduce((v, c) => (v * 33 + c.charCodeAt(0)) >>> 0, 5381);
  const ratePercent = 3 + hash % 5; // deterministic 3–7% for audits
  return { ratePercent, grossPot, projectedFee: Math.floor(grossPot * ratePercent / 100), simulation: true };
}
export function prototypeLedger(room) {
  const rows = room.adminFeePreview ?? [];
  return {simulation:true, totalProjected:rows.reduce((sum, row) => sum + row.projectedFee, 0), hands:rows};
}
