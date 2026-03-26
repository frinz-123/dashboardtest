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

import { GET, PATCH } from "@/app/api/inventario-carros/route";

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

const createPatchMockSheets = () => {
  const update = jest.fn().mockResolvedValue({});
  const get = jest.fn(
    async ({ range, fields }: { range?: string; fields?: string }) => {
      if (fields === "sheets.properties.title") {
        return {
          data: {
            sheets: [
              { properties: { title: "InventarioCarros" } },
              { properties: { title: "Bodega" } },
            ],
          },
        };
      }

      if (range === "InventarioCarros!A1:O1") {
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
            ],
          },
        };
      }

      if (range === "Bodega!A1:Q1") {
        return {
          data: {
            values: [
              [
                "id",
                "date",
                "periodCode",
                "weekCode",
                "product",
                "quantity",
                "direction",
                "movementType",
                "sellerEmail",
                "notes",
                "linkedEntryId",
                "linkStatus",
                "overrideReason",
                "createdBy",
                "createdAt",
                "updatedAt",
                "isNonStock",
              ],
            ],
          },
        };
      }

      if (range === "Bodega!A:Q") {
        return {
          data: {
            values: [
              [
                "id",
                "date",
                "periodCode",
                "weekCode",
                "product",
                "quantity",
                "direction",
                "movementType",
                "sellerEmail",
                "notes",
                "linkedEntryId",
                "linkStatus",
                "overrideReason",
                "createdBy",
                "createdAt",
                "updatedAt",
                "isNonStock",
              ],
              [
                "bodega-1",
                "2026-03-21",
                "P1",
                "P1S1",
                "Producto",
                "12",
                "Salida",
                "SalidaCarro",
                "vendor@example.com",
                "Notas antiguas",
                "car-1",
                "linked",
                "",
                "admin@example.com",
                "2026-03-21T09:00:00.000Z",
                "2026-03-21T10:00:00.000Z",
                "false",
              ],
            ],
          },
        };
      }

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
                "car-1",
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
                "bodega-1",
                "linked",
                "",
              ],
            ],
          },
        };
      }

      throw new Error(`Unexpected range: ${range}`);
    },
  );

  return {
    sheets: {
      spreadsheets: {
        get,
        batchUpdate: jest.fn(),
        values: {
          get,
          update,
          append: jest.fn(),
        },
      },
    } as unknown as MockSheets,
    update,
  };
};

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

  it("updates the linked bodega counterpart across the full Q column range", async () => {
    const { sheets, update } = createPatchMockSheets();
    googleSheetsMock.mockReturnValue(sheets);

    const response = await PATCH({
      json: async () => ({
        rowNumber: 2,
        entry: {
          id: "car-1",
          date: "2026-03-24",
          sellerEmail: "vendor@example.com",
          product: "Producto Editado",
          quantity: 7,
          movementType: "Carga",
          notes: "Notas nuevas",
          createdBy: "admin@example.com",
          createdAt: "2026-03-21T09:00:00.000Z",
          updatedAt: "2026-03-21T10:00:00.000Z",
          linkedEntryId: "bodega-1",
          linkStatus: "linked",
          overrideReason: "",
        },
      }),
    } as Request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true });

    const bodegaUpdateCall = update.mock.calls.find(
      ([request]) => request.range === "Bodega!A2:Q2",
    );

    expect(bodegaUpdateCall).toBeDefined();
    expect(bodegaUpdateCall?.[0].requestBody.values[0]).toHaveLength(17);
  });

  it("rejects stale edits when updatedAt no longer matches", async () => {
    const { sheets, update } = createPatchMockSheets();
    googleSheetsMock.mockReturnValue(sheets);

    const response = await PATCH({
      json: async () => ({
        rowNumber: 2,
        entry: {
          id: "car-1",
          product: "Producto Editado",
          quantity: 7,
          updatedAt: "2026-03-20T10:00:00.000Z",
        },
      }),
    } as Request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      error:
        "El movimiento cambió desde que se abrió. Recarga e intenta de nuevo.",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects linked edits when the reciprocal bodega link is broken", async () => {
    const { update } = createPatchMockSheets();
    const get = jest.fn(
      async ({ range, fields }: { range?: string; fields?: string }) => {
        if (fields === "sheets.properties.title") {
          return {
            data: {
              sheets: [
                { properties: { title: "InventarioCarros" } },
                { properties: { title: "Bodega" } },
              ],
            },
          };
        }

        if (range === "InventarioCarros!A1:O1") {
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
              ],
            },
          };
        }

        if (range === "Bodega!A1:Q1") {
          return {
            data: {
              values: [
                [
                  "id",
                  "date",
                  "periodCode",
                  "weekCode",
                  "product",
                  "quantity",
                  "direction",
                  "movementType",
                  "sellerEmail",
                  "notes",
                  "linkedEntryId",
                  "linkStatus",
                  "overrideReason",
                  "createdBy",
                  "createdAt",
                  "updatedAt",
                  "isNonStock",
                ],
              ],
            },
          };
        }

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
                  "car-1",
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
                  "bodega-1",
                  "linked",
                  "",
                ],
              ],
            },
          };
        }

        if (range === "Bodega!A:Q") {
          return {
            data: {
              values: [
                [
                  "id",
                  "date",
                  "periodCode",
                  "weekCode",
                  "product",
                  "quantity",
                  "direction",
                  "movementType",
                  "sellerEmail",
                  "notes",
                  "linkedEntryId",
                  "linkStatus",
                  "overrideReason",
                  "createdBy",
                  "createdAt",
                  "updatedAt",
                  "isNonStock",
                ],
                [
                  "bodega-1",
                  "2026-03-21",
                  "P1",
                  "P1S1",
                  "Producto",
                  "12",
                  "Salida",
                  "SalidaCarro",
                  "vendor@example.com",
                  "Notas antiguas",
                  "another-car",
                  "linked",
                  "",
                  "admin@example.com",
                  "2026-03-21T09:00:00.000Z",
                  "2026-03-21T10:00:00.000Z",
                  "false",
                ],
              ],
            },
          };
        }

        throw new Error(`Unexpected range: ${range}`);
      },
    );

    googleSheetsMock.mockReturnValue({
      spreadsheets: {
        get,
        batchUpdate: jest.fn(),
        values: {
          get,
          update,
          append: jest.fn(),
        },
      },
    } as unknown as MockSheets);

    const response = await PATCH({
      json: async () => ({
        rowNumber: 2,
        entry: {
          id: "car-1",
          product: "Producto Editado",
          quantity: 7,
          updatedAt: "2026-03-21T10:00:00.000Z",
          linkedEntryId: "bodega-1",
          linkStatus: "linked",
        },
      }),
    } as Request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      error: "El vínculo con bodega ya cambió. Recarga antes de continuar.",
    });
    expect(update).not.toHaveBeenCalled();
  });
});
