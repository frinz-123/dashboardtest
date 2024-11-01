import { google } from 'googleapis'
import { NextResponse } from 'next/server'

const auth = new google.auth.GoogleAuth({
  credentials: {
    type: process.env.GOOGLE_SERVICE_ACCOUNT_TYPE,
    project_id: process.env.GOOGLE_SERVICE_ACCOUNT_PROJECT_ID,
    private_key_id: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_ID,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

const spreadsheetId = process.env.NEXT_PUBLIC_SPREADSHEET_ID!

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
      const range = `Form_Data!A${lastRow}:AK${lastRow}`

      // Format current date as MM/DD/YYYY
      const currentDate = new Date()
      const formattedDate = `${currentDate.getMonth() + 1}/${currentDate.getDate()}/${currentDate.getFullYear()}`

      // Create an array with 37 elements (A to AK)
      const rowData = new Array(37).fill('')

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