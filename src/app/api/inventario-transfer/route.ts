import { google, type sheets_v4 } from "googleapis";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isInventarioCarroAdmin } from "@/utils/auth";
import { sheetsAuth } from "@/utils/googleAuth";
import {
  BODEGA_LEDGER_HEADER_ROW,
  BODEGA_LEDGER_LAST_COLUMN,
  type BodegaLedgerInput,
  CAR_LEDGER_HEADER_ROW,
  CAR_LEDGER_LAST_COLUMN,
  type CarLedgerInput,
  ensureHeaderRow,
  ensureSheetExists,
  getNegativeStockWarnings,
  getSheetRows,
  INVENTARIO_BODEGA_SHEET_NAME,
  INVENTARIO_CARROS_SHEET_NAME,
  parseBodegaLedgerRow,
  SPREADSHEET_ID,
  toBodegaLedgerValues,
  toCarLedgerValues,
} from "@/utils/inventoryLedger";

export const dynamic = "force-dynamic";

type TransferItem = {
  product: string;
  quantity: number;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
};

const appendValuesWithRollback = async (
  sheets: ReturnType<typeof google.sheets>,
  carValues: Array<Array<string | number>>,
  bodegaValues: Array<Array<string | number>>,
) => {
  const rollbackRanges: string[] = [];

  try {
    if (carValues.length > 0) {
      const carResponse = await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${INVENTARIO_CARROS_SHEET_NAME}!A:${CAR_LEDGER_LAST_COLUMN}`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: carValues,
        },
      });

      const updatedRange = carResponse.data.updates?.updatedRange || "";
      if (updatedRange) rollbackRanges.push(updatedRange);
    }

    if (bodegaValues.length > 0) {
      const bodegaResponse = await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${INVENTARIO_BODEGA_SHEET_NAME}!A:${BODEGA_LEDGER_LAST_COLUMN}`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: bodegaValues,
        },
      });

      const updatedRange = bodegaResponse.data.updates?.updatedRange || "";
      if (updatedRange) rollbackRanges.push(updatedRange);
    }
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (const range of rollbackRanges) {
      try {
        await sheets.spreadsheets.values.clear({
          spreadsheetId: SPREADSHEET_ID,
          range,
        });
      } catch (rollbackError) {
        rollbackErrors.push(getErrorMessage(rollbackError));
      }
    }

    if (rollbackErrors.length > 0) {
      throw new Error(
        `Fallback append failed (${getErrorMessage(error)}). Rollback errors: ${rollbackErrors.join(
          " | ",
        )}`,
      );
    }

    throw error;
  }
};

const assertLinkedEntriesConsistency = (
  normalizedItems: TransferItem[],
  linkToBodega: boolean,
  carEntries: CarLedgerInput[],
  bodegaEntries: BodegaLedgerInput[],
) => {
  if (!linkToBodega) {
    if (bodegaEntries.length > 0) {
      throw new Error("Unexpected bodega entries when linkToBodega=false");
    }
    return;
  }

  if (
    carEntries.length !== normalizedItems.length ||
    bodegaEntries.length !== normalizedItems.length
  ) {
    throw new Error(
      "Linked transfer generated an inconsistent number of entries",
    );
  }

  const carById = new Map(
    carEntries.map((entry) => [entry.id || "", entry] as const),
  );
  const bodegaById = new Map(
    bodegaEntries.map((entry) => [entry.id || "", entry] as const),
  );

  for (const carEntry of carEntries) {
    const carId = carEntry.id || "";
    const linkedBodegaId = carEntry.linkedEntryId || "";
    if (!carId || !linkedBodegaId) {
      throw new Error("Linked car entry is missing ID linkage");
    }

    const bodegaCounterpart = bodegaById.get(linkedBodegaId);
    if (!bodegaCounterpart) {
      throw new Error(`Missing bodega counterpart for car entry ${carId}`);
    }
    if ((bodegaCounterpart.linkedEntryId || "") !== carId) {
      throw new Error(`Broken reciprocal linkage for car entry ${carId}`);
    }
  }

  for (const bodegaEntry of bodegaEntries) {
    const bodegaId = bodegaEntry.id || "";
    const linkedCarId = bodegaEntry.linkedEntryId || "";
    if (!bodegaId || !linkedCarId) {
      throw new Error("Linked bodega entry is missing ID linkage");
    }

    const carCounterpart = carById.get(linkedCarId);
    if (!carCounterpart) {
      throw new Error(`Missing car counterpart for bodega entry ${bodegaId}`);
    }
    if ((carCounterpart.linkedEntryId || "") !== bodegaId) {
      throw new Error(`Broken reciprocal linkage for bodega entry ${bodegaId}`);
    }
  }
};

