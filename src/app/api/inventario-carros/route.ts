import { google } from "googleapis";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { EMAIL_TO_VENDOR_LABELS, isInventarioCarroAdmin } from "@/utils/auth";
import { getCurrentPeriodInfo } from "@/utils/dateUtils";
import { sheetsAuth } from "@/utils/googleAuth";
import { PRODUCT_NAMES } from "@/utils/productCatalog";

export const dynamic = "force-dynamic";

const SPREADSHEET_ID =
  process.env.NEXT_PUBLIC_SPREADSHEET_ID ||
  "1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g";
const SHEET_NAME = "InventarioCarros";
const MAZATLAN_TZ = "America/Mazatlan";
const HEADER_ROW = [
  "id",
  "date",
  "periodCode",
  "weekCode",
  "sellerEmail",
  "product",
  "quantity",
  "movementType",
  "notes",
  "createdBy",
  "createdAt",
  "updatedAt",
];

type LedgerRow = {
  rowNumber: number;
  id: string;
  date: string;
  periodCode: string;
  weekCode: string;
  sellerEmail: string;
  product: string;
  quantity: number;
  movementType: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type LedgerInput = {
  id?: string;
  date?: string;
  sellerEmail: string;
  product: string;
  quantity: number;
  movementType: string;
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

const ensureHeaderRow = async (sheets: ReturnType<typeof google.sheets>) => {
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1:L1`,
  });

  const header = headerResponse.data.values?.[0] || [];

  if (header.length === 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:L`,
      valueInputOption: "RAW",
      requestBody: {
        values: [HEADER_ROW],
      },
    });
    return;
  }

  if (header[0] !== "id" || header.length < HEADER_ROW.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:L1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [HEADER_ROW],
      },
    });
  }
};

const parseDateInput = (value?: string): Date => {
  if (!value) return new Date();
  const trimmed = value.trim();
  if (!trimmed) return new Date();

  const parts = trimmed.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts.map((part) => Number(part));
    if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
      return new Date(year, month - 1, day, 12, 0, 0);
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return new Date();
};

const getMazatlanDateParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MAZATLAN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
  };
};

const getPeriodInfoForDate = (date: Date) => {
  const { year, month, day } = getMazatlanDateParts(date);
  const periodDate = new Date(Number(year), Number(month) - 1, Number(day));
  const { periodNumber, weekInPeriod } = getCurrentPeriodInfo(periodDate);
  return {
    dateString: `${year}-${month}-${day}`,
    periodCode: `P${periodNumber}`,
    weekCode: `P${periodNumber}S${weekInPeriod}`,
  };
};

