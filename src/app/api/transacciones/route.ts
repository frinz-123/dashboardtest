import { google } from "googleapis";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isMasterAccount } from "@/utils/auth";
import { sheetsAuth } from "@/utils/googleAuth";
import {
  applyTransactionFilters,
  detectPhotoColumnIndex,
  parseLimit,
  parseOffset,
  parseTransactionRow,
  sortTransactionsDescending,
  type TransactionFilters,
} from "@/utils/transacciones";

const SPREADSHEET_ID = "1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g";
const SHEET_NAME = "Form_Data";
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 500;

export const dynamic = "force-dynamic";

const parseOptionalNumber = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseOptionalBoolean = (value: string | null): boolean | null => {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "si"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no"].includes(normalized)) {
    return false;
  }

  return null;
};

const toSafeLimit = (value: string | null): number => {
  const parsed = parseLimit(value, DEFAULT_LIMIT);
  return Math.min(parsed, MAX_LIMIT);
};

const getFilterOptions = (
  records: ReturnType<typeof applyTransactionFilters>,
): {
  codigos: string[];
  vendedores: string[];
  periodos: string[];
} => {
  const codigos = new Set<string>();
  const vendedores = new Set<string>();
  const periodos = new Set<string>();

  records.forEach((record) => {
    if (record.codigo) codigos.add(record.codigo);
    if (record.email) vendedores.add(record.email);
    if (record.periodWeekCode) periodos.add(record.periodWeekCode);
  });

  return {
    codigos: [...codigos].sort((a, b) => a.localeCompare(b, "es")),
    vendedores: [...vendedores].sort((a, b) => a.localeCompare(b, "es")),
    periodos: [...periodos].sort((a, b) => a.localeCompare(b, "es")),
  };
};

export async function GET(request: Request) {
  try {
    const session = await auth();
    const sessionEmail = session?.user?.email?.toLowerCase().trim() || "";

    if (!sessionEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isMasterAccount(sessionEmail)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const limit = toSafeLimit(searchParams.get("limit"));
    const offset = parseOffset(searchParams.get("offset"));

    const filters: TransactionFilters = {
      from: searchParams.get("from") || "",
      to: searchParams.get("to") || "",
      code: searchParams.get("code") || "",
      client: searchParams.get("client") || "",
      email: searchParams.get("email") || "",
      saleId: searchParams.get("saleId") || "",
      period: searchParams.get("period") || "",
      monthCode: searchParams.get("monthCode") || "",
      product: searchParams.get("product") || "",
      minTotal: parseOptionalNumber(searchParams.get("minTotal")),
      maxTotal: parseOptionalNumber(searchParams.get("maxTotal")),
      hasPhotos: parseOptionalBoolean(searchParams.get("hasPhotos")),
    };

    const sheets = google.sheets({ version: "v4", auth: sheetsAuth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:AQ`,
    });

    const rows = response.data.values || [];
    const headers: string[] = rows[0] || [];
    const dataRows = rows.slice(1);

    if (dataRows.length === 0) {
      return NextResponse.json({
        items: [],
        total: 0,
        limit,
        offset,
        hasMore: false,
        filterOptions: {
          codigos: [],
          vendedores: [],
          periodos: [],
        },
      });
    }

    const photoColumnIndex = detectPhotoColumnIndex(headers);
    const parsedRows = dataRows
      .map((row, index) =>
        parseTransactionRow(row, headers, photoColumnIndex, index + 2),
      )
      .filter(
        (record) =>
          Boolean(record.clientName) ||
          Boolean(record.email) ||
          record.venta > 0,
      );

    const filteredRows = applyTransactionFilters(parsedRows, filters);
    const sortedRows = sortTransactionsDescending(filteredRows);
    const filterOptions = getFilterOptions(parsedRows);

    const total = sortedRows.length;
    const pagedItems = sortedRows.slice(offset, offset + limit);

    console.log("📊 Transacciones API:", {
      requestedBy: sessionEmail,
      totalRows: dataRows.length,
      parsedRows: parsedRows.length,
      filteredRows: filteredRows.length,
      returnedRows: pagedItems.length,
      limit,
      offset,
      filters,
    });

    return NextResponse.json({
      items: pagedItems,
      total,
      limit,
      offset,
      hasMore: offset + pagedItems.length < total,
      filterOptions,
    });
  } catch (error) {
    console.error("Error in /api/transacciones GET:", error);

    return NextResponse.json(
      {
        error: "No se pudieron obtener las transacciones.",
      },
      { status: 500 },
    );
  }
}
