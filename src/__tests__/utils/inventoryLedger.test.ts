import type { sheets_v4 } from "googleapis";
import { getSheetRows } from "@/utils/inventoryLedger";

describe("inventoryLedger.getSheetRows", () => {
  it("preserves cleared rows so physical row numbers stay stable", async () => {
    const get = jest.fn().mockResolvedValue({
      data: {
        values: [
          ["id", "date"],
          ["entry-1", "2026-02-19"],
          ["", ""],
          ["entry-3", "2026-02-20"],
        ],
      },
    });

    const sheets = {
      spreadsheets: {
        values: {
          get,
        },
      },
    } as unknown as sheets_v4.Sheets;

    const result = await getSheetRows(sheets, "InventarioCarros", "O");

    expect(result.hasHeader).toBe(true);
    expect(result.rows).toEqual([
      ["entry-1", "2026-02-19"],
      ["", ""],
      ["entry-3", "2026-02-20"],
    ]);
  });
});
