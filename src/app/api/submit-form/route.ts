import { google } from "googleapis";
import { after, NextResponse } from "next/server";
import { getCurrentPeriodInfo } from "@/utils/dateUtils";
import {
  isFormAdminEmail,
  isPhotoRequiredClientCode,
  PHOTO_MIN_REQUIRED,
  parseBooleanLike,
} from "@/utils/formSubmission";
import { sheetsAuth } from "@/utils/googleAuth";
import {
  FORM_DATA_LAST_COLUMN,
  FORM_DATA_LAST_COLUMN_INDEX,
  PRODUCT_COLUMN_ENTRIES,
} from "@/utils/productCatalog";
import {
  appendSubmissionStatusEntry,
  decideSubmissionLedgerAction,
  ensureSubmissionStatusHeader,
  findFormSubmissionMatch,
  getLatestSubmissionStatusEntry,
} from "@/utils/submissionStatusLedger";

const spreadsheetId = "1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g";

// Location validation constants
const MAX_LOCATION_ACCURACY = 100; // meters - reject if GPS accuracy is worse than this
const MAX_CLIENT_DISTANCE = 450; // meters - maximum allowed distance to client

// Helper function to check if user is an admin with override permissions
function isOverrideEmail(email: string | null | undefined): boolean {
  return isFormAdminEmail(email);
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function normalizePhotoUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((url) => String(url)).filter((url) => url.trim());
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((url) => String(url)).filter((url) => url.trim());
      }
    } catch {
      // Fallback to comma-separated string.
    }
    return trimmed
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean);
  }

  return [];
}

