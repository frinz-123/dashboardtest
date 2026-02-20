import type { sheets_v4 } from "googleapis";
import { getCurrentPeriodInfo } from "@/utils/dateUtils";

export const SPREADSHEET_ID =
  process.env.NEXT_PUBLIC_SPREADSHEET_ID ||
  "1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g";

export const INVENTARIO_CARROS_SHEET_NAME = "InventarioCarros";
export const INVENTARIO_BODEGA_SHEET_NAME =
  process.env.SHEET_NAME_BODEGA || "Bodega";

export const CAR_LEDGER_LAST_COLUMN = "O";
export const BODEGA_LEDGER_LAST_COLUMN = "P";

const MAZATLAN_TZ = "America/Mazatlan";

export type LinkStatus = "linked" | "override";
export type InventoryDirection = "Entrada" | "Salida";

export type InventoryWarning = {
  code: "NEGATIVE_STOCK";
  product: string;
  resultingStock: number;
};

export const CAR_LEDGER_HEADER_ROW = [
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
  "linkedEntryId",
  "linkStatus",
  "overrideReason",
] as const;

export const BODEGA_LEDGER_HEADER_ROW = [
  "id",
  "date",
  "periodCode",
  "weekCode",
  "product",
  "quantity",
  "direction",
  "movementType",
  "sellerEmail",
  "notes",
  "linkedEntryId",
  "linkStatus",
  "overrideReason",
  "createdBy",
  "createdAt",
  "updatedAt",
] as const;

export type CarLedgerRow = {
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
  linkedEntryId: string;
  linkStatus: LinkStatus | "";
  overrideReason: string;
};

