import { promises as fs } from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";

const serverOutputDir = path.join(process.cwd(), ".next", "server");

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const envKeys = [
  "AUTH_SECRET",
  "NEXTAUTH_SECRET",
  "AUTH_URL",
  "NEXTAUTH_URL",
  "AUTH_TRUST_HOST",
  "GOOGLE_CLIENT_ID",
  "AUTH_GOOGLE_ID",
  "GOOGLE_CLIENT_SECRET",
  "AUTH_GOOGLE_SECRET",
  "OVERRIDE_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_CLIENT_ID",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID",
  "GOOGLE_SERVICE_ACCOUNT_PROJECT_ID",
  "GOOGLE_SERVICE_ACCOUNT_TYPE",
  "GOOGLE_DRIVE_FOLDER_ID",
  "GOOGLE_DRIVE_REDIRECT_URI",
  "GOOGLE_DRIVE_REFRESH_TOKEN",
  "R2_ACCESS_KEY_ID",
  "R2_ACCOUNT_ID",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL",
  "R2_SECRET_ACCESS_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
];

const jsFilePattern = /\.(?:js|mjs|cjs)$/i;

const escapeRegExp = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const walk = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(entryPath)));
      continue;
    }

    if (jsFilePattern.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
};

const inlineEnvReferences = (source) => {
  let nextSource = source;
  let replaced = false;

  for (const key of envKeys) {
    const pattern = new RegExp(`process\\.env\\.${escapeRegExp(key)}\\b`, "g");

    if (!pattern.test(nextSource)) {
      continue;
    }

    pattern.lastIndex = 0;
    const envValue = process.env[key];
    const replacement = envValue === undefined ? "undefined" : JSON.stringify(envValue);
    nextSource = nextSource.replace(pattern, replacement);
    replaced = true;
  }

  return { nextSource, replaced };
};

const main = async () => {
  try {
    await fs.access(serverOutputDir);
  } catch {
    console.log(`[postbuild:inline-next-server-env] Skipped because ${serverOutputDir} does not exist.`);
    return;
  }

  const files = await walk(serverOutputDir);
  let processedFiles = 0;

  for (const filePath of files) {
    const originalSource = await fs.readFile(filePath, "utf8");
    const { nextSource, replaced } = inlineEnvReferences(originalSource);

    if (!replaced) {
      continue;
    }

    await fs.writeFile(filePath, nextSource, "utf8");
    processedFiles += 1;
  }

  console.log("[postbuild:inline-next-server-env] Completed", {
    processedFiles,
    serverOutputDir,
    availableKeys: envKeys.filter((key) => process.env[key] !== undefined),
  });
};

await main();