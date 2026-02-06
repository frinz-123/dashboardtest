import { google } from "googleapis";
import { type NextRequest, NextResponse } from "next/server";

// Force dynamic rendering for this API route
export const dynamic = "force-dynamic";

const _SHEET_IDS = {
  clientes: "1292284175",
  performance: "2073545797",
  programacion: "1620884655",
  configuracion: "1091850595",
  metricas: "585874922",
  visitas: "123456789", // Individual visits tracking
  reprogramadas: "477915293", // Rescheduled visits tracking
};

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
      /\n/g,
      "\n",
    ),
    project_id: process.env.GOOGLE_SERVICE_ACCOUNT_PROJECT_ID,
    client_id: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_ID,
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const viewAsEmail = searchParams.get("viewAsEmail"); // New parameter for master accounts
    const sheet = searchParams.get("sheet") || "clientes";

    console.log(
      "🔍 API DEBUG: Request params - email:",
      email,
      "viewAsEmail:",
      viewAsEmail,
      "sheet:",
      sheet,
    );

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter is required" },
        { status: 400 },
      );
    }

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = "1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g";

    let sheetName: string;
    let range: string;

    switch (sheet) {
      case "clientes":
        sheetName = "Clientes_Rutas";
        range = `'${sheetName}'!A:H`;
        break;
      case "performance":
        sheetName = "Rutas_Performance";
        range = `'${sheetName}'!A:K`;
        break;
      case "programacion":
        sheetName = "Programacion_Semanal";
        range = `'${sheetName}'!A:I`;
        break;
      case "configuracion":
        sheetName = "Configuracion";
        range = `'${sheetName}'!A:D`;
        break;
      case "metricas":
        sheetName = "Metricas_Rutas";
        range = `'${sheetName}'!A:K`;
        break;
      case "visitas":
        sheetName = "Visitas_Individuales";
        range = `'${sheetName}'!A:H`;
        break;
      case "reprogramadas":
        sheetName = "Visitas_Reprogramadas";
        range = `'${sheetName}'!A:G`;
        break;
      default:
        return NextResponse.json(
          { error: "Invalid sheet parameter" },
          { status: 400 },
        );
    }

    console.log(
      "🔍 API DEBUG: Attempting to fetch from sheet:",
      sheetName,
      "with range:",
      range,
    );
    console.log("🔍 API DEBUG: Spreadsheet ID:", spreadsheetId);

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      console.log(
        "🔍 API DEBUG: Google Sheets API response status:",
        response.status,
      );
      console.log(
        "🔍 API DEBUG: Response data keys:",
        Object.keys(response.data || {}),
      );

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        console.log("⚠️ API DEBUG: No data returned from sheet");
        return NextResponse.json({ data: [] }, { status: 200 });
      }

      console.log("🔍 API DEBUG: Number of rows returned:", rows.length);

      const headers = rows[0];
      const data = rows.slice(1).map((row) => {
        const item: Record<string, any> = {};
        headers.forEach((header, index) => {
          if (header && row[index] !== undefined) {
            // Convert numeric values
            if (header === "Latitude" || header === "Longitud") {
              item[header] = parseFloat(row[index]) || 0;
            } else if (header === "Frecuencia") {
              item[header] = parseInt(row[index], 10) || 1;
            } else {
              item[header] = row[index];
            }
          }
        });
        return item;
      });

      // Import master account utilities
      const { isMasterAccount, getVendorIdentifiers, normalizeVendorValue } =
        await import("../../../utils/auth");

      // Check if this is a master account request
      const isMaster = isMasterAccount(email);
      const isAllRoutesRequest =
        isMaster && (viewAsEmail === null || viewAsEmail === "null");

      // For master accounts, allow viewing as another vendor.
      // For "all routes" explicitly, keep effectiveEmail as the caller email (used only for logging).
      const effectiveEmail =
        !isAllRoutesRequest && viewAsEmail && isMaster ? viewAsEmail : email;

      const vendorIdentifiers = isAllRoutesRequest
        ? null
        : getVendorIdentifiers(effectiveEmail);

      const matchesVendor = (value: any) => {
        if (isAllRoutesRequest) return true;
        return (
          vendorIdentifiers?.has(normalizeVendorValue(String(value || ""))) ||
          false
        );
      };

      console.log(
        "🔍 API DEBUG: Master account check - isMaster:",
        isMaster,
        "isAllRoutesRequest:",
        isAllRoutesRequest,
        "effectiveEmail:",
        effectiveEmail,
      );

      console.log("🔍 API DEBUG: Total rows processed:", data.length);
      console.log("🔍 API DEBUG: Headers found:", headers);
      if (data.length > 0) {
        console.log("🔍 API DEBUG: First row sample:", data[0]);
        console.log("🔍 API DEBUG: Unique vendedores in sheet:", [
          ...new Set(data.map((item) => item.Vendedor)),
        ]);

        // Basic data validation for clients sheet
        if (sheet === "clientes") {
          const cleyData = data.filter(
            (item) => item.Tipo_Cliente?.toUpperCase() === "CLEY",
          );
          console.log("🔍 API DEBUG: CLEY clients found:", cleyData.length);
        }
      }

      // Filter by vendedor (seller) based on sheet type
      let filteredData = data;

      if (isAllRoutesRequest) {
        console.log(
          "🔍 API DEBUG: Master account - returning ALL records (explicit all-routes request)",
        );
        filteredData = data;
      } else if (sheet === "clientes") {
        filteredData = data.filter((item) => matchesVendor(item.Vendedor));
      } else if (
        sheet === "metricas" ||
        sheet === "performance" ||
        sheet === "visitas"
      ) {
        filteredData = data.filter((item) =>
          matchesVendor(item.vendedor || item.Vendedor),
        );
      } else if (sheet === "programacion") {
        filteredData = data.filter((item) =>
          matchesVendor(item.vendedor || item.Vendedor),
        );
      } else if (sheet === "reprogramadas") {
        filteredData = data.filter((item) =>
          matchesVendor(item.vendedor || item.Vendedor),
        );
      }

      console.log(
        "🔍 API DEBUG: Returning filtered rows:",
        filteredData.length,
        "sheet:",
        sheet,
      );

      return NextResponse.json({ data: filteredData }, {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      });
    } catch (sheetsError: any) {
      console.error("❌ API ERROR: Google Sheets API failed:", sheetsError);
      console.error("❌ API ERROR: Error message:", sheetsError.message);
      console.error("❌ API ERROR: Error code:", sheetsError.code);

      return NextResponse.json(
        {
          error: "Failed to fetch data from Google Sheets",
          details: sheetsError.message,
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("❌ API ERROR: General error:", error);
    return NextResponse.json(
      { error: "Failed to fetch route data" },
      { status: 500 },
    );
  }
}
