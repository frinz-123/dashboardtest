import { google } from "googleapis";
import { NextResponse } from "next/server";

// Force dynamic rendering for this API route
export const dynamic = "force-dynamic";

const auth = new google.auth.GoogleAuth({
  credentials: {
    type: "service_account",
    project_id: "light-legend-427200-q9",
    private_key_id: "d6d5b9ed0d50c7df921a85d7823a0a6c0ad31c6c",
    private_key:
      "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCL9FQTF3JAkzgU\nw8srlOOAdn2FKAF78Xa0XRdOYJmPs1LF+hzbO6P73zr9qHBLOZ/+Y3WFFrmLNnny\n3G+vlcPAtzsWj+CYRvKxeKpr4VtBTd/01btNZB32DRjW4MzazRm9tJmbqdTdF2tr\nYaRWohCpHJMBMsJ5moP++TgMA3I5nFfljkbr1Liso/yKJKG7Xm1UCnSvQfRkXSrV\nJaq0rApbY8/rA5TQF0NW28KtC++EIJnzL7WthRQGqw6bjuAHX70Q1tt/ntJ0K0Oc\nvXG3svTenwHrvyqWIFjgUiUI+3rGZdz08aZGMLFzEpGDHf2eLGp0x+dxx9ogoSdi\n9IXVA+6zAgMBAAECggEADBW16Mwefnr33bsmYQYDOwWAQy44KpaoFFzxdUAcIm9u\nl0/IjBmzSD13X43a3HQGX7YA4NQcg2vZzeHA9x1sgMiRnpof36ZIsJBlztjvw0zR\nKNgHy1/4wlVRLsTMi5woO9xLY0if69No4CXXRe/Kln+0JedXKZ7xBORKNadahqTb\nrotXOk5ucr20+f5kUBwVQLM1pnJtC2MwWpx4YEDag/tah/ZoH7cYaHcJ5mi9eusL\nVwvVwMx5b1ox8yNVA+i00imBNUULul1U67YREXL05U4u5ixgyej3raJmCZ56T0/9\ncGrne9KgN6ezOsvEvTwtoYejHp2K8oWu227Hut3amQKBgQDFSpKD9nuxAAwBb4xS\nniMA5mamskhCuCiOF33+oV1JAuytMaQHslKp9qTHo/5QmfykfDxvWKo8UTqtaEI8\n6pRBrVkGSm9Oc5546qvIb+Cq5nNdDOIXVG2RnNBI3lpca9Ewquo4wWOto3mbgbfs\n6zOx4t6WnmBy9jFQq30jmIUB7wKBgQC1meWPZ0WLLByV1IzlMKqZ8ntkPPAgbEYt\nGnIFV4QCrRxpMKr1YjPg03XMmeum+3zt/xACfdR0Gm0b4ZZeHTbvBadjt3VobxAa\nlVf4d+hwly1mJ68GZWbjX9KUMU0djI4IyCLYp2cXs+pwcQAHsleLkloExRQveaot\nnO2gribTfQKBgB3qBbcum2imGivpjvxD8AjF5pCl/aDoLXYGB9ug+fUFFX/ZRAbK\nug/9TtTaf8gW4SDLmZpEdmN46Y27fjegVeRzdUkn5iKeE0xAQNW+aPFgyeM0/d8N\ntSNcBJTX6hmTW3+mmqcKY6PDYr/6djndG9SAEsIBt5wWyjlyFyJbkOdPAoGBALKj\nlOIgIJTq66On1oGOAgQ2N5M/Lqd2WwH7RbZjhIRtbck8CrAfzhCXcwW1U86LDTXA\n9iq9RMSBSltm6dfivSsbULISwffdaOX9iu/sZEZ9MDeRSebs0O1SUX9dkBJFNWMG\nHOEqq4rxfOjm/7SShvPRH6QZieW5tOHxwP+S0LaxAoGAft9TEPSxzuplIZxTFpck\nVtgSkAqzy3co1PxOk3p1BgG0vMnrEZZOs6VW/qq1QYOm/4w935Pzl0cBQzBMYBnp\n58cH9OkbB0ao2mmeVHmvyhb0jggaTCfJ9QP+iF4GiLOFQm2fFWxKDAglQEtkBVHx\nNWkTHRHBD62hk+H2ffZ1TQo=\n-----END PRIVATE KEY-----\n",
    client_email: "cesar-reyes@light-legend-427200-q9.iam.gserviceaccount.com",
    client_id: "113188820672311170516",
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const spreadsheetId =
  process.env.NEXT_PUBLIC_SPREADSHEET_ID ||
  "1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g";
const sheetName = process.env.NEXT_PUBLIC_SHEET_NAME || "Form_Data";

// Product mapping from column letters to product names
const PRODUCT_COLUMNS = {
  I: "Chiltepin Molido 50 g",
  J: "Chiltepin Molido 20 g",
  K: "Chiltepin Entero 30 g",
  L: "Salsa Chiltepin El rey 195 ml",
  M: "Salsa Especial El Rey 195 ml",
  N: "Salsa Reina El rey 195 ml",
  O: "Salsa Habanera El Rey 195 ml",
  P: "Paquete El Rey",
  Q: "Molinillo El Rey 30 g",
  R: "Tira Entero",
  S: "Tira Molido",
  T: "Salsa chiltepin Litro",
  U: "Salsa Especial Litro",
  V: "Salsa Reina Litro",
  W: "Salsa Habanera Litro",
  X: "Michela Mix Tamarindo",
  Y: "Michela Mix Mango",
  Z: "Michela Mix Sandia",
  AA: "Michela Mix Fuego",
  AB: "El Rey Mix Original",
  AC: "El Rey Mix Especial",
  AD: "Medio Kilo Chiltepin Entero",
  AI: "Michela Mix Picafresa",
  AJ: "Habanero Molido 50 g",
  AK: "Habanero Molido 20 g",
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const clientName = searchParams.get("client");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const sheets = google.sheets({ version: "v4", auth });

    if (action === "clients") {
      // Get all unique clients
      const clientData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:C`,
      });

      const clients: Record<string, { lat: number; lng: number }> = {};
      if (clientData.data.values) {
        clientData.data.values.slice(1).forEach((row: any[]) => {
          const name = row[0];
          if (name && row[1] && row[2]) {
            clients[name] = {
              lat: parseFloat(row[1]),
              lng: parseFloat(row[2]),
            };
          }
        });
      }

      return NextResponse.json({
        success: true,
        data: Object.keys(clients).sort(),
      });
    }

    if (action === "client-data" && clientName) {
      // Get all sales data
      const salesData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:AN`,
      });

      if (!salesData.data.values) {
        return NextResponse.json({
          success: true,
          data: {
            recentEntries: [],
            yearlySales: 0,
            allTimeSales: 0,
            productBreakdown: {},
            salesTrend: [],
          },
        });
      }

      // Filter data for specific client
      const clientEntries = salesData.data.values
        .slice(1) // Skip header
        .filter((row: any[]) => row[0] === clientName)
        .map((row: any[], index: number) => {
          // Parse products from the row
          const products: Record<string, number> = {};
          Object.entries(PRODUCT_COLUMNS).forEach(([col, productName]) => {
            const colIndex = columnToIndex(col);
            if (row[colIndex] && parseInt(row[colIndex], 10) > 0) {
              products[productName] = parseInt(row[colIndex], 10);
            }
          });

          return {
            id: index,
            clientName: row[0],
            clientCode: row[31] || "",
            date: row[32] || "",
            total: parseFloat(row[33] || "0"),
            userEmail: row[7] || "",
            location: {
              clientLat: row[1] || "",
              clientLng: row[2] || "",
              currentLat: row[5] || "",
              currentLng: row[6] || "",
            },
            products,
            periodWeek: row[37] || "",
            cleyOrderValue: row[38] || "",
          };
        })
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );

      // Calculate analytics
      const currentYear = new Date().getFullYear();
      const yearlyEntries = clientEntries.filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate.getFullYear() === currentYear;
      });

      const yearlySales = yearlyEntries.reduce(
        (sum, entry) => sum + entry.total,
        0,
      );
      const allTimeSales = clientEntries.reduce(
        (sum, entry) => sum + entry.total,
        0,
      );

      // Product breakdown (all time)
      const productBreakdown: Record<
        string,
        { quantity: number; revenue: number }
      > = {};
      clientEntries.forEach((entry) => {
        Object.entries(entry.products).forEach(([product, quantity]) => {
          if (!productBreakdown[product]) {
            productBreakdown[product] = { quantity: 0, revenue: 0 };
          }
          productBreakdown[product].quantity += quantity;
          // We don't have individual product prices in the data, so we'll skip revenue calculation for now
        });
      });

      // Sales trend (last 12 months)
      const salesTrend = generateSalesTrend(clientEntries);

      // Recent entries (limited)
      const recentEntries = clientEntries.slice(0, limit);

      return NextResponse.json({
        success: true,
        data: {
          recentEntries,
          yearlySales,
          allTimeSales,
          productBreakdown,
          salesTrend,
          totalEntries: clientEntries.length,
        },
      });
    }

    if (action === "seller-analytics") {
      console.log("👥 Seller Analytics endpoint called");

      // Get date range parameters
      const dateFrom = searchParams.get("dateFrom");
      const dateTo = searchParams.get("dateTo");
      console.log("📅 Date filters:", { dateFrom, dateTo });

      // Get seller-specific analytics
      const sellerSalesData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:AN`,
      });

      console.log(
        "👥 Seller Analytics - Google Sheets response:",
        sellerSalesData.data.values?.length,
        "rows",
      );

      if (
        !sellerSalesData.data.values ||
        sellerSalesData.data.values.length < 2
      ) {
        console.log("⚠️ No data available for seller analytics");
        return NextResponse.json({
          success: true,
          data: {
            sellers: [],
            totalSellers: 0,
          },
        });
      }

      // Get all rows for processing (like the working analytics API)
      const allRows = sellerSalesData.data.values.slice(1);
      // ✅ CORRECTED: Use Column AN (index 39) where vendedor is actually stored
      const anIndexForVendedor = columnToIndex("AN"); // Column AN where vendedor assignments are stored
      console.log(
        "👥 Seller Analytics - Using Column AN (index",
        anIndexForVendedor,
        ") for vendedor data",
      );
      console.log(
        "👥 Seller Analytics - Headers around Column AN:",
        sellerSalesData.data.values[0]?.slice(37, 42),
      );

      // First, build client-vendedor mapping using Column AN (like existing analytics)
      const clientVendedores: Record<string, string> = {};
      let foundVendedores = 0;
      // Process rows in reverse order (most recent first)
      for (let i = allRows.length - 1; i >= 0; i--) {
        const row = allRows[i];
        const name = row[0];
        const vendedor = row[anIndexForVendedor]; // Using Column AN where vendedor assignments are stored
        if (name && vendedor && !clientVendedores[name]) {
          clientVendedores[name] = vendedor;
          foundVendedores++;
          if (foundVendedores <= 5) {
            console.log(`👤 Client: ${name} -> Vendedor: ${vendedor}`);
          }
        }
      }
      console.log(
        "📋 Total client-vendedor mappings found:",
        Object.keys(clientVendedores).length,
      );

      // Now parse entries with products and assign vendedor from mapping
      const entries = allRows.map((row: any[], rowIndex) => {
        const products = Object.entries(PRODUCT_COLUMNS).reduce(
          (acc, [col, productName]) => {
            const colIndex = columnToIndex(col);
            const quantity = row[colIndex];
            const parsedQuantity = parseInt(quantity || "0", 10);
            if (quantity && parsedQuantity > 0) {
              acc[productName] = parsedQuantity;
            }
            return acc;
          },
          {} as Record<string, number>,
        );

        const clientName = row[0] || "";
        const vendedor = clientVendedores[clientName] || "Sin Asignar";

        // Debug first few entries
        if (rowIndex < 3) {
          console.log(
            `👥 Row ${rowIndex} client:`,
            clientName,
            "vendedor from Column AN:",
            vendedor,
          );
          console.log(
            `👥 Row ${rowIndex} has products:`,
            Object.keys(products).length > 0,
          );
        }

        return {
          clientName,
          date: row[32] || "",
          total: parseFloat(row[33] || "0"),
          products,
          vendedor,
          userEmail: row[7] || "", // userEmail from Column H, vendedor from Column AN mapping
          location: {
            clientLat: row[1] || "", // ClientLatitude
            clientLng: row[2] || "", // ClientLongitude
          },
        };
      });

      console.log("👥 All entries before filtering:", entries.length);

      const entriesWithVendedor = entries.filter(
        (entry) => entry.vendedor && entry.vendedor !== "Sin Asignar",
      );
      console.log("👥 Entries with vendedor:", entriesWithVendedor.length);

      const entriesWithProducts = entries.filter(
        (entry) => Object.keys(entry.products).length > 0,
      );
      console.log("👥 Entries with products:", entriesWithProducts.length);

      const filteredEntries = entries.filter(
        (entry) =>
          entry.vendedor &&
          entry.vendedor !== "Sin Asignar" &&
          Object.keys(entry.products).length > 0,
      );
      console.log(
        "👥 Entries with both vendedor and products:",
        filteredEntries.length,
      );

      // Filter by date range
      // Default to current year if no date range provided
      const currentYear = new Date().getFullYear();
      const defaultDateFrom = `${currentYear}-01-01`;
      const defaultDateTo = new Date().toISOString().split("T")[0];

      const fromDate = dateFrom
        ? new Date(dateFrom)
        : new Date(defaultDateFrom);
      const toDate = dateTo ? new Date(dateTo) : new Date(defaultDateTo);

      // Set time to end of day for toDate to include the entire day
      toDate.setHours(23, 59, 59, 999);

      const dateFilteredEntries = filteredEntries.filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate >= fromDate && entryDate <= toDate;
      });

      console.log(
        "👥 Seller Analytics - Total entries after parsing:",
        entries.length,
      );
      console.log(
        "👥 Seller Analytics - Date filtered entries:",
        dateFilteredEntries.length,
      );
      console.log("👥 Date range used:", {
        from: fromDate.toISOString().split("T")[0],
        to: toDate.toISOString().split("T")[0],
      });

      // Generate seller analytics
      const sellerAnalytics = generateSellerAnalytics(dateFilteredEntries);

      console.log("👥 Generated seller analytics:", {
        totalSellers: sellerAnalytics.totalSellers,
        sellersCount: sellerAnalytics.sellers.length,
      });

      const periodLabel =
        dateFrom || dateTo
          ? `${dateFrom || defaultDateFrom} al ${dateTo || defaultDateTo}`
          : "Año actual";

      return NextResponse.json({
        success: true,
        data: {
          sellers: sellerAnalytics.sellers,
          totalSellers: sellerAnalytics.totalSellers,
          period: periodLabel,
        },
      });
    }

    if (action === "analytics") {
      // Get date range parameters
      const dateFrom = searchParams.get("dateFrom");
      const dateTo = searchParams.get("dateTo");
      console.log("📅 Analytics date filters:", { dateFrom, dateTo });

      // Get overall analytics
      const salesData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:AN`,
      });

      console.log(
        "📊 Google Sheets response:",
        salesData.data.values?.length,
        "rows",
      );

      console.log("🔍 Full Google Sheets data structure:");
      console.log(
        "   Total values array length:",
        salesData.data.values?.length,
      );
      console.log("   First row (headers):", salesData.data.values?.[0]);
      console.log("   Second row (first data):", salesData.data.values?.[1]);
      console.log(
        "   Last row:",
        salesData.data.values?.[salesData.data.values.length - 1],
      );

      // Check if we have headers and data
      if (!salesData.data.values || salesData.data.values.length < 2) {
        console.log("⚠️  No data or insufficient rows in sheet");
      } else {
        console.log("✅ Sheet has headers and data rows");
      }

      // Debug: Show column structure
      if (salesData.data.values && salesData.data.values.length > 0) {
        const headerRow = salesData.data.values[0];
        console.log("🔍 Sheet headers (first 15):", headerRow.slice(0, 15));
        console.log("🔍 Total columns:", headerRow.length);
        console.log("🔍 Column indices for products:");
        Object.entries(PRODUCT_COLUMNS).forEach(([col, _productName]) => {
          const colIndex = columnToIndex(col);
          console.log(
            `  ${col} -> Index ${colIndex} -> Header: ${headerRow[colIndex] || "MISSING"}`,
          );
        });
      }

      if (!salesData.data.values) {
        return NextResponse.json({
          success: true,
          data: {
            totalSales: 0,
            totalClients: 0,
            topProducts: [],
            monthlyTrend: [],
            topClients: [],
            clientStats: {},
          },
        });
      }

      const afIndexForCode = columnToIndex("AF");
      // Parse ALL entries (including $0 sales) - don't filter by products yet
      const allEntries = salesData.data.values
        .slice(1)
        .map((row: any[], rowIndex) => {
          const products = Object.entries(PRODUCT_COLUMNS).reduce(
            (acc, [col, productName]) => {
              const colIndex = columnToIndex(col);
              const quantity = row[colIndex];
              const parsedQuantity = parseInt(quantity || "0", 10);

              if (quantity && parsedQuantity > 0) {
                acc[productName] = parsedQuantity;
              }
              return acc;
            },
            {} as Record<string, number>,
          );

          const codeRaw = (row[afIndexForCode] || "").toString();
          const code = codeRaw.trim().toUpperCase();

          // Debug: Log products for first few rows
          if (rowIndex < 5) {
            console.log(`\n🚨 Row ${rowIndex + 1} Analysis:`);
            console.log(`   Client: ${row[0]}`);
            console.log(`   Date: ${row[32]}`);
            console.log(`   Total: ${row[33]}`);
            console.log(`   Has products: ${Object.keys(products).length > 0}`);
            console.log(`   🎯 Final products:`, products);
          }

          return {
            clientName: row[0],
            date: row[32] || "",
            total: parseFloat(row[33] || "0"),
            products,
            code,
            hasSale:
              Object.keys(products).length > 0 ||
              parseFloat(row[33] || "0") > 0,
          };
        });

      // Keep ALL entries for visit tracking (no filter)
      const entries = allEntries;

      // Separate array for entries with actual sales (for product stats)
      const salesEntries = allEntries.filter(
        (entry) => Object.keys(entry.products).length > 0,
      );

      // Apply date filtering
      let yearlyEntries: any[];
      let yearlySalesEntries: any[];

      if (dateFrom && dateTo) {
        const startDate = new Date(dateFrom);
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999); // Include the entire end date
        console.log("📅 Filtering by custom date range:", {
          startDate,
          endDate,
        });

        // Filter ALL entries (including $0 visits) by date range
        yearlyEntries = entries.filter((entry) => {
          const entryDate = new Date(entry.date);
          return entryDate >= startDate && entryDate <= endDate;
        });

        // Filter only sales entries by date range (for product stats)
        yearlySalesEntries = salesEntries.filter((entry) => {
          const entryDate = new Date(entry.date);
          return entryDate >= startDate && entryDate <= endDate;
        });
      } else {
        // Default to current year
        const currentYear = new Date().getFullYear();
        console.log("📅 Filtering for year:", currentYear);

        // Filter ALL entries (including $0 visits) by current year
        yearlyEntries = entries.filter((entry) => {
          const entryDate = new Date(entry.date);
          const isCurrentYear = entryDate.getFullYear() === currentYear;
          if (!isCurrentYear && Math.random() < 0.1) {
            console.log(
              `❌ Filtered out entry from ${entryDate.getFullYear()}: ${entry.date}`,
            );
          }
          return isCurrentYear;
        });

        // Filter only sales entries by current year (for product stats)
        yearlySalesEntries = salesEntries.filter((entry) => {
          const entryDate = new Date(entry.date);
          return entryDate.getFullYear() === currentYear;
        });
      }

      console.log("📈 Total visits (all entries):", yearlyEntries.length);
      console.log("📈 Visits with sales:", yearlySalesEntries.length);

      const totalSales = yearlyEntries.reduce(
        (sum, entry) => sum + entry.total,
        0,
      );
      const uniqueClients = new Set(
        yearlyEntries.map((entry) => entry.clientName),
      ).size;

      const clientVisitDates: Record<string, string[]> = {};

      // Client statistics - Track ALL visits but separate sales metrics
      const clientStats: Record<
        string,
        {
          totalSales: number;
          entries: number; // Total visits (including $0)
          salesEntries: number; // Only visits with sales
          avgOrder: number;
          lastVisit: string; // Last visit of any kind
          lastSaleVisit: string; // Last visit with actual sale
          avgDaysBetweenVisits: number | null;
        }
      > = {};

      // First pass: Count ALL visits (including $0)
      yearlyEntries.forEach((entry) => {
        if (!clientStats[entry.clientName]) {
          clientStats[entry.clientName] = {
            totalSales: 0,
            entries: 0,
            salesEntries: 0,
            avgOrder: 0,
            lastVisit: "",
            lastSaleVisit: "",
            avgDaysBetweenVisits: null,
          };
        }

        if (!clientVisitDates[entry.clientName]) {
          clientVisitDates[entry.clientName] = [];
        }
        if (entry.date) {
          clientVisitDates[entry.clientName].push(entry.date);
        }

        // Count every visit
        clientStats[entry.clientName].entries += 1;

        // Track total sales (even if $0)
        clientStats[entry.clientName].totalSales += entry.total;

        // Update lastVisit with ANY visit
        if (
          !clientStats[entry.clientName].lastVisit ||
          new Date(entry.date) >
            new Date(clientStats[entry.clientName].lastVisit)
        ) {
          clientStats[entry.clientName].lastVisit = entry.date;
        }

        // Track sales visits separately
        if (entry.hasSale) {
          clientStats[entry.clientName].salesEntries += 1;

          // Update lastSaleVisit only for visits with sales
          if (
            !clientStats[entry.clientName].lastSaleVisit ||
            new Date(entry.date) >
              new Date(clientStats[entry.clientName].lastSaleVisit)
          ) {
            clientStats[entry.clientName].lastSaleVisit = entry.date;
          }
        }
      });

      // Calculate average order based only on visits with sales (exclude $0 visits)
      Object.entries(clientStats).forEach(([clientName, stats]) => {
        stats.avgOrder =
          stats.salesEntries > 0 ? stats.totalSales / stats.salesEntries : 0;
        stats.avgDaysBetweenVisits = computeAverageDaysBetweenVisits(
          clientVisitDates[clientName] || [],
        );
      });

      console.log(
        "📊 Sample client stats:",
        Object.entries(clientStats)
          .slice(0, 3)
          .map(([name, stats]) => ({
            name,
            totalVisits: stats.entries,
            salesVisits: stats.salesEntries,
            conversionRate: `${Math.round((stats.salesEntries / stats.entries) * 100)}%`,
            lastVisit: stats.lastVisit,
            lastSaleVisit: stats.lastSaleVisit,
          })),
      );

      // Top clients by sales
      const topClients = Object.entries(clientStats)
        .map(([client, stats]) => ({ client, ...stats }))
        .sort((a, b) => b.totalSales - a.totalSales)
        .slice(0, 50);

      // Top products - use only sales entries (with products)
      const productStats: Record<
        string,
        { quantity: number; revenue: number }
      > = {};
      yearlySalesEntries.forEach((entry, entryIndex) => {
        Object.entries(entry.products).forEach(([product, quantity]) => {
          if (!productStats[product]) {
            productStats[product] = { quantity: 0, revenue: 0 };
          }

          // Log suspiciously high quantities
          if (quantity > 1000) {
            console.log(
              `🚨 High quantity detected: ${product} = ${quantity} in entry ${entryIndex} (${entry.clientName})`,
            );
          }

          productStats[product].quantity += quantity;
        });
      });

      const topProducts = Object.entries(productStats)
        .map(([product, stats]) => ({ product, ...stats }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      console.log("Product statistics:", productStats);
      console.log("Top products calculated:", topProducts);

      // If no products were found (all filtered out), provide fallback data
      if (topProducts.length === 0) {
        console.log("⚠️  No valid products found, using fallback data");
        // This will help identify if the issue is with all data being filtered out
      }

      // Monthly trend
      const monthlyTrend = generateMonthlyTrend(yearlyEntries);

      // Get all rows for mapping operations
      const allRows = salesData.data.values.slice(1);

      // Build client code mapping from the full sheet (first non-empty AF per client)
      const afIndex = columnToIndex("AF");
      const clientCodes: Record<string, string> = {};
      // Process rows in reverse order like navegar page does (most recent first)
      for (let i = allRows.length - 1; i >= 0; i--) {
        const row = allRows[i];
        const name = row[0];
        const code = row[afIndex];
        if (name && code && !clientCodes[name]) {
          clientCodes[name] = code;
        }
      }

      // Build client vendedor mapping from ALL sheet data (not just current year)
      const anIndex = columnToIndex("AN");
      console.log("🔍 AN column index calculation:");
      console.log('  - columnToIndex("AN"):', anIndex);
      console.log("  - Manual calculation: A=1, N=14, 1*26+14=40, 40-1=39");
      console.log("  - Should be 39 for column AN");
      console.log(
        "🔍 Total columns in sheet:",
        salesData.data.values?.[0]?.length,
      );
      console.log(
        "🔍 Headers array length:",
        salesData.data.values?.[0]?.length,
      );
      console.log("🔍 All headers:", salesData.data.values?.[0]);
      console.log(
        "🔍 Sample header row for AN column:",
        salesData.data.values?.[0]?.[anIndex],
      );
      console.log("🔍 Column AF index:", columnToIndex("AF"));
      console.log(
        "🔍 Column AF header:",
        salesData.data.values?.[0]?.[columnToIndex("AF")],
      );

      // Debug: Check what columns exist beyond AK
      const akIndex = columnToIndex("AK");
      console.log("🔍 Column AK index:", akIndex);
      console.log(
        "🔍 Column AK header:",
        salesData.data.values?.[0]?.[akIndex],
      );
      console.log("🔍 Column AL index:", columnToIndex("AL"));
      console.log(
        "🔍 Column AL header:",
        salesData.data.values?.[0]?.[columnToIndex("AL")],
      );
      console.log("🔍 Column AM index:", columnToIndex("AM"));
      console.log(
        "🔍 Column AM header:",
        salesData.data.values?.[0]?.[columnToIndex("AM")],
      );
      console.log("🔍 Column AN index:", columnToIndex("AN"));
      console.log(
        "🔍 Column AN header:",
        salesData.data.values?.[0]?.[columnToIndex("AN")],
      );

      const clientVendedores: Record<string, string> = {};
      let foundVendedores = 0;
      // Process rows in reverse order like navegar page does (most recent first)
      for (let i = allRows.length - 1; i >= 0; i--) {
        const row = allRows[i];
        const name = row[0];
        const vendedor = row[anIndex];
        if (name && vendedor && !clientVendedores[name]) {
          clientVendedores[name] = vendedor;
          foundVendedores++;
          console.log(`👤 Client: ${name} -> Vendedor: ${vendedor}`);
        }
      }

      console.log(
        "📋 Total client-vendedor mappings found:",
        Object.keys(clientVendedores).length,
      );
      console.log("📋 Vendedores found during processing:", foundVendedores);
      console.log(
        "📋 Sample mappings:",
        Object.entries(clientVendedores).slice(0, 5),
      );

      // Aggregate products by per-row code (AF), normalized - use only sales entries
      const productsByCode: Record<string, Record<string, number>> = {};
      yearlySalesEntries.forEach((entry: any) => {
        const code = (entry.code || "").toString().trim().toUpperCase();
        if (!code) return;
        if (!productsByCode[code]) productsByCode[code] = {};
        Object.entries(entry.products).forEach(([product, quantity]) => {
          productsByCode[code][product] =
            (productsByCode[code][product] || 0) + (quantity || 0);
        });
      });

      // Aggregate sales stats by code (similar to clientStats but grouped by code)
      const codeStats: Record<
        string,
        {
          totalSales: number;
          entries: number;
          salesEntries: number;
          avgOrder: number;
        }
      > = {};

      yearlyEntries.forEach((entry: any) => {
        const code = (entry.code || "").toString().trim().toUpperCase();
        if (!code) return;

        if (!codeStats[code]) {
          codeStats[code] = {
            totalSales: 0,
            entries: 0,
            salesEntries: 0,
            avgOrder: 0,
          };
        }

        codeStats[code].entries += 1;
        codeStats[code].totalSales += entry.total;

        if (entry.hasSale) {
          codeStats[code].salesEntries += 1;
        }
      });

      // Calculate average order for each code based on sales entries
      Object.values(codeStats).forEach((stats) => {
        stats.avgOrder =
          stats.salesEntries > 0 ? stats.totalSales / stats.salesEntries : 0;
      });

      // Top codes by sales (similar to topClients)
      const topCodigos = Object.entries(codeStats)
        .map(([code, stats]) => ({ code, ...stats }))
        .sort((a, b) => b.totalSales - a.totalSales)
        .slice(0, 50);

      console.log("📊 Top Codigos calculated:", topCodigos.slice(0, 5));

      const responseData = {
        totalSales,
        totalClients: uniqueClients,
        topProducts,
        monthlyTrend,
        topClients,
        clientStats,
        clientCodes,
        clientVendedores,
        productsByCode,
        topCodigos,
      };
      console.log("Final analytics response:", responseData);
      return NextResponse.json({
        success: true,
        data: responseData,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Invalid action parameter",
      },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error in clientes API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

function generateSellerAnalytics(entries: any[]) {
  // Group entries by vendedor
  const salesByVendedor = entries.reduce(
    (acc, entry) => {
      const vendedor = entry.vendedor || "Sin Asignar";
      if (!acc[vendedor]) acc[vendedor] = [];
      acc[vendedor].push(entry);
      return acc;
    },
    {} as Record<string, any[]>,
  );

  console.log("👥 Found sellers:", Object.keys(salesByVendedor));

  // Calculate analytics for each seller
  const sellerAnalytics = Object.entries(salesByVendedor).map(
    ([vendedor, sales]) => {
      // Basic metrics
      const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
      const totalVisits = sales.length;
      const avgTicket = totalSales / totalVisits;

      // Client analysis with enhanced location data
      const clientStats = sales.reduce(
        (acc, sale) => {
          const clientName = sale.clientName;
          if (!acc[clientName]) {
            acc[clientName] = {
              totalSales: 0,
              visitCount: 0,
              lastVisit: null,
              firstVisit: null,
              dates: [],
              locations: [],
            };
          }
          acc[clientName].totalSales += sale.total;
          acc[clientName].visitCount += 1;
          acc[clientName].dates.push(sale.date);

          // Store location data if available
          if (sale.location?.clientLat && sale.location.clientLng) {
            acc[clientName].locations.push({
              lat: parseFloat(sale.location.clientLat),
              lng: parseFloat(sale.location.clientLng),
              date: sale.date,
            });
          }

          // Update first and last visit
          const saleDate = new Date(sale.date);
          if (
            !acc[clientName].firstVisit ||
            saleDate < new Date(acc[clientName].firstVisit)
          ) {
            acc[clientName].firstVisit = sale.date;
          }
          if (
            !acc[clientName].lastVisit ||
            saleDate > new Date(acc[clientName].lastVisit)
          ) {
            acc[clientName].lastVisit = sale.date;
          }
          return acc;
        },
        {} as Record<string, any>,
      );

      // Best clients (top 10 by revenue)
      const bestClients = Object.entries(clientStats)
        .map(([clientName, stats]) => ({
          clientName,
          totalSales: stats.totalSales,
          visitCount: stats.visitCount,
          avgTicket: stats.totalSales / stats.visitCount,
          lastVisit: stats.lastVisit,
          loyaltyScore:
            stats.visitCount * (stats.totalSales / totalSales) * 100,
        }))
        .sort((a, b) => b.totalSales - a.totalSales)
        .slice(0, 10);

      // Product distribution analysis
      const productStats = sales.reduce(
        (acc, sale) => {
          Object.entries(sale.products).forEach(([product, quantity]) => {
            if (!acc[product]) {
              acc[product] = { quantity: 0, salesCount: 0 };
            }
            acc[product].quantity += quantity;
            acc[product].salesCount += 1;
          });
          return acc;
        },
        {} as Record<string, any>,
      );

      const totalProductsSold = Object.values(productStats).reduce(
        (sum: number, stats: any) => sum + stats.quantity,
        0,
      );

      const productDistribution = Object.entries(productStats)
        .map(([product, stats]) => ({
          product,
          quantity: stats.quantity,
          percentage:
            totalProductsSold > 0
              ? (stats.quantity / totalProductsSold) * 100
              : 0,
          salesCount: stats.salesCount,
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 15); // Top 15 products

      // 🎯 1. TERRITORY COVERAGE ANALYSIS
      console.log(
        `🗺️ Generating territory analysis for ${vendedor} with ${Object.keys(clientStats).length} clients`,
      );
      const territoryAnalysis = generateTerritoryAnalysis(clientStats, sales);
      console.log(`🗺️ Territory analysis for ${vendedor}:`, territoryAnalysis);

      // ⚡ 2. SALES VELOCITY DASHBOARD
      console.log(
        `⚡ Generating sales velocity for ${vendedor} with ${sales.length} sales`,
      );
      const salesVelocity = generateSalesVelocityAnalysis(clientStats, sales);
      console.log(`⚡ Sales velocity for ${vendedor}:`, salesVelocity);

      // 🎖️ 3. CLIENT RETENTION & LOYALTY ANALYSIS
      console.log(`🎖️ Generating retention analysis for ${vendedor}`);
      const retentionAnalysis = generateRetentionAnalysis(
        clientStats,
        sales,
        totalSales,
      );
      console.log(`🎖️ Retention analysis for ${vendedor}:`, retentionAnalysis);

      // Monthly trends (last 6 months)
      const monthlyTrends = generateSellerMonthlyTrends(sales);

      return {
        vendedor,
        totalSales,
        totalVisits,
        uniqueClients: Object.keys(clientStats).length,
        avgTicket,
        bestClients,
        productDistribution,
        monthlyTrends,
        territoryAnalysis,
        salesVelocity,
        retentionAnalysis,
        rank: 0, // Will be set after sorting
      };
    },
  );

  // Sort sellers by total sales and assign ranks
  const rankedSellers = sellerAnalytics
    .sort((a, b) => b.totalSales - a.totalSales)
    .map((seller, index) => ({
      ...seller,
      rank: index + 1,
    }));

  return {
    sellers: rankedSellers,
    totalSellers: rankedSellers.length,
  };
}

function generateSellerMonthlyTrends(sales: any[]) {
  const monthlyData: Record<string, { sales: number; visits: number }> = {};

  // Get last 6 months
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthlyData[monthKey] = { sales: 0, visits: 0 };
  }

  sales.forEach((sale) => {
    const saleDate = new Date(sale.date);
    const monthKey = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyData[monthKey]) {
      monthlyData[monthKey].sales += sale.total;
      monthlyData[monthKey].visits += 1;
    }
  });

  return Object.entries(monthlyData).map(([month, data]) => ({
    month,
    sales: data.sales,
    visits: data.visits,
  }));
}

// 🎯 1. TERRITORY COVERAGE ANALYSIS
function generateTerritoryAnalysis(
  clientStats: Record<string, any>,
  _sales: any[],
) {
  console.log(
    "🗺️ Territory Analysis - Total clients:",
    Object.keys(clientStats).length,
  );
  console.log(
    "🗺️ Territory Analysis - Sample client stats:",
    Object.entries(clientStats).slice(0, 2),
  );

  const clientsWithLocations = Object.entries(clientStats)
    .filter(([_, stats]) => stats.locations && stats.locations.length > 0)
    .map(([clientName, stats]) => ({
      clientName,
      ...stats,
      avgLocation: {
        lat:
          stats.locations.reduce((sum: number, loc: any) => sum + loc.lat, 0) /
          stats.locations.length,
        lng:
          stats.locations.reduce((sum: number, loc: any) => sum + loc.lng, 0) /
          stats.locations.length,
      },
    }));

  console.log(
    "🗺️ Territory Analysis - Clients with locations:",
    clientsWithLocations.length,
  );

  // Calculate territory boundaries (bounding box)
  const lats = clientsWithLocations
    .map((client) => client.avgLocation.lat)
    .filter((lat) => !Number.isNaN(lat));
  const lngs = clientsWithLocations
    .map((client) => client.avgLocation.lng)
    .filter((lng) => !Number.isNaN(lng));

  const territoryBounds =
    lats.length > 0
      ? {
          north: Math.max(...lats),
          south: Math.min(...lats),
          east: Math.max(...lngs),
          west: Math.min(...lngs),
        }
      : null;

  // Calculate territory metrics
  const territoryCenter = territoryBounds
    ? {
        lat: (territoryBounds.north + territoryBounds.south) / 2,
        lng: (territoryBounds.east + territoryBounds.west) / 2,
      }
    : null;

  // Estimate territory area (rough calculation in km²)
  const territoryArea = territoryBounds
    ? Math.abs((territoryBounds.north - territoryBounds.south) * 111) *
      Math.abs(
        (territoryBounds.east - territoryBounds.west) *
          111 *
          Math.cos((territoryCenter?.lat * Math.PI) / 180),
      )
    : 0;

  // Client density (clients per km²)
  const clientDensity =
    territoryArea > 0 ? clientsWithLocations.length / territoryArea : 0;

  // Estimate average distance between clients (simplified)
  let totalDistance = 0;
  let distanceCount = 0;
  for (let i = 0; i < clientsWithLocations.length; i++) {
    for (let j = i + 1; j < clientsWithLocations.length; j++) {
      const client1 = clientsWithLocations[i];
      const client2 = clientsWithLocations[j];
      const distance = calculateDistance(
        client1.avgLocation.lat,
        client1.avgLocation.lng,
        client2.avgLocation.lat,
        client2.avgLocation.lng,
      );
      totalDistance += distance;
      distanceCount++;
    }
  }
  const avgDistanceBetweenClients =
    distanceCount > 0 ? totalDistance / distanceCount : 0;

  return {
    totalClients: clientsWithLocations.length,
    territoryBounds,
    territoryCenter,
    territoryArea: Math.round(territoryArea * 100) / 100,
    clientDensity: Math.round(clientDensity * 100) / 100,
    avgDistanceBetweenClients:
      Math.round(avgDistanceBetweenClients * 100) / 100,
    coverageScore: Math.min(
      100,
      Math.round(
        (clientsWithLocations.length / Math.max(1, territoryArea)) * 50,
      ),
    ),
  };
}

// ⚡ 2. SALES VELOCITY DASHBOARD
function generateSalesVelocityAnalysis(
  clientStats: Record<string, any>,
  sales: any[],
) {
  const _now = new Date();

  // Calculate time between visits for repeat clients
  const visitIntervals: number[] = [];
  const timeToDeal: number[] = [];

  Object.values(clientStats).forEach((stats: any) => {
    if (stats.dates && stats.dates.length > 1) {
      const sortedDates = stats.dates
        .map((d: string) => new Date(d))
        .sort((a: Date, b: Date) => a.getTime() - b.getTime());

      // Calculate intervals between visits
      for (let i = 1; i < sortedDates.length; i++) {
        const interval =
          (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) /
          (1000 * 60 * 60 * 24); // days
        visitIntervals.push(interval);
      }

      // Time from first visit to first sale (assuming first visit is prospecting)
      if (stats.totalSales > 0) {
        const timeToDealDays =
          (sortedDates[sortedDates.length - 1].getTime() -
            sortedDates[0].getTime()) /
          (1000 * 60 * 60 * 24);
        timeToDeal.push(timeToDealDays);
      }
    }
  });

  // Calculate averages
  const avgTimeBetweenVisits =
    visitIntervals.length > 0
      ? visitIntervals.reduce((sum, interval) => sum + interval, 0) /
        visitIntervals.length
      : 0;

  const avgTimeToDeal =
    timeToDeal.length > 0
      ? timeToDeal.reduce((sum, time) => sum + time, 0) / timeToDeal.length
      : 0;

  // Monthly acceleration/deceleration
  const monthlyVelocity = calculateMonthlyVelocity(sales);

  // Peak performance analysis
  const peakAnalysis = calculatePeakPerformance(sales);

  return {
    avgTimeBetweenVisits: Math.round(avgTimeBetweenVisits * 10) / 10,
    avgTimeToDeal: Math.round(avgTimeToDeal * 10) / 10,
    visitFrequency:
      avgTimeBetweenVisits > 0
        ? Math.round((30 / avgTimeBetweenVisits) * 10) / 10
        : 0, // visits per month
    monthlyVelocity,
    peakAnalysis,
    velocityScore: Math.min(
      100,
      Math.round((1 / Math.max(avgTimeBetweenVisits / 30, 0.1)) * 50),
    ), // Higher frequency = higher score
  };
}

// 🎖️ 3. CLIENT RETENTION & LOYALTY ANALYSIS
function generateRetentionAnalysis(
  clientStats: Record<string, any>,
  _sales: any[],
  totalSales: number,
) {
  const now = new Date();

  // Calculate client lifecycle metrics
  const clientMetrics = Object.entries(clientStats).map(
    ([clientName, stats]) => {
      const daysSinceLastVisit = stats.lastVisit
        ? (now.getTime() - new Date(stats.lastVisit).getTime()) /
          (1000 * 60 * 60 * 24)
        : Infinity;

      const customerLifetime =
        stats.firstVisit && stats.lastVisit
          ? (new Date(stats.lastVisit).getTime() -
              new Date(stats.firstVisit).getTime()) /
            (1000 * 60 * 60 * 24)
          : 0;

      const customerValue = stats.totalSales;
      const visitFrequency =
        customerLifetime > 0 ? stats.visitCount / (customerLifetime / 30) : 0; // visits per month

      // Loyalty score based on multiple factors
      const loyaltyScore = Math.min(
        100,
        stats.visitCount * 15 + // Visit frequency weight
          (customerValue / totalSales) * 25 + // Revenue contribution weight
          Math.min(customerLifetime / 365, 1) * 35 + // Longevity weight
          visitFrequency * 25, // Consistency weight
      );

      // Churn risk assessment
      const churnRisk =
        daysSinceLastVisit > 90
          ? "High"
          : daysSinceLastVisit > 60
            ? "Medium"
            : daysSinceLastVisit > 30
              ? "Low"
              : "Very Low";

      return {
        clientName,
        daysSinceLastVisit: Math.round(daysSinceLastVisit),
        customerLifetime: Math.round(customerLifetime),
        customerValue,
        visitFrequency: Math.round(visitFrequency * 10) / 10,
        loyaltyScore: Math.round(loyaltyScore),
        churnRisk,
        stats,
      };
    },
  );

  // Segment clients by loyalty
  const loyaltySegments = {
    champions: clientMetrics.filter(
      (c) => c.loyaltyScore >= 80 && c.visitFrequency >= 2,
    ),
    loyalCustomers: clientMetrics.filter(
      (c) => c.loyaltyScore >= 60 && c.loyaltyScore < 80,
    ),
    potentialLoyalists: clientMetrics.filter(
      (c) => c.loyaltyScore >= 40 && c.loyaltyScore < 60,
    ),
    atRisk: clientMetrics.filter(
      (c) => c.churnRisk === "High" || c.churnRisk === "Medium",
    ),
    newCustomers: clientMetrics.filter(
      (c) => c.customerLifetime <= 90 && c.visitFrequency >= 1,
    ),
  };

  const mapSegmentClient = (client: (typeof clientMetrics)[number]) => ({
    clientName: client.clientName,
    loyaltyScore: client.loyaltyScore,
    customerValue: client.customerValue,
    visitCount: client.stats.visitCount,
    lastVisit: client.stats.lastVisit,
    daysSinceLastVisit: client.daysSinceLastVisit,
    churnRisk: client.churnRisk,
  });

  // Calculate retention metrics
  const avgCustomerLifetime =
    clientMetrics.reduce((sum, c) => sum + c.customerLifetime, 0) /
    clientMetrics.length;
  const avgLoyaltyScore =
    clientMetrics.reduce((sum, c) => sum + c.loyaltyScore, 0) /
    clientMetrics.length;
  const retentionRate =
    (clientMetrics.filter((c) => c.daysSinceLastVisit <= 90).length /
      clientMetrics.length) *
    100;

  return {
    totalClients: clientMetrics.length,
    avgCustomerLifetime: Math.round(avgCustomerLifetime),
    avgLoyaltyScore: Math.round(avgLoyaltyScore),
    retentionRate: Math.round(retentionRate * 10) / 10,
    loyaltySegments: {
      champions: loyaltySegments.champions.length,
      loyalCustomers: loyaltySegments.loyalCustomers.length,
      potentialLoyalists: loyaltySegments.potentialLoyalists.length,
      atRisk: loyaltySegments.atRisk.length,
      newCustomers: loyaltySegments.newCustomers.length,
    },
    topLoyalClients: clientMetrics
      .sort((a, b) => b.loyaltyScore - a.loyaltyScore)
      .slice(0, 10)
      .map((c) => ({
        clientName: c.clientName,
        loyaltyScore: c.loyaltyScore,
        customerValue: c.customerValue,
        visitCount: c.stats.visitCount,
        lastVisit: c.stats.lastVisit,
      })),
    churnRiskClients: clientMetrics
      .filter((c) => c.churnRisk === "High" || c.churnRisk === "Medium")
      .sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit)
      .slice(0, 10)
      .map((c) => ({
        clientName: c.clientName,
        daysSinceLastVisit: c.daysSinceLastVisit,
        churnRisk: c.churnRisk,
        customerValue: c.customerValue,
        lastVisit: c.stats.lastVisit,
      })),
    loyalCustomersList: loyaltySegments.loyalCustomers
      .sort((a, b) => b.loyaltyScore - a.loyaltyScore)
      .slice(0, 10)
      .map(mapSegmentClient),
    potentialLoyalistsList: loyaltySegments.potentialLoyalists
      .sort((a, b) => b.loyaltyScore - a.loyaltyScore)
      .slice(0, 10)
      .map(mapSegmentClient),
    newCustomersList: loyaltySegments.newCustomers
      .sort((a, b) => b.customerValue - a.customerValue)
      .slice(0, 10)
      .map(mapSegmentClient),
  };
}

// Helper functions
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateMonthlyVelocity(sales: any[]) {
  const monthlyData: Record<string, { sales: number; visits: number }> = {};

  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthlyData[monthKey] = { sales: 0, visits: 0 };
  }

  sales.forEach((sale) => {
    const saleDate = new Date(sale.date);
    const monthKey = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyData[monthKey]) {
      monthlyData[monthKey].sales += sale.total;
      monthlyData[monthKey].visits += 1;
    }
  });

  const months = Object.entries(monthlyData);
  const velocityChanges = [];
  for (let i = 1; i < months.length; i++) {
    const prevMonth = months[i - 1][1];
    const currMonth = months[i][1];
    const salesChange =
      prevMonth.sales > 0
        ? ((currMonth.sales - prevMonth.sales) / prevMonth.sales) * 100
        : 0;
    const visitsChange =
      prevMonth.visits > 0
        ? ((currMonth.visits - prevMonth.visits) / prevMonth.visits) * 100
        : 0;
    velocityChanges.push({
      month: months[i][0],
      salesChange: Math.round(salesChange * 10) / 10,
      visitsChange: Math.round(visitsChange * 10) / 10,
    });
  }

  return velocityChanges;
}

