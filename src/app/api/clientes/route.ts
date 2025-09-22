import { google } from 'googleapis'
import { NextResponse } from 'next/server'

const auth = new google.auth.GoogleAuth({
  credentials: {
    type: "service_account",
    project_id: "light-legend-427200-q9",
    private_key_id: "d6d5b9ed0d50c7df921a85d7823a0a6c0ad31c6c",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCL9FQTF3JAkzgU\nw8srlOOAdn2FKAF78Xa0XRdOYJmPs1LF+hzbO6P73zr9qHBLOZ/+Y3WFFrmLNnny\n3G+vlcPAtzsWj+CYRvKxeKpr4VtBTd/01btNZB32DRjW4MzazRm9tJmbqdTdF2tr\nYaRWohCpHJMBMsJ5moP++TgMA3I5nFfljkbr1Liso/yKJKG7Xm1UCnSvQfRkXSrV\nJaq0rApbY8/rA5TQF0NW28KtC++EIJnzL7WthRQGqw6bjuAHX70Q1tt/ntJ0K0Oc\nvXG3svTenwHrvyqWIFjgUiUI+3rGZdz08aZGMLFzEpGDHf2eLGp0x+dxx9ogoSdi\n9IXVA+6zAgMBAAECggEADBW16Mwefnr33bsmYQYDOwWAQy44KpaoFFzxdUAcIm9u\nl0/IjBmzSD13X43a3HQGX7YA4NQcg2vZzeHA9x1sgMiRnpof36ZIsJBlztjvw0zR\nKNgHy1/4wlVRLsTMi5woO9xLY0if69No4CXXRe/Kln+0JedXKZ7xBORKNadahqTb\nrotXOk5ucr20+f5kUBwVQLM1pnJtC2MwWpx4YEDag/tah/ZoH7cYaHcJ5mi9eusL\nVwvVwMx5b1ox8yNVA+i00imBNUULul1U67YREXL05U4u5ixgyej3raJmCZ56T0/9\ncGrne9KgN6ezOsvEvTwtoYejHp2K8oWu227Hut3amQKBgQDFSpKD9nuxAAwBb4xS\nniMA5mamskhCuCiOF33+oV1JAuytMaQHslKp9qTHo/5QmfykfDxvWKo8UTqtaEI8\n6pRBrVkGSm9Oc5546qvIb+Cq5nNdDOIXVG2RnNBI3lpca9Ewquo4wWOto3mbgbfs\n6zOx4t6WnmBy9jFQq30jmIUB7wKBgQC1meWPZ0WLLByV1IzlMKqZ8ntkPPAgbEYt\nGnIFV4QCrRxpMKr1YjPg03XMmeum+3zt/xACfdR0Gm0b4ZZeHTbvBadjt3VobxAa\nlVf4d+hwly1mJ68GZWbjX9KUMU0djI4IyCLYp2cXs+pwcQAHsleLkloExRQveaot\nnO2gribTfQKBgB3qBbcum2imGivpjvxD8AjF5pCl/aDoLXYGB9ug+fUFFX/ZRAbK\nug/9TtTaf8gW4SDLmZpEdmN46Y27fjegVeRzdUkn5iKeE0xAQNW+aPFgyeM0/d8N\ntSNcBJTX6hmTW3+mmqcKY6PDYr/6djndG9SAEsIBt5wWyjlyFyJbkOdPAoGBALKj\nlOIgIJTq66On1oGOAgQ2N5M/Lqd2WwH7RbZjhIRtbck8CrAfzhCXcwW1U86LDTXA\n9iq9RMSBSltm6dfivSsbULISwffdaOX9iu/sZEZ9MDeRSebs0O1SUX9dkBJFNWMG\nHOEqq4rxfOjm/7SShvPRH6QZieW5tOHxwP+S0LaxAoGAft9TEPSxzuplIZxTFpck\nVtgSkAqzy3co1PxOk3p1BgG0vMnrEZZOs6VW/qq1QYOm/4w935Pzl0cBQzBMYBnp\n58cH9OkbB0ao2mmeVHmvyhb0jggaTCfJ9QP+iF4GiLOFQm2fFWxKDAglQEtkBVHx\nNWkTHRHBD62hk+H2ffZ1TQo=\n-----END PRIVATE KEY-----\n",
    client_email: "cesar-reyes@light-legend-427200-q9.iam.gserviceaccount.com",
    client_id: "113188820672311170516",
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

const spreadsheetId = process.env.NEXT_PUBLIC_SPREADSHEET_ID || '1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g'
const sheetName = process.env.NEXT_PUBLIC_SHEET_NAME || 'Form_Data'

// Product mapping from column letters to product names
const PRODUCT_COLUMNS = {
  I: 'Chiltepin Molido 50 g',
  J: 'Chiltepin Molido 20 g',
  K: 'Chiltepin Entero 30 g',
  L: 'Salsa Chiltepin El rey 195 ml',
  M: 'Salsa Especial El Rey 195 ml',
  N: 'Salsa Reina El rey 195 ml',
  O: 'Salsa Habanera El Rey 195 ml',
  P: 'Paquete El Rey',
  Q: 'Molinillo El Rey 30 g',
  R: 'Tira Entero',
  S: 'Tira Molido',
  T: 'Salsa chiltepin Litro',
  U: 'Salsa Especial Litro',
  V: 'Salsa Reina Litro',
  W: 'Salsa Habanera Litro',
  X: 'Michela Mix Tamarindo',
  Y: 'Michela Mix Mango',
  Z: 'Michela Mix Sandia',
  AA: 'Michela Mix Fuego',
  AB: 'El Rey Mix Original',
  AC: 'El Rey Mix Especial',
  AD: 'Medio Kilo Chiltepin Entero',
  AI: 'Michela Mix Picafresa',
  AJ: 'Habanero Molido 50 g',
  AK: 'Habanero Molido 20 g'
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')
    const clientName = searchParams.get('client')
    const limit = parseInt(searchParams.get('limit') || '50')

    const sheets = google.sheets({ version: 'v4', auth })

    if (action === 'clients') {
      // Get all unique clients
      const clientData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:C`,
      })

      const clients: Record<string, { lat: number, lng: number }> = {}
      if (clientData.data.values) {
        clientData.data.values.slice(1).forEach((row: any[]) => {
          const name = row[0]
          if (name && row[1] && row[2]) {
            clients[name] = {
              lat: parseFloat(row[1]),
              lng: parseFloat(row[2])
            }
          }
        })
      }

      return NextResponse.json({
        success: true,
        data: Object.keys(clients).sort()
      })
    }

    if (action === 'client-data' && clientName) {
      // Get all sales data
      const salesData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:AN`,
      })

      if (!salesData.data.values) {
        return NextResponse.json({
          success: true,
          data: {
            recentEntries: [],
            yearlySales: 0,
            allTimeSales: 0,
            productBreakdown: {},
            salesTrend: []
          }
        })
      }

      // Filter data for specific client
      const clientEntries = salesData.data.values
        .slice(1) // Skip header
        .filter((row: any[]) => row[0] === clientName)
        .map((row: any[], index: number) => {
          // Parse products from the row
          const products: Record<string, number> = {}
          Object.entries(PRODUCT_COLUMNS).forEach(([col, productName]) => {
            const colIndex = columnToIndex(col)
            if (row[colIndex] && parseInt(row[colIndex]) > 0) {
              products[productName] = parseInt(row[colIndex])
            }
          })

          return {
            id: index,
            clientName: row[0],
            clientCode: row[31] || '',
            date: row[32] || '',
            total: parseFloat(row[33] || '0'),
            userEmail: row[7] || '',
            location: {
              clientLat: row[1] || '',
              clientLng: row[2] || '',
              currentLat: row[5] || '',
              currentLng: row[6] || ''
            },
            products,
            periodWeek: row[37] || '',
            cleyOrderValue: row[38] || ''
          }
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      // Calculate analytics
      const currentYear = new Date().getFullYear()
      const yearlyEntries = clientEntries.filter(entry => {
        const entryDate = new Date(entry.date)
        return entryDate.getFullYear() === currentYear
      })

      const yearlySales = yearlyEntries.reduce((sum, entry) => sum + entry.total, 0)
      const allTimeSales = clientEntries.reduce((sum, entry) => sum + entry.total, 0)

      // Product breakdown (all time)
      const productBreakdown: Record<string, { quantity: number, revenue: number }> = {}
      clientEntries.forEach(entry => {
        Object.entries(entry.products).forEach(([product, quantity]) => {
          if (!productBreakdown[product]) {
            productBreakdown[product] = { quantity: 0, revenue: 0 }
          }
          productBreakdown[product].quantity += quantity
          // We don't have individual product prices in the data, so we'll skip revenue calculation for now
        })
      })

      // Sales trend (last 12 months)
      const salesTrend = generateSalesTrend(clientEntries)

      // Recent entries (limited)
      const recentEntries = clientEntries.slice(0, limit)

      return NextResponse.json({
        success: true,
        data: {
          recentEntries,
          yearlySales,
          allTimeSales,
          productBreakdown,
          salesTrend,
          totalEntries: clientEntries.length
        }
      })
    }

    if (action === 'analytics') {
      // Get overall analytics
      const salesData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:AN`,
      })

      console.log('📊 Google Sheets response:', salesData.data.values?.length, 'rows')

      console.log('🔍 Full Google Sheets data structure:')
      console.log('   Total values array length:', salesData.data.values?.length)
      console.log('   First row (headers):', salesData.data.values?.[0])
      console.log('   Second row (first data):', salesData.data.values?.[1])
      console.log('   Last row:', salesData.data.values?.[salesData.data.values.length - 1])

      // Check if we have headers and data
      if (!salesData.data.values || salesData.data.values.length < 2) {
        console.log('⚠️  No data or insufficient rows in sheet')
      } else {
        console.log('✅ Sheet has headers and data rows')
      }

      // Debug: Show column structure
      if (salesData.data.values && salesData.data.values.length > 0) {
        const headerRow = salesData.data.values[0]
        console.log('🔍 Sheet headers (first 15):', headerRow.slice(0, 15))
        console.log('🔍 Total columns:', headerRow.length)
        console.log('🔍 Column indices for products:')
        Object.entries(PRODUCT_COLUMNS).forEach(([col, productName]) => {
          const colIndex = columnToIndex(col)
          console.log(`  ${col} -> Index ${colIndex} -> Header: ${headerRow[colIndex] || 'MISSING'}`)
        })
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
            clientStats: {}
          }
        })
      }

      const afIndexForCode = columnToIndex('AF')
      const entries = salesData.data.values.slice(1).map((row: any[], rowIndex) => {
        const products = Object.entries(PRODUCT_COLUMNS).reduce((acc, [col, productName]) => {
          const colIndex = columnToIndex(col)
          const quantity = row[colIndex]
          const parsedQuantity = parseInt(quantity || '0')

          // Temporarily allow all quantities to debug the issue
          if (quantity && parsedQuantity > 0) {
            acc[productName] = parsedQuantity
          }
          return acc
        }, {} as Record<string, number>)

        const codeRaw = (row[afIndexForCode] || '').toString()
        const code = codeRaw.trim().toUpperCase()

        // Debug: Log products for first few rows
        if (rowIndex < 5) { // Increased to 5 rows for better debugging
          console.log(`\n🚨 Row ${rowIndex + 1} Analysis:`)
          console.log(`   Client: ${row[0]}`)
          console.log(`   Date: ${row[32]}`)
          console.log(`   Total: ${row[33]}`)

          // Check for suspicious large values in the row
          const largeValues = []
          row.forEach((value, index) => {
            if (value && !isNaN(parseFloat(value)) && parseFloat(value) > 10000) {
              largeValues.push({ column: indexToColumn(index), index, value: parseFloat(value) })
            }
          })
          if (largeValues.length > 0) {
            console.log(`   ⚠️  Large values found:`, largeValues)
          }

          // Log all product columns to see what's wrong
          const productColumnsDebug = Object.entries(PRODUCT_COLUMNS).map(([col, productName]) => {
            const colIndex = columnToIndex(col)
            return {
              column: col,
              index: colIndex,
              value: row[colIndex],
              parsedValue: parseInt(row[colIndex] || '0')
            }
          })
          console.log(`   📦 Product columns:`, productColumnsDebug)

          console.log(`   🎯 Final products:`, products)
        }

        return {
          clientName: row[0],
          date: row[32] || '',
          total: parseFloat(row[33] || '0'),
          products,
          code
        }
      }).filter(entry => Object.keys(entry.products).length > 0) // Only include entries with products

      const currentYear = new Date().getFullYear()
      console.log('📅 Filtering for year:', currentYear)

      const yearlyEntries = entries.filter(entry => {
        const entryDate = new Date(entry.date)
        const isCurrentYear = entryDate.getFullYear() === currentYear
        if (!isCurrentYear && Math.random() < 0.1) { // Log 10% of filtered entries
          console.log(`❌ Filtered out entry from ${entryDate.getFullYear()}: ${entry.date}`)
        }
        return isCurrentYear
      })

      console.log('📈 Entries after date filtering:', yearlyEntries.length, 'out of', entries.length)

      const totalSales = yearlyEntries.reduce((sum, entry) => sum + entry.total, 0)
      const uniqueClients = new Set(yearlyEntries.map(entry => entry.clientName)).size

      // Client statistics
      const clientStats: Record<string, { totalSales: number, entries: number, avgOrder: number, lastVisit: string }> = {}
      yearlyEntries.forEach(entry => {
        if (!clientStats[entry.clientName]) {
          clientStats[entry.clientName] = { totalSales: 0, entries: 0, avgOrder: 0, lastVisit: '' }
        }
        clientStats[entry.clientName].totalSales += entry.total
        clientStats[entry.clientName].entries += 1
        if (!clientStats[entry.clientName].lastVisit || new Date(entry.date) > new Date(clientStats[entry.clientName].lastVisit)) {
          clientStats[entry.clientName].lastVisit = entry.date
        }
      })

      // Calculate average order
      Object.values(clientStats).forEach(stats => {
        stats.avgOrder = stats.totalSales / stats.entries
      })

      // Top clients by sales
      const topClients = Object.entries(clientStats)
        .map(([client, stats]) => ({ client, ...stats }))
        .sort((a, b) => b.totalSales - a.totalSales)
        .slice(0, 10)

      // Top products
      const productStats: Record<string, { quantity: number, revenue: number }> = {}
      yearlyEntries.forEach((entry, entryIndex) => {
        Object.entries(entry.products).forEach(([product, quantity]) => {
          if (!productStats[product]) {
            productStats[product] = { quantity: 0, revenue: 0 }
          }

          // Log suspiciously high quantities
          if (quantity > 1000) {
            console.log(`🚨 High quantity detected: ${product} = ${quantity} in entry ${entryIndex} (${entry.clientName})`)
          }

          productStats[product].quantity += quantity
        })
      })

      const topProducts = Object.entries(productStats)
        .map(([product, stats]) => ({ product, ...stats }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10)

      console.log('Product statistics:', productStats)
      console.log('Top products calculated:', topProducts)

      // If no products were found (all filtered out), provide fallback data
      if (topProducts.length === 0) {
        console.log('⚠️  No valid products found, using fallback data')
        // This will help identify if the issue is with all data being filtered out
      }

      // Monthly trend
      const monthlyTrend = generateMonthlyTrend(yearlyEntries)

      // Get all rows for mapping operations
      const allRows = salesData.data.values.slice(1)

      // Build client code mapping from the full sheet (first non-empty AF per client)
      const afIndex = columnToIndex('AF')
      const clientCodes: Record<string, string> = {}
      // Process rows in reverse order like navegar page does (most recent first)
      for (let i = allRows.length - 1; i >= 0; i--) {
        const row = allRows[i]
        const name = row[0]
        const code = row[afIndex]
        if (name && code && !clientCodes[name]) {
          clientCodes[name] = code
        }
      }

      // Build client vendedor mapping from ALL sheet data (not just current year)
      const anIndex = columnToIndex('AN')
      console.log('🔍 AN column index calculation:')
      console.log('  - columnToIndex("AN"):', anIndex)
      console.log('  - Manual calculation: A=1, N=14, 1*26+14=40, 40-1=39')
      console.log('  - Should be 39 for column AN')
      console.log('🔍 Total columns in sheet:', salesData.data.values?.[0]?.length)
      console.log('🔍 Headers array length:', salesData.data.values?.[0]?.length)
      console.log('🔍 All headers:', salesData.data.values?.[0])
      console.log('🔍 Sample header row for AN column:', salesData.data.values?.[0]?.[anIndex])
      console.log('🔍 Column AF index:', columnToIndex('AF'))
      console.log('🔍 Column AF header:', salesData.data.values?.[0]?.[columnToIndex('AF')])

      // Debug: Check what columns exist beyond AK
      const akIndex = columnToIndex('AK')
      console.log('🔍 Column AK index:', akIndex)
      console.log('🔍 Column AK header:', salesData.data.values?.[0]?.[akIndex])
      console.log('🔍 Column AL index:', columnToIndex('AL'))
      console.log('🔍 Column AL header:', salesData.data.values?.[0]?.[columnToIndex('AL')])
      console.log('🔍 Column AM index:', columnToIndex('AM'))
      console.log('🔍 Column AM header:', salesData.data.values?.[0]?.[columnToIndex('AM')])
      console.log('🔍 Column AN index:', columnToIndex('AN'))
      console.log('🔍 Column AN header:', salesData.data.values?.[0]?.[columnToIndex('AN')])

      const clientVendedores: Record<string, string> = {}
      let foundVendedores = 0
      // Process rows in reverse order like navegar page does (most recent first)
      for (let i = allRows.length - 1; i >= 0; i--) {
        const row = allRows[i]
        const name = row[0]
        const vendedor = row[anIndex]
        if (name && vendedor && !clientVendedores[name]) {
          clientVendedores[name] = vendedor
          foundVendedores++
          console.log(`👤 Client: ${name} -> Vendedor: ${vendedor}`)
        }
      }

      console.log('📋 Total client-vendedor mappings found:', Object.keys(clientVendedores).length)
      console.log('📋 Vendedores found during processing:', foundVendedores)
      console.log('📋 Sample mappings:', Object.entries(clientVendedores).slice(0, 5))

      // Aggregate products by per-row code (AF), normalized
      const productsByCode: Record<string, Record<string, number>> = {}
      yearlyEntries.forEach((entry: any) => {
        const code = (entry.code || '').toString().trim().toUpperCase()
        if (!code) return
        if (!productsByCode[code]) productsByCode[code] = {}
        Object.entries(entry.products).forEach(([product, quantity]) => {
          productsByCode[code][product] = (productsByCode[code][product] || 0) + (quantity || 0)
        })
      })

      const responseData = {
        totalSales,
        totalClients: uniqueClients,
        topProducts,
        monthlyTrend,
        topClients,
        clientStats,
        clientCodes,
        clientVendedores,
        productsByCode
      }
      console.log('Final analytics response:', responseData)
      return NextResponse.json({
        success: true,
        data: responseData
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action parameter'
    }, { status: 400 })

  } catch (error) {
    console.error('Error in clientes API:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

function columnToIndex(column: string): number {
  // Convert Excel-like column letters (A, B, ..., Z, AA, AB, ...) to 0-based index
  // Example: A->0, B->1, ..., Z->25, AA->26, AB->27, ...
  let index = 0
  for (let i = 0; i < column.length; i++) {
    const charCode = column.charCodeAt(i)
    // Use 1-based within the loop, then convert to 0-based at the end
    index = index * 26 + (charCode - 64) // 'A' = 65 => 1
  }
  return index - 1
}

function indexToColumn(index: number): string {
  let column = ''
  while (index >= 0) {
    column = String.fromCharCode(65 + (index % 26)) + column
    index = Math.floor(index / 26) - 1
  }
  return column
}

function generateSalesTrend(entries: any[]): Array<{ month: string, sales: number, entries: number }> {
  const months: Record<string, { sales: number, entries: number }> = {}

  // Get last 12 months
  for (let i = 11; i >= 0; i--) {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const monthName = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
    months[monthKey] = { sales: 0, entries: 0 }
  }

  entries.forEach(entry => {
    const entryDate = new Date(entry.date)
    const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`
    if (months[monthKey]) {
      months[monthKey].sales += entry.total
      months[monthKey].entries += 1
    }
  })

  return Object.entries(months).map(([monthKey, data]) => ({
    month: monthKey,
    sales: data.sales,
    entries: data.entries
  }))
}

function generateMonthlyTrend(entries: any[]): Array<{ month: string, sales: number, clients: number }> {
  const months: Record<string, { sales: number, clients: Set<string> }> = {}

  // Get current year months
  const currentYear = new Date().getFullYear()
  for (let month = 0; month < 12; month++) {
    const monthKey = `${currentYear}-${String(month + 1).padStart(2, '0')}`
    const monthName = new Date(currentYear, month).toLocaleDateString('es-ES', { month: 'short' })
    months[monthKey] = { sales: 0, clients: new Set() }
  }

  entries.forEach(entry => {
    const entryDate = new Date(entry.date)
    const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`
    if (months[monthKey]) {
      months[monthKey].sales += entry.total
      months[monthKey].clients.add(entry.clientName)
    }
  })

  return Object.entries(months).map(([monthKey, data]) => ({
    month: monthKey,
    sales: data.sales,
    clients: data.clients.size
  }))
}
