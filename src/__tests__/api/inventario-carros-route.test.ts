import type { sheets_v4 } from "googleapis";

const googleSheetsMock = jest.fn();
const authMock = jest.fn();
const isInventarioCarroAdminMock = jest.fn();

jest.mock("googleapis", () => ({
  google: {
    sheets: (...args: unknown[]) => googleSheetsMock(...args),
  },
}));

jest.mock("@/auth", () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

jest.mock("@/utils/auth", () => ({
  EMAIL_TO_VENDOR_LABELS: {},
  isInventarioCarroAdmin: (...args: unknown[]) =>
    isInventarioCarroAdminMock(...args),
}));

jest.mock("@/utils/googleAuth", () => ({
  sheetsAuth: {},
}));

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => ({
      status: init?.status ?? 200,
      headers: init?.headers ?? {},
      json: async () => body,
    }),
  },
}));

import { GET } from "@/app/api/inventario-carros/route";

type MockSheets = sheets_v4.Sheets;

const createMockSheets = () =>
  ({
    spreadsheets: {
      get: jest.fn().mockResolvedValue({
        data: {
          sheets: [{ properties: { title: "InventarioCarros" } }],
        },
      }),
      batchUpdate: jest.fn(),
      values: {
        get: jest.fn(async ({ range }: { range: string }) => {
          if (range === "InventarioCarros!A:O") {
            return {
              data: {
                values: [
                  [
                    "id",
                    "date",
                    "periodCode",
                    "weekCode",
                    "sellerEmail",
                    "product",
                    "quantity",
                    "movementType",
                    "notes",
                    "createdBy",
                    "createdAt",
                    "updatedAt",
                    "linkedEntryId",
                    "linkStatus",
                    "overrideReason",
                  ],
                  [
                    "entry-1",
                    "2026-03-21",
                    "P1",
                    "P1S1",
                    "vendor@example.com",
                    "Producto",
                    "12",
                    "Carga",
                    "Notas",
                    "admin@example.com",
                    "2026-03-21T09:00:00.000Z",
                    "2026-03-21T10:00:00.000Z",
                    "linked-1",
                    "linked",
                    "",
                  ],
                ],
              },
            };
          }

          throw new Error(`Unexpected range: ${range}`);
        }),
      },
    },
  }) as unknown as MockSheets;

describe("inventario-carros route", () => {
  beforeEach(() => {
    googleSheetsMock.mockReset();
    authMock.mockReset();
    isInventarioCarroAdminMock.mockReset();
    authMock.mockResolvedValue({
      user: { email: "admin@example.com" },
    });
    isInventarioCarroAdminMock.mockReturnValue(true);
  });

  it("returns no-store headers on GET", async () => {
    googleSheetsMock.mockReturnValue(createMockSheets());

    const response = await GET({
      url: "http://localhost/api/inventario-carros",
    } as Request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers).toMatchObject({
      "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
      Pragma: "no-cache",
    });
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toMatchObject({
      id: "entry-1",
      linkStatus: "linked",
      linkedEntryId: "linked-1",
    });
  });
});
