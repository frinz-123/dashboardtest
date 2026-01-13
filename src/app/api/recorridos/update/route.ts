import { google } from "googleapis";
import { NextResponse } from "next/server";
import {
  EMAIL_TO_VENDOR_LABELS,
  getVendorEmailFromLabel,
  getVendorIdentifiers,
  isMasterAccount,
  normalizeVendorValue,
} from "../../../../utils/auth";

// Force dynamic rendering for this API route
export const dynamic = "force-dynamic";

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

const spreadsheetId = "1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Handle different actions
    if (body.action === "update_visit_status") {
      return await updateVisitStatus(body);
    } else if (body.action === "update_route_summary") {
      return await updateRouteSummary(body);
    } else if (body.action === "update_weekly_schedule") {
      return await updateWeeklySchedule(body);
    } else {
      return NextResponse.json(
        {
          error:
            'Invalid action. Use "update_visit_status", "update_route_summary", or "update_weekly_schedule"',
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Error in update API:", error);
    return NextResponse.json(
      { error: "Failed to update route data" },
      { status: 500 },
    );
  }
}

// ✅ MODIFIED: Write individual visits to Metricas_Rutas sheet immediately
async function updateVisitStatus(body: any) {
  const {
    userEmail,
    clientName,
    routeDay,
    visitType, // 'completed', 'skipped', 'postponed'
    location, // Contains { lat: number, lng: number }
    notes,
    cleyVisitType, // 'Pedidos', 'Entrega', or 'Normal'
    visitDate, // ✅ NEW: The specific date of the visit from the client
    timestamp = new Date().toISOString(),
    masterEmail, // For master account audit trail
  } = body;

  if (!userEmail || !clientName || !routeDay || !visitType) {
    return NextResponse.json(
      {
        error: "Required fields: userEmail, clientName, routeDay, visitType",
      },
      { status: 400 },
    );
  }

  if (userEmail === "ALL_ROUTES" || userEmail === "null") {
    return NextResponse.json(
      { error: "Invalid userEmail for write operation" },
      { status: 400 },
    );
  }

  const sheets = google.sheets({ version: "v4", auth });


  // Handle master account audit trail
  const isMaster = isMasterAccount(masterEmail || userEmail);
  const normalizedUserEmail = userEmail.toLowerCase().trim();
  const effectiveVendor =
    EMAIL_TO_VENDOR_LABELS[normalizedUserEmail] || normalizedUserEmail;

  const vendedor = effectiveVendor;

  // ✅ REVISED: Prefer explicit visitDate (date-only), otherwise use Mazatlán-local "today".
  const dateOnlyFromInput =
    typeof visitDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(visitDate)
      ? visitDate.slice(0, 10)
      : null;

  const nowUtc = new Date();
  const mazatlanOffset = -7; // GMT-7
  const mazatlanNow = new Date(nowUtc.getTime() + mazatlanOffset * 60 * 60 * 1000);

  const fecha = dateOnlyFromInput || mazatlanNow.toISOString().split("T")[0];

  // Use a stable midday timestamp for week calculations when we have a date-only input.
  const effectiveDateForWeek = dateOnlyFromInput
    ? new Date(`${fecha}T12:00:00.000Z`)
    : mazatlanNow;

  const weekNumber = getWeekNumber(effectiveDateForWeek);

  // ✅ Generate a unique ID for the visit
  const id_visita = `visit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const latitud = location?.lat || null;
  const longitud = location?.lng || null;

  // ✅ Updated data structure to match Metricas_Rutas headers:
  // id_visita, vendedor, cliente, fecha, dia_ruta, tipo_visita, semana, timestamp, notas, latitud, longitud
  const visitData = [
    id_visita,
    vendedor,
    clientName,
    fecha,
    routeDay,
    visitType,
    weekNumber,
    timestamp,
    notes || "",
    latitud,
    longitud,
  ];

  console.log("📊 Writing individual visit to Metricas_Rutas:", {
    id_visita,
    vendedor,
    cliente: clientName,
    fecha,
    dia_ruta: routeDay,
    tipo_visita: visitType,
    semana: weekNumber,
    latitud,
    longitud,
  });

  try {
    // Write to Metricas_Rutas
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'Metricas_Rutas'!A:K`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [visitData],
      },
    });

    // ✅ ADDED: If visit is completed, schedule next visit in Programacion_Semanal
    if (visitType === "completed") {
      await scheduleNextVisit(
        sheets,
        vendedor,
        clientName,
        routeDay,
        fecha,
        cleyVisitType,
      );
    }

    return NextResponse.json({
      success: true,
      message: "Visit recorded successfully in Metricas_Rutas sheet",
      data: {
        cliente: clientName,
        tipo_visita: visitType,
        fecha,
        vendedor,
      },
    });
  } catch (error) {
    console.error("❌ Error writing visit to Metricas_Rutas:", error);
    return NextResponse.json(
      { error: "Failed to record visit in sheet" },
      { status: 500 },
    );
  }
}

