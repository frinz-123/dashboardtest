import { google } from "googleapis";
import webPush from "web-push";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { sheetsAuth } from "@/utils/googleAuth";
import { EMAIL_TO_VENDOR_LABELS, isMasterAccount } from "@/utils/auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const SPREADSHEET_ID = "1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g";
const SHEET_GID = "1368603165";
const SHEET_NAME = "FeedReviews";
const REVIEW_HEADERS = ["saleId", "reviewedAt", "reviewedBy", "note", "seenBy"];
const SUBSCRIPTIONS_SHEET_NAME = "PushSubscriptions";

type PushSubscriptionRow = {
    email: string;
    endpoint: string;
    p256dh: string;
    auth: string;
};

const getVapidConfig = () => {
    const publicKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
        process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;

    if (!publicKey || !privateKey || !subject) {
        return null;
    }

    return { publicKey, privateKey, subject };
};

const getOwnerEmail = (saleId: string): string => {
    return (saleId || "").split("|")[0]?.trim().toLowerCase() || "";
};

const fetchPushSubscriptions = async (
    sheets: ReturnType<typeof google.sheets>,
    email: string,
): Promise<PushSubscriptionRow[]> => {
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SUBSCRIPTIONS_SHEET_NAME}!A:F`,
    });

    const rows = response.data.values || [];
    const hasHeader = rows.length > 0 && rows[0][0] === "email";
    const dataRows = hasHeader ? rows.slice(1) : rows;

    return dataRows
        .filter((row) => (row[0] || "").toLowerCase().trim() === email)
        .map((row) => ({
            email: row[0] || "",
            endpoint: row[1] || "",
            p256dh: row[2] || "",
            auth: row[3] || "",
        }))
        .filter((row) => row.endpoint && row.p256dh && row.auth);
};

const clearPushSubscription = async (
    sheets: ReturnType<typeof google.sheets>,
    endpoint: string,
) => {
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SUBSCRIPTIONS_SHEET_NAME}!A:F`,
    });

    const rows = response.data.values || [];
    const hasHeader = rows.length > 0 && rows[0][0] === "email";
    const dataRows = hasHeader ? rows.slice(1) : rows;
    const rowIndex = dataRows.findIndex((row) => row[1] === endpoint);

    if (rowIndex === -1) return;

    const sheetRow = rowIndex + (hasHeader ? 2 : 1);
    await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SUBSCRIPTIONS_SHEET_NAME}!A${sheetRow}:F${sheetRow}`,
    });
};

const sendReviewPushNotification = async (
    sheets: ReturnType<typeof google.sheets>,
    saleId: string,
    reviewedBy: string,
): Promise<void> => {
    const ownerEmail = getOwnerEmail(saleId);
    if (!ownerEmail) return;

    const vapidConfig = getVapidConfig();
    if (!vapidConfig) {
        console.warn("VAPID keys missing - skipping push notification.");
        return;
    }

    const subscriptions = await fetchPushSubscriptions(sheets, ownerEmail);
    if (subscriptions.length === 0) return;

    webPush.setVapidDetails(
        vapidConfig.subject,
        vapidConfig.publicKey,
        vapidConfig.privateKey,
    );

    const reviewerKey = reviewedBy.toLowerCase().trim();
    const reviewerLabel = EMAIL_TO_VENDOR_LABELS[reviewerKey] ||
        reviewedBy.split("@")[0];
    const payload = JSON.stringify({
        title: "Nuevo comentario",
        body: `Tienes un comentario de ${reviewerLabel}`,
        data: {
            url: "/buzon",
        },
    });

    await Promise.all(
        subscriptions.map(async (subscription) => {
            try {
                await webPush.sendNotification(
                    {
                        endpoint: subscription.endpoint,
                        keys: {
                            p256dh: subscription.p256dh,
                            auth: subscription.auth,
                        },
                    },
                    payload,
                );
            } catch (error: any) {
                const statusCode = error?.statusCode || error?.status;
                if (statusCode === 404 || statusCode === 410) {
                    await clearPushSubscription(sheets, subscription.endpoint);
                }
            }
        }),
    );
};

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

        if (noteText) {
            sendReviewPushNotification(sheets, saleId, reviewedBy).catch(
                (error) => {
                    console.error("Error sending push notification:", error);
                },
            );
        }

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
