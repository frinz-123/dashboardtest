import { auth } from "@/auth";
import {
  createGoogleSheetsAuth,
  googleServiceAccountCredentials,
} from "@/server/serverEnv";
import { isMasterAccount } from "@/utils/auth";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!isMasterAccount(session.user.email)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("Starting token request..."); // Debug log
    console.log("Service account configured:", {
      hasClientEmail: Boolean(googleServiceAccountCredentials.client_email),
    });

    const googleSheetsAuth = createGoogleSheetsAuth();

    const client = await googleSheetsAuth.getClient();
    const token = await client.getAccessToken();

    console.log("Token obtained successfully"); // Debug log

    return new Response(JSON.stringify({ access_token: token.token }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error getting token:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to get access token",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
