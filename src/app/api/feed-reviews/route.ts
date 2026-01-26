import { google } from "googleapis";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { sheetsAuth } from "@/utils/googleAuth";
import { isMasterAccount } from "@/utils/auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const SPREADSHEET_ID = "1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g";
const SHEET_GID = "1368603165";
const SHEET_NAME = "FeedReviews";
const REVIEW_HEADERS = ["saleId", "reviewedAt", "reviewedBy", "note", "seenBy"];

const ensureHeaderRow = async (
    sheets: ReturnType<typeof google.sheets>,
) => {
    const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:E1`,
    });

    const headerRow = headerResponse.data.values?.[0] || [];
    if (headerRow.length === 0) {
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:E`,
            valueInputOption: "RAW",
            requestBody: {
                values: [REVIEW_HEADERS],
            },
        });
        return;
    }

    if (headerRow[0] === "saleId" && headerRow[4] !== "seenBy") {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A1:E1`,
            valueInputOption: "RAW",
            requestBody: {
                values: [REVIEW_HEADERS],
            },
        });
    }
};

// GET - Fetch all reviews
export async function GET() {
    try {
        const sheets = google.sheets({ version: "v4", auth: sheetsAuth });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:E`,
        });

        const rows = response.data.values || [];

        // Skip header row if exists, otherwise assume no header
        const dataRows = rows.length > 0 && rows[0][0] === "saleId" ? rows.slice(1) : rows;

        const reviews = dataRows.map((row) => ({
            saleId: row[0] || "",
            reviewedAt: row[1] || "",
            reviewedBy: row[2] || "",
            note: row[3] || "",
            seenBy: row[4] || "",
        }));

        return NextResponse.json({ reviews });
    } catch (error) {
        console.error("Error fetching feed reviews:", error);
        return NextResponse.json(
            { error: "Failed to fetch reviews" },
            { status: 500 }
        );
    }
}

// POST - Add a new review
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { saleId, reviewedBy, note } = body;
        const noteText = (note || "").trim();

        if (!saleId || !reviewedBy) {
            return NextResponse.json(
                { error: "saleId and reviewedBy are required" },
                { status: 400 }
            );
        }

        const sheets = google.sheets({ version: "v4", auth: sheetsAuth });

        await ensureHeaderRow(sheets);

        const reviewedAt = new Date().toISOString();

        // Append the new review
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:E`,
            valueInputOption: "RAW",
            requestBody: {
                values: [[saleId, reviewedAt, reviewedBy, noteText, ""]],
            },
        });

        return NextResponse.json({
            success: true,
            review: {
                saleId,
                reviewedAt,
                reviewedBy,
                note: noteText,
                seenBy: "",
            },
        });
    } catch (error) {
        console.error("Error saving feed review:", error);
        return NextResponse.json(
            { error: "Failed to save review" },
            { status: 500 }
        );
    }
}

// PATCH - Update seenBy
export async function PATCH(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        const sessionEmail = session?.user?.email?.toLowerCase().trim() || "";

        if (!sessionEmail) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { saleId, reviewedAt, seenBy } = body;

        if (!saleId || !reviewedAt) {
            return NextResponse.json(
                { error: "saleId and reviewedAt are required" },
                { status: 400 }
            );
        }

        if (seenBy && seenBy.toLowerCase().trim() !== sessionEmail) {
            const isAdmin = isMasterAccount(sessionEmail);
            if (!isAdmin) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        const sheets = google.sheets({ version: "v4", auth: sheetsAuth });
        await ensureHeaderRow(sheets);

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:E`,
        });

        const rows = response.data.values || [];
        const hasHeader = rows.length > 0 && rows[0][0] === "saleId";
        const dataRows = hasHeader ? rows.slice(1) : rows;
        const rowIndex = dataRows.findIndex(
            (row) => row[0] === saleId && row[1] === reviewedAt,
        );

        if (rowIndex === -1) {
            return NextResponse.json(
                { error: "Review not found" },
                { status: 404 }
            );
        }

        const sheetRowNumber = rowIndex + (hasHeader ? 2 : 1);
        const existingSeenBy = dataRows[rowIndex][4] || "";
        const seenByList = existingSeenBy
            .split(",")
            .map((entry: string) => entry.trim())
            .filter(Boolean);

        if (!seenByList.includes(sessionEmail)) {
            seenByList.push(sessionEmail);
        }

        const updatedSeenBy = seenByList.join(", ");

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!E${sheetRowNumber}`,
            valueInputOption: "RAW",
            requestBody: {
                values: [[updatedSeenBy]],
            },
        });

        return NextResponse.json({
            success: true,
            saleId,
            seenBy: updatedSeenBy,
        });
    } catch (error) {
        console.error("Error updating seenBy:", error);
        return NextResponse.json(
            { error: "Failed to update seenBy" },
            { status: 500 }
        );
    }
}