// ✅ ADDED: Function to schedule next visit in Programacion_Semanal
async function scheduleNextVisit(
  sheets: any,
  vendedor: string,
  clientName: string,
  routeDay: string,
  completedDate: string,
  cleyVisitType?: string,
) {
  try {
    // First, get client frequency from Clientes_Rutas sheet
    const clientsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'Clientes_Rutas'!A:H`,
    });

    const clientsData = clientsResponse.data.values;
    if (!clientsData || clientsData.length <= 1) {
      console.warn("No client data found for scheduling next visit");
      return;
    }

    // Find the client and get their frequency
    const headers = clientsData[0];

    const vendorEmail = getVendorEmailFromLabel(vendedor);
    const vendorIdentifiers = getVendorIdentifiers(vendorEmail);

    const clientRow = clientsData.slice(1).find((row: any[]) => {
      const rowVendor = row[6] || "";
      return (
        row[0] === clientName &&
        vendorIdentifiers.has(normalizeVendorValue(String(rowVendor)))
      );
    });

    if (!clientRow) {
      console.warn(`Client ${clientName} not found for vendor ${vendedor}`);
      return;
    }

    const frequencyIndex = headers.indexOf("Frecuencia");
    const tipoClienteIndex = headers.indexOf("Tipo_Cliente");
    const entregaIndex = headers.indexOf("Entrega");
    const diaIndex = headers.indexOf("Dia");

    const frequency =
      frequencyIndex >= 0 ? parseInt(clientRow[frequencyIndex]) || 2 : 2;
    const tipoCliente =
      tipoClienteIndex >= 0 ? clientRow[tipoClienteIndex] : "";
    const entregaDay = entregaIndex >= 0 ? clientRow[entregaIndex] : "";
    const pedidosDay = diaIndex >= 0 ? clientRow[diaIndex] : "";

    // ✅ NEW: Handle CLEY dual-visit scheduling
    if (tipoCliente?.toUpperCase() === "CLEY" && entregaDay && cleyVisitType) {
      // If this was a Pedidos visit, schedule the Entrega visit for the same week
      if (cleyVisitType === "Pedidos") {
        const completedDateObj = new Date(completedDate);
        const entregaDate = getNextDayOfWeek(completedDateObj, entregaDay);
        const entregaDateStr = entregaDate.toISOString().split("T")[0];

        const entregaWeek = getWeekNumber(entregaDate);
        const weekStart = new Date(entregaDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
        const weekStartStr = weekStart.toISOString().split("T")[0];

        // Schedule Entrega visit
        const entregaScheduleData = [
          entregaWeek,
          weekStartStr,
          entregaDay,
          `${clientName} (Entrega)`,
          vendedor,
          "",
          entregaDateStr,
          "Programado",
          2, // Order 2 for Entrega
        ];

        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `'Programacion_Semanal'!A:I`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [entregaScheduleData],
          },
        });

        console.log("📅 Scheduled CLEY Entrega visit:", entregaScheduleData);
        return; // Don't schedule regular frequency-based visit
      }
      // If this was an Entrega visit, schedule the next Pedidos visit based on frequency
      else if (cleyVisitType === "Entrega") {
        const completedDateObj = new Date(completedDate);
        const nextPedidosDate = new Date(completedDateObj);
        nextPedidosDate.setDate(nextPedidosDate.getDate() + frequency * 7);

        const nextPedidosWeek = getWeekNumber(nextPedidosDate);
        const weekStart = new Date(nextPedidosDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
        const weekStartStr = weekStart.toISOString().split("T")[0];

        // Schedule next Pedidos visit
        const pedidosScheduleData = [
          nextPedidosWeek,
          weekStartStr,
          pedidosDay,
          `${clientName} (Pedidos)`,
          vendedor,
          completedDate,
          nextPedidosDate.toISOString().split("T")[0],
          "Programado",
          1, // Order 1 for Pedidos
        ];

        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `'Programacion_Semanal'!A:I`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [pedidosScheduleData],
          },
        });

        console.log(
          "📅 Scheduled next CLEY Pedidos visit:",
          pedidosScheduleData,
        );
        return;
      }
    }

    // ✅ REGULAR CLIENT: Calculate next visit date (add frequency weeks to completed date)
    const completedDateObj = new Date(completedDate);
    const nextVisitDate = new Date(completedDateObj);
    nextVisitDate.setDate(nextVisitDate.getDate() + frequency * 7);
    const nextVisitDateStr = nextVisitDate.toISOString().split("T")[0];

    // Calculate week number and week start date for the next visit
    const nextVisitWeek = getWeekNumber(nextVisitDate);
    const weekStart = new Date(nextVisitDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
    const weekStartStr = weekStart.toISOString().split("T")[0];

    // Get current visit order (could be enhanced to read existing orders and increment)
    const visitOrder = 1; // Default order, could be made smarter

    // ✅ CORRECTED: Data for Programacion_Semanal matching actual structure:
    // semana_numero, fecha_inicio, dia_semana, cliente_nombre, vendedor, ultima_visita, proxima_visita_programada, estado, orden_visita
    const scheduleData = [
      nextVisitWeek, // semana_numero
      weekStartStr, // fecha_inicio (Monday of the week)
      routeDay, // dia_semana
      clientName, // cliente_nombre
      vendedor, // vendedor
      completedDate, // ultima_visita
      nextVisitDateStr, // proxima_visita_programada
      "Programado", // estado
      visitOrder, // orden_visita
    ];

    console.log("📅 Scheduling next visit in Programacion_Semanal:", {
      semana_numero: nextVisitWeek,
      fecha_inicio: weekStartStr,
      dia_semana: routeDay,
      cliente_nombre: clientName,
      vendedor: vendedor,
      ultima_visita: completedDate,
      proxima_visita_programada: nextVisitDateStr,
      estado: "Programado",
      orden_visita: visitOrder,
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'Programacion_Semanal'!A:I`, // Updated range to A:I for 9 columns
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [scheduleData],
      },
    });
  } catch (error) {
    console.error("❌ Error scheduling next visit:", error);
    // Don't fail the main operation if scheduling fails
  }
}


