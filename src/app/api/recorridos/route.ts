import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

const SHEET_IDS = {
  clientes: '1292284175',
  performance: '2073545797',
  programacion: '1620884655',
  configuracion: '1091850595',
  metricas: '585874922',
  visitas: '123456789',  // Individual visits tracking
  reprogramadas: '477915293'  // Rescheduled visits tracking
};

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
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const viewAsEmail = searchParams.get('viewAsEmail'); // New parameter for master accounts
    const sheet = searchParams.get('sheet') || 'clientes';
    
    console.log('🔍 API DEBUG: Request params - email:', email, 'viewAsEmail:', viewAsEmail, 'sheet:', sheet);
    
    if (!email) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
    }

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g';
    
    let sheetName: string;
    let range: string;
    
    switch (sheet) {
      case 'clientes':
        sheetName = 'Clientes_Rutas';
        range = `'${sheetName}'!A:H`;
        break;
      case 'performance':
        sheetName = 'Rutas_Performance';
        range = `'${sheetName}'!A:K`;
        break;
      case 'programacion':
        sheetName = 'Programacion_Semanal';
        range = `'${sheetName}'!A:I`;
        break;
      case 'configuracion':
        sheetName = 'Configuracion';
        range = `'${sheetName}'!A:D`;
        break;
      case 'metricas':
        sheetName = 'Metricas_Rutas';
        range = `'${sheetName}'!A:K`;
        break;
      case 'visitas':
        sheetName = 'Visitas_Individuales';
        range = `'${sheetName}'!A:H`;
        break;
      case 'reprogramadas':
        sheetName = 'Visitas_Reprogramadas';
        range = `'${sheetName}'!A:G`;
        break;
      default:
        return NextResponse.json({ error: 'Invalid sheet parameter' }, { status: 400 });
    }

    console.log('🔍 API DEBUG: Attempting to fetch from sheet:', sheetName, 'with range:', range);
    console.log('🔍 API DEBUG: Spreadsheet ID:', spreadsheetId);

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      console.log('🔍 API DEBUG: Google Sheets API response status:', response.status);
      console.log('🔍 API DEBUG: Response data keys:', Object.keys(response.data || {}));

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        console.log('⚠️ API DEBUG: No data returned from sheet');
        return NextResponse.json({ data: [] }, { status: 200 });
      }

      console.log('🔍 API DEBUG: Number of rows returned:', rows.length);
      
      const headers = rows[0];
      const data = rows.slice(1).map(row => {
        const item: Record<string, any> = {};
        headers.forEach((header, index) => {
          if (header && row[index] !== undefined) {
            // Convert numeric values
            if (header === 'Latitude' || header === 'Longitud') {
              item[header] = parseFloat(row[index]) || 0;
            } else if (header === 'Frecuencia') {
              item[header] = parseInt(row[index]) || 1;
            } else {
              item[header] = row[index];
            }
          }
        });
        return item;
      });

      // Import master account utilities
      const { isMasterAccount, EMAIL_TO_VENDOR_LABELS } = await import('../../../utils/auth');
      
      // Check if this is a master account request
      const isMaster = isMasterAccount(email);
      const effectiveEmail = viewAsEmail && isMaster ? viewAsEmail : email;
      
      console.log('🔍 API DEBUG: Master account check - isMaster:', isMaster, 'effectiveEmail:', effectiveEmail);

      console.log('🔍 API DEBUG: Total rows processed:', data.length);
      console.log('🔍 API DEBUG: Headers found:', headers);
      if (data.length > 0) {
        console.log('🔍 API DEBUG: First row sample:', data[0]);
        console.log('🔍 API DEBUG: Unique vendedores in sheet:', [...new Set(data.map(item => item.Vendedor))]);
        
        // Basic data validation for clients sheet
        if (sheet === 'clientes') {
          const cleyData = data.filter(item => item.Tipo_Cliente?.toUpperCase() === 'CLEY');
          console.log('🔍 API DEBUG: CLEY clients found:', cleyData.length);
        }
      }

      // Filter by vendedor (seller) based on sheet type
      let filteredData = data;
      if (sheet === 'clientes') {
        if (isMaster && !viewAsEmail) {
          // Master account without viewAsEmail - return ALL clients
          console.log('🔍 API DEBUG: Master account - returning ALL clients');
          filteredData = data;
        } else {
          // Regular filtering or master account viewing as specific vendor
          const userLabel = EMAIL_TO_VENDOR_LABELS[effectiveEmail];
          
          filteredData = data.filter(item => {
            const vendedor = item.Vendedor;
            
            // Match if vendedor is either the email OR the friendly label
            return vendedor === effectiveEmail || vendedor === userLabel;
          });
          
          console.log('🔍 API DEBUG: Looking for email:', effectiveEmail, 'or label:', userLabel);
          console.log('🔍 API DEBUG: Filtered data for user:', filteredData.length);
          if (filteredData.length > 0) {
            console.log('🔍 API DEBUG: Filtered sample:', filteredData[0]);
            
            // Basic filtering validation
            const filteredCleyData = filteredData.filter(item => item.Tipo_Cliente?.toUpperCase() === 'CLEY');
            console.log('🔍 API DEBUG: CLEY clients after filtering:', filteredCleyData.length);
          }
        }
      } else if (sheet === 'metricas' || sheet === 'performance' || sheet === 'visitas') {
        // For visit tracking sheets, filter by vendedor (seller name/email)
        const userLabel = EMAIL_TO_VENDOR_LABELS[effectiveEmail] || effectiveEmail;
        
        // ✅ ADDED: Debug logging for vendedor field mapping
        if (data.length > 0) {
          console.log('🔍 API DEBUG: Sample record for vendedor analysis:', data[0]);
          console.log('🔍 API DEBUG: Available fields in first record:', Object.keys(data[0]));
          console.log('🔍 API DEBUG: vendedor field value:', data[0].vendedor);
          console.log('🔍 API DEBUG: Vendedor field value:', data[0].Vendedor);
        }
        
        filteredData = data.filter(item => {
          const vendedor = item.vendedor || item.Vendedor;
          const matches = vendedor === effectiveEmail || vendedor === userLabel;
          
          // ✅ ADDED: Log each record's vendedor value for debugging
          if (!matches) {
            console.log(`🔍 API DEBUG: Record excluded - vendedor: "${vendedor}", looking for: "${effectiveEmail}" or "${userLabel}"`);
          }
          
          return matches;
        });
        
        console.log('🔍 API DEBUG: Filtering visits for:', effectiveEmail, 'or label:', userLabel);
        console.log('🔍 API DEBUG: Filtered visit data:', filteredData.length);
      } else if (sheet === 'programacion') {
        // Filter programacion by vendedor
        const userLabel = EMAIL_TO_VENDOR_LABELS[effectiveEmail] || effectiveEmail;
        filteredData = data.filter(item => {
          const vendedor = item.vendedor || item.Vendedor;
          return vendedor === effectiveEmail || vendedor === userLabel;
        });
      }

      return NextResponse.json({ data: filteredData }, { status: 200 });
      
    } catch (sheetsError: any) {
      console.error('❌ API ERROR: Google Sheets API failed:', sheetsError);
      console.error('❌ API ERROR: Error message:', sheetsError.message);
      console.error('❌ API ERROR: Error code:', sheetsError.code);
      
      return NextResponse.json({ 
        error: 'Failed to fetch data from Google Sheets', 
        details: sheetsError.message 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ API ERROR: General error:', error);
    return NextResponse.json({ error: 'Failed to fetch route data' }, { status: 500 });
  }
} 