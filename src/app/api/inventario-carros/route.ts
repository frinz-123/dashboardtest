import { google } from "googleapis";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { EMAIL_TO_VENDOR_LABELS, isInventarioCarroAdmin } from "@/utils/auth";
import { sheetsAuth } from "@/utils/googleAuth";
import {
  BODEGA_LEDGER_HEADER_ROW,
  BODEGA_LEDGER_LAST_COLUMN,
  CAR_LEDGER_HEADER_ROW,
  CAR_LEDGER_LAST_COLUMN,
  type CarLedgerInput,
  clearRowValues,
  ensureHeaderRow,
  ensureSheetExists,
  getNegativeStockWarnings,
  getSheetRows,
  INVENTARIO_BODEGA_SHEET_NAME,
  INVENTARIO_CARROS_SHEET_NAME,
  parseBodegaLedgerRow,
  parseCarLedgerRow,
  SPREADSHEET_ID,
  toBodegaLedgerValues,
  toCarLedgerValues,
} from "@/utils/inventoryLedger";
import { PRODUCT_NAMES } from "@/utils/productCatalog";

export const dynamic = "force-dynamic";

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

const getCarRows = async (sheets: ReturnType<typeof google.sheets>) => {
  const { rows, hasHeader } = await getSheetRows(
    sheets,
    INVENTARIO_CARROS_SHEET_NAME,
    CAR_LEDGER_LAST_COLUMN,
  );
  return {
    hasHeader,
    rows: rows
      .map((row, index) => parseCarLedgerRow(row, index + (hasHeader ? 2 : 1)))
      .filter((row) => row.id),
  };
};

const getBodegaRows = async (sheets: ReturnType<typeof google.sheets>) => {
  const { rows, hasHeader } = await getSheetRows(
    sheets,
    INVENTARIO_BODEGA_SHEET_NAME,
    BODEGA_LEDGER_LAST_COLUMN,
  );
  return rows
    .map((row, index) => parseBodegaLedgerRow(row, index + (hasHeader ? 2 : 1)))
    .filter((row) => row.id);
};

const syncBodegaCounterpart = async (
  sheets: ReturnType<typeof google.sheets>,
  entry: CarLedgerInput,
  actorEmail: string,
) => {
  if (entry.linkStatus !== "linked" || !entry.linkedEntryId) {
    return;
  }

  const bodegaRows = await getBodegaRows(sheets);
  const counterpart = bodegaRows.find((row) => row.id === entry.linkedEntryId);
  if (!counterpart) return;

  const now = new Date().toISOString();
  const values = toBodegaLedgerValues(
    {
      id: counterpart.id,
      date: entry.date,
      product: entry.product,
      quantity: Number(entry.quantity || 0),
      direction: "Salida",
      movementType: "SalidaCarro",
      sellerEmail: entry.sellerEmail,
      notes: entry.notes,
      linkedEntryId: entry.id || "",
      linkStatus: "linked",
      overrideReason: entry.overrideReason,
      createdBy: counterpart.createdBy || actorEmail,
      createdAt: counterpart.createdAt || now,
      updatedAt: now,
    },
    actorEmail,
    now,
  );

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${INVENTARIO_BODEGA_SHEET_NAME}!A${counterpart.rowNumber}:P${counterpart.rowNumber}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [values],
    },
  });
};

const clearBodegaCounterpart = async (
  sheets: ReturnType<typeof google.sheets>,
  linkedEntryId: string,
) => {
  if (!linkedEntryId) return;
  const bodegaRows = await getBodegaRows(sheets);
  const counterpart = bodegaRows.find((row) => row.id === linkedEntryId);
  if (!counterpart) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${INVENTARIO_BODEGA_SHEET_NAME}!A${counterpart.rowNumber}:P${counterpart.rowNumber}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [clearRowValues(BODEGA_LEDGER_HEADER_ROW.length)],
    },
  });
};

const getBodegaWarnings = async (sheets: ReturnType<typeof google.sheets>) => {
  const rows = await getBodegaRows(sheets);
  return getNegativeStockWarnings(rows);
};

