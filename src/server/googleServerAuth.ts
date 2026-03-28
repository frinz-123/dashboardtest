import { google } from "googleapis";
import { getFirstServerEnv, serverEnv } from "@/server/serverEnv";

export const googleServiceAccountCredentials = {
  type: getFirstServerEnv("GOOGLE_SERVICE_ACCOUNT_TYPE") ?? "service_account",
  project_id: serverEnv.GOOGLE_SERVICE_ACCOUNT_PROJECT_ID,
  private_key_id: serverEnv.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID,
  private_key: serverEnv.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  ),
  client_email: serverEnv.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
  client_id: serverEnv.GOOGLE_SERVICE_ACCOUNT_CLIENT_ID,
};

export const createGoogleSheetsAuth = () => {
  return new google.auth.GoogleAuth({
    credentials: googleServiceAccountCredentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
};

export const createDriveAuth = () => {
  const driveClientId = getFirstServerEnv(
    "GOOGLE_DRIVE_CLIENT_ID",
    "GOOGLE_CLIENT_ID",
    "AUTH_GOOGLE_ID",
  );
  const driveClientSecret = getFirstServerEnv(
    "GOOGLE_DRIVE_CLIENT_SECRET",
    "GOOGLE_CLIENT_SECRET",
    "AUTH_GOOGLE_SECRET",
  );
  const driveRefreshToken = serverEnv.GOOGLE_DRIVE_REFRESH_TOKEN;
  const driveRedirectUri = serverEnv.GOOGLE_DRIVE_REDIRECT_URI;

  if (driveClientId && driveClientSecret && driveRefreshToken) {
    const driveOAuthClient = new google.auth.OAuth2(
      driveClientId,
      driveClientSecret,
      driveRedirectUri,
    );

    driveOAuthClient.setCredentials({ refresh_token: driveRefreshToken });

    return driveOAuthClient;
  }

  return new google.auth.GoogleAuth({
    credentials: googleServiceAccountCredentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
};