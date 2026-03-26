import type { sheets_v4 } from "googleapis";
import {
  getSheetRows,
  hasReciprocalLinkedEntry,
} from "@/utils/inventoryLedger";

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

describe("inventoryLedger.hasReciprocalLinkedEntry", () => {
  it("only accepts reciprocal linked rows", () => {
    expect(
      hasReciprocalLinkedEntry(
        {
          id: "bodega-1",
          linkedEntryId: "car-1",
          linkStatus: "linked",
        },
        "car-1",
      ),
    ).toBe(true);

    expect(
      hasReciprocalLinkedEntry(
        {
          id: "bodega-1",
          linkedEntryId: "other-car",
          linkStatus: "linked",
        },
        "car-1",
      ),
    ).toBe(false);

    expect(
      hasReciprocalLinkedEntry(
        {
          id: "bodega-1",
          linkedEntryId: "car-1",
          linkStatus: "override",
        },
        "car-1",
      ),
    ).toBe(false);
  });
});
