import { expect, test, type Page } from "@playwright/test";

async function ensureServiceWorkerControl(page: Page) {
  await page.goto("/auth/signin", { waitUntil: "networkidle" });

  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return;
    await navigator.serviceWorker.ready;
  });

  // The first load may register but not yet be controlled.
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), {
    timeout: 45000,
  });
}

test.describe("Offline app shell", () => {
  test("loads cached sign-in page while offline", async ({ page }) => {
    await ensureServiceWorkerControl(page);

    await page.context().setOffline(true);
    await page.goto("/auth/signin", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Sign in to your account" }))
      .toBeVisible();
  });

  test("shows offline fallback for uncached navigation", async ({ page }) => {
    await ensureServiceWorkerControl(page);

    await page.context().setOffline(true);
    await page.goto(`/ruta-no-cacheada-${Date.now()}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByText("Sin conexion")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  });
});
