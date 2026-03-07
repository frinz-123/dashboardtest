import type { sheets_v4 } from "googleapis";
import { SUBMISSION_STATUS_HEADERS } from "@/utils/submissionStatusLedger";

const googleSheetsMock = jest.fn();
const afterMock = jest.fn();

jest.mock("googleapis", () => ({
  google: {
    sheets: (...args: unknown[]) => googleSheetsMock(...args),
  },
}));

jest.mock("@/utils/googleAuth", () => ({
  sheetsAuth: {},
}));

jest.mock("next/server", () => {
  return {
    after: (...args: unknown[]) => afterMock(...args),
    NextResponse: {
      json: (body: unknown, init?: ResponseInit) => ({
        status: init?.status ?? 200,
        headers: {
          "Content-Type": "application/json",
        },
        json: async () => body,
      }),
    },
  };
});

import { POST } from "@/app/api/submit-form/route";

type MockSheets = sheets_v4.Sheets & {
  _ledgerAppends: string[][];
  _formAppends: string[][];
};

function createPayload(overrides: Record<string, unknown> = {}) {
  return {
    submissionId: "submission-123",
    clientName: "Cliente Test",
    clientCode: "T001",
    products: {},
    total: 150,
    location: {
      lat: 24.1,
      lng: -110.3,
      accuracy: 10,
      timestamp: Date.now(),
    },
    userEmail: "test@example.com",
    actorEmail: "test@example.com",
    attemptNumber: 1,
    photoUrls: [],
    ...overrides,
  };
}

function createRequest(payload: Record<string, unknown>) {
  return {
    json: async () => payload,
    headers: {
      get: jest.fn().mockReturnValue(null),
    },
  } as unknown as Request;
}

function createMockSheets(options?: {
  aeResponses?: string[][][];
  ledgerRows?: string[][];
  clientRows?: string[][];
  currentRows?: string[][];
  formAppendError?: Error;
}) {
  const ledgerAppends: string[][] = [];
  const formAppends: string[][] = [];
  const aeResponses = options?.aeResponses ?? [[]];
  let aeCallCount = 0;

  const valuesGet = jest.fn(async ({ range }: { range: string }) => {
    if (range === "Submission_Status!A1:G1") {
      return {
        data: {
          values: [Array.from(SUBMISSION_STATUS_HEADERS)],
        },
      };
    }

    if (range === "Submission_Status!A2:G") {
      return {
        data: {
          values: options?.ledgerRows ?? [],
        },
      };
    }

    if (range === "Form_Data!AE:AE") {
      const response =
        aeResponses[Math.min(aeCallCount, aeResponses.length - 1)] ?? [];
      aeCallCount += 1;
      return {
        data: {
          values: response,
        },
      };
    }

    if (range === "Form_Data!A:C") {
      return {
        data: {
          values: options?.clientRows ?? [["Cliente Test", "24.1", "-110.3"]],
        },
      };
    }

    if (range === "Form_Data!A:A") {
      return {
        data: {
          values: options?.currentRows ?? [["Cliente"], ["Otro"]],
        },
      };
    }

    if (range.startsWith("Form_Data!AE")) {
      return {
        data: {
          values: [[createPayload().submissionId]],
        },
      };
    }

    return {
      data: {
        values: [],
      },
    };
  });

  const valuesAppend = jest.fn(
    async ({
      range,
      requestBody,
    }: {
      range: string;
      requestBody: { values?: string[][] };
    }) => {
      if (range === "Submission_Status!A:G") {
        const row = requestBody.values?.[0] ?? [];
        ledgerAppends.push(row);
        return {
          data: {
            updates: {
              updatedRange: `Submission_Status!A${ledgerAppends.length + 1}:G${ledgerAppends.length + 1}`,
            },
          },
        };
      }

      if (range === "Form_Data!A:AQ") {
        if (options?.formAppendError) {
          throw options.formAppendError;
        }
        const row = requestBody.values?.[0] ?? [];
        formAppends.push(row);
        return {
          data: {
            updates: {
              updatedRange: "Form_Data!A5:AQ5",
            },
          },
        };
      }

      throw new Error(`Unexpected append range: ${range}`);
    },
  );

  const valuesUpdate = jest.fn().mockResolvedValue({
    data: {},
  });

  const spreadsheetsGet = jest.fn().mockResolvedValue({
    data: {
      sheets: [{ properties: { title: "Form_Data", sheetId: 0 } }],
    },
  });

  const batchUpdate = jest.fn().mockResolvedValue({
    data: {},
  });

  const sheets = {
    spreadsheets: {
      values: {
        get: valuesGet,
        append: valuesAppend,
        update: valuesUpdate,
      },
      get: spreadsheetsGet,
      batchUpdate,
    },
    _ledgerAppends: ledgerAppends,
    _formAppends: formAppends,
  } as unknown as MockSheets;

  return sheets;
}

