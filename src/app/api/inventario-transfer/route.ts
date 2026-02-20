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

    if (carEntries.length > 0) {
      const carValues = carEntries.map((entry) =>
        toCarLedgerValues(entry, authCheck.email, now),
      );
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${INVENTARIO_CARROS_SHEET_NAME}!A:O`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: carValues,
        },
      });
    }

    if (bodegaEntries.length > 0) {
      const bodegaValues = bodegaEntries.map((entry) =>
        toBodegaLedgerValues(entry, authCheck.email, now),
      );
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${INVENTARIO_BODEGA_SHEET_NAME}!A:P`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: bodegaValues,
        },
      });
    }

    const warnings = await getBodegaWarnings(sheets);
    return NextResponse.json({
      success: true,
      carEntries: carEntries.length,
      bodegaEntries: bodegaEntries.length,
      warnings,
    });
  } catch (error) {
    console.error("Error creating inventario transfer:", error);
    return NextResponse.json(
      { error: "Failed to create inventario transfer" },
      { status: 500 },
    );
  }
}
