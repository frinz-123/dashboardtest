import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

type RescheduleRequest = {
  clientName: string;
  originalDay: string;
  newDay: string;
  visitType: 'Pedidos' | 'Entrega' | 'Normal';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, userEmail } = body

    if (!userEmail) {
      return NextResponse.json({ error: 'Missing userEmail' }, { status: 400 })
    }

    // Handle batch reschedule action
    if (action === 'batch_reschedule') {
      const { reschedules } = body
      
      if (!reschedules || !Array.isArray(reschedules)) {
        return NextResponse.json({ error: 'Missing required fields for batch_reschedule' }, { status: 400 })
      }

      // Initialize Google Sheets using the same auth as the main API
      const auth = new google.auth.GoogleAuth({
        credentials: {
          type: "service_account",
          project_id: "light-legend-427200-q9",
          private_key_id: "d6d5b9ed0d50c7df921a85d7823a0a6c0ad31c6c",
          private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCL9FQTF3JAkzgU\nw8srlOOAdn2FKAF78Xa0XRdOYJmPs1LF+hzbO6P73zr9qHBLOZ/+Y3WFFrmLNnny\n3G+vlcPAtzsWj+CYRvKxeKpr4VtBTd/01btNZB32DRjW4MzazRm9tJmbqdTdF2tr\nYaRWohCpHJMBMsJ5moP++TgMA3I5nFfljkbr1Liso/yKJKG7Xm1UCnSvQfRkXSrV\nJaq0rApbY8/rA5TQF0NW28KtC++EIJnzL7WthRQGqw6bjuAHX70Q1tt/ntJ0K0Oc\nvXG3svTenwHrvyqWIFjgUiUI+3rGZdz08aZGMLFzEpGDHf2eLGp0x+dxx9ogoSdi\n9IXVA+6zAgMBAAECggEADBW16Mwefnr33bsmYQYDOwWAQy44KpaoFFzxdUAcIm9u\nl0/IjBmzSD13X43a3HQGX7YA4NQcg2vZzeHA9x1sgMiRnpof36ZIsJBlztjvw0zR\nKNgHy1/4wlVRLsTMi5woO9xLY0if69No4CXXRe/Kln+0JedXKZ7xBORKNadahqTb\nrotXOk5ucr20+f5kUBwVQLM1pnJtC2MwWpx4YEDag/tah/ZoH7cYaHcJ5mi9eusL\nVwvVwMx5b1ox8yNVA+i00imBNUULul1U67YREXL05U4u5ixgyej3raJmCZ56T0/9\ncGrne9KgN6ezOsvEvTwtoYejHp2K8oWu227Hut3amQKBgQDFSpKD9nuxAAwBb4xS\nniMA5mamskhCuCiOF33+oV1JAuytMaQHslKp9qTHo/5QmfykfDxvWKo8UTqtaEI8\n6pRBrVkGSm9Oc5546qvIb+Cq5nNdDOIXVG2RnNBI3lpca9Ewquo4wWOto3mbgbfs\n6zOx4t6WnmBy9jFQq30jmIUB7wKBgQC1meWPZ0WLLByV1IzlMKqZ8ntkPPAgbEYt\nGnIFV4QCrRxpMKr1YjPg03XMmeum+3zt/xACfdR0Gm0b4ZZeHTbvBadjt3VobxAa\nlVf4d+hwly1mJ68GZWbjX9KUMU0djI4IyCLYp2cXs+pwcQAHsleLkloExRQveaot\nnO2gribTfQKBgB3qBbcum2imGivpjvxD8AjF5pCl/aDoLXYGB9ug+fUFFX/ZRAbK\nug/9TtTaf8gW4SDLmZpEdmN46Y27fjegVeRzdUkn5iKeE0xAQNW+aPFgyeM0/d8N\ntSNcBJTX6hmTW3+mmqcKY6PDYr/6djndG9SAEsIBt5wWyjlyFyJbkOdPAoGBALKj\nlOIgIJTq66On1oGOAgQ2N5M/Lqd2WwH7RbZjhIRtbck8CrAfzhCXcwW1U86LDTXA\n9iq9RMSBSltm6dfivSsbULISwffdaOX9iu/sZEZ9MDeRSebs0O1SUX9dkBJFNWMG\nHOEqq4rxfOjm/7SShvPRH6QZieW5tOHxwP+S0LaxAoGAft9TEPSxzuplIZxTFpck\nVtgSkAqzy3co1PxOk3p1BgG0vMnrEZZOs6VW/qq1QYOm/4w935Pzl0cBQzBMYBnp\n58cH9OkbB0ao2mmeVHmvyhb0jggaTCfJ9QP+iF4GiLOFQm2fFWxKDAglQEtkBVHx\nNWkTHRHBD62hk+H2ffZ1TQo=\n-----END PRIVATE KEY-----\n",
          client_email: "cesar-reyes@light-legend-427200-q9.iam.gserviceaccount.com",
          client_id: "113188820672311170516"
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      })

      const sheets = google.sheets({ version: 'v4', auth })
      const spreadsheetId = '1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g'

      // ✅ FIXED: Use email directly to match client data vendor field
      // Don't convert to friendly labels - use the actual email as it appears in the client data
      const vendorLabel = userEmail;
      
      // Prepare rows for batch insert
      const currentDate = new Date().toISOString().split('T')[0]
      const values = reschedules.map((reschedule: RescheduleRequest) => [
        reschedule.clientName,        // cliente_original (A)
        reschedule.visitType,         // tipo_visita (B)
        reschedule.originalDay,       // dia_original (C)
        reschedule.newDay,           // dia_nuevo (D)
        currentDate,                 // fecha_reprogramacion (E)
        vendorLabel,                 // vendedor (F) - ✅ FIXED: Use consistent vendor label
        'Si'                         // activo (G)
      ])

      console.log('📝 RESCHEDULE API: Adding rows to Visitas_Reprogramadas:', values)

      // Append all rows at once to the Visitas_Reprogramadas sheet
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Visitas_Reprogramadas!A:G',
        valueInputOption: 'RAW',
        requestBody: {
          values: values
        }
      })

      console.log('✅ RESCHEDULE API: Successfully added', values.length, 'reschedule records')
      console.log('📊 RESCHEDULE API: Response:', response.data)

      return NextResponse.json({ 
        success: true, 
        message: `${values.length} reschedules saved successfully`,
        reschedules: values.map((row, index) => ({
          clientName: reschedules[index].clientName,
          visitType: reschedules[index].visitType,
          originalDay: reschedules[index].originalDay,
          newDay: reschedules[index].newDay,
          date: currentDate,
          vendedor: vendorLabel, // ✅ FIXED: Use consistent vendor label
          activo: 'Si'
        }))
      })
    }

    // Handle deactivate reschedule action
    if (action === 'deactivate_reschedule') {
      const { clientName, visitType } = body
      
      if (!clientName || !visitType) {
        return NextResponse.json({ error: 'Missing required fields for deactivate_reschedule' }, { status: 400 })
      }

      // Initialize Google Sheets
      const auth = new google.auth.GoogleAuth({
        credentials: {
          type: "service_account",
          project_id: "light-legend-427200-q9",
          private_key_id: "d6d5b9ed0d50c7df921a85d7823a0a6c0ad31c6c",
          private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCL9FQTF3JAkzgU\nw8srlOOAdn2FKAF78Xa0XRdOYJmPs1LF+hzbO6P73zr9qHBLOZ/+Y3WFFrmLNnny\n3G+vlcPAtzsWj+CYRvKxeKpr4VtBTd/01btNZB32DRjW4MzazRm9tJmbqdTdF2tr\nYaRWohCpHJMBMsJ5moP++TgMA3I5nFfljkbr1Liso/yKJKG7Xm1UCnSvQfRkXSrV\nJaq0rApbY8/rA5TQF0NW28KtC++EIJnzL7WthRQGqw6bjuAHX70Q1tt/ntJ0K0Oc\nvXG3svTenwHrvyqWIFjgUiUI+3rGZdz08aZGMLFzEpGDHf2eLGp0x+dxx9ogoSdi\n9IXVA+6zAgMBAAECggEADBW16Mwefnr33bsmYQYDOwWAQy44KpaoFFzxdUAcIm9u\l0/IjBmzSD13X43a3HQGX7YA4NQcg2vZzeHA9x1sgMiRnpof36ZIsJBlztjvw0zR\nKNgHy1/4wlVRLsTMi5woO9xLY0if69No4CXXRe/Kln+0JedXKZ7xBORKNadahqTb\nrotXOk5ucr20+f5kUBwVQLM1pnJtC2MwWpx4YEDag/tah/ZoH7cYaHcJ5mi9eusL\nVwvVwMx5b1ox8yNVA+i00imBNUULul1U67YREXL05U4u5ixgyej3raJmCZ56T0/9\ncGrne9KgN6ezOsvEvTwtoYejHp2K8oWu227Hut3amQKBgQDFSpKD9nuxAAwBb4xS\nniMA5mamskhCuCiOF33+oV1JAuytMaQHslKp9qTHo/5QmfykfDxvWKo8UTqtaEI8\n6pRBrVkGSm9Oc5546qvIb+Cq5nNdDOIXVG2RnNBI3lpca9Ewquo4wWOto3mbgbfs\n6zOx4t6WnmBy9jFQq30jmIUB7wKBgQC1meWPZ0WLLByV1IzlMKqZ8ntkPPAgbEYt\nGnIFV4QCrRxpMKr1YjPg03XMmeum+3zt/xACfdR0Gm0b4ZZeHTbvBadjt3VobxAa\nlVf4d+hwly1mJ68GZWbjX9KUMU0djI4IyCLYp2cXs+pwcQAHsleLkloExRQveaot\nnO2gribTfQKBgB3qBbcum2imGivpjvxD8AjF5pCl/aDoLXYGB9ug+fUFFX/ZRAbK\nug/9TtTaf8gW4SDLmZpEdmN46Y27fjegVeRzdUkn5iKeE0xAQNW+aPFgyeM0/d8N\tSNcBJTX6hmTW3+mmqcKY6PDYr/6djndG9SAEsIBt5wWyjlyFyJbkOdPAoGBALKj\nlOIgIJTq66On1oGOAgQ2N5M/Lqd2WwH7RbZjhIRtbck8CrAfzhCXcwW1U86LDTXA\n9iq9RMSBSltm6dfivSsbULISwffdaOX9iu/sZEZ9MDeRSebs0O1SUX9dkBJFNWMG\nHOEqq4rxfOjm/7SShvPRH6QZieW5tOHxwP+S0LaxAoGAft9TEPSxzuplIZxTFpck\nVtgSkAqzy3co1PxOk3p1BgG0vMnrEZZOs6VW/qq1QYOm/4w935Pzl0cBQzBMYBnp\n58cH9OkbB0ao2mmeVHmvyhb0jggaTCfJ9QP+iF4GiLOFQm2fFWxKDAglQEtkBVHx\nNWkTHRHBD62hk+H2ffZ1TQo=\n-----END PRIVATE KEY-----\n",
          client_email: "cesar-reyes@light-legend-427200-q9.iam.gserviceaccount.com",
          client_id: "113188820672311170516"
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      })

      const sheets = google.sheets({ version: 'v4', auth })
      const spreadsheetId = '1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g'

      console.log(`📝 DEACTIVATE RESCHEDULE: Looking for ${clientName} (${visitType}) to deactivate`)

      // ✅ FIXED: Use email directly to match client data vendor field
      // Don't convert to friendly labels - use the actual email as it appears in the client data
      const vendorLabel = userEmail;

      // First, get all rows from the sheet to find the matching reschedule
      const getResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Visitas_Reprogramadas!A:G',
      })

      const rows = getResponse.data.values || []
      
      // Find the row index for this client+visitType where activo = 'Si'
      let rowIndexToUpdate = -1
      for (let i = 1; i < rows.length; i++) { // Skip header row
        const [rowClient, rowVisitType, , , , rowVendedor, rowActivo] = rows[i]
        if (rowClient === clientName && 
            rowVisitType === visitType && 
            rowVendedor === vendorLabel && // ✅ FIXED: Use consistent vendor label
            rowActivo === 'Si') {
          rowIndexToUpdate = i + 1 // Google Sheets is 1-indexed
          break
        }
      }

      if (rowIndexToUpdate === -1) {
        console.log(`⚠️ No active reschedule found for ${clientName} (${visitType})`)
        return NextResponse.json({ 
          success: true, 
          message: 'No active reschedule found to deactivate' 
        })
      }

      // Update the 'activo' column to 'No'
      const updateResponse = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Visitas_Reprogramadas!G${rowIndexToUpdate}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['No']]
        }
      })

      console.log(`✅ DEACTIVATE RESCHEDULE: Successfully deactivated reschedule for ${clientName} (${visitType})`)

      return NextResponse.json({ 
        success: true, 
        message: `Reschedule deactivated for ${clientName} (${visitType})`,
        updatedRow: rowIndexToUpdate
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('❌ RESCHEDULE API ERROR:', error)
    return NextResponse.json({ 
      error: 'Failed to save reschedules',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 