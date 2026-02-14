import { google } from "googleapis";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isMasterAccount } from "@/utils/auth";
import { sheetsAuth } from "@/utils/googleAuth";

const SPREADSHEET_ID = "1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g";
const SHEET_NAME = "FeedReviews";

const getOwnerEmail = (saleId: string): string => {
  return (saleId || "").split("|")[0]?.trim().toLowerCase() || "";
};

const parseSeenBy = (value?: string): Set<string> => {
  if (!value) return new Set();
  return new Set(
    value
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
};

export async function GET() {
  try {
    const session = await auth();
    const email = session?.user?.email?.toLowerCase().trim() || "";

    if (!email) {
      return NextResponse.json({ count: 0 });
    }

    const isAdmin = isMasterAccount(email);
    const sheets = google.sheets({ version: "v4", auth: sheetsAuth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:E`,
    });

    const rows = response.data.values || [];
    const dataRows =
      rows.length > 0 && rows[0][0] === "saleId" ? rows.slice(1) : rows;

    let count = 0;

    for (const row of dataRows) {
      const saleId = row[0] || "";
      const note = (row[3] || "").trim();
      const seenBy = row[4] || "";

      if (!saleId || !note) continue;

      const ownerEmail = getOwnerEmail(saleId);
      if (!ownerEmail) continue;
      if (!isAdmin && ownerEmail !== email) continue;

      const seenSet = parseSeenBy(seenBy);
      if (!seenSet.has(email)) {
        count += 1;
      }
    }

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Error fetching buzon unseen count:", error);
    return NextResponse.json(
      { error: "Failed to fetch unseen count" },
      { status: 500 },
    );
  }
}