// Helper function to get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// Handle route summary updates (write to Rutas_Performance sheet)
async function updateRouteSummary(body: any) {
  const {
    userEmail,
    routeDay,
    fecha, // Date in YYYY-MM-DD format
    clientesProgramados,
    clientesVisitados,
    ventasTotales = 0,
    tiempoInicio,
    tiempoFin,
    kilometrosRecorridos = 0,
    combustibleGastado = 0,
    observaciones = "",
  } = body;

  if (
    !userEmail ||
    !routeDay ||
    !fecha ||
    clientesProgramados === undefined ||
    clientesVisitados === undefined
  ) {
    return NextResponse.json(
      {
        error:
          "Required fields: userEmail, routeDay, fecha, clientesProgramados, clientesVisitados",
      },
      { status: 400 },
    );
  }

  if (userEmail === "ALL_ROUTES" || userEmail === "null") {
    return NextResponse.json(
      { error: "Invalid userEmail for write operation" },
      { status: 400 },
    );
  }

  const sheets = google.sheets({ version: "v4", auth });

  const normalizedUserEmail = userEmail.toLowerCase().trim();
  const vendedor =
    EMAIL_TO_VENDOR_LABELS[normalizedUserEmail] || normalizedUserEmail;

  // Data matching the exact sheet columns:
  // fecha,dia_ruta,vendedor,clientes_programados,clientes_visitados,ventas_totales,tiempo_inicio,tiempo_fin,kilometros_recorridos,combustible_gastado,observaciones
  const performanceData = [
    fecha,
    routeDay,
    vendedor,
    clientesProgramados,
    clientesVisitados,
    ventasTotales,
    tiempoInicio || "",
    tiempoFin || "",
    kilometrosRecorridos,
    combustibleGastado,
    observaciones,
  ];

  console.log("📊 Writing to Rutas_Performance:", {
    fecha,
    dia_ruta: routeDay,
    vendedor,
    clientes_programados: clientesProgramados,
    clientes_visitados: clientesVisitados,
    ventas_totales: ventasTotales,
    tiempo_inicio: tiempoInicio,
    tiempo_fin: tiempoFin,
    kilometros_recorridos: kilometrosRecorridos,
    combustible_gastado: combustibleGastado,
    observaciones,
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'Rutas_Performance'!A:K`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [performanceData],
    },
  });

  // Also update weekly schedule with actual performance
  try {
    await updateWeeklyScheduleFromPerformance({
      userEmail,
      routeDay,
      fecha,
      clientesProgramados,
      clientesVisitados,
      vendedor,
    });
  } catch (error) {
    console.warn("Failed to update weekly schedule:", error);
    // Don't fail the main operation if weekly schedule update fails
  }

  return NextResponse.json({
    success: true,
    message: "Route summary updated successfully in Rutas_Performance sheet",
    data: {
      fecha,
      dia_ruta: routeDay,
      vendedor,
      clientes_programados: clientesProgramados,
      clientes_visitados: clientesVisitados,
    },
  });
}

// Handle weekly schedule updates (write to Programacion_Semanal sheet)
async function updateWeeklySchedule(body: any) {
  const {
    userEmail,
    semana, // Week number or date range
    clientes, // Array of client objects with their scheduled days
    vendedor,
  } = body;

  if (!userEmail || !semana || !clientes || !Array.isArray(clientes)) {
    return NextResponse.json(
      {
        error: "Required fields: userEmail, semana, clientes (array)",
      },
      { status: 400 },
    );
  }

  if (userEmail === "ALL_ROUTES" || userEmail === "null") {
    return NextResponse.json(
      { error: "Invalid userEmail for write operation" },
      { status: 400 },
    );
  }

  const sheets = google.sheets({ version: "v4", auth });

  const normalizedUserEmail = userEmail.toLowerCase().trim();
  const vendedorName =
    vendedor ||
    EMAIL_TO_VENDOR_LABELS[normalizedUserEmail] ||
    normalizedUserEmail;

  // Calculate week start date
  const weekStartDate = new Date();
  const weekNumber =
    typeof semana === "number"
      ? semana
      : parseInt(semana) || getWeekNumber(new Date());

  // ✅ CORRECTED: Expected Programacion_Semanal columns:
  // semana_numero, fecha_inicio, dia_semana, cliente_nombre, vendedor, ultima_visita, proxima_visita_programada, estado, orden_visita
  const scheduleRows = clientes.map((client: any, index: number) => [
    weekNumber, // semana_numero
    weekStartDate.toISOString().split("T")[0], // fecha_inicio
    client.dia, // dia_semana
    client.nombre, // cliente_nombre
    vendedorName, // vendedor
    "", // ultima_visita (empty for new schedules)
    client.fechaProgramada || "", // proxima_visita_programada
    "Programado", // estado
    index + 1, // orden_visita
  ]);

  console.log("📅 Writing to Programacion_Semanal:", {
    semana_numero: weekNumber,
    vendedor: vendedorName,
    clientCount: clientes.length,
    scheduleRows: scheduleRows.slice(0, 3), // Log first 3 rows for debugging
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'Programacion_Semanal'!A:I`, // Updated range to A:I for 9 columns
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: scheduleRows,
    },
  });

  return NextResponse.json({
    success: true,
    message:
      "Weekly schedule updated successfully in Programacion_Semanal sheet",
    data: {
      semana_numero: weekNumber,
      vendedor: vendedorName,
      clientes_programados: clientes.length,
    },
  });
}

