import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const internalDir = path.join(
  repoRoot,
  ".netlify",
  "functions-internal",
  "___netlify-server-handler",
);
const handlerFile = path.join(internalDir, "___netlify-server-handler.mjs");
const zipFile = path.join(
  repoRoot,
  ".netlify",
  "functions",
  "___netlify-server-handler.zip",
);

if (process.platform !== "win32") {
  console.log("[netlify-fix] Skipping: only needed for Windows local Netlify builds.");
  process.exit(0);
}

if (!existsSync(handlerFile)) {
  console.log("[netlify-fix] Skipping: generated server handler not found.");
  process.exit(0);
}

const originalSource = readFileSync(handlerFile, "utf8");
const repairedSource = repairHandlerSource(originalSource);

if (repairedSource === originalSource) {
  console.log("[netlify-fix] Server handler did not require changes.");
  process.exit(0);
}

writeFileSync(handlerFile, repairedSource, "utf8");
rebuildZipFromDirectory(internalDir, zipFile);
console.log("[netlify-fix] Repaired Netlify server handler for Windows deploys.");

function repairHandlerSource(source) {
  const requestContextPath = matchOrThrow(
    source,
    /from '([^']*request-context\.cjs)'/,
    "request-context import",
  );
  const tracerPath = matchOrThrow(
    source,
    /from '([^']*tracer\.cjs)'/,
    "tracer import",
  );
  const chdirPath = matchOrThrow(
    source,
    /process\.chdir\('([^']+)'\)/,
    "process.chdir path",
  );
  const serverPath = matchOrThrow(
    source,
    /await import\('([^']*server\.js)'\)/,
    "server import path",
  );

  if (!requestContextPath.startsWith("\\var\\task\\")) {
    return source;
  }

  const relativeAppRoot = `./${toPosixPath(
    requestContextPath
      .replace(/^\\var\\task\\/, "")
      .replace(/\/\.netlify\/dist\/run\/handlers\/request-context\.cjs$/, ""),
  )}`;
  const relativeHandlersRoot = `${relativeAppRoot}/.netlify/dist/run/handlers`;

  let updated = source;

  if (!updated.includes("import { fileURLToPath } from 'node:url'")) {
    updated = `import { fileURLToPath } from 'node:url'\n${updated}`;
  }

  updated = updated.replace(
    requestContextPath,
    `${relativeHandlersRoot}/request-context.cjs`,
  );
  updated = updated.replace(tracerPath, `${relativeHandlersRoot}/tracer.cjs`);
  updated = updated.replace(
    `process.chdir('${chdirPath}')`,
    `const appRoot = fileURLToPath(new URL('${relativeAppRoot}/', import.meta.url))\n\nprocess.chdir(appRoot)`,
  );
  updated = updated.replace(`cwd: '${chdirPath}'`, "cwd: appRoot");
  updated = updated.replace(
    `await import('${serverPath}')`,
    `await import(new URL('${relativeHandlersRoot}/server.js', import.meta.url).href)`,
  );

  return updated;
}

function rebuildZipFromDirectory(sourceDir, destinationZip) {
  const command = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.IO.Compression.FileSystem",
    `$source = '${escapePowerShell(sourceDir)}'`,
    `$destination = '${escapePowerShell(destinationZip)}'`,
    "if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Force }",
    "[System.IO.Compression.ZipFile]::CreateFromDirectory($source, $destination)",
  ].join("; ");

  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-Command", command],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: "pipe",
    },
  );

  if (result.status !== 0) {
    throw new Error(
      [result.stdout, result.stderr]
        .filter(Boolean)
        .join("\n") || "Failed to rebuild Netlify handler zip.",
    );
  }
}

function matchOrThrow(source, pattern, label) {
  const value = source.match(pattern)?.[1];

  if (!value) {
    throw new Error(`[netlify-fix] Could not find ${label}.`);
  }

  return value;
}

function toPosixPath(value) {
  return value.replace(/\\/g, "/");
}

function escapePowerShell(value) {
  return value.replace(/'/g, "''");
}
