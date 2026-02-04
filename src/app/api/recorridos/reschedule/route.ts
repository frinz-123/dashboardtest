import { google } from "googleapis";
import { type NextRequest, NextResponse } from "next/server";

type RescheduleRequest = {
  clientName: string;
  originalDay: string;
  newDay: string;
  visitType: "Pedidos" | "Entrega" | "Normal";
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userEmail } = body;

    if (!userEmail) {
      return NextResponse.json({ error: "Missing userEmail" }, { status: 400 });
    }

    // Handle batch reschedule action
    if (action === "batch_reschedule") {
      const { reschedules } = body;

      if (!reschedules || !Array.isArray(reschedules)) {
        return NextResponse.json(
          { error: "Missing required fields for batch_reschedule" },
          { status: 400 },
        );
      }

      // Initialize Google Sheets using the same auth as the main API
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

      const sheets = google.sheets({ version: "v4", auth });
      const spreadsheetId = "1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g";

      // ✅ FIXED: Use email directly to match client data vendor field
      // Don't convert to friendly labels - use the actual email as it appears in the client data
      const vendorLabel = userEmail;

      // Prepare rows for batch insert
      const currentDate = new Date().toISOString().split("T")[0];
      const values = reschedules.map((reschedule: RescheduleRequest) => [
        reschedule.clientName, // cliente_original (A)
        reschedule.visitType, // tipo_visita (B)
        reschedule.originalDay, // dia_original (C)
        reschedule.newDay, // dia_nuevo (D)
        currentDate, // fecha_reprogramacion (E)
        vendorLabel, // vendedor (F) - ✅ FIXED: Use consistent vendor label
        "Si", // activo (G)
      ]);

      console.log(
        "📝 RESCHEDULE API: Adding rows to Visitas_Reprogramadas:",
        values,
      );

      // Append all rows at once to the Visitas_Reprogramadas sheet
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Visitas_Reprogramadas!A:G",
        valueInputOption: "RAW",
        requestBody: {
          values: values,
        },
      });

      console.log(
        "✅ RESCHEDULE API: Successfully added",
        values.length,
        "reschedule records",
      );
      console.log("📊 RESCHEDULE API: Response:", response.data);

      return NextResponse.json({
        success: true,
        message: `${values.length} reschedules saved successfully`,
        reschedules: values.map((_row, index) => ({
          clientName: reschedules[index].clientName,
          visitType: reschedules[index].visitType,
          originalDay: reschedules[index].originalDay,
          newDay: reschedules[index].newDay,
          date: currentDate,
          vendedor: vendorLabel, // ✅ FIXED: Use consistent vendor label
          activo: "Si",
        })),
      });
    }

    // Handle deactivate reschedule action
    if (action === "deactivate_reschedule") {
      const { clientName, visitType } = body;

      if (!clientName || !visitType) {
        return NextResponse.json(
          { error: "Missing required fields for deactivate_reschedule" },
          { status: 400 },
        );
      }

      // Initialize Google Sheets
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

      const sheets = google.sheets({ version: "v4", auth });
      const spreadsheetId = "1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g";

      console.log(
        `📝 DEACTIVATE RESCHEDULE: Looking for ${clientName} (${visitType}) to deactivate`,
      );

      // ✅ FIXED: Use email directly to match client data vendor field
      // Don't convert to friendly labels - use the actual email as it appears in the client data
      const vendorLabel = userEmail;

      // First, get all rows from the sheet to find the matching reschedule
      const getResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Visitas_Reprogramadas!A:G",
      });

      const rows = getResponse.data.values || [];

      // Find the row index for this client+visitType where activo = 'Si'
      let rowIndexToUpdate = -1;
      for (let i = 1; i < rows.length; i++) {
        // Skip header row
        const [rowClient, rowVisitType, , , , rowVendedor, rowActivo] = rows[i];
        if (
          rowClient === clientName &&
          rowVisitType === visitType &&
          rowVendedor === vendorLabel && // ✅ FIXED: Use consistent vendor label
          rowActivo === "Si"
        ) {
          rowIndexToUpdate = i + 1; // Google Sheets is 1-indexed
          break;
        }
      }

      if (rowIndexToUpdate === -1) {
        console.log(
          `⚠️ No active reschedule found for ${clientName} (${visitType})`,
        );
        return NextResponse.json({
          success: true,
          message: "No active reschedule found to deactivate",
        });
      }

      // Update the 'activo' column to 'No'
      const _updateResponse = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Visitas_Reprogramadas!G${rowIndexToUpdate}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [["No"]],
        },
      });

      console.log(
        `✅ DEACTIVATE RESCHEDULE: Successfully deactivated reschedule for ${clientName} (${visitType})`,
      );

      return NextResponse.json({
        success: true,
        message: `Reschedule deactivated for ${clientName} (${visitType})`,
        updatedRow: rowIndexToUpdate,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("❌ RESCHEDULE API ERROR:", error);
    return NextResponse.json(
      {
        error: "Failed to save reschedules",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
