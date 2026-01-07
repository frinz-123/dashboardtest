import { google } from "googleapis";
import { NextResponse } from "next/server";
import { sheetsAuth } from "@/utils/googleAuth";

const SPREADSHEET_ID = "1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g";
const SHEET_GID = "1368603165";
const SHEET_NAME = "FeedReviews";

// GET - Fetch all reviews
export async function GET() {
    try {
        const sheets = google.sheets({ version: "v4", auth: sheetsAuth });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:D`,
        });

        const rows = response.data.values || [];

        // Skip header row if exists, otherwise assume no header
        const dataRows = rows.length > 0 && rows[0][0] === "saleId" ? rows.slice(1) : rows;

        const reviews = dataRows.map((row) => ({
            saleId: row[0] || "",
            reviewedAt: row[1] || "",
            reviewedBy: row[2] || "",
            note: row[3] || "",
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

        if (!saleId || !reviewedBy) {
            return NextResponse.json(
                { error: "saleId and reviewedBy are required" },
                { status: 400 }
            );
        }

        const sheets = google.sheets({ version: "v4", auth: sheetsAuth });

        // Check if header row exists, if not create it
        const existingData = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A1:D1`,
        });

        if (!existingData.data.values || existingData.data.values.length === 0) {
            // Add header row
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_NAME}!A:D`,
                valueInputOption: "RAW",
                requestBody: {
                    values: [["saleId", "reviewedAt", "reviewedBy", "note"]],
                },
            });
        }

        const reviewedAt = new Date().toISOString();

        // Append the new review
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:D`,
            valueInputOption: "RAW",
            requestBody: {
                values: [[saleId, reviewedAt, reviewedBy, note || ""]],
            },
        });

        return NextResponse.json({
            success: true,
            review: {
                saleId,
                reviewedAt,
                reviewedBy,
                note: note || "",
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
