import { createHash } from "node:crypto";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

// Force Node.js runtime (not Edge) for stream and crypto compatibility
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const r2BucketName = process.env.R2_BUCKET;
const r2PublicBaseUrl = process.env.R2_PUBLIC_BASE_URL;

const r2Client =
  r2AccountId && r2AccessKeyId && r2SecretAccessKey
    ? new S3Client({
        region: "auto",
        endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: r2AccessKeyId,
          secretAccessKey: r2SecretAccessKey,
        },
      })
    : null;

const getPublicUrl = (key: string): string => {
  if (!r2PublicBaseUrl) return key;
  const base = r2PublicBaseUrl.endsWith("/")
    ? r2PublicBaseUrl.slice(0, -1)
    : r2PublicBaseUrl;
  return `${base}/${key}`;
};

export async function POST(req: Request) {
  const missingEnv = [
    !r2AccountId && "R2_ACCOUNT_ID",
    !r2AccessKeyId && "R2_ACCESS_KEY_ID",
    !r2SecretAccessKey && "R2_SECRET_ACCESS_KEY",
    !r2BucketName && "R2_BUCKET",
    !r2PublicBaseUrl && "R2_PUBLIC_BASE_URL",
  ].filter(Boolean) as string[];

  if (missingEnv.length > 0 || !r2Client || !r2BucketName || !r2PublicBaseUrl) {
    console.error("R2 env not configured", { missingEnv });
    return NextResponse.json(
      {
        success: false,
        error: `Falta configurar: ${missingEnv.join(", ")}`,
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
    const buffer = Buffer.from(await blob.arrayBuffer());
    const photoHash = createHash("sha256").update(buffer).digest("hex");
    const objectKey = `photos/${photoHash}.${extension}`;

    stage = "checkDuplicate";
    let existingMetadata: Record<string, string> | undefined;
    try {
      const head = await r2Client.send(
        new HeadObjectCommand({
          Bucket: r2BucketName,
          Key: objectKey,
        }),
      );
      existingMetadata = head.Metadata;
    } catch (error: unknown) {
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } })
        ?.$metadata?.httpStatusCode;
      const name = (error as { name?: string })?.name;
      if (statusCode !== 404 && name !== "NotFound") {
        throw error;
      }
    }

    if (existingMetadata) {
      const isSameSubmission =
        existingMetadata.submissionid === submissionId &&
        existingMetadata.photoid === photoId;

      if (isSameSubmission) {
        return NextResponse.json({
          success: true,
          url: getPublicUrl(objectKey),
          duplicate: true,
        });
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
    await r2Client.send(
      new PutObjectCommand({
        Bucket: r2BucketName,
        Key: objectKey,
        Body: buffer,
        ContentType: mimeType,
        Metadata: {
          submissionid: submissionId,
          photoid: photoId,
          photohash: photoHash,
        },
      }),
    );

    return NextResponse.json({ success: true, url: getPublicUrl(objectKey) });
  } catch (error: unknown) {
    console.error("R2 upload error at stage:", stage, error);

    // Extract error details from various error formats
    let errorMessage = "Unknown error";
    let errorCode = "";

    if (error instanceof Error) {
      errorMessage = error.message;
      const r2Error = error as Error & {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (r2Error.$metadata?.httpStatusCode) {
        errorCode = String(r2Error.$metadata.httpStatusCode);
      }
      if (r2Error.name) {
        errorMessage = `${r2Error.name}: ${errorMessage}`;
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
