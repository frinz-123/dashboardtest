import { google } from 'googleapis';

export async function GET() {
  try {
    console.log('Starting token request...'); // Debug log
    console.log('Client email:', process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL); // Debug log (redacted in production)
    
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        project_id: process.env.GOOGLE_SERVICE_ACCOUNT_PROJECT_ID,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const client = await auth.getClient();
    const token = await client.getAccessToken();
    
    console.log('Token obtained successfully'); // Debug log

    return new Response(JSON.stringify({ access_token: token.token }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error getting token:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to get access token',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 