// Some rooms were created before Double Board was exposed in the interface.
// Preserve the existing rotation and append only the newly introduced options.
export const requiredDealerModes = Object.freeze(["om5db", "om6db", "om7"]);
export function ensureDealerChoiceModes(room) {
  if (!room || room.game !== "choice") return false;
  if (!Array.isArray(room.rotation)) room.rotation = [];
  let changed = false;
  for (const id of requiredDealerModes) {
    if (!room.rotation.includes(id)) { room.rotation.push(id); changed = true; }
  }
  return changed;
}
