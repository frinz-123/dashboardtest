import { google } from "googleapis";
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
  clearRowValues,
  ensureHeaderRow,
  ensureSheetExists,
  getNegativeStockWarnings,
  getSheetRows,
  INVENTARIO_BODEGA_SHEET_NAME,
  INVENTARIO_CARROS_SHEET_NAME,
  type LinkStatus,
  parseBodegaLedgerRow,
  parseCarLedgerRow,
  SPREADSHEET_ID,
  toBodegaLedgerValues,
  toCarLedgerValues,
} from "@/utils/inventoryLedger";

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

const getCarRows = async (sheets: ReturnType<typeof google.sheets>) => {
  const { rows, hasHeader } = await getSheetRows(
    sheets,
    INVENTARIO_CARROS_SHEET_NAME,
    CAR_LEDGER_LAST_COLUMN,
  );
  return rows
    .map((row, index) => parseCarLedgerRow(row, index + (hasHeader ? 2 : 1)))
    .filter((row) => row.id);
};

const getWarnings = async (sheets: ReturnType<typeof google.sheets>) => {
  const bodegaRows = await getBodegaRows(sheets);
  return getNegativeStockWarnings(bodegaRows);
};

const syncCarCounterpart = async (
  sheets: ReturnType<typeof google.sheets>,
  entry: BodegaLedgerInput,
  actorEmail: string,
) => {
  if (entry.linkStatus !== "linked" || !entry.linkedEntryId) return;

  const carRows = await getCarRows(sheets);
  const counterpart = carRows.find((row) => row.id === entry.linkedEntryId);
  if (!counterpart) return;

  const now = new Date().toISOString();
  const values = toCarLedgerValues(
    {
      id: counterpart.id,
      date: entry.date,
      sellerEmail: entry.sellerEmail || counterpart.sellerEmail,
      product: entry.product,
      quantity: Number(entry.quantity || 0),
      movementType: "Carga",
      notes: entry.notes,
      createdBy: counterpart.createdBy || actorEmail,
      createdAt: counterpart.createdAt || now,
      updatedAt: now,
      linkedEntryId: entry.id || "",
      linkStatus: "linked",
      overrideReason: entry.overrideReason,
    },
    actorEmail,
    now,
  );

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${INVENTARIO_CARROS_SHEET_NAME}!A${counterpart.rowNumber}:O${counterpart.rowNumber}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [values],
    },
  });
};

