import { google } from "googleapis";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { sheetsAuth } from "@/utils/googleAuth";

const SPREADSHEET_ID = "1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g";
const SHEET_NAME = "PushSubscriptions";
const SUBSCRIPTION_HEADERS = [
  "email",
  "endpoint",
  "p256dh",
  "auth",
  "createdAt",
  "updatedAt",
];

const ensureHeaderRow = async (
  sheets: ReturnType<typeof google.sheets>,
) => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1:F1`,
  });

  const headerRow = response.data.values?.[0] || [];

  if (headerRow.length === 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:F`,
      valueInputOption: "RAW",
      requestBody: {
        values: [SUBSCRIPTION_HEADERS],
      },
    });
    return;
  }

  if (headerRow[0] !== "email" || headerRow.length < SUBSCRIPTION_HEADERS.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:F1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [SUBSCRIPTION_HEADERS],
      },
    });
  }
};

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const subscription = body?.subscription;
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: "Invalid subscription" },
        { status: 400 },
      );
    }

    const sheets = google.sheets({ version: "v4", auth: sheetsAuth });
    await ensureHeaderRow(sheets);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:F`,
    });

    const rows = response.data.values || [];
    const hasHeader = rows.length > 0 && rows[0][0] === "email";
    const dataRows = hasHeader ? rows.slice(1) : rows;
    const existingIndex = dataRows.findIndex((row) => row[1] === endpoint);

    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      const sheetRow = existingIndex + (hasHeader ? 2 : 1);
      const createdAt = dataRows[existingIndex][4] || now;

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A${sheetRow}:F${sheetRow}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[email, endpoint, p256dh, auth, createdAt, now]],
        },
      });

      return NextResponse.json({ success: true, updated: true });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:F`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[email, endpoint, p256dh, auth, now, now]],
      },
    });

    return NextResponse.json({ success: true, updated: false });
  } catch (error) {
    console.error("Error saving push subscription:", error);
    return NextResponse.json(
      { error: "Failed to save subscription" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const endpoint = body?.endpoint;

    if (!endpoint) {
      return NextResponse.json(
        { error: "Endpoint is required" },
        { status: 400 },
      );
    }

    const sheets = google.sheets({ version: "v4", auth: sheetsAuth });
    await ensureHeaderRow(sheets);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:F`,
    });

    const rows = response.data.values || [];
    const hasHeader = rows.length > 0 && rows[0][0] === "email";
    const dataRows = hasHeader ? rows.slice(1) : rows;
    const rowIndex = dataRows.findIndex((row) => row[1] === endpoint);

    if (rowIndex === -1) {
      return NextResponse.json({ success: true, removed: false });
    }

    const sheetRow = rowIndex + (hasHeader ? 2 : 1);
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A${sheetRow}:F${sheetRow}`,
    });

    return NextResponse.json({ success: true, removed: true });
  } catch (error) {
    console.error("Error removing push subscription:", error);
    return NextResponse.json(
      { error: "Failed to remove subscription" },
      { status: 500 },
    );
  }
}
