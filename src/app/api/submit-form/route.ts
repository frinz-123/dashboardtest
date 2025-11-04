import { google } from 'googleapis'
import { NextResponse } from 'next/server'
import { getCurrentPeriodInfo } from '@/utils/dateUtils'

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

const spreadsheetId = '1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g'

// Admin override emails - users who can bypass GPS validation
const OVERRIDE_EMAILS = process.env.NEXT_PUBLIC_OVERRIDE_EMAIL?.split(',').map(email => email.trim()) || [];

// Location validation constants
const MAX_LOCATION_ACCURACY = 100 // meters - reject if GPS accuracy is worse than this
const MAX_LOCATION_AGE = 30000 // 30 seconds in milliseconds - reject if location is older than this
const MAX_CLIENT_DISTANCE = 450 // meters - maximum allowed distance to client

// Helper function to check if user is an admin with override permissions
function isOverrideEmail(email: string | null | undefined): boolean {
  return email ? OVERRIDE_EMAILS.includes(email) : false;
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      clientName,
      products,
      total,
      location,
      clientCode,
      userEmail,
      cleyOrderValue,
      actorEmail,
      isAdminOverride,
      overrideTargetEmail
    } = body

    const adminEmailForValidation = actorEmail ?? userEmail ?? null
    const isAdmin = isOverrideEmail(adminEmailForValidation)

    // ✅ VALIDATION: Enhanced logging for email tracking
    console.log("🔍 FORM SUBMISSION RECEIVED:", {
      timestamp: new Date().toISOString(),
      clientName,
      clientCode,
      userEmail,
      userEmailType: typeof userEmail,
      actorEmail,
      actorEmailType: typeof actorEmail,
      adminEmailForValidation,
      adminEmailIsOverride: isAdmin,
      isAdminOverrideRequested: !!isAdminOverride,
      overrideTargetEmail,
      requestHeaders: {
        'user-agent': req.headers.get('user-agent'),
        'referer': req.headers.get('referer')
      },
      cleyOrderValue,
      cleyOrderValueType: typeof cleyOrderValue,
      totalProducts: Object.keys(products).length,
      hasLocation: !!location,
      locationAccuracy: location?.accuracy,
      locationTimestamp: location?.timestamp
    });

    // ✅ VALIDATION: Location validation
    if (!location || !location.lat || !location.lng) {
      console.error("❌ LOCATION VALIDATION FAILED: Missing location data", {
        location,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json({
        success: false,
        error: 'Ubicación requerida. Por favor, asegúrate de que el GPS esté activado.'
      }, { status: 400 })
    }

    // Validate location accuracy (skip for admin override users)
    if (!isAdmin && location.accuracy !== undefined && location.accuracy > MAX_LOCATION_ACCURACY) {
      console.error("❌ LOCATION VALIDATION FAILED: Poor GPS accuracy", {
        accuracy: location.accuracy,
        maxAllowed: MAX_LOCATION_ACCURACY,
        timestamp: new Date().toISOString(),
        clientName,
        userEmail
      });
      return NextResponse.json({
        success: false,
        error: `La precisión del GPS es insuficiente (±${Math.round(location.accuracy)}m). Por favor, espera unos segundos para obtener una mejor señal.`
      }, { status: 400 })
    }

    // Log if admin bypassed GPS accuracy check
    if (isAdmin && location.accuracy !== undefined && location.accuracy > MAX_LOCATION_ACCURACY) {
      console.log("👤 ADMIN OVERRIDE: Bypassing GPS accuracy check", {
        accuracy: location.accuracy,
        maxAllowed: MAX_LOCATION_ACCURACY,
        userEmail,
        adminEmailForValidation,
        clientName,
        timestamp: new Date().toISOString()
      });
    }

    // Validate location freshness (skip for admin override users)
    if (!isAdmin && location.timestamp !== undefined) {
      const locationAge = Date.now() - location.timestamp
      if (locationAge > MAX_LOCATION_AGE) {
        console.error("❌ LOCATION VALIDATION FAILED: Stale location", {
          locationAge,
          maxAllowed: MAX_LOCATION_AGE,
          locationTimestamp: location.timestamp,
          currentTime: Date.now(),
          timestamp: new Date().toISOString(),
          clientName,
          userEmail
        });
        return NextResponse.json({
          success: false,
          error: 'La ubicación ha expirado. Por favor, actualiza tu ubicación antes de enviar.'
        }, { status: 400 })
      }
    }

    // Log if admin bypassed location age check
    if (isAdmin && location.timestamp !== undefined) {
      const locationAge = Date.now() - location.timestamp
      if (locationAge > MAX_LOCATION_AGE) {
        console.log("👤 ADMIN OVERRIDE: Bypassing location age check", {
          locationAge,
          maxAllowed: MAX_LOCATION_AGE,
          userEmail,
          adminEmailForValidation,
          clientName,
          timestamp: new Date().toISOString()
        });
      }
    }

    // ✅ VALIDATION: Alert if email looks suspicious
    if (userEmail === 'arturo.elreychiltepin@gmail.com') {
      console.error("🚨 SUSPICIOUS EMAIL DETECTED: Submission using arturo.elreychiltepin@gmail.com");
      console.error("🚨 REQUEST DETAILS:", {
        userAgent: req.headers.get('user-agent'),
        referer: req.headers.get('referer'),
        timestamp: new Date().toISOString(),
        clientName: clientName
      });
    }

    const sheets = google.sheets({ version: 'v4', auth })

    try {
      // First, get client's location from the first occurrence in the sheet
      const clientData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Form_Data!A:C',
      })

      let clientLat = '', clientLng = ''
      if (clientData.data.values) {
        const clientRow = clientData.data.values.find(row => row[0] === clientName)
        if (clientRow) {
          clientLat = clientRow[1]
          clientLng = clientRow[2]
        }
      }

      // ✅ VALIDATION: Validate distance to client (if client location is available)
      if (clientLat && clientLng) {
        const clientLatNum = parseFloat(clientLat)
        const clientLngNum = parseFloat(clientLng)
        if (!isNaN(clientLatNum) && !isNaN(clientLngNum)) {
          const distanceToClient = calculateDistance(
            location.lat,
            location.lng,
            clientLatNum,
            clientLngNum
          )

          console.log("📍 DISTANCE VALIDATION:", {
            distance: distanceToClient,
            maxAllowed: MAX_CLIENT_DISTANCE,
            clientLocation: { lat: clientLatNum, lng: clientLngNum },
            userLocation: { lat: location.lat, lng: location.lng },
            timestamp: new Date().toISOString()
          })

          // Validate distance to client (skip for admin override users)
          if (!isAdmin && distanceToClient > MAX_CLIENT_DISTANCE) {
            console.error("❌ LOCATION VALIDATION FAILED: Too far from client", {
              distance: distanceToClient,
              maxAllowed: MAX_CLIENT_DISTANCE,
              clientName,
              userEmail,
              timestamp: new Date().toISOString()
            })
            return NextResponse.json({
              success: false,
              error: `Estás demasiado lejos del cliente (${Math.round(distanceToClient)}m). Por favor, acércate a la ubicación del cliente para continuar.`
            }, { status: 400 })
          }

          // Log if admin bypassed distance check
          if (isAdmin && distanceToClient > MAX_CLIENT_DISTANCE) {
            console.log("👤 ADMIN OVERRIDE: Bypassing distance validation", {
              distance: distanceToClient,
              maxAllowed: MAX_CLIENT_DISTANCE,
              userEmail,
              adminEmailForValidation,
              clientName,
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      // Get the current data to find the last row
      const currentData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Form_Data!A:A',
      })

      const lastRow = currentData.data.values ? currentData.data.values.length + 1 : 2
      
      // Ensure we're explicitly including column AM (the 39th column)
      const range = `Form_Data!A${lastRow}:AM${lastRow}`

      // Format current date/time using Mazatlan timezone (GMT-7)
      const submissionTimestamp = new Date()
      const MAZATLAN_TZ = 'America/Mazatlan'

      const mazatlanParts = new Intl.DateTimeFormat('en-US', {
        timeZone: MAZATLAN_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZoneName: 'short',
      }).formatToParts(submissionTimestamp)

      const getPart = (type: Intl.DateTimeFormatPartTypes) =>
        mazatlanParts.find(part => part.type === type)?.value || ''

      const month = getPart('month') || '00'
      const day = getPart('day') || '00'
      const year = getPart('year') || '0000'
      const hour = getPart('hour') || '00'
      const minute = getPart('minute') || '00'
      const second = getPart('second') || '00'
      const timeZoneName = getPart('timeZoneName') || 'GMT'

      const formattedDate = `${month}/${day}/${year}`
      const formattedTime = `${hour}:${minute}:${second}`

      const offsetMatch = timeZoneName.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/)
      const rawOffsetHours = offsetMatch ? parseInt(offsetMatch[1], 10) : 0
      const offsetMinutes = offsetMatch && offsetMatch[2] ? parseInt(offsetMatch[2], 10) : 0
      const offsetSign = rawOffsetHours >= 0 ? '+' : '-'
      const absOffsetHours = Math.abs(rawOffsetHours)
      const isoOffset = `${offsetSign}${String(absOffsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`

      const isoDateTime = `${year}-${month}-${day}T${hour}:${minute}:${second}${isoOffset}`
      const mazatlanDateForPeriod = new Date(isoDateTime)

      const periodSourceDate = Number.isNaN(mazatlanDateForPeriod.getTime())
        ? submissionTimestamp
        : mazatlanDateForPeriod

      console.log('🕒 SUBMISSION TIMESTAMP VALIDATION:', {
        iso: submissionTimestamp.toISOString(),
        formattedDate,
        formattedTime,
        isoOffset,
        mazatlanDateForPeriod: periodSourceDate.toISOString(),
        targetColumn: 'E',
        timeZone: MAZATLAN_TZ,
      })

      // Get current period and week for column AL (aligned to Mazatlan date)
      const { periodNumber, weekInPeriod } = getCurrentPeriodInfo(periodSourceDate)
      const periodWeekCode = `P${periodNumber}S${weekInPeriod}`

      // Create an array with 39 elements (A to AM)
      const rowData = new Array(39).fill('')

      // Set the values according to the mapping
      rowData[0] = clientName                                    // Column A
      rowData[1] = clientLat                                    // Column B (Client's stored lat)
      rowData[2] = clientLng                                    // Column C (Client's stored lng)
      rowData[3] = ''                                           // Column D (Reserved/unused)
      rowData[4] = formattedTime                                // Column E (Submission time)
      rowData[5] = location.lat.toString()                      // Column F (Current lat)
      rowData[6] = location.lng.toString()                      // Column G (Current lng)
      rowData[7] = userEmail                                    // Column H (Add this line)
      rowData[8] = products['Chiltepin Molido 50 g'] || ''     // Column I
      rowData[9] = products['Chiltepin Molido 20 g'] || ''     // Column J
      rowData[10] = products['Chiltepin Entero 30 g'] || ''    // Column K
      rowData[11] = products['Salsa Chiltepin El rey 195 ml'] || ''  // Column L
      rowData[12] = products['Salsa Especial El Rey 195 ml'] || ''   // Column M
      rowData[13] = products['Salsa Reina El rey 195 ml'] || ''      // Column N
      rowData[14] = products['Salsa Habanera El Rey 195 ml'] || ''   // Column O
      rowData[15] = products['Paquete El Rey'] || ''           // Column P
      rowData[16] = products['Molinillo El Rey 30 g'] || ''    // Column Q
      rowData[17] = products['Tira Entero'] || ''              // Column R
      rowData[18] = products['Tira Molido'] || ''              // Column S
      rowData[19] = products['Salsa chiltepin Litro'] || ''    // Column T
      rowData[20] = products['Salsa Especial Litro'] || ''     // Column U
      rowData[21] = products['Salsa Reina Litro'] || ''        // Column V
      rowData[22] = products['Salsa Habanera Litro'] || ''     // Column W
      rowData[23] = products['Michela Mix Tamarindo'] || ''    // Column X
      rowData[24] = products['Michela Mix Mango'] || ''        // Column Y
      rowData[25] = products['Michela Mix Sandia'] || ''       // Column Z
      rowData[26] = products['Michela Mix Fuego'] || ''        // Column AA
      rowData[27] = products['El Rey Mix Original'] || ''      // Column AB
      rowData[28] = products['El Rey Mix Especial'] || ''      // Column AC
      rowData[29] = products['Medio Kilo Chiltepin Entero'] || '' // Column AD
      rowData[31] = clientCode                                  // Column AF
      rowData[32] = formattedDate                              // Column AG (now in MM/DD/YYYY format)
      rowData[33] = total.toString()                           // Column AH
      rowData[34] = products['Michela Mix Picafresa'] || ''    // Column AI
      rowData[35] = products['Habanero Molido 50 g'] || ''     // Column AJ
      rowData[36] = products['Habanero Molido 20 g'] || ''     // Column AK
      rowData[37] = periodWeekCode                             // Column AL - Always use the period/week code here
      
      // CLEY order value for Column AM (index 38)
      // Always set a value for column AM to ensure it's included in the update
      if (clientCode.toUpperCase() === 'CLEY' && cleyOrderValue) {
        const amValue = cleyOrderValue === "1" ? "No" : "Si";
        console.log("Setting AM column for CLEY:", { 
          clientCode, 
          cleyOrderValue, 
          amValue 
        });
        rowData[38] = amValue;     // Column AM - CLEY Order value
      } else {
        console.log("Not setting AM column:", { 
          clientCode: clientCode.toUpperCase(), 
          isCley: clientCode.toUpperCase() === 'CLEY',
          hasCleyValue: !!cleyOrderValue,
          cleyOrderValue
        });
        rowData[38] = ""; // Empty string but explicitly set to ensure column AM is included
      }

      console.log("Final row data:", {
        columnAL: rowData[37],
        columnAM: rowData[38],
        fullArrayLength: rowData.length
      });

      // Try using append instead of update to handle the column range better
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Form_Data!A:AM',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [rowData],
        },
      })

      return NextResponse.json({ success: true, data: response.data })
    } catch (error) {
      console.error('Permission error:', error)
      return NextResponse.json({ 
        success: false, 
        error: 'No tienes permiso para acceder a la hoja de cálculo. Por favor, verifica que la cuenta de servicio tenga acceso.' 
      }, { status: 403 })
    }
  } catch (error) {
    console.error('Error submitting form:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error al enviar el formulario. Por favor intenta de nuevo.' 
    }, { status: 500 })
  }
} 