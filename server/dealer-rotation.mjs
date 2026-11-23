// Atualiza somente a lista padrão antiga; rotações personalizadas permanecem intactas.
export const legacyDealerRotation = [
  'texas','super','crazy','watermelon','om4','om5','om6',
  'draw','om3','cour','om7',
];
export const currentDealerRotation = [
  'texas','super','crazy','watermelon','om4','om5','om6',
  'om5db','om6db','draw','om3','cour','om7',
];
export function upgradeDealerRotation(rotation) {
  if (!Array.isArray(rotation)) return currentDealerRotation.slice();
  if (rotation.length === legacyDealerRotation.length &&
      rotation.every((game, index) => game === legacyDealerRotation[index]))
    return currentDealerRotation.slice();
  return rotation;
}
