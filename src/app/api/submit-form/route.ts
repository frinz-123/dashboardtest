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

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { clientName, products, total, location, clientCode, userEmail } = body

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

      // Get the current data to find the last row
      const currentData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Form_Data!A:A',
      })

      const lastRow = currentData.data.values ? currentData.data.values.length + 1 : 2
      const range = `Form_Data!A${lastRow}:AL${lastRow}`

      // Format current date as MM/DD/YYYY
      const currentDate = new Date()
      const formattedDate = `${currentDate.getMonth() + 1}/${currentDate.getDate()}/${currentDate.getFullYear()}`

      // Get current period and week for column AL
      const { periodNumber, weekInPeriod } = getCurrentPeriodInfo(currentDate)
      const periodWeekCode = `P${periodNumber}S${weekInPeriod}`

      // Create an array with 38 elements (A to AL)
      const rowData = new Array(38).fill('')

      // Set the values according to the mapping
      rowData[0] = clientName                                    // Column A
      rowData[1] = clientLat                                    // Column B (Client's stored lat)
      rowData[2] = clientLng                                    // Column C (Client's stored lng)
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
      rowData[37] = periodWeekCode                             // Column AL - Period and Week Code (e.g., P17S2)

      const response = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
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