export async function GET(req: Request) {
  try {
    const authCheck = await assertMaster();
    if (!authCheck.ok) {
      return NextResponse.json(
        { error: authCheck.message },
        { status: authCheck.status },
      );
    }

    const { searchParams } = new URL(req.url);
    const sellerEmail = (searchParams.get("sellerEmail") || "")
      .toLowerCase()
      .trim();
    const periodCode = searchParams.get("periodCode") || "";
    const weekCode = searchParams.get("weekCode") || "";
    const movementType = searchParams.get("movementType") || "";

    const sheets = google.sheets({ version: "v4", auth: sheetsAuth });
    await ensureSheetExists(sheets, INVENTARIO_CARROS_SHEET_NAME);
    const { rows, hasHeader } = await getCarRows(sheets);

    let filteredRows = rows;
    if (sellerEmail) {
      filteredRows = filteredRows.filter(
        (row) => row.sellerEmail.toLowerCase().trim() === sellerEmail,
      );
    }
    if (periodCode) {
      filteredRows = filteredRows.filter(
        (row) => row.periodCode === periodCode,
      );
    }
    if (weekCode) {
      filteredRows = filteredRows.filter((row) => row.weekCode === weekCode);
    }
    if (movementType) {
      filteredRows = filteredRows.filter(
        (row) => row.movementType === movementType,
      );
    }

    return NextResponse.json({ rows: filteredRows, hasHeader });
  } catch (error) {
    console.error("Error fetching inventario carros:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventario carros" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const authCheck = await assertMaster();
    if (!authCheck.ok) {
      return NextResponse.json(
        { error: authCheck.message },
        { status: authCheck.status },
      );
    }

    const body = await req.json();
    const action = body?.action || "create";

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

    if (action === "seed") {
      const seedResult = await seedLedger(sheets, authCheck.email);
      if (!seedResult.success) {
        return NextResponse.json(
          { error: seedResult.message },
          { status: seedResult.status },
        );
      }
      return NextResponse.json({ success: true, rows: seedResult.rows });
    }

    const entries: CarLedgerInput[] = Array.isArray(body?.entries)
      ? body.entries
      : [];

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "entries are required" },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const values = entries.map((entry) =>
      toCarLedgerValues(
        {
          ...entry,
          id: entry.id || crypto.randomUUID(),
          createdBy: entry.createdBy || authCheck.email,
          createdAt: entry.createdAt || now,
          updatedAt: now,
        },
        authCheck.email,
        now,
      ),
    );

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${INVENTARIO_CARROS_SHEET_NAME}!A:O`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values,
      },
    });

    return NextResponse.json({
      success: true,
      data: response.data,
      warnings: [],
    });
  } catch (error) {
    console.error("Error creating inventario carros:", error);
    return NextResponse.json(
      { error: "Failed to create inventario carros" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const authCheck = await assertMaster();
    if (!authCheck.ok) {
      return NextResponse.json(
        { error: authCheck.message },
        { status: authCheck.status },
      );
    }

    const body = await req.json();
    const rowNumber = Number(body?.rowNumber || 0);
    const entry: CarLedgerInput | null = body?.entry || null;

    if (!rowNumber || !entry) {
      return NextResponse.json(
        { error: "rowNumber and entry are required" },
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

    const updatedAt = new Date().toISOString();
    const normalizedEntry: CarLedgerInput = {
      ...entry,
      id: entry.id || crypto.randomUUID(),
      createdBy: entry.createdBy || authCheck.email,
      createdAt: entry.createdAt || updatedAt,
      updatedAt,
    };

    const values = toCarLedgerValues(
      normalizedEntry,
      authCheck.email,
      updatedAt,
    );

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${INVENTARIO_CARROS_SHEET_NAME}!A${rowNumber}:O${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [values],
      },
    });

    await syncBodegaCounterpart(sheets, normalizedEntry, authCheck.email);
    const warnings = await getBodegaWarnings(sheets);

    return NextResponse.json({ success: true, warnings });
  } catch (error) {
    console.error("Error updating inventario carros:", error);
    return NextResponse.json(
      { error: "Failed to update inventario carros" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const authCheck = await assertMaster();
    if (!authCheck.ok) {
      return NextResponse.json(
        { error: authCheck.message },
        { status: authCheck.status },
      );
    }

    const body = await req.json().catch(() => ({}));
    const rowNumber = Number(body?.rowNumber || 0);
    const id = (body?.id || "").trim();

    if (!rowNumber && !id) {
      return NextResponse.json(
        { error: "rowNumber or id is required" },
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

    const { rows } = await getCarRows(sheets);
    const targetRow = rows.find((row) =>
      rowNumber ? row.rowNumber === rowNumber : row.id === id,
    );

    if (!targetRow) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${INVENTARIO_CARROS_SHEET_NAME}!A${targetRow.rowNumber}:O${targetRow.rowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [clearRowValues(CAR_LEDGER_HEADER_ROW.length)],
      },
    });

    if (targetRow.linkStatus === "linked" && targetRow.linkedEntryId) {
      await clearBodegaCounterpart(sheets, targetRow.linkedEntryId);
    }

    const warnings = await getBodegaWarnings(sheets);
    return NextResponse.json({ success: true, warnings });
  } catch (error) {
    console.error("Error deleting inventario carros row:", error);
    return NextResponse.json(
      { error: "Failed to delete inventario carros row" },
      { status: 500 },
    );
  }
}

const seedLedger = async (
  sheets: ReturnType<typeof google.sheets>,
  createdBy: string,
) => {
  const { rows } = await getCarRows(sheets);

  if (rows.length > 0) {
    return {
      success: false,
      status: 409,
      message: "Sheet already has data",
    };
  }

  const sellers = Object.keys(EMAIL_TO_VENDOR_LABELS).slice(0, 3);
  const products = PRODUCT_NAMES.slice(0, 5);
  const nowIso = new Date().toISOString();

  const values = sellers.flatMap((sellerEmail, sellerIndex) => {
    const baseQuantity = 18 + sellerIndex * 4;
    return products.flatMap((product, productIndex) => {
      const quantity = baseQuantity + productIndex * 2;

      return [
        toCarLedgerValues(
          {
            id: crypto.randomUUID(),
            sellerEmail,
            product,
            quantity,
            movementType: "InventarioInicial",
            notes: "Seed demo",
            createdBy,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          createdBy,
          nowIso,
        ),
        toCarLedgerValues(
          {
            id: crypto.randomUUID(),
            sellerEmail,
            product,
            quantity: Math.max(4, Math.round(quantity / 3)),
            movementType: "Carga",
            notes: "Seed demo carga",
            createdBy,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          createdBy,
          nowIso,
        ),
      ];
    });
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${INVENTARIO_CARROS_SHEET_NAME}!A:O`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values,
    },
  });

  return { success: true, rows: values.length };
};
