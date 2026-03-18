export const BOX_UNITS_BY_PRODUCT: Readonly<Record<string, number>> = {
  "Chiltepin Molido 50 g": 12,
  "Chiltepin Molido 20 g": 24,
  "Chiltepin Entero 30 g": 12,
  "Salsa Chiltepin El rey 195 ml": 24,
  "Salsa Especial El Rey 195 ml": 24,
  "Salsa Reina El rey 195 ml": 24,
  "Salsa Habanera El Rey 195 ml": 24,
  "Paquete El Rey": 12,
  "Molinillo El Rey 30 g": 12,
  "Salsa chiltepin Litro": 12,
  "Salsa Especial Litro": 12,
  "Salsa Reina Litro": 12,
  "Salsa Habanera Litro": 12,
  "Michela Mix Tamarindo": 24,
  "Michela Mix Mango": 24,
  "Michela Mix Sandia": 24,
  "Michela Mix Fuego": 24,
  "El Rey Mix Original": 12,
  "El Rey Mix Especial": 12,
  "Michela Mix Picafresa": 24,
  "Habanero Molido 50 g": 12,
  "Habanero Molido 20 g": 24,
  "Molinillo Habanero 20 g": 24,
  "Chiltepin Pouch 30g": 12,
};

export type BoxBreakdown = {
  unitsPerBox: number;
  fullBoxes: number;
  remainderPieces: number;
  display: string;
};

const formatBoxPieceLabel = (count: number) => `pza${count === 1 ? "" : "s"}`;

const formatBoxCountLabel = (count: number) => `caja${count === 1 ? "" : "s"}`;

export const getBoxBreakdown = (
  product: string,
  quantity: number,
): BoxBreakdown | null => {
  const unitsPerBox = BOX_UNITS_BY_PRODUCT[product];
  if (!unitsPerBox) return null;

  const normalizedQuantity = Math.max(0, Math.trunc(quantity));
  const fullBoxes = Math.floor(normalizedQuantity / unitsPerBox);
  const remainderPieces = normalizedQuantity % unitsPerBox;
  const display =
    remainderPieces > 0
      ? `${fullBoxes} ${formatBoxCountLabel(fullBoxes)} + ${remainderPieces} ${formatBoxPieceLabel(remainderPieces)}`
      : `${fullBoxes} ${formatBoxCountLabel(fullBoxes)}`;

  return {
    unitsPerBox,
    fullBoxes,
    remainderPieces,
    display,
  };
};