function calculatePeakPerformance(sales: any[]) {
  // Analyze performance by day of week and hour
  const dayPerformance: Record<string, { sales: number; visits: number }> = {
    Monday: { sales: 0, visits: 0 },
    Tuesday: { sales: 0, visits: 0 },
    Wednesday: { sales: 0, visits: 0 },
    Thursday: { sales: 0, visits: 0 },
    Friday: { sales: 0, visits: 0 },
    Saturday: { sales: 0, visits: 0 },
    Sunday: { sales: 0, visits: 0 },
  };

  sales.forEach((sale) => {
    const saleDate = new Date(sale.date);
    const dayName = saleDate.toLocaleDateString("en-US", { weekday: "long" });
    if (dayPerformance[dayName]) {
      dayPerformance[dayName].sales += sale.total;
      dayPerformance[dayName].visits += 1;
    }
  });

  const bestDay = Object.entries(dayPerformance).sort(
    (a, b) => b[1].sales - a[1].sales,
  )[0];

  const bestDayVisits = Object.entries(dayPerformance).sort(
    (a, b) => b[1].visits - a[1].visits,
  )[0];

  return {
    bestSalesDay: bestDay ? bestDay[0] : "N/A",
    bestSalesDayAmount: bestDay ? Math.round(bestDay[1].sales) : 0,
    bestVisitsDay: bestDayVisits ? bestDayVisits[0] : "N/A",
    bestVisitsDayCount: bestDayVisits ? bestDayVisits[1].visits : 0,
    dayPerformance,
  };
}

