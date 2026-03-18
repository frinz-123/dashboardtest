export const FORM_DATA_LAST_COLUMN = "AR";

export const PRODUCT_COLUMNS = {
  I: "Chiltepin Molido 50 g",
  J: "Chiltepin Molido 20 g",
  K: "Chiltepin Entero 30 g",
  L: "Salsa Chiltepin El rey 195 ml",
  M: "Salsa Especial El Rey 195 ml",
  N: "Salsa Reina El rey 195 ml",
  O: "Salsa Habanera El Rey 195 ml",
  P: "Paquete El Rey",
  Q: "Molinillo El Rey 30 g",
  R: "Tira Entero",
  S: "Tira Molido",
  T: "Salsa chiltepin Litro",
  U: "Salsa Especial Litro",
  V: "Salsa Reina Litro",
  W: "Salsa Habanera Litro",
  X: "Michela Mix Tamarindo",
  Y: "Michela Mix Mango",
  Z: "Michela Mix Sandia",
  AA: "Michela Mix Fuego",
  AB: "El Rey Mix Original",
  AC: "El Rey Mix Especial",
  AD: "Medio Kilo Chiltepin Entero",
  AI: "Michela Mix Picafresa",
  AJ: "Habanero Molido 50 g",
  AK: "Habanero Molido 20 g",
  AQ: "Molinillo Habanero 20 g",
  AR: "Chiltepin Pouch 30g",
} as const;

export const PRODUCT_NAMES = Object.values(PRODUCT_COLUMNS);

const columnToIndex = (column: string): number => {
  let index = 0;
  for (let i = 0; i < column.length; i++) {
    index = index * 26 + (column.charCodeAt(i) - 64);
  }
  return index - 1;
};

export const PRODUCT_COLUMN_ENTRIES = Object.entries(PRODUCT_COLUMNS).map(
  ([column, name]) => ({
    column,
    name,
    index: columnToIndex(column),
  }),
);

export const PRODUCT_COLUMN_INDICES = PRODUCT_COLUMN_ENTRIES.map(
  ({ index }) => index,
);

export const PRODUCT_COLUMN_NAME_BY_INDEX = PRODUCT_COLUMN_ENTRIES.reduce(
  (acc, { index, name }) => {
    acc[index] = name;
    return acc;
  },
  {} as Record<number, string>,
);

export const PRODUCT_COLUMN_INDEX = PRODUCT_COLUMN_ENTRIES.reduce(
  (acc, { name, index }) => {
    acc[name] = index;
    return acc;
  },
  {} as Record<string, number>,
);

export const FORM_DATA_LAST_COLUMN_INDEX = columnToIndex(FORM_DATA_LAST_COLUMN);