export async function POST(req: Request) {
  const startTime = Date.now();
  let submissionId: string | undefined;
  let ledgerAttemptCount = 1;

  try {
    const body = await req.json();
    const {
      clientName,
      products,
      total,
      location,
      queuedAt,
      clientCode,
      userEmail,
      cleyOrderValue,
      actorEmail,
      isAdminOverride,
      overrideTargetEmail,
      submissionId: clientSubmissionId,
      attemptNumber,
      date: overrideDateString,
      overridePeriod,
      overrideMonthCode,
      photoUrls: rawPhotoUrls,
      skipRequiredPhotos: rawSkipRequiredPhotos,
      allowDuplicatePhotos: rawAllowDuplicatePhotos,
    } = body;

    submissionId =
      typeof clientSubmissionId === "string" && clientSubmissionId.trim()
        ? clientSubmissionId.trim()
        : undefined;
    if (!submissionId) {
      return NextResponse.json(
        {
          success: false,
          error: "submissionId requerido.",
        },
        { status: 400 },
      );
    }
    const resolvedSubmissionId = submissionId;
    const photoUrls = normalizePhotoUrls(rawPhotoUrls);

    const adminEmailForValidation = actorEmail ?? userEmail ?? null;
    const isAdmin = isOverrideEmail(adminEmailForValidation);
    const skipRequiredPhotosRequested = parseBooleanLike(rawSkipRequiredPhotos);
    const allowDuplicatePhotosRequested = parseBooleanLike(
      rawAllowDuplicatePhotos,
    );
    const skipRequiredPhotos = isAdmin && skipRequiredPhotosRequested;
    const allowDuplicatePhotos = isAdmin && allowDuplicatePhotosRequested;
    const hasOverrideDateInput =
      typeof overrideDateString === "string" &&
      overrideDateString.trim().length > 0;
    const hasAnyOverrideRequest = Boolean(
      isAdminOverride ||
        overrideTargetEmail ||
        hasOverrideDateInput ||
        (typeof overridePeriod === "string" && overridePeriod.trim()) ||
        (typeof overrideMonthCode === "string" && overrideMonthCode.trim()) ||
        skipRequiredPhotosRequested ||
        allowDuplicatePhotosRequested,
    );

    const locationAge = location?.timestamp
      ? Date.now() - location.timestamp
      : null;
    const queuedAge =
      typeof queuedAt === "number" ? Date.now() - queuedAt : null;
    const isQueuedSubmission = typeof queuedAt === "number";
    const normalizedAttemptNumber =
      typeof attemptNumber === "number" && Number.isFinite(attemptNumber)
        ? Math.max(1, Math.trunc(attemptNumber))
        : 1;

    // Queued submissions already passed client-side checks (button gating),
    // so skip all location validations on the server for queued attempts.
    const shouldBypassLocationChecks = !isAdmin && isQueuedSubmission;
    const sheets = google.sheets({ version: "v4", auth: sheetsAuth });

    const writeLedgerStatus = async (
      status:
        | "processing"
        | "submitted"
        | "retryable_failed"
        | "permanent_failed",
      options?: {
        leaseExpiresAt?: string | null;
        lastError?: string | null;
        formRowRef?: string | null;
      },
    ) => {
      await appendSubmissionStatusEntry(sheets, spreadsheetId, {
        submissionId: resolvedSubmissionId,
        status,
        leaseExpiresAt: options?.leaseExpiresAt ?? null,
        updatedAt: new Date().toISOString(),
        attemptCount: ledgerAttemptCount,
        lastError: options?.lastError ?? null,
        formRowRef: options?.formRowRef ?? null,
      });
    };

    const buildSubmittedResponse = (
      options: {
        duplicate: boolean;
        formRowRef: string | null;
        message: string;
        data?: unknown;
      },
      processingTime = Date.now() - startTime,
    ) =>
      NextResponse.json({
        success: true,
        duplicate: options.duplicate,
        submissionState: "submitted",
        formRowRef: options.formRowRef,
        message: options.message,
        data: options.data,
        processingTime,
      });

    const buildInProgressResponse = () =>
      NextResponse.json(
        {
          success: false,
          code: "SUBMISSION_IN_PROGRESS",
          retryable: true,
          submissionState: "processing",
          error: "Este pedido sigue procesandose en el servidor.",
          submissionId: resolvedSubmissionId,
          processingTime: Date.now() - startTime,
        },
        { status: 409 },
      );

    const respondPermanentFailure = async (
      message: string,
      statusCode = 400,
    ) => {
      try {
        await writeLedgerStatus("permanent_failed", {
          lastError: message,
        });
      } catch (ledgerError) {
        console.error(
          "❌ Failed to record permanent ledger state:",
          ledgerError,
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: message,
          retryable: false,
          submissionId: resolvedSubmissionId,
          processingTime: Date.now() - startTime,
        },
        { status: statusCode },
      );
    };

    const respondRetryableFailure = async (message: string) => {
      try {
        await writeLedgerStatus("retryable_failed", {
          lastError: message,
        });
      } catch (ledgerError) {
        console.error(
          "❌ Failed to record retryable ledger state:",
          ledgerError,
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: message,
          retryable: true,
          submissionState: "unknown",
          submissionId: resolvedSubmissionId,
          processingTime: Date.now() - startTime,
        },
        { status: 500 },
      );
    };

    await ensureSubmissionStatusHeader(sheets, spreadsheetId);
    const initialFormMatch = await findFormSubmissionMatch(
      sheets,
      spreadsheetId,
      resolvedSubmissionId,
    );
    const latestLedgerEntry = await getLatestSubmissionStatusEntry(
      sheets,
      spreadsheetId,
      resolvedSubmissionId,
    );
    const ledgerDecision = decideSubmissionLedgerAction({
      formMatch: initialFormMatch,
      latestEntry: latestLedgerEntry,
      clientAttemptNumber: normalizedAttemptNumber,
    });

    if (ledgerDecision.type === "duplicate-submitted") {
      ledgerAttemptCount = ledgerDecision.attemptCount;
      try {
        await writeLedgerStatus("submitted", {
          formRowRef: ledgerDecision.formRowRef,
        });
      } catch (ledgerError) {
        console.error(
          "❌ Failed to confirm submitted ledger state:",
          ledgerError,
        );
      }

      return buildSubmittedResponse({
        duplicate: true,
        formRowRef: ledgerDecision.formRowRef,
        message: "Pedido ya procesado (sheet duplicate)",
      });
    }

    if (ledgerDecision.type === "in-progress") {
      return buildInProgressResponse();
    }

    if (ledgerDecision.type === "permanent-failed") {
      ledgerAttemptCount =
        latestLedgerEntry?.attemptCount ?? normalizedAttemptNumber;
      return NextResponse.json(
        {
          success: false,
          error: ledgerDecision.error,
          retryable: false,
          submissionId: resolvedSubmissionId,
          processingTime: Date.now() - startTime,
        },
        { status: 400 },
      );
    }

    ledgerAttemptCount = ledgerDecision.attemptCount;
    await writeLedgerStatus("processing", {
      leaseExpiresAt: ledgerDecision.leaseExpiresAt,
    });

    // ✅ VALIDATION: Enhanced logging for email tracking
    console.log("🔍 FORM SUBMISSION RECEIVED:", {
      timestamp: new Date().toISOString(),
      submissionId: resolvedSubmissionId,
      attemptNumber: attemptNumber || 1,
      clientName,
      clientCode,
      userEmail,
      userEmailType: typeof userEmail,
      actorEmail,
      actorEmailType: typeof actorEmail,
      adminEmailForValidation,
      adminEmailIsOverride: isAdmin,
      isAdminOverrideRequested: !!isAdminOverride,
      overrideTargetEmail,
      requestHeaders: {
        "user-agent": req.headers.get("user-agent"),
        referer: req.headers.get("referer"),
      },
      cleyOrderValue,
      cleyOrderValueType: typeof cleyOrderValue,
      photoUrlCount: photoUrls.length,
      skipRequiredPhotosRequested,
      skipRequiredPhotosEffective: skipRequiredPhotos,
      allowDuplicatePhotosRequested,
      allowDuplicatePhotosEffective: allowDuplicatePhotos,
      totalProducts: Object.keys(products).length,
      hasLocation: !!location,
      locationAccuracy: location?.accuracy,
      locationTimestamp: location?.timestamp,
      locationAgeMs: locationAge,
      locationAgeSeconds:
        locationAge !== null ? Number((locationAge / 1000).toFixed(1)) : null,
      queuedAt,
      queuedAgeMs: queuedAge,
      queuedAgeSeconds:
        queuedAge !== null ? Number((queuedAge / 1000).toFixed(1)) : null,
      isAdminOverrideEffective: isAdmin,
      isQueuedSubmission,
      normalizedAttemptNumber,
      shouldBypassLocationChecks,
      hasOverrideDateInput,
      hasAnyOverrideRequest,
    });

    if (hasAnyOverrideRequest && !isAdmin) {
      console.warn(
        "⚠️ OVERRIDE REQUEST IGNORED: request contains override fields but actor is not admin",
        {
          submissionId: resolvedSubmissionId,
          actorEmail,
          userEmail,
          overrideTargetEmail,
          hasOverrideDateInput,
          overridePeriod,
          overrideMonthCode,
          skipRequiredPhotosRequested,
          allowDuplicatePhotosRequested,
        },
      );
    }

    const normalizedClientCode =
      typeof clientCode === "string" ? clientCode.toUpperCase() : "";
    if (
      isPhotoRequiredClientCode(normalizedClientCode) &&
      !skipRequiredPhotos &&
      photoUrls.length < PHOTO_MIN_REQUIRED
    ) {
      return respondPermanentFailure(
        `Fotos requeridas (minimo ${PHOTO_MIN_REQUIRED}) para este cliente.`,
      );
    }

    // ✅ VALIDATION: Location validation
    if (!location || !location.lat || !location.lng) {
      console.error("❌ LOCATION VALIDATION FAILED: Missing location data", {
        location,
        timestamp: new Date().toISOString(),
      });
      return respondPermanentFailure(
        "Ubicación requerida. Por favor, asegúrate de que el GPS esté activado.",
      );
    }

    // Validate location accuracy (skip for admin override users)
    if (
      !isAdmin &&
      location.accuracy !== undefined &&
      location.accuracy > MAX_LOCATION_ACCURACY
    ) {
      if (shouldBypassLocationChecks) {
        console.log(
          "🛰️ QUEUED ORDER: Bypassing GPS accuracy check for queued submission",
          {
            accuracy: location.accuracy,
            maxAllowed: MAX_LOCATION_ACCURACY,
            queuedAge,
            clientName,
            userEmail,
            timestamp: new Date().toISOString(),
          },
        );
      } else {
        console.error("❌ LOCATION VALIDATION FAILED: Poor GPS accuracy", {
          accuracy: location.accuracy,
          maxAllowed: MAX_LOCATION_ACCURACY,
          timestamp: new Date().toISOString(),
          clientName,
          userEmail,
        });
        return respondPermanentFailure(
          `La precisión del GPS es insuficiente (±${Math.round(location.accuracy)}m). Por favor, espera unos segundos para obtener una mejor señal.`,
        );
      }
    }

    // Log if admin bypassed GPS accuracy check
    if (
      isAdmin &&
      location.accuracy !== undefined &&
      location.accuracy > MAX_LOCATION_ACCURACY
    ) {
      console.log("👤 ADMIN OVERRIDE: Bypassing GPS accuracy check", {
        accuracy: location.accuracy,
        maxAllowed: MAX_LOCATION_ACCURACY,
        userEmail,
        adminEmailForValidation,
        clientName,
        timestamp: new Date().toISOString(),
      });
    }

    // ✅ VALIDATION: Alert if email looks suspicious (deferred to after response)
    const suspiciousEmail = userEmail === "arturo.elreychiltepin@gmail.com";
    const suspiciousHeaders = suspiciousEmail
      ? {
          userAgent: req.headers.get("user-agent"),
          referer: req.headers.get("referer"),
        }
      : null;

    try {
      const [clientData, _currentData] = await Promise.all([
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: "Form_Data!A:C",
        }),
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: "Form_Data!A:A",
        }),
      ]);

      let clientLat = "";
      let clientLng = "";
      if (clientData.data.values) {
        const clientRow = clientData.data.values.find(
          (row) => row[0] === clientName,
        );
        if (clientRow) {
          clientLat = clientRow[1];
          clientLng = clientRow[2];
        }
      }

      // ✅ VALIDATION: Validate distance to client (if client location is available)
      if (clientLat && clientLng) {
        const clientLatNum = parseFloat(clientLat);
        const clientLngNum = parseFloat(clientLng);
        if (!Number.isNaN(clientLatNum) && !Number.isNaN(clientLngNum)) {
          const distanceToClient = calculateDistance(
            location.lat,
            location.lng,
            clientLatNum,
            clientLngNum,
          );

          console.log("📍 DISTANCE VALIDATION:", {
            distance: distanceToClient,
            maxAllowed: MAX_CLIENT_DISTANCE,
            clientLocation: {
              lat: clientLatNum,
              lng: clientLngNum,
            },
            userLocation: { lat: location.lat, lng: location.lng },
            timestamp: new Date().toISOString(),
          });

          // Validate distance to client (skip for admin override users)
          if (!isAdmin && distanceToClient > MAX_CLIENT_DISTANCE) {
            if (shouldBypassLocationChecks) {
              console.log(
                "🛰️ QUEUED ORDER: Bypassing distance validation for queued submission",
                {
                  distance: distanceToClient,
                  maxAllowed: MAX_CLIENT_DISTANCE,
                  clientName,
                  userEmail,
                  queuedAge,
                  timestamp: new Date().toISOString(),
                },
              );
            } else {
              console.error(
                "❌ LOCATION VALIDATION FAILED: Too far from client",
                {
                  distance: distanceToClient,
                  maxAllowed: MAX_CLIENT_DISTANCE,
                  clientName,
                  userEmail,
                  timestamp: new Date().toISOString(),
                },
              );
              return respondPermanentFailure(
                `Estás demasiado lejos del cliente (${Math.round(distanceToClient)}m). Por favor, acércate a la ubicación del cliente para continuar.`,
              );
            }
          }

          // Log if admin bypassed distance check
          if (isAdmin && distanceToClient > MAX_CLIENT_DISTANCE) {
            console.log("👤 ADMIN OVERRIDE: Bypassing distance validation", {
              distance: distanceToClient,
              maxAllowed: MAX_CLIENT_DISTANCE,
              userEmail,
              adminEmailForValidation,
              clientName,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      // Format current date/time using Mazatlan timezone (GMT-7)
      // 🔧 ADMIN OVERRIDE: Use override date if provided by admin user
      let submissionTimestamp: Date;
      if (isAdmin && hasOverrideDateInput) {
        const overrideDateValue = String(overrideDateString).trim();
        submissionTimestamp = new Date(overrideDateValue);
        console.log("📅 ADMIN DATE OVERRIDE: Using override date", {
          overrideDateString: overrideDateValue,
          parsedDate: submissionTimestamp.toISOString(),
          isValidDate: !Number.isNaN(submissionTimestamp.getTime()),
          adminEmail: adminEmailForValidation,
          timestamp: new Date().toISOString(),
        });

        // Validate the parsed date
        if (Number.isNaN(submissionTimestamp.getTime())) {
          console.warn(
            "⚠️ INVALID OVERRIDE DATE: Falling back to current time",
            {
              overrideDateString: overrideDateValue,
              adminEmail: adminEmailForValidation,
            },
          );
          submissionTimestamp = new Date();
        }
      } else {
        submissionTimestamp = new Date();
      }
      const MAZATLAN_TZ = "America/Mazatlan";

      const mazatlanParts = new Intl.DateTimeFormat("en-US", {
        timeZone: MAZATLAN_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZoneName: "short",
      }).formatToParts(submissionTimestamp);

      const getPart = (type: Intl.DateTimeFormatPartTypes) =>
        mazatlanParts.find((part) => part.type === type)?.value || "";

      const month = getPart("month") || "00";
      const day = getPart("day") || "00";
      const year = getPart("year") || "0000";
      const hour = getPart("hour") || "00";
      const minute = getPart("minute") || "00";
      const second = getPart("second") || "00";
      const timeZoneName = getPart("timeZoneName") || "GMT";

      const formattedDate = `${month}/${day}/${year}`;
      const formattedTime = `${hour}:${minute}:${second}`;

      const offsetMatch = timeZoneName.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
      const rawOffsetHours = offsetMatch ? parseInt(offsetMatch[1], 10) : 0;
      const offsetMinutes = offsetMatch?.[2] ? parseInt(offsetMatch[2], 10) : 0;
      const offsetSign = rawOffsetHours >= 0 ? "+" : "-";
      const absOffsetHours = Math.abs(rawOffsetHours);
      const isoOffset = `${offsetSign}${String(absOffsetHours).padStart(2, "0")}:${String(offsetMinutes).padStart(2, "0")}`;

      const isoDateTime = `${year}-${month}-${day}T${hour}:${minute}:${second}${isoOffset}`;
      const mazatlanDateForPeriod = new Date(isoDateTime);

      const periodSourceDate = Number.isNaN(mazatlanDateForPeriod.getTime())
        ? submissionTimestamp
        : mazatlanDateForPeriod;

      console.log("🕒 SUBMISSION TIMESTAMP VALIDATION:", {
        iso: submissionTimestamp.toISOString(),
        formattedDate,
        formattedTime,
        isoOffset,
        mazatlanDateForPeriod: periodSourceDate.toISOString(),
        targetColumn: "E",
        timeZone: MAZATLAN_TZ,
      });

      // Get current period and week for column AL (aligned to Mazatlan date)
      // 🔧 ADMIN OVERRIDE: Use override period if provided by admin user
      let periodWeekCode: string;
      if (isAdmin && overridePeriod && overridePeriod.trim()) {
        periodWeekCode = overridePeriod.trim();
        console.log("📅 ADMIN PERIOD OVERRIDE: Using override period", {
          overridePeriod,
          adminEmail: adminEmailForValidation,
          timestamp: new Date().toISOString(),
        });
      } else {
        const { periodNumber, weekInPeriod } =
          getCurrentPeriodInfo(periodSourceDate);
        periodWeekCode = `P${periodNumber}S${weekInPeriod}`;
      }

      // Generate Month_Year format (e.g., NOV_25) for column AO
      // 🔧 ADMIN OVERRIDE: Use override month code if provided by admin user
      let monthYearCode: string;
      if (isAdmin && overrideMonthCode && overrideMonthCode.trim()) {
        monthYearCode = overrideMonthCode.trim().toUpperCase();
        console.log("📅 ADMIN MONTH CODE OVERRIDE: Using override month code", {
          overrideMonthCode,
          adminEmail: adminEmailForValidation,
          timestamp: new Date().toISOString(),
        });
      } else {
        const monthYearFormatter = new Intl.DateTimeFormat("en-US", {
          timeZone: MAZATLAN_TZ,
          month: "short",
          year: "2-digit",
        });
        const myParts = monthYearFormatter.formatToParts(periodSourceDate);
        const mPart = myParts.find((p) => p.type === "month")?.value || "";
        const yPart = myParts.find((p) => p.type === "year")?.value || "";
        monthYearCode = `${mPart}_${yPart}`.toUpperCase().replace(".", "");
      }

      const photoLinksValue =
        photoUrls.length > 0 ? JSON.stringify(photoUrls) : "";

      const rowData = new Array(FORM_DATA_LAST_COLUMN_INDEX + 1).fill("");

      // Set the values according to the mapping
      rowData[0] = clientName; // Column A
      rowData[1] = clientLat; // Column B (Client's stored lat)
      rowData[2] = clientLng; // Column C (Client's stored lng)
      rowData[3] = ""; // Column D (Reserved/unused)
      rowData[4] = formattedTime; // Column E (Submission time)
      rowData[5] = location.lat.toString(); // Column F (Current lat)
      rowData[6] = location.lng.toString(); // Column G (Current lng)
      rowData[7] = userEmail; // Column H
      rowData[30] = resolvedSubmissionId; // Column AE - Idempotency key
      rowData[31] = clientCode; // Column AF
      rowData[32] = formattedDate; // Column AG
      rowData[33] = total.toString(); // Column AH
      rowData[37] = periodWeekCode; // Column AL

      // CLEY order value for Column AM (index 38)
      if (normalizedClientCode === "CLEY" && cleyOrderValue) {
        rowData[38] = cleyOrderValue === "1" ? "No" : "Si";
      } else {
        rowData[38] = "";
      }

      rowData[40] = monthYearCode; // Column AO
      rowData[41] = photoLinksValue; // Column AP

      PRODUCT_COLUMN_ENTRIES.forEach(({ index, name }) => {
        rowData[index] = products[name] || "";
      });

      console.log("Final row data:", {
        columnAL: rowData[37],
        columnAM: rowData[38],
        columnAE: rowData[30],
        columnH: rowData[7],
        columnAO: rowData[40],
        columnAP: rowData[41],
        fullArrayLength: rowData.length,
        isAdminEffective: isAdmin,
        actorEmail,
        userEmail,
        overrideTargetEmail,
        skipRequiredPhotos,
        allowDuplicatePhotos,
      });

      const preWriteFormMatch = await findFormSubmissionMatch(
        sheets,
        spreadsheetId,
        resolvedSubmissionId,
      );
      if (preWriteFormMatch) {
        console.log("🔄 PRE-WRITE SHEET DUPLICATE DETECTED:", {
          submissionId: resolvedSubmissionId,
          clientName,
          formRowRef: preWriteFormMatch.rowRef,
        });
        try {
          await writeLedgerStatus("submitted", {
            formRowRef: preWriteFormMatch.rowRef,
          });
        } catch (ledgerError) {
          console.error(
            "❌ Failed to confirm pre-write duplicate:",
            ledgerError,
          );
        }

        return buildSubmittedResponse({
          duplicate: true,
          formRowRef: preWriteFormMatch.rowRef,
          message: "Pedido ya procesado (sheet duplicate)",
        });
      }

      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `Form_Data!A:${FORM_DATA_LAST_COLUMN}`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [rowData],
        },
      });

      const processingTime = Date.now() - startTime;
      const formRowRef = response.data.updates?.updatedRange ?? null;
      await writeLedgerStatus("submitted", {
        formRowRef,
      });
      const successData = {
        success: true,
        duplicate: false,
        submissionState: "submitted",
        formRowRef,
        data: response.data,
        processingTime,
      };

      const jsonResponse = NextResponse.json(successData);
      after(async () => {
        console.log("✅ SUBMISSION SUCCESSFUL:", {
          submissionId: resolvedSubmissionId,
          clientName,
          processingTime,
          timestamp: new Date().toISOString(),
        });
        if (suspiciousEmail) {
          console.error(
            "🚨 SUSPICIOUS EMAIL DETECTED: Submission using arturo.elreychiltepin@gmail.com",
          );
          console.error("🚨 REQUEST DETAILS:", {
            ...suspiciousHeaders,
            timestamp: new Date().toISOString(),
            clientName,
          });
        }

        try {
          const verifyData = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Form_Data!AE:AE",
          });
          const allIds = verifyData.data.values || [];
          const matchingRows: number[] = [];
          for (let i = 0; i < allIds.length; i++) {
            if (
              typeof allIds[i][0] === "string" &&
              allIds[i][0].trim() === resolvedSubmissionId
            ) {
              matchingRows.push(i);
            }
          }

          if (matchingRows.length > 1) {
            console.warn(
              `⚠️ DUPLICATE ROWS DETECTED for ${resolvedSubmissionId}: ${matchingRows.length} rows at indices ${matchingRows.join(", ")}`,
            );
            const rowsToDelete = matchingRows.slice(1).reverse();

            const sheetMeta = await sheets.spreadsheets.get({
              spreadsheetId,
              fields: "sheets(properties(sheetId,title))",
            });
            const formDataSheet = sheetMeta.data.sheets?.find(
              (sheet) => sheet.properties?.title === "Form_Data",
            );
            if (formDataSheet?.properties?.sheetId == null) return;

            for (const rowIndex of rowsToDelete) {
              try {
                const cellCheck = await sheets.spreadsheets.values.get({
                  spreadsheetId,
                  range: `Form_Data!AE${rowIndex + 1}`,
                });
                const cellValue = cellCheck.data.values?.[0]?.[0];
                if (
                  typeof cellValue !== "string" ||
                  cellValue.trim() !== resolvedSubmissionId
                ) {
                  console.log(
                    `⏭️ Row ${rowIndex} no longer holds ${resolvedSubmissionId} (found "${cellValue}") — skipping`,
                  );
                  continue;
                }

                await sheets.spreadsheets.batchUpdate({
                  spreadsheetId,
                  requestBody: {
                    requests: [
                      {
                        deleteDimension: {
                          range: {
                            sheetId: formDataSheet.properties.sheetId,
                            dimension: "ROWS",
                            startIndex: rowIndex,
                            endIndex: rowIndex + 1,
                          },
                        },
                      },
                    ],
                  },
                });
                console.log(
                  `🗑️ DELETED duplicate row ${rowIndex} for ${resolvedSubmissionId}`,
                );
              } catch (deleteError) {
                console.error(
                  `❌ Failed to delete duplicate row ${rowIndex}:`,
                  deleteError,
                );
              }
            }
          }
        } catch (verifyError) {
          console.error(
            "❌ Post-write duplicate verification failed:",
            verifyError,
          );
        }
      });
      return jsonResponse;
    } catch (error) {
      console.error("❌ SHEETS API ERROR:", {
        submissionId: resolvedSubmissionId,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });

      let formMatchAfterError = null;
      try {
        formMatchAfterError = await findFormSubmissionMatch(
          sheets,
          spreadsheetId,
          resolvedSubmissionId,
        );
      } catch (reconciliationError) {
        console.error(
          "❌ Failed to reconcile Form_Data after Sheets error:",
          reconciliationError,
        );
      }

      if (formMatchAfterError) {
        try {
          await writeLedgerStatus("submitted", {
            formRowRef: formMatchAfterError.rowRef,
          });
        } catch (ledgerError) {
          console.error(
            "❌ Failed to reconcile submitted ledger state:",
            ledgerError,
          );
        }

        return buildSubmittedResponse({
          duplicate: true,
          formRowRef: formMatchAfterError.rowRef,
          message: "Pedido confirmado tras reconciliacion del backend.",
        });
      }

      return respondRetryableFailure(
        "Error al guardar en la base de datos. Estado no confirmado; se reintentara automaticamente.",
      );
    }
  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error("❌ SUBMISSION ERROR:", {
      submissionId,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      processingTime,
      timestamp: new Date().toISOString(),
    });

    let errorMessage =
      "Error al enviar el formulario. Por favor intenta de nuevo.";
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes("ubicación")) {
        errorMessage = error.message;
        statusCode = 400;
      } else if (
        error.message.includes("GPS") ||
        error.message.includes("precisión")
      ) {
        errorMessage = error.message;
        statusCode = 400;
      } else if (error.message.includes("lejos")) {
        errorMessage = error.message;
        statusCode = 400;
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        retryable: statusCode >= 500,
        submissionId,
        processingTime,
      },
      { status: statusCode },
    );
  }
}
