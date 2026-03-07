import { google } from "googleapis";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isMasterAccount } from "@/utils/auth";
import { sheetsAuth } from "@/utils/googleAuth";
import { isPolygonFeature, type PolygonFeature } from "@/utils/polygonGeometry";

const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID ||
  process.env.NEXT_PUBLIC_SPREADSHEET_ID ||
  "1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g";
const SHEET_NAME = "Dibujos";
const HEADER = [
  "id",
  "nombre",
  "scope",
  "geometry_json",
  "created_by_email",
  "created_at_iso",
  "updated_at_iso",
  "is_active",
];

type StoredDrawing = {
  id: string;
  nombre: string;
  scope: "global" | "user";
  geometry: PolygonFeature;
  createdByEmail: string;
  createdAtIso: string;
  updatedAtIso: string;
  isActive: boolean;
};

const normalizeEmail = (value: string | null | undefined): string =>
  (value || "").toLowerCase().trim();

const parseBooleanLike = (value: string): boolean => {
  const normalized = (value || "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
};

const toStoredDrawing = (row: string[]): StoredDrawing | null => {
  const [
    id,
    nombre,
    scopeRaw,
    geometryRaw,
    createdByEmail,
    createdAtIso,
    updatedAtIso,
    isActiveRaw,
  ] = row;

  if (!id || !nombre || !geometryRaw) {
    return null;
  }

  try {
    const parsedGeometry = JSON.parse(geometryRaw);
    if (!isPolygonFeature(parsedGeometry)) {
      return null;
    }

    const scope = scopeRaw === "global" ? "global" : "user";

    return {
      id,
      nombre,
      scope,
      geometry: parsedGeometry,
      createdByEmail: normalizeEmail(createdByEmail),
      createdAtIso,
      updatedAtIso,
      isActive: parseBooleanLike(isActiveRaw || "true"),
    };
  } catch {
    return null;
  }
};

const ensureHeader = async (sheets: ReturnType<typeof google.sheets>) => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1:H1`,
  });

  const current = response.data.values?.[0] || [];
  const hasHeader = HEADER.every((header, index) => current[index] === header);

  if (!hasHeader) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:H1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [HEADER],
      },
    });
  }
};

const getRows = async (sheets: ReturnType<typeof google.sheets>) => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:H`,
  });

  return response.data.values || [];
};

export async function GET() {
  try {
    const session = await auth();
    const email = normalizeEmail(session?.user?.email);

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = isMasterAccount(email);
    const sheets = google.sheets({ version: "v4", auth: sheetsAuth });

    await ensureHeader(sheets);
    const rows = await getRows(sheets);

    const drawings = rows
      .map(toStoredDrawing)
      .filter((drawing): drawing is StoredDrawing => Boolean(drawing))
      .filter((drawing) => drawing.isActive)
      .filter(
        (drawing) =>
          isAdmin ||
          drawing.scope === "global" ||
          drawing.createdByEmail === email,
      )
      .sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso));

    return NextResponse.json({ drawings });
  } catch (error) {
    console.error("[navegar/dibujos][GET] error", error);
    return NextResponse.json(
      { error: "No fue posible cargar los dibujos." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const email = normalizeEmail(session?.user?.email);

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const nombre = (body?.nombre || "").toString().trim();
    const requestedScope = (body?.scope || "user").toString();
    const geometry = body?.geometry;

    if (!nombre) {
      return NextResponse.json(
        { error: "El nombre del dibujo es requerido." },
        { status: 400 },
      );
    }

    if (!isPolygonFeature(geometry)) {
      return NextResponse.json(
        { error: "La geometría del dibujo no es válida." },
        { status: 400 },
      );
    }

    const isAdmin = isMasterAccount(email);
    const scope: "global" | "user" =
      requestedScope === "global" && isAdmin ? "global" : "user";
    const nowIso = new Date().toISOString();
    const id = crypto.randomUUID();

    const sheets = google.sheets({ version: "v4", auth: sheetsAuth });
    await ensureHeader(sheets);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:H`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [
            id,
            nombre,
            scope,
            JSON.stringify(geometry),
            email,
            nowIso,
            nowIso,
            "true",
          ],
        ],
      },
    });

    return NextResponse.json({
      drawing: {
        id,
        nombre,
        scope,
        geometry,
        createdByEmail: email,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
        isActive: true,
      },
    });
  } catch (error) {
    console.error("[navegar/dibujos][POST] error", error);
    return NextResponse.json(
      { error: "No fue posible guardar el dibujo." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    const email = normalizeEmail(session?.user?.email);

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const id = (body?.id || "").toString().trim();
    const nombre = typeof body?.nombre === "string" ? body.nombre.trim() : null;
    const isActive =
      typeof body?.isActive === "boolean" ? body.isActive : undefined;

    if (!id) {
      return NextResponse.json(
        { error: "El id del dibujo es requerido." },
        { status: 400 },
      );
    }

    const sheets = google.sheets({ version: "v4", auth: sheetsAuth });
    await ensureHeader(sheets);
    const rows = await getRows(sheets);

    const rowIndex = rows.findIndex((row) => row[0] === id);
    if (rowIndex === -1) {
      return NextResponse.json(
        { error: "Dibujo no encontrado." },
        { status: 404 },
      );
    }

    const row = rows[rowIndex] || [];
    const drawing = toStoredDrawing(row);
    if (!drawing) {
      return NextResponse.json({ error: "Dibujo inválido." }, { status: 400 });
    }

    const isAdmin = isMasterAccount(email);
    const canEdit = isAdmin || drawing.createdByEmail === email;
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updatedRow = [...row];
    if (nombre) {
      updatedRow[1] = nombre;
    }
    if (typeof isActive === "boolean") {
      updatedRow[7] = isActive ? "true" : "false";
    }
    updatedRow[6] = new Date().toISOString();

    const sheetRow = rowIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A${sheetRow}:H${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [updatedRow],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[navegar/dibujos][PATCH] error", error);
    return NextResponse.json(
      { error: "No fue posible actualizar el dibujo." },
      { status: 500 },
    );
  }
}
