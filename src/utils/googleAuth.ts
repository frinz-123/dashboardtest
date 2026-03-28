import { createDriveAuth, createGoogleSheetsAuth } from "@/server/googleServerAuth";

export const sheetsAuth = createGoogleSheetsAuth();

// Prefer OAuth for Drive to use a real user's storage quota; fall back to
// service account for Shared Drives or legacy setups.
export const driveAuth = createDriveAuth();