function computeAverageDaysBetweenVisits(dates: string[]): number | null {
  if (!dates || dates.length < 2) return null;

  const parsedDates = dates
    .filter(Boolean)
    .map((date) => new Date(date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  const uniqueDates: Date[] = [];
  const seen = new Set<string>();
  parsedDates.forEach((date) => {
    const key = date.toISOString().slice(0, 10);
    if (!seen.has(key)) {
      seen.add(key);
      uniqueDates.push(date);
    }
  });

  if (uniqueDates.length < 2) return null;

  const totalDays = uniqueDates.slice(0, -1).reduce((sum, date, index) => {
    const next = uniqueDates[index + 1];
    const diffDays = (date.getTime() - next.getTime()) / (1000 * 60 * 60 * 24);
    return sum + diffDays;
  }, 0);

  return Math.round(totalDays / (uniqueDates.length - 1));
}

function columnToIndex(column: string): number {
  // Convert Excel-like column letters (A, B, ..., Z, AA, AB, ...) to 0-based index
  // Example: A->0, B->1, ..., Z->25, AA->26, AB->27, ...
  let index = 0;
  for (let i = 0; i < column.length; i++) {
    const charCode = column.charCodeAt(i);
    // Use 1-based within the loop, then convert to 0-based at the end
    index = index * 26 + (charCode - 64); // 'A' = 65 => 1
  }
  return index - 1;
}

function _indexToColumn(index: number): string {
  let column = "";
  while (index >= 0) {
    column = String.fromCharCode(65 + (index % 26)) + column;
    index = Math.floor(index / 26) - 1;
  }
  return column;
}

function generateSalesTrend(
  entries: any[],
): Array<{ month: string; sales: number; entries: number }> {
  const months: Record<string, { sales: number; entries: number }> = {};

  // Get last 12 months
  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const _monthName = date.toLocaleDateString("es-ES", {
      month: "short",
      year: "numeric",
    });
    months[monthKey] = { sales: 0, entries: 0 };
  }

  entries.forEach((entry) => {
    const entryDate = new Date(entry.date);
    const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, "0")}`;
    if (months[monthKey]) {
      months[monthKey].sales += entry.total;
      months[monthKey].entries += 1;
    }
  });

  return Object.entries(months).map(([monthKey, data]) => ({
    month: monthKey,
    sales: data.sales,
    entries: data.entries,
  }));
}

function generateMonthlyTrend(
  entries: any[],
): Array<{ month: string; sales: number; clients: number }> {
  const months: Record<string, { sales: number; clients: Set<string> }> = {};

  // Get current year months
  const currentYear = new Date().getFullYear();
  for (let month = 0; month < 12; month++) {
    const monthKey = `${currentYear}-${String(month + 1).padStart(2, "0")}`;
    const _monthName = new Date(currentYear, month).toLocaleDateString(
      "es-ES",
      {
        month: "short",
      },
    );
    months[monthKey] = { sales: 0, clients: new Set() };
  }

  entries.forEach((entry) => {
    const entryDate = new Date(entry.date);
    const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, "0")}`;
    if (months[monthKey]) {
      months[monthKey].sales += entry.total;
      months[monthKey].clients.add(entry.clientName);
    }
  });

  return Object.entries(months).map(([monthKey, data]) => ({
    month: monthKey,
    sales: data.sales,
    clients: data.clients.size,
  }));
}
