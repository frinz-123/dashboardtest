import type { sheets_v4 } from "googleapis";

export const SUBMISSION_STATUS_SHEET = "Submission_Status";
export const SUBMISSION_STATUS_HEADERS = [
  "submission_id",
  "status",
  "lease_expires_at",
  "updated_at",
  "attempt_count",
  "last_error",
  "form_row_ref",
] as const;
export const PROCESSING_LEASE_MS = 60_000;

export type SubmissionLedgerStatus =
  | "processing"
  | "submitted"
  | "retryable_failed"
  | "permanent_failed";

export interface SubmissionStatusEntry {
  submissionId: string;
  status: SubmissionLedgerStatus;
  leaseExpiresAt: string | null;
  updatedAt: string;
  attemptCount: number;
  lastError: string | null;
  formRowRef: string | null;
  rowNumber: number;
}

export interface FormSubmissionMatch {
  rowNumber: number;
  rowRef: string;
}

type AppendLedgerEntryInput = Omit<SubmissionStatusEntry, "rowNumber">;

export type SubmissionLedgerDecision =
  | {
      type: "duplicate-submitted";
      formRowRef: string | null;
      attemptCount: number;
    }
  | { type: "in-progress" }
  | { type: "permanent-failed"; error: string }
  | {
      type: "claim-processing";
      attemptCount: number;
      leaseExpiresAt: string;
    };

function trimCell(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseAttemptCount(value: unknown): number {
  const raw = typeof value === "number" ? value : Number(trimCell(value));
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 0;
}

function toLedgerEntry(
  row: unknown[] | undefined,
  rowNumber: number,
): SubmissionStatusEntry | null {
  if (!row) return null;

  const submissionId = trimCell(row[0]);
  const status = trimCell(row[1]) as SubmissionLedgerStatus;

  if (!submissionId || !status) {
    return null;
  }

  return {
    submissionId,
    status,
    leaseExpiresAt: trimCell(row[2]) || null,
    updatedAt: trimCell(row[3]) || new Date(0).toISOString(),
    attemptCount: parseAttemptCount(row[4]),
    lastError: trimCell(row[5]) || null,
    formRowRef: trimCell(row[6]) || null,
    rowNumber,
  };
}

export function isLedgerLeaseActive(
  entry: Pick<SubmissionStatusEntry, "status" | "leaseExpiresAt">,
  nowMs = Date.now(),
): boolean {
  if (entry.status !== "processing" || !entry.leaseExpiresAt) {
    return false;
  }

  const leaseUntil = Date.parse(entry.leaseExpiresAt);
  return Number.isFinite(leaseUntil) && leaseUntil > nowMs;
}

export function getNextSubmissionAttemptCount(
  latestEntry: Pick<SubmissionStatusEntry, "attemptCount"> | null,
  clientAttemptNumber: number,
): number {
  return Math.max(clientAttemptNumber, (latestEntry?.attemptCount ?? 0) + 1);
}

export function decideSubmissionLedgerAction(args: {
  formMatch: FormSubmissionMatch | null;
  latestEntry: SubmissionStatusEntry | null;
  clientAttemptNumber: number;
  nowMs?: number;
  processingLeaseMs?: number;
}): SubmissionLedgerDecision {
  const {
    formMatch,
    latestEntry,
    clientAttemptNumber,
    nowMs = Date.now(),
    processingLeaseMs = PROCESSING_LEASE_MS,
  } = args;

  if (formMatch) {
    return {
      type: "duplicate-submitted",
      formRowRef: formMatch.rowRef,
      attemptCount: Math.max(
        clientAttemptNumber,
        latestEntry?.attemptCount ?? clientAttemptNumber,
      ),
    };
  }

  if (latestEntry?.status === "submitted") {
    return {
      type: "duplicate-submitted",
      formRowRef: latestEntry.formRowRef,
      attemptCount: Math.max(clientAttemptNumber, latestEntry.attemptCount),
    };
  }

  if (
    latestEntry?.status === "processing" &&
    isLedgerLeaseActive(latestEntry, nowMs)
  ) {
    return { type: "in-progress" };
  }

  if (latestEntry?.status === "permanent_failed") {
    return {
      type: "permanent-failed",
      error: latestEntry.lastError || "Error permanente del servidor",
    };
  }

  const attemptCount = getNextSubmissionAttemptCount(
    latestEntry,
    clientAttemptNumber,
  );

  return {
    type: "claim-processing",
    attemptCount,
    leaseExpiresAt: new Date(nowMs + processingLeaseMs).toISOString(),
  };
}

export async function ensureSubmissionStatusHeader(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
): Promise<void> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SUBMISSION_STATUS_SHEET}!A1:G1`,
  });

  const currentHeader = (response.data.values?.[0] ?? []).map(trimCell);
  const expectedHeader = [...SUBMISSION_STATUS_HEADERS];

  if (
    currentHeader.length === expectedHeader.length &&
    currentHeader.every((value, index) => value === expectedHeader[index])
  ) {
    return;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SUBMISSION_STATUS_SHEET}!A1:G1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [expectedHeader],
    },
  });
}

export async function findFormSubmissionMatch(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  submissionId: string,
): Promise<FormSubmissionMatch | null> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Form_Data!AE:AE",
  });

  const rows = response.data.values ?? [];
  for (let index = 0; index < rows.length; index++) {
    if (trimCell(rows[index]?.[0]) !== submissionId) {
      continue;
    }

    const rowNumber = index + 1;
    return {
      rowNumber,
      rowRef: `Form_Data!AE${rowNumber}`,
    };
  }

  return null;
}

export async function getLatestSubmissionStatusEntry(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  submissionId: string,
): Promise<SubmissionStatusEntry | null> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SUBMISSION_STATUS_SHEET}!A2:G`,
  });

  const rows = response.data.values ?? [];
  let latestEntry: SubmissionStatusEntry | null = null;

  rows.forEach((row, index) => {
    const parsed = toLedgerEntry(row, index + 2);
    if (!parsed || parsed.submissionId !== submissionId) {
      return;
    }

    latestEntry = parsed;
  });

  return latestEntry;
}

export async function appendSubmissionStatusEntry(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  entry: AppendLedgerEntryInput,
): Promise<string | null> {
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SUBMISSION_STATUS_SHEET}!A:G`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          entry.submissionId,
          entry.status,
          entry.leaseExpiresAt ?? "",
          entry.updatedAt,
          String(entry.attemptCount),
          entry.lastError ?? "",
          entry.formRowRef ?? "",
        ],
      ],
    },
  });

  return response.data.updates?.updatedRange ?? null;
}
