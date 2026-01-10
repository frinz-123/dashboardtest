import { Readable } from "stream";
import { createHash } from "crypto";
import { google } from "googleapis";
import { NextResponse } from "next/server";
import { driveAuth } from "@/utils/googleAuth";

// Force Node.js runtime (not Edge) for stream and crypto compatibility
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

export async function POST(req: Request) {
    if (!folderId) {
        console.error("Missing GOOGLE_DRIVE_FOLDER_ID");
        return NextResponse.json(
            {
                success: false,
                error: "Falta configurar GOOGLE_DRIVE_FOLDER_ID",
            },
            { status: 500 },
        );
    }

    // Verify auth is available
    if (!driveAuth) {
        console.error("Drive auth not configured");
        return NextResponse.json(
            {
                success: false,
                error: "Drive authentication not configured",
            },
            { status: 500 },
        );
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file");
        const submissionId = (
            formData.get("submissionId") || "submission"
        ).toString();
        const photoId = (formData.get("photoId") || "photo").toString();

        if (!(file instanceof File)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Archivo no valido",
                },
                { status: 400 },
            );
        }

        const mimeType = file.type || "application/octet-stream";
        const extension = mimeType.includes("png") ? "png" : "jpg";
        const filename = `cley-${submissionId}-${photoId}.${extension}`;

        const buffer = Buffer.from(await file.arrayBuffer());
        const photoHash = createHash("sha256").update(buffer).digest("hex");
        const drive = google.drive({ version: "v3", auth: driveAuth });

        const existing = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false and appProperties has { key='photoHash' and value='${photoHash}' }`,
            fields: "files(id, name)",
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            pageSize: 1,
        });

        if (existing.data.files && existing.data.files.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Foto duplicada. Toma una nueva.",
                    duplicate: true,
                },
                { status: 409 },
            );
        }

        const createResponse = await drive.files.create({
            requestBody: {
                name: filename,
                parents: [folderId],
                appProperties: {
                    photoHash,
                },
            },
            media: {
                mimeType,
                body: Readable.from(buffer),
            },
            fields: "id",
            supportsAllDrives: true,
        });

        const fileId = createResponse.data.id;
        if (!fileId) {
            return NextResponse.json(
                { success: false, error: "No se pudo crear el archivo" },
                { status: 500 },
            );
        }

        await drive.permissions.create({
            fileId,
            requestBody: {
                role: "reader",
                type: "anyone",
            },
            supportsAllDrives: true,
        });

        const fileResponse = await drive.files.get({
            fileId,
            fields: "webViewLink, webContentLink",
            supportsAllDrives: true,
        });

        const url =
            fileResponse.data.webViewLink || fileResponse.data.webContentLink;

        if (!url) {
            return NextResponse.json(
                { success: false, error: "No se pudo obtener el enlace" },
                { status: 500 },
            );
        }

        return NextResponse.json({ success: true, url, fileId });
    } catch (error) {
        console.error("Drive upload error:", error);
        const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error("Error details:", { errorMessage, errorStack });

        // Return more detailed error info in development, generic in production
        const isDev = process.env.NODE_ENV === "development";
        return NextResponse.json(
            {
                success: false,
                error: isDev
                    ? `Upload failed: ${errorMessage}`
                    : "No se pudo subir la foto",
                ...(isDev && { details: errorMessage }),
            },
            { status: 500 },
        );
    }
}