export type BodegaLedgerRow = {
  rowNumber: number;
  id: string;
  date: string;
  periodCode: string;
  weekCode: string;
  product: string;
  quantity: number;
  direction: InventoryDirection;
  movementType: string;
  sellerEmail: string;
  notes: string;
  linkedEntryId: string;
  linkStatus: LinkStatus | "";
  overrideReason: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CarLedgerInput = {
  id?: string;
  date?: string;
  sellerEmail?: string;
  product?: string;
  quantity?: number;
  movementType?: string;
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  linkedEntryId?: string;
  linkStatus?: LinkStatus | "";
  overrideReason?: string;
};

export type BodegaLedgerInput = {
  id?: string;
  date?: string;
  product?: string;
  quantity?: number;
  direction?: InventoryDirection;
  movementType?: string;
  sellerEmail?: string;
  notes?: string;
  linkedEntryId?: string;
  linkStatus?: LinkStatus | "";
  overrideReason?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export const normalizeEmail = (value: string | undefined) =>
  (value || "").toLowerCase().trim();

export const normalizeLinkStatus = (
  value: string | undefined,
): LinkStatus | "" => {
  if (value === "linked" || value === "override") return value;
  return "";
};

export const normalizeDirection = (
  value: string | undefined,
): InventoryDirection => {
  if ((value || "").toLowerCase().trim() === "salida") return "Salida";
  return "Entrada";
};

const parseNumber = (value: string | undefined) =>
  Number.parseFloat(value || "0") || 0;

export const parseDateInput = (value?: string): Date => {
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

export const getPeriodInfoForDate = (date: Date) => {
  const { year, month, day } = getMazatlanDateParts(date);
  const periodDate = new Date(Number(year), Number(month) - 1, Number(day));
  const { periodNumber, weekInPeriod } = getCurrentPeriodInfo(periodDate);
  return {
    dateString: `${year}-${month}-${day}`,
    periodCode: `P${periodNumber}`,
    weekCode: `P${periodNumber}S${weekInPeriod}`,
  };
};

export const toCarLedgerValues = (
  entry: CarLedgerInput,
  actorEmail: string,
  now: string,
) => {
  const entryDate = parseDateInput(entry.date);
  const { dateString, periodCode, weekCode } = getPeriodInfoForDate(entryDate);
  const quantity = Number(entry.quantity || 0);

  return [
    entry.id || crypto.randomUUID(),
    dateString,
    periodCode,
    weekCode,
    normalizeEmail(entry.sellerEmail),
    entry.product || "",
    Number.isNaN(quantity) ? 0 : quantity,
    entry.movementType || "",
    entry.notes || "",
    entry.createdBy || actorEmail,
    entry.createdAt || now,
    entry.updatedAt || now,
    entry.linkedEntryId || "",
    normalizeLinkStatus(entry.linkStatus),
    entry.overrideReason || "",
  ];
};

export const toBodegaLedgerValues = (
  entry: BodegaLedgerInput,
  actorEmail: string,
  now: string,
) => {
  const entryDate = parseDateInput(entry.date);
  const { dateString, periodCode, weekCode } = getPeriodInfoForDate(entryDate);
  const quantity = Number(entry.quantity || 0);

  return [
    entry.id || crypto.randomUUID(),
    dateString,
    periodCode,
    weekCode,
    entry.product || "",
    Number.isNaN(quantity) ? 0 : quantity,
    normalizeDirection(entry.direction),
    entry.movementType || "",
    normalizeEmail(entry.sellerEmail),
    entry.notes || "",
    entry.linkedEntryId || "",
    normalizeLinkStatus(entry.linkStatus),
    entry.overrideReason || "",
    entry.createdBy || actorEmail,
    entry.createdAt || now,
    entry.updatedAt || now,
  ];
};

export const parseCarLedgerRow = (
  row: string[],
  rowNumber: number,
): CarLedgerRow => ({
  rowNumber,
  id: row[0] || "",
  date: row[1] || "",
  periodCode: row[2] || "",
  weekCode: row[3] || "",
  sellerEmail: row[4] || "",
  product: row[5] || "",
  quantity: parseNumber(row[6]),
  movementType: row[7] || "",
  notes: row[8] || "",
  createdBy: row[9] || "",
  createdAt: row[10] || "",
  updatedAt: row[11] || "",
  linkedEntryId: row[12] || "",
  linkStatus: normalizeLinkStatus(row[13] || ""),
  overrideReason: row[14] || "",
});

export const parseBodegaLedgerRow = (
  row: string[],
  rowNumber: number,
): BodegaLedgerRow => ({
  rowNumber,
  id: row[0] || "",
  date: row[1] || "",
  periodCode: row[2] || "",
  weekCode: row[3] || "",
  product: row[4] || "",
  quantity: parseNumber(row[5]),
  direction: normalizeDirection(row[6]),
  movementType: row[7] || "",
  sellerEmail: row[8] || "",
  notes: row[9] || "",
  linkedEntryId: row[10] || "",
  linkStatus: normalizeLinkStatus(row[11] || ""),
  overrideReason: row[12] || "",
  createdBy: row[13] || "",
  createdAt: row[14] || "",
  updatedAt: row[15] || "",
});

type SheetRowsResult = {
  rows: string[][];
  hasHeader: boolean;
};

export const getSheetRows = async (
  sheets: sheets_v4.Sheets,
  sheetName: string,
  lastColumn: string,
): Promise<SheetRowsResult> => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:${lastColumn}`,
  });

  const rows = response.data.values || [];
  const hasHeader = rows.length > 0 && (rows[0][0] || "").trim() === "id";
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return {
    hasHeader,
    rows: dataRows,
  };
};

export const ensureHeaderRow = async (
  sheets: sheets_v4.Sheets,
  sheetName: string,
  headerRow: readonly string[],
  lastColumn: string,
) => {
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:${lastColumn}1`,
  });
  const currentHeader = headerResponse.data.values?.[0] || [];

  if (currentHeader.length === 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:${lastColumn}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [Array.from(headerRow)],
      },
    });
    return;
  }

  const shouldRewrite =
    currentHeader.length < headerRow.length ||
    headerRow.some((value, index) => value !== (currentHeader[index] || ""));

  if (shouldRewrite) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:${lastColumn}1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [Array.from(headerRow)],
      },
    });
  }
};

export const ensureSheetExists = async (
  sheets: sheets_v4.Sheets,
  sheetName: string,
) => {
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets.properties.title",
  });

  const exists = (spreadsheet.data.sheets || []).some(
    (sheet) => sheet.properties?.title === sheetName,
  );

  if (exists) return;

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          },
        ],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.toLowerCase().includes("already exists")) {
      return;
    }
    throw error;
  }
};

export const getBodegaStockByProduct = (rows: BodegaLedgerRow[]) => {
  const totals = new Map<string, number>();

  rows.forEach((row) => {
    const current = totals.get(row.product) || 0;
    const delta = row.direction === "Salida" ? -row.quantity : row.quantity;
    totals.set(row.product, current + delta);
  });

  return totals;
};

export const getNegativeStockWarnings = (
  rows: BodegaLedgerRow[],
): InventoryWarning[] => {
  const totals = getBodegaStockByProduct(rows);
  const warnings: InventoryWarning[] = [];

  totals.forEach((resultingStock, product) => {
    if (resultingStock < 0) {
      warnings.push({
        code: "NEGATIVE_STOCK",
        product,
        resultingStock,
      });
    }
  });

  warnings.sort((a, b) => a.product.localeCompare(b.product));
  return warnings;
};

export const clearRowValues = (totalColumns: number): string[] =>
  Array.from({ length: totalColumns }).map(() => "");
