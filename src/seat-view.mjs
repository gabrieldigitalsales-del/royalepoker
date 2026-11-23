export function seatPerspective(capacity, viewerSlot = 0) {
  return {
    visual: (physicalSlot) => (physicalSlot - viewerSlot + capacity) % capacity,
    physical: (visualSlot) => (visualSlot + viewerSlot) % capacity,
  };
}