const toCellData = (value: string | number): sheets_v4.Schema$CellData => {
  if (typeof value === "number") {
    return { userEnteredValue: { numberValue: value } };
  }

  return { userEnteredValue: { stringValue: value } };
};

const toAppendCellsRequest = (
  sheetId: number,
  values: Array<Array<string | number>>,
): sheets_v4.Schema$Request => ({
  appendCells: {
    sheetId,
    rows: values.map((row) => ({
      values: row.map((cell) => toCellData(cell)),
    })),
    fields: "userEnteredValue",
  },
});

const getSessionEmail = async () => {
  const session = await auth();
  return session?.user?.email?.toLowerCase().trim() || "";
};

const assertMaster = async () => {
  const email = await getSessionEmail();
  if (!email) {
    return { ok: false as const, status: 401, message: "Unauthorized" };
  }
  if (!isInventarioCarroAdmin(email)) {
    return { ok: false as const, status: 403, message: "Forbidden" };
  }
  return { ok: true as const, email };
};

const getBodegaWarnings = async (sheets: ReturnType<typeof google.sheets>) => {
  const { rows, hasHeader } = await getSheetRows(
    sheets,
    INVENTARIO_BODEGA_SHEET_NAME,
    BODEGA_LEDGER_LAST_COLUMN,
  );
  const parsedRows = rows
    .map((row, index) => parseBodegaLedgerRow(row, index + (hasHeader ? 2 : 1)))
    .filter((row) => row.id);
  return getNegativeStockWarnings(parsedRows);
};

