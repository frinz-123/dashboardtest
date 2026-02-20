import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  use: {
    baseURL: "http://localhost:3000",
    // Keep SW alive across page navigations
    serviceWorkers: "allow",
  },
  webServer: {
    command: "NEXT_PUBLIC_ENABLE_SW_DEV=true npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30000,
  },
});
