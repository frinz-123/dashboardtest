export type InventoryCarroLedgerLike = {
  date?: string;
  product: string;
  quantity: number;
  weekCode: string;
};

export type InventoryCarroSalesLike = {
  date?: string;
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

const normalizeDateString = (value?: string) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, "0"),
    String(parsed.getDate()).padStart(2, "0"),
  ].join("-");
};

const isOnOrBeforeCutoff = ({
  cutoffDate,
  cutoffWeekKey,
  rowDate,
  rowWeekCode,
}: {
  cutoffDate?: string;
  cutoffWeekKey?: number;
  rowDate?: string;
  rowWeekCode: string;
}) => {
  if (!cutoffDate || cutoffWeekKey === undefined) {
    return true;
  }

  const normalizedCutoffDate = normalizeDateString(cutoffDate);
  if (!normalizedCutoffDate) {
    return true;
  }

  const rowWeekKey = getWeekKey(rowWeekCode);
  if (rowWeekKey === null) return false;
  if (rowWeekKey < cutoffWeekKey) return true;
  if (rowWeekKey > cutoffWeekKey) return false;
  if (!rowDate) return true;

  const normalizedRowDate = normalizeDateString(rowDate);
  if (!normalizedRowDate) {
    return true;
  }

  return normalizedRowDate <= normalizedCutoffDate;
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
  cutoffDate,
  cutoffWeekKey,
  ledgerRows,
  productList,
  salesRows,
}: {
  baselineWeekKey: number;
  cutoffDate?: string;
  cutoffWeekKey?: number;
  ledgerRows: InventoryCarroLedgerLike[];
  productList: string[];
  salesRows: InventoryCarroSalesLike[];
}) => {
  const relevantLedgerRows = ledgerRows.filter(
    (row) =>
      isOnOrAfterWeekKey(row.weekCode, baselineWeekKey) &&
      isOnOrBeforeCutoff({
        cutoffDate,
        cutoffWeekKey,
        rowDate: row.date,
        rowWeekCode: row.weekCode,
      }),
  );
  const relevantSalesRows = salesRows.filter(
    (row) =>
      isOnOrAfterWeekKey(row.weekCode, baselineWeekKey) &&
      isOnOrBeforeCutoff({
        cutoffDate,
        cutoffWeekKey,
        rowDate: row.date,
        rowWeekCode: row.weekCode,
      }),
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