const clearCarCounterpart = async (
  sheets: ReturnType<typeof google.sheets>,
  linkedEntryId: string,
) => {
  if (!linkedEntryId) return;
  const carRows = await getCarRows(sheets);
  const counterpart = carRows.find((row) => row.id === linkedEntryId);
  if (!counterpart) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${INVENTARIO_CARROS_SHEET_NAME}!A${counterpart.rowNumber}:O${counterpart.rowNumber}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [clearRowValues(CAR_LEDGER_HEADER_ROW.length)],
    },
  });
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
    const periodCode = searchParams.get("periodCode") || "";
    const weekCode = searchParams.get("weekCode") || "";
    const product = searchParams.get("product") || "";
    const movementType = searchParams.get("movementType") || "";
    const direction = searchParams.get("direction") || "";
    const sellerEmail = (searchParams.get("sellerEmail") || "")
      .toLowerCase()
      .trim();

    const sheets = google.sheets({ version: "v4", auth: sheetsAuth });
    await ensureSheetExists(sheets, INVENTARIO_BODEGA_SHEET_NAME);
    await ensureHeaderRow(
      sheets,
      INVENTARIO_BODEGA_SHEET_NAME,
      BODEGA_LEDGER_HEADER_ROW,
      BODEGA_LEDGER_LAST_COLUMN,
    );
    let rows = await getBodegaRows(sheets);

    if (periodCode) rows = rows.filter((row) => row.periodCode === periodCode);
    if (weekCode) rows = rows.filter((row) => row.weekCode === weekCode);
    if (product) rows = rows.filter((row) => row.product === product);
    if (movementType)
      rows = rows.filter((row) => row.movementType === movementType);
    if (direction) rows = rows.filter((row) => row.direction === direction);
    if (sellerEmail) {
      rows = rows.filter(
        (row) => row.sellerEmail.toLowerCase().trim() === sellerEmail,
      );
    }

    return NextResponse.json({
      rows,
      warnings: getNegativeStockWarnings(rows),
    });
  } catch (error) {
    console.error("Error fetching inventario bodega:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch inventario bodega",
        details: error instanceof Error ? error.message : String(error),
      },
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
    const entries: BodegaLedgerInput[] = Array.isArray(body?.entries)
      ? body.entries
      : [];

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "entries are required" },
        { status: 400 },
      );
    }

    const sheets = google.sheets({ version: "v4", auth: sheetsAuth });
    await ensureSheetExists(sheets, INVENTARIO_BODEGA_SHEET_NAME);
    await ensureSheetExists(sheets, INVENTARIO_CARROS_SHEET_NAME);
    await ensureHeaderRow(
      sheets,
      INVENTARIO_BODEGA_SHEET_NAME,
      BODEGA_LEDGER_HEADER_ROW,
      BODEGA_LEDGER_LAST_COLUMN,
    );
    await ensureHeaderRow(
      sheets,
      INVENTARIO_CARROS_SHEET_NAME,
      CAR_LEDGER_HEADER_ROW,
      CAR_LEDGER_LAST_COLUMN,
    );

    const now = new Date().toISOString();
    const values = entries.map((entry) =>
      toBodegaLedgerValues(
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
      range: `${INVENTARIO_BODEGA_SHEET_NAME}!A:P`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });

    const warnings = await getWarnings(sheets);
    return NextResponse.json({ success: true, data: response.data, warnings });
  } catch (error) {
    console.error("Error creating inventario bodega:", error);
    return NextResponse.json(
      {
        error: "Failed to create inventario bodega",
        details: error instanceof Error ? error.message : String(error),
      },
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
    const entry: BodegaLedgerInput | null = body?.entry || null;

    if (!rowNumber || !entry) {
      return NextResponse.json(
        { error: "rowNumber and entry are required" },
        { status: 400 },
      );
    }

    const sheets = google.sheets({ version: "v4", auth: sheetsAuth });
    await ensureSheetExists(sheets, INVENTARIO_BODEGA_SHEET_NAME);
    await ensureSheetExists(sheets, INVENTARIO_CARROS_SHEET_NAME);
    await ensureHeaderRow(
      sheets,
      INVENTARIO_BODEGA_SHEET_NAME,
      BODEGA_LEDGER_HEADER_ROW,
      BODEGA_LEDGER_LAST_COLUMN,
    );
    await ensureHeaderRow(
      sheets,
      INVENTARIO_CARROS_SHEET_NAME,
      CAR_LEDGER_HEADER_ROW,
      CAR_LEDGER_LAST_COLUMN,
    );

    const currentRows = await getBodegaRows(sheets);
    const existing = currentRows.find((row) => row.rowNumber === rowNumber);
    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const linkStatus = (entry.linkStatus || existing.linkStatus || "") as
      | LinkStatus
      | "";
    const linkedEntryId = entry.linkedEntryId || existing.linkedEntryId || "";
    const isLinked = linkStatus === "linked" && Boolean(linkedEntryId);

    const now = new Date().toISOString();
    const normalizedEntry: BodegaLedgerInput = {
      id: entry.id || existing.id,
      date: entry.date || existing.date,
      product: entry.product || existing.product,
      quantity: Number(entry.quantity ?? existing.quantity ?? 0),
      direction: isLinked ? "Salida" : entry.direction || existing.direction,
      movementType: isLinked
        ? "SalidaCarro"
        : entry.movementType || existing.movementType,
      sellerEmail: entry.sellerEmail ?? existing.sellerEmail,
      notes: entry.notes ?? existing.notes,
      linkedEntryId,
      linkStatus: isLinked ? "linked" : linkStatus,
      overrideReason: entry.overrideReason ?? existing.overrideReason,
      createdBy: existing.createdBy || authCheck.email,
      createdAt: existing.createdAt || now,
      updatedAt: now,
    };

    const values = toBodegaLedgerValues(normalizedEntry, authCheck.email, now);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${INVENTARIO_BODEGA_SHEET_NAME}!A${rowNumber}:P${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [values] },
    });

    await syncCarCounterpart(sheets, normalizedEntry, authCheck.email);
    const warnings = await getWarnings(sheets);

    return NextResponse.json({ success: true, warnings });
  } catch (error) {
    console.error("Error updating inventario bodega:", error);
    return NextResponse.json(
      {
        error: "Failed to update inventario bodega",
        details: error instanceof Error ? error.message : String(error),
      },
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
    await ensureSheetExists(sheets, INVENTARIO_BODEGA_SHEET_NAME);
    await ensureSheetExists(sheets, INVENTARIO_CARROS_SHEET_NAME);
    await ensureHeaderRow(
      sheets,
      INVENTARIO_BODEGA_SHEET_NAME,
      BODEGA_LEDGER_HEADER_ROW,
      BODEGA_LEDGER_LAST_COLUMN,
    );
    await ensureHeaderRow(
      sheets,
      INVENTARIO_CARROS_SHEET_NAME,
      CAR_LEDGER_HEADER_ROW,
      CAR_LEDGER_LAST_COLUMN,
    );

    const rows = await getBodegaRows(sheets);
    const targetRow = rows.find((row) =>
      rowNumber ? row.rowNumber === rowNumber : row.id === id,
    );
    if (!targetRow) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${INVENTARIO_BODEGA_SHEET_NAME}!A${targetRow.rowNumber}:P${targetRow.rowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [clearRowValues(BODEGA_LEDGER_HEADER_ROW.length)],
      },
    });

    if (targetRow.linkStatus === "linked" && targetRow.linkedEntryId) {
      await clearCarCounterpart(sheets, targetRow.linkedEntryId);
    }

    const warnings = await getWarnings(sheets);
    return NextResponse.json({ success: true, warnings });
  } catch (error) {
    console.error("Error deleting inventario bodega row:", error);
    return NextResponse.json(
      {
        error: "Failed to delete inventario bodega row",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