export async function POST(req: Request) {
  const requestContext = {
    sellerEmail: "",
    itemCount: 0,
    linkToBodega: true,
  };

  try {
    const authCheck = await assertMaster();
    if (!authCheck.ok) {
      return NextResponse.json(
        { error: authCheck.message },
        { status: authCheck.status },
      );
    }

    const body = await req.json();
    const sellerEmail = (body?.sellerEmail || "").toLowerCase().trim();
    const movementType = body?.movementType || "Carga";
    const notes = body?.notes || "";
    const date = body?.date;
    const linkToBodega = body?.linkToBodega !== false;
    const overrideReason = body?.overrideReason || "";
    const items: TransferItem[] = Array.isArray(body?.entries)
      ? body.entries
      : [];
    requestContext.sellerEmail = sellerEmail;
    requestContext.itemCount = items.length;
    requestContext.linkToBodega = linkToBodega;

    if (!sellerEmail) {
      return NextResponse.json(
        { error: "sellerEmail is required" },
        { status: 400 },
      );
    }
    if (movementType !== "Carga") {
      return NextResponse.json(
        { error: "Only movementType=Carga is supported for transfer" },
        { status: 400 },
      );
    }
    if (items.length === 0) {
      return NextResponse.json(
        { error: "entries are required" },
        { status: 400 },
      );
    }

    const normalizedItems = items
      .map((item) => ({
        product: (item.product || "").trim(),
        quantity: Number(item.quantity || 0),
      }))
      .filter((item) => item.product && Number.isFinite(item.quantity));

    if (normalizedItems.length === 0) {
      return NextResponse.json(
        { error: "entries must include valid product and quantity" },
        { status: 400 },
      );
    }

    if (normalizedItems.some((item) => item.quantity <= 0)) {
      return NextResponse.json(
        { error: "entries quantity must be greater than zero" },
        { status: 400 },
      );
    }

    const sheets = google.sheets({ version: "v4", auth: sheetsAuth });
    await ensureSheetExists(sheets, INVENTARIO_CARROS_SHEET_NAME);
    await ensureSheetExists(sheets, INVENTARIO_BODEGA_SHEET_NAME);
    await ensureHeaderRow(
      sheets,
      INVENTARIO_CARROS_SHEET_NAME,
      CAR_LEDGER_HEADER_ROW,
      CAR_LEDGER_LAST_COLUMN,
    );
    await ensureHeaderRow(
      sheets,
      INVENTARIO_BODEGA_SHEET_NAME,
      BODEGA_LEDGER_HEADER_ROW,
      BODEGA_LEDGER_LAST_COLUMN,
    );

    const now = new Date().toISOString();
    const carEntries: CarLedgerInput[] = [];
    const bodegaEntries: BodegaLedgerInput[] = [];

    normalizedItems.forEach((item) => {
      if (linkToBodega) {
        const carId = crypto.randomUUID();
        const bodegaId = crypto.randomUUID();

        carEntries.push({
          id: carId,
          date,
          sellerEmail,
          product: item.product,
          quantity: item.quantity,
          movementType: "Carga",
          notes,
          createdBy: authCheck.email,
          createdAt: now,
          updatedAt: now,
          linkedEntryId: bodegaId,
          linkStatus: "linked",
          overrideReason: "",
        });

        bodegaEntries.push({
          id: bodegaId,
          date,
          product: item.product,
          quantity: item.quantity,
          direction: "Salida",
          movementType: "SalidaCarro",
          sellerEmail,
          notes,
          linkedEntryId: carId,
          linkStatus: "linked",
          overrideReason: "",
          createdBy: authCheck.email,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        carEntries.push({
          id: crypto.randomUUID(),
          date,
          sellerEmail,
          product: item.product,
          quantity: item.quantity,
          movementType: "Carga",
          notes,
          createdBy: authCheck.email,
          createdAt: now,
          updatedAt: now,
          linkStatus: "override",
          overrideReason,
        });
      }
    });

    assertLinkedEntriesConsistency(
      normalizedItems,
      linkToBodega,
      carEntries,
      bodegaEntries,
    );

    const carValues: Array<Array<string | number>> = carEntries.map((entry) =>
      toCarLedgerValues(entry, authCheck.email, now),
    );
    const bodegaValues: Array<Array<string | number>> = bodegaEntries.map(
      (entry) => toBodegaLedgerValues(entry, authCheck.email, now),
    );

    try {
      const spreadsheetMetadata = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
        fields: "sheets(properties(sheetId,title))",
      });

      const sheetIdByTitle = new Map(
        (spreadsheetMetadata.data.sheets || [])
          .map((sheet) => {
            const title = sheet.properties?.title;
            const sheetId = sheet.properties?.sheetId;
            if (!title || typeof sheetId !== "number") return null;
            return [title, sheetId] as const;
          })
          .filter((entry): entry is readonly [string, number] =>
            Boolean(entry),
          ),
      );

      const requests: sheets_v4.Schema$Request[] = [];
      if (carValues.length > 0) {
        const carSheetId = sheetIdByTitle.get(INVENTARIO_CARROS_SHEET_NAME);
        if (typeof carSheetId !== "number") {
          throw new Error(
            `Sheet ${INVENTARIO_CARROS_SHEET_NAME} was not found after setup`,
          );
        }
        requests.push(toAppendCellsRequest(carSheetId, carValues));
      }
      if (bodegaValues.length > 0) {
        const bodegaSheetId = sheetIdByTitle.get(INVENTARIO_BODEGA_SHEET_NAME);
        if (typeof bodegaSheetId !== "number") {
          throw new Error(
            `Sheet ${INVENTARIO_BODEGA_SHEET_NAME} was not found after setup`,
          );
        }
        requests.push(toAppendCellsRequest(bodegaSheetId, bodegaValues));
      }

      if (requests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests,
          },
        });
      }
    } catch (batchWriteError) {
      console.error(
        "Primary transfer append path failed; using values.append fallback",
        batchWriteError,
      );
      await appendValuesWithRollback(sheets, carValues, bodegaValues);
    }

    const warnings = await getBodegaWarnings(sheets);
    return NextResponse.json({
      success: true,
      carEntries: carEntries.length,
      bodegaEntries: bodegaEntries.length,
      warnings,
    });
  } catch (error) {
    const details = getErrorMessage(error);
    console.error("Error creating inventario transfer:", {
      error,
      details,
      requestContext,
    });
    return NextResponse.json(
      {
        error: "Failed to create inventario transfer",
        details,
      },
      { status: 500 },
    );
  }
}