const normalizeRow = (row: string[], rowNumber: number): LedgerRow => ({
  rowNumber,
  id: row[0] || "",
  date: row[1] || "",
  periodCode: row[2] || "",
  weekCode: row[3] || "",
  sellerEmail: row[4] || "",
  product: row[5] || "",
  quantity: Number.parseFloat(row[6] || "0") || 0,
  movementType: row[7] || "",
  notes: row[8] || "",
  createdBy: row[9] || "",
  createdAt: row[10] || "",
  updatedAt: row[11] || "",
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
    const sellerEmail = searchParams.get("sellerEmail") || "";
    const periodCode = searchParams.get("periodCode") || "";
    const weekCode = searchParams.get("weekCode") || "";

    const sheets = google.sheets({ version: "v4", auth: sheetsAuth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:L`,
    });

    const rows = response.data.values || [];
    const hasHeader = rows.length > 0 && rows[0][0] === "id";
    const dataRows = hasHeader ? rows.slice(1) : rows;

    let ledgerRows = dataRows.map((row, index) =>
      normalizeRow(row, index + (hasHeader ? 2 : 1)),
    );

    if (sellerEmail) {
      const normalizedSeller = sellerEmail.toLowerCase().trim();
      ledgerRows = ledgerRows.filter(
        (row) => row.sellerEmail.toLowerCase().trim() === normalizedSeller,
      );
    }
    if (periodCode) {
      ledgerRows = ledgerRows.filter((row) => row.periodCode === periodCode);
    }
    if (weekCode) {
      ledgerRows = ledgerRows.filter((row) => row.weekCode === weekCode);
    }

    return NextResponse.json({ rows: ledgerRows, hasHeader });
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
    await ensureHeaderRow(sheets);

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

    const entries: LedgerInput[] = Array.isArray(body?.entries)
      ? body.entries
      : [];

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "entries are required" },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const values = entries.map((entry) => {
      const entryDate = parseDateInput(entry.date);
      const { dateString, periodCode, weekCode } =
        getPeriodInfoForDate(entryDate);
      const id = entry.id || crypto.randomUUID();
      const quantity = Number(entry.quantity || 0);

      return [
        id,
        dateString,
        periodCode,
        weekCode,
        (entry.sellerEmail || "").toLowerCase().trim(),
        entry.product || "",
        Number.isNaN(quantity) ? 0 : quantity,
        entry.movementType || "",
        entry.notes || "",
        authCheck.email,
        now,
        now,
      ];
    });

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:L`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values,
      },
    });

    return NextResponse.json({ success: true, data: response.data });
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
    const entry: LedgerInput | null = body?.entry || null;

    if (!rowNumber || !entry) {
      return NextResponse.json(
        { error: "rowNumber and entry are required" },
        { status: 400 },
      );
    }

    const entryDate = parseDateInput(entry.date);
    const { dateString, periodCode, weekCode } =
      getPeriodInfoForDate(entryDate);

    const updatedAt = new Date().toISOString();
    const quantity = Number(entry.quantity || 0);

    const values = [
      entry.id || crypto.randomUUID(),
      dateString,
      periodCode,
      weekCode,
      (entry.sellerEmail || "").toLowerCase().trim(),
      entry.product || "",
      Number.isNaN(quantity) ? 0 : quantity,
      entry.movementType || "",
      entry.notes || "",
      entry.createdBy || authCheck.email,
      entry.createdAt || updatedAt,
      updatedAt,
    ];

    const sheets = google.sheets({ version: "v4", auth: sheetsAuth });
    await ensureHeaderRow(sheets);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A${rowNumber}:L${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [values],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating inventario carros:", error);
    return NextResponse.json(
      { error: "Failed to update inventario carros" },
      { status: 500 },
    );
  }
}

const seedLedger = async (
  sheets: ReturnType<typeof google.sheets>,
  createdBy: string,
) => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:L`,
  });

  const rows = response.data.values || [];
  const hasHeader = rows.length > 0 && rows[0][0] === "id";
  const dataRows = hasHeader ? rows.slice(1) : rows;

  if (dataRows.length > 0) {
    return {
      success: false,
      status: 409,
      message: "Sheet already has data",
    };
  }

  const sellers = Object.keys(EMAIL_TO_VENDOR_LABELS).slice(0, 3);
  const products = PRODUCT_NAMES.slice(0, 5);
  const now = new Date();
  const nowIso = now.toISOString();

  const values = sellers.flatMap((sellerEmail, sellerIndex) => {
    const baseQuantity = 18 + sellerIndex * 4;
    return products.flatMap((product, productIndex) => {
      const quantity = baseQuantity + productIndex * 2;
      const initialInfo = getPeriodInfoForDate(now);
      const cargaInfo = getPeriodInfoForDate(new Date());
      return [
        [
          crypto.randomUUID(),
          initialInfo.dateString,
          initialInfo.periodCode,
          initialInfo.weekCode,
          sellerEmail,
          product,
          quantity,
          "InventarioInicial",
          "Seed demo",
          createdBy,
          nowIso,
          nowIso,
        ],
        [
          crypto.randomUUID(),
          cargaInfo.dateString,
          cargaInfo.periodCode,
          cargaInfo.weekCode,
          sellerEmail,
          product,
          Math.max(4, Math.round(quantity / 3)),
          "Carga",
          "Seed demo carga",
          createdBy,
          nowIso,
          nowIso,
        ],
      ];
    });
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:L`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values,
    },
  });

  return { success: true, rows: values.length };
};