describe("submit-form route idempotency ledger", () => {
  beforeEach(() => {
    googleSheetsMock.mockReset();
    afterMock.mockReset();
  });

  it("returns a confirmed duplicate when Form_Data already contains the submission id", async () => {
    const sheets = createMockSheets({
      aeResponses: [[["submission-123"]]],
    });
    googleSheetsMock.mockReturnValue(sheets);

    const response = await POST(createRequest(createPayload()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.duplicate).toBe(true);
    expect(body.submissionState).toBe("submitted");
    expect(sheets._ledgerAppends.at(-1)?.[1]).toBe("submitted");
  });

  it("returns 409 while a fresh processing lease is active", async () => {
    const now = new Date();
    const sheets = createMockSheets({
      ledgerRows: [
        [
          "submission-123",
          "processing",
          new Date(now.getTime() + 60_000).toISOString(),
          now.toISOString(),
          "1",
          "",
          "",
        ],
      ],
    });
    googleSheetsMock.mockReturnValue(sheets);

    const response = await POST(createRequest(createPayload()));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("SUBMISSION_IN_PROGRESS");
    expect(body.submissionState).toBe("processing");
    expect(sheets._formAppends).toHaveLength(0);
  });

  it("reclaims a stale processing lease and continues the submission", async () => {
    const now = new Date();
    const sheets = createMockSheets({
      aeResponses: [[], []],
      ledgerRows: [
        [
          "submission-123",
          "processing",
          new Date(now.getTime() - 60_000).toISOString(),
          now.toISOString(),
          "1",
          "",
          "",
        ],
      ],
    });
    googleSheetsMock.mockReturnValue(sheets);

    const response = await POST(createRequest(createPayload()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.duplicate).toBe(false);
    expect(body.submissionState).toBe("submitted");
    expect(sheets._ledgerAppends[0]?.[1]).toBe("processing");
    expect(sheets._ledgerAppends[0]?.[4]).toBe("2");
    expect(sheets._ledgerAppends.at(-1)?.[1]).toBe("submitted");
  });

  it("reconciles to success when Form_Data contains the submission after a Sheets write error", async () => {
    const sheets = createMockSheets({
      aeResponses: [[], [["submission-123"]]],
      formAppendError: new Error("append failed"),
    });
    googleSheetsMock.mockReturnValue(sheets);

    const response = await POST(createRequest(createPayload()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.duplicate).toBe(true);
    expect(body.submissionState).toBe("submitted");
    expect(sheets._ledgerAppends.at(-1)?.[1]).toBe("submitted");
  });

  it("returns a retryable unknown failure when Sheets errors and reconciliation finds no row", async () => {
    const sheets = createMockSheets({
      aeResponses: [[], []],
      formAppendError: new Error("append failed"),
    });
    googleSheetsMock.mockReturnValue(sheets);

    const response = await POST(createRequest(createPayload()));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.retryable).toBe(true);
    expect(body.submissionState).toBe("unknown");
    expect(sheets._ledgerAppends.at(-1)?.[1]).toBe("retryable_failed");
  });

  it("records permanent validation failures in the ledger", async () => {
    const sheets = createMockSheets();
    googleSheetsMock.mockReturnValue(sheets);

    const response = await POST(
      createRequest(
        createPayload({
          location: null,
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.retryable).toBe(false);
    expect(sheets._ledgerAppends.map((row) => row[1])).toEqual([
      "processing",
      "permanent_failed",
    ]);
  });
});
