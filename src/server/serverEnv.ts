import { google } from "googleapis";
import { SERVER_ENV } from "@/generated/serverEnv";

const getFirstConfiguredValue = (...values: Array<string | undefined>) => {
  return values.find((value) => value && value.trim().length > 0)?.trim();
};

export const serverEnv = SERVER_ENV;

export const getFirstServerEnv = (...keys: Array<keyof typeof SERVER_ENV>) => {
  return getFirstConfiguredValue(...keys.map((key) => SERVER_ENV[key]));
};

export const parseServerEmailList = (value: string | undefined) => {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
};

export const getMissingServerEnv = (...keys: Array<keyof typeof SERVER_ENV>) => {
  return keys.filter((key) => !SERVER_ENV[key]?.trim());
};

export const googleServiceAccountCredentials = {
  type: getFirstConfiguredValue(
    SERVER_ENV.GOOGLE_SERVICE_ACCOUNT_TYPE,
    "service_account",
  ),
  project_id: SERVER_ENV.GOOGLE_SERVICE_ACCOUNT_PROJECT_ID,
  private_key_id: SERVER_ENV.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID,
  private_key: SERVER_ENV.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  ),
  client_email: SERVER_ENV.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
  client_id: SERVER_ENV.GOOGLE_SERVICE_ACCOUNT_CLIENT_ID,
};

export const createGoogleSheetsAuth = () => {
  return new google.auth.GoogleAuth({
    credentials: googleServiceAccountCredentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
};

export const createDriveAuth = () => {
  const driveClientId = getFirstConfiguredValue(
    SERVER_ENV.GOOGLE_DRIVE_CLIENT_ID,
    SERVER_ENV.GOOGLE_CLIENT_ID,
    SERVER_ENV.AUTH_GOOGLE_ID,
  );
  const driveClientSecret = getFirstConfiguredValue(
    SERVER_ENV.GOOGLE_DRIVE_CLIENT_SECRET,
    SERVER_ENV.GOOGLE_CLIENT_SECRET,
    SERVER_ENV.AUTH_GOOGLE_SECRET,
  );
  const driveRefreshToken = SERVER_ENV.GOOGLE_DRIVE_REFRESH_TOKEN;
  const driveRedirectUri = SERVER_ENV.GOOGLE_DRIVE_REDIRECT_URI;

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