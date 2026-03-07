export type InventoryCarroLedgerLike = {
  product: string;
  quantity: number;
  weekCode: string;
};

export type InventoryCarroSalesLike = {
  products: Record<string, number>;
  weekCode: string;
};

export type InventoryResetAdjustment = {
  product: string;
  currentSaldo: number;
  quantity: number;
};

export const parseWeekCode = (code: string) => {
  const match = code.match(/P(\d+)S(\d+)/i);
  if (!match) return null;
  return { period: Number(match[1]), week: Number(match[2]) };
};

export const getWeekKey = (code: string) => {
  const parsed = parseWeekCode(code);
  if (!parsed) return null;
  return parsed.period * 10 + parsed.week;
};

export const isOnOrAfterWeekKey = (code: string, minWeekKey: number) => {
  const key = getWeekKey(code);
  return key !== null && key >= minWeekKey;
};

export const createProductTotals = (productList: string[]) => {
  const totals: Record<string, number> = {};

  productList.forEach((product) => {
    totals[product] = 0;
  });

  return totals;
};

export const sumLedgerTotals = (
  rows: InventoryCarroLedgerLike[],
  productList: string[],
) => {
  const totals = createProductTotals(productList);

  rows.forEach((row) => {
    if (!row.product) return;
    totals[row.product] = (totals[row.product] || 0) + (row.quantity || 0);
  });

  return totals;
};

export const sumSalesTotals = (
  rows: InventoryCarroSalesLike[],
  productList: string[],
) => {
  const totals = createProductTotals(productList);

  rows.forEach((row) => {
    Object.entries(row.products).forEach(([product, quantity]) => {
      totals[product] = (totals[product] || 0) + (quantity || 0);
    });
  });

  return totals;
};

export const buildLiveSaldoTotals = ({
  baselineWeekKey,
  ledgerRows,
  productList,
  salesRows,
}: {
  baselineWeekKey: number;
  ledgerRows: InventoryCarroLedgerLike[];
  productList: string[];
  salesRows: InventoryCarroSalesLike[];
}) => {
  const relevantLedgerRows = ledgerRows.filter((row) =>
    isOnOrAfterWeekKey(row.weekCode, baselineWeekKey),
  );
  const relevantSalesRows = salesRows.filter((row) =>
    isOnOrAfterWeekKey(row.weekCode, baselineWeekKey),
  );

  const ledgerTotals = sumLedgerTotals(relevantLedgerRows, productList);
  const salesTotals = sumSalesTotals(relevantSalesRows, productList);
  const saldoTotals = createProductTotals(productList);

  productList.forEach((product) => {
    saldoTotals[product] =
      (ledgerTotals[product] || 0) - (salesTotals[product] || 0);
  });

  return saldoTotals;
};

export const buildResetAdjustments = ({
  productList,
  saldoTotals,
}: {
  productList: string[];
  saldoTotals: Record<string, number>;
}) => {
  const adjustments: InventoryResetAdjustment[] = [];

  productList.forEach((product) => {
    const currentSaldo = saldoTotals[product] || 0;
    if (currentSaldo === 0) return;

    adjustments.push({
      product,
      currentSaldo,
      quantity: -currentSaldo,
    });
  });

  return adjustments;
};
