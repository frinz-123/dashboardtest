import { createHash } from "crypto";
import { google } from "googleapis";
import { NextResponse } from "next/server";
import { Readable } from "stream";
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

  let stage = "init";
  try {
    stage = "formData";
    const formData = await req.formData();
    const file = formData.get("file");
    const submissionId = (
      formData.get("submissionId") || "submission"
    ).toString();
    const photoId = (formData.get("photoId") || "photo").toString();

    // Check if file is a valid Blob-like object (File extends Blob)
    // We can't use `instanceof File` because File is not defined in Node.js runtime
    if (
      !file ||
      typeof file !== "object" ||
      typeof (file as Blob).arrayBuffer !== "function"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Archivo no valido",
        },
        { status: 400 },
      );
    }

    stage = "buffer";
    const blob = file as Blob;
    const mimeType = blob.type || "application/octet-stream";
    const extension = mimeType.includes("png") ? "png" : "jpg";
    const filename = `cley-${submissionId}-${photoId}.${extension}`;

    const buffer = Buffer.from(await blob.arrayBuffer());
    const photoHash = createHash("sha256").update(buffer).digest("hex");

    stage = "driveInit";
    const drive = google.drive({ version: "v3", auth: driveAuth });

    stage = "checkDuplicate";
    const existing = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and appProperties has { key='photoHash' and value='${photoHash}' }`,
      fields: "files(id, name, appProperties, webViewLink, webContentLink)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 1,
    });
    const existingFile = existing.data.files?.[0];
    if (existingFile?.id) {
      const appProps = existingFile.appProperties || {};
      const expectedName = `cley-${submissionId}-${photoId}.${extension}`;
      const isSameSubmission =
        (appProps.submissionId === submissionId &&
          appProps.photoId === photoId) ||
        existingFile.name === expectedName;

      if (isSameSubmission) {
        let existingUrl =
          existingFile.webViewLink || existingFile.webContentLink;

        if (!existingUrl) {
          await drive.permissions.create({
            fileId: existingFile.id,
            requestBody: {
              role: "reader",
              type: "anyone",
            },
            supportsAllDrives: true,
          });
          const fileResponse = await drive.files.get({
            fileId: existingFile.id,
            fields: "webViewLink, webContentLink",
            supportsAllDrives: true,
          });
          existingUrl =
            fileResponse.data.webViewLink || fileResponse.data.webContentLink;
        }

        if (existingUrl) {
          return NextResponse.json({
            success: true,
            url: existingUrl,
            fileId: existingFile.id,
            duplicate: true,
          });
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: "Foto duplicada. Toma una nueva.",
          duplicate: true,
        },
        { status: 409 },
      );
    }

    stage = "upload";
    const createResponse = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
        appProperties: {
          photoHash,
          submissionId,
          photoId,
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

    stage = "permissions";
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
      supportsAllDrives: true,
    });

    stage = "getLink";
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
  } catch (error: unknown) {
    console.error("Drive upload error at stage:", stage, error);

    // Extract error details from various error formats
    let errorMessage = "Unknown error";
    let errorCode = "";

    if (error instanceof Error) {
      errorMessage = error.message;
      // Google API errors often have additional properties
      const gError = error as Error & {
        code?: number | string;
        errors?: Array<{ message: string; reason: string }>;
      };
      if (gError.code) errorCode = String(gError.code);
      if (gError.errors?.[0]) {
        errorMessage = `${gError.errors[0].reason}: ${gError.errors[0].message}`;
      }
    } else if (typeof error === "object" && error !== null) {
      errorMessage = JSON.stringify(error);
    }

    console.error("Error details:", { stage, errorMessage, errorCode });

    // Temporarily return details in production for debugging
    return NextResponse.json(
      {
        success: false,
        error: `Error en ${stage}: ${errorMessage}`,
        stage,
        code: errorCode,
      },
      { status: 500 },
    );
  }
}
