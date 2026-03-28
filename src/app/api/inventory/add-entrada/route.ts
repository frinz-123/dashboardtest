import { google } from "googleapis";
import { NextResponse } from "next/server";
import { createGoogleSheetsAuth } from "@/server/googleServerAuth";
import { serverEnv } from "@/server/serverEnv";

export async function POST(req: Request) {
  try {
    const entrada = await req.json();
    console.log("Received entrada:", entrada);

    const sheetName = serverEnv.SHEET_NAME_ENTRADAS;
    if (!sheetName) {
      throw new Error("Sheet name is not configured");
    }

    const auth = createGoogleSheetsAuth();

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = serverEnv.NEXT_PUBLIC_SPREADSHEET_ID;
    const range = `${sheetName}!A:F`;

    console.log("Attempting to append with:", { spreadsheetId, range });

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            entrada.nombre,
            entrada.categoria,
            entrada.cantidad.toString(),
            entrada.peso.toString(),
            entrada.source,
            entrada.date,
            entrada.comentario || "",
          ],
        ],
      },
    });

    return NextResponse.json({ success: true, data: response.data });
  } catch (error) {
    console.error("Error details:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Error al agregar entrada",
      },
      { status: 500 },
    );
  }
}
