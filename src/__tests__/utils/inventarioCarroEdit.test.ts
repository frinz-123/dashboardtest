import {
  applyLinkedLedgerEdit,
  type LinkedLedgerEditUpdate,
  mergeLinkedLedgerFetchResult,
} from "@/utils/inventarioCarroEdit";

type TestLedgerRow = {
  rowNumber: number;
  date: string;
  product: string;
  quantity: number;
  notes: string;
  updatedAt: string;
  sellerEmail: string;
};

const buildUpdate = (
  overrides: Partial<LinkedLedgerEditUpdate> = {},
): LinkedLedgerEditUpdate => ({
  rowNumber: 3,
  date: "2026-03-21",
  product: "Producto Nuevo",
  quantity: 14,
  notes: "Notas nuevas",
  updatedAt: "2026-03-21T10:00:00.000Z",
  ...overrides,
});

describe("inventarioCarroEdit", () => {
  it("applies a linked edit by row number and preserves other fields", () => {
    const rows: TestLedgerRow[] = [
      {
        rowNumber: 3,
        date: "2026-03-20",
        product: "Producto Viejo",
        quantity: 9,
        notes: "Notas viejas",
        updatedAt: "2026-03-20T09:00:00.000Z",
        sellerEmail: "vendor@example.com",
      },
    ];

    const updatedRows = applyLinkedLedgerEdit(rows, buildUpdate());

    expect(updatedRows).toEqual([
      {
        rowNumber: 3,
        date: "2026-03-21",
        product: "Producto Nuevo",
        quantity: 14,
        notes: "Notas nuevas",
        updatedAt: "2026-03-21T10:00:00.000Z",
        sellerEmail: "vendor@example.com",
      },
    ]);
  });

  it("keeps the optimistic linked edit when the fresh fetch returns stale data", () => {
    const staleRows: TestLedgerRow[] = [
      {
        rowNumber: 3,
        date: "2026-03-20",
        product: "Producto Viejo",
        quantity: 9,
        notes: "Notas viejas",
        updatedAt: "2026-03-20T09:00:00.000Z",
        sellerEmail: "vendor@example.com",
      },
    ];

    const reconciledRows = mergeLinkedLedgerFetchResult(
      staleRows,
      buildUpdate(),
    );

    expect(reconciledRows).toEqual([
      {
        rowNumber: 3,
        date: "2026-03-21",
        product: "Producto Nuevo",
        quantity: 14,
        notes: "Notas nuevas",
        updatedAt: "2026-03-21T10:00:00.000Z",
        sellerEmail: "vendor@example.com",
      },
    ]);
  });

  it("accepts the fresh fetch result when it already matches the optimistic edit", () => {
    const freshRows: TestLedgerRow[] = [
      {
        rowNumber: 3,
        date: "2026-03-21",
        product: "Producto Nuevo",
        quantity: 14,
        notes: "Notas nuevas",
        updatedAt: "2026-03-22T10:00:00.000Z",
        sellerEmail: "vendor@example.com",
      },
    ];

    const reconciledRows = mergeLinkedLedgerFetchResult(
      freshRows,
      buildUpdate(),
    );

    expect(reconciledRows).toBe(freshRows);
  });
});
