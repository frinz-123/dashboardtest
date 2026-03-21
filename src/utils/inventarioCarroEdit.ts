type LinkedLedgerRowLike = {
  rowNumber: number;
  date: string;
  product: string;
  quantity: number;
  notes: string;
  updatedAt: string;
};

export type LinkedLedgerEditUpdate = Pick<
  LinkedLedgerRowLike,
  "rowNumber" | "date" | "product" | "quantity" | "notes" | "updatedAt"
>;

export const applyLinkedLedgerEdit = <T extends LinkedLedgerRowLike>(
  rows: T[],
  update: LinkedLedgerEditUpdate,
) =>
  rows.map((row) =>
    row.rowNumber === update.rowNumber
      ? {
          ...row,
          date: update.date,
          product: update.product,
          quantity: update.quantity,
          notes: update.notes,
          updatedAt: update.updatedAt,
        }
      : row,
  );

export const mergeLinkedLedgerFetchResult = <T extends LinkedLedgerRowLike>(
  rows: T[],
  fallbackUpdate: LinkedLedgerEditUpdate | null,
) => {
  if (!fallbackUpdate) return rows;

  const matchedRow = rows.find(
    (row) => row.rowNumber === fallbackUpdate.rowNumber,
  );

  if (!matchedRow) return rows;

  const isStaleRow =
    matchedRow.date !== fallbackUpdate.date ||
    matchedRow.product !== fallbackUpdate.product ||
    matchedRow.quantity !== fallbackUpdate.quantity ||
    matchedRow.notes !== fallbackUpdate.notes;

  if (!isStaleRow) return rows;

  return applyLinkedLedgerEdit(rows, fallbackUpdate);
};