// Helper function to update weekly schedule from performance data
async function updateWeeklyScheduleFromPerformance(performanceData: any) {
  const {
    userEmail,
    routeDay,
    fecha,
    clientesProgramados,
    clientesVisitados,
    vendedor,
  } = performanceData;

  const sheets = google.sheets({ version: "v4", auth });

  // Calculate week number and week start date
  const date = new Date(fecha);
  const weekNumber = getWeekNumber(date);
  const weekStart = new Date(date.setDate(date.getDate() - date.getDay() + 1)); // Monday of that week
  const weekStartStr = weekStart.toISOString().split("T")[0];

  // ✅ CORRECTED: Update weekly schedule with actual performance using correct structure
  // semana_numero, fecha_inicio, dia_semana, cliente_nombre, vendedor, ultima_visita, proxima_visita_programada, estado, orden_visita
  const scheduleData = [
    weekNumber, // semana_numero
    weekStartStr, // fecha_inicio
    routeDay, // dia_semana
    `Resumen ${routeDay} (${clientesVisitados}/${clientesProgramados})`, // cliente_nombre (summary entry)
    vendedor, // vendedor
    fecha, // ultima_visita (route completion date)
    "", // proxima_visita_programada (empty for summary)
    clientesVisitados === clientesProgramados ? "Completado" : "Parcial", // estado
    999, // orden_visita (high number for summary entries)
  ];

  console.log("📅 Updating Programacion_Semanal with performance data:", {
    semana_numero: weekNumber,
    fecha_inicio: weekStartStr,
    dia_semana: routeDay,
    vendedor,
    performance: `${clientesVisitados}/${clientesProgramados}`,
    estado:
      clientesVisitados === clientesProgramados ? "Completado" : "Parcial",
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'Programacion_Semanal'!A:I`, // ✅ CORRECTED: Updated to A:I for 9 columns
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [scheduleData],
    },
  });
}

// Helper function to get the next occurrence of a specific day of the week
function getNextDayOfWeek(currentDate: Date, targetDay: string): Date {
  const dayMap: Record<string, number> = {
    Domingo: 0,
    Lunes: 1,
    Martes: 2,
    Miercoles: 3,
    Jueves: 4,
    Viernes: 5,
    Sabado: 6,
  };

  const targetDayNum = dayMap[targetDay];
  if (targetDayNum === undefined) {
    console.warn(`Unknown day: ${targetDay}, defaulting to next day`);
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay;
  }

  const currentDayNum = currentDate.getDay();
  let daysToAdd = targetDayNum - currentDayNum;

  // If target day is today or already passed this week, go to next week
  if (daysToAdd <= 0) {
    daysToAdd += 7;
  }

  const nextDate = new Date(currentDate);
  nextDate.setDate(nextDate.getDate() + daysToAdd);
  return nextDate;
}
