import { expect, type Page, test } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SESSION_TOKEN =
  "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIiwia2lkIjoibUdXTnMxNmRGY2xhRlVSZWtuTkx4dU1FUEUwUlBEUTJZUXk0bHR5dFV1OEMxaFFfT1BYRnV2MlFRdWwxNVFKZExlcks4ZGlMSXV1RW1yTy1xU1RlYncifQ..NeGeMXutpwmyLcPrADE2nA.O9RGKL8WwXMrQV3tzXWmvU2yTZ29VVqc10R9kKzNkrYYnCSfuLVNEjUKRXyUbyfxNFI_3kN2Y2QarWWfYDh4PgJqq9ma0eAhydXqlITyMsGPPmqevCGFX4wDyFvVHRpa7uskWA7v-KAPH4j5qNrXj-FcdHT1HrRDnj7APY1VZ7JaNJoZ8S7IkZTPh1FaQRnr.3lVrLwXLxn2HC37UvulBR2KxDwFTDwYNeI5Z0Lefw4o";

/** Set the NextAuth session cookie so middleware lets us through. */
async function setAuthCookie(page: Page) {
  await page.context().addCookies([
    {
      name: "authjs.session-token",
      value: SESSION_TOKEN,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/** Seed IndexedDB with a fake queue item. */
async function seedQueueItem(
  page: Page,
  overrides: Record<string, unknown> = {},
) {
  await page.evaluate(
    (item) => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("elrey-submissions", 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore("pending-orders", { keyPath: "id" });
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("pending-orders", "readwrite");
          tx.objectStore("pending-orders").put(item);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    },
    {
      id: "test-submission-001",
      status: "pending",
      retryCount: 0,
      createdAt: Date.now(),
      lastAttemptAt: null,
      lastAttemptSource: null,
      lastHttpStatus: null,
      lastServerState: null,
      nextRetryAt: null,
      errorMessage: null,
      isAdmin: false,
      payload: {
        clientName: "Cliente Test",
        clientCode: "T001",
        products: { "Producto A": 2 },
        total: 150.0,
        queuedAt: Date.now(),
        userEmail: "ferchosaico26@gmail.com",
        actorEmail: "ferchosaico26@gmail.com",
        location: { lat: 4.6, lng: -74.0, accuracy: 10, timestamp: Date.now() },
        date: new Date().toISOString(),
        photoIds: [],
        photoUrls: [],
      },
      ...overrides,
    },
  );
}

/** Reset the queue IndexedDB database before each test. */
async function resetIndexedDB(page: Page) {
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const deleteReq = indexedDB.deleteDatabase("elrey-submissions");
      deleteReq.onsuccess = () => resolve();
      deleteReq.onerror = () => reject(deleteReq.error);
      deleteReq.onblocked = () => resolve();
    });
  });
}

/** Clear the queue store while keeping the database available to the page. */
async function clearQueueStore(page: Page) {
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("elrey-submissions", 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains("pending-orders")) {
          req.result.createObjectStore("pending-orders", { keyPath: "id" });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("pending-orders")) {
          db.close();
          resolve();
          return;
        }
        const tx = db.transaction("pending-orders", "readwrite");
        tx.objectStore("pending-orders").clear();
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

/** Count items in the queue IndexedDB store. */
async function countQueueItems(page: Page): Promise<number> {
  return page.evaluate(() => {
    return new Promise<number>((resolve, reject) => {
      const req = indexedDB.open("elrey-submissions", 1);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("pending-orders")) {
          resolve(0);
          return;
        }
        const tx = db.transaction("pending-orders", "readonly");
        const countReq = tx.objectStore("pending-orders").count();
        countReq.onsuccess = () => resolve(countReq.result);
        countReq.onerror = () => reject(countReq.error);
      };
      req.onerror = () => resolve(0);
    });
  });
}

async function getQueueItem(page: Page, id: string) {
  return page.evaluate((submissionId) => {
    return new Promise<Record<string, unknown> | null>((resolve, reject) => {
      const req = indexedDB.open("elrey-submissions", 1);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("pending-orders")) {
          resolve(null);
          return;
        }
        const tx = db.transaction("pending-orders", "readonly");
        const getReq = tx.objectStore("pending-orders").get(submissionId);
        getReq.onsuccess = () => resolve(getReq.result ?? null);
        getReq.onerror = () => reject(getReq.error);
      };
      req.onerror = () => resolve(null);
    });
  }, id);
}

async function emulateOfflineAppState(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => false,
    });
  });
}

/** Navigate to the form page and wait for it to be ready. */
async function goToForm(page: Page) {
  await page.context().setOffline(false);
  await emulateOfflineAppState(page);
  await page.route("**/api/clientes**", (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ clients: [] }) }),
  );
  await page.route("**/api/productos**", (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ products: [] }) }),
  );

  await page.goto("/form");
  // Wait until the page is interactive (not redirected to signin)
  await page.waitForURL("**/form", { timeout: 10000 });
}

async function goToFormWithMocks(
  page: Page,
  options: {
    disableServiceWorker?: boolean;
    submitStatus: number;
    submitBody: string;
    submitContentType?: string;
  },
) {
  await page.context().setOffline(false);
  if (options.disableServiceWorker) {
    await page.route("**/service-worker.js", (route) =>
      route.fulfill({ status: 404, body: "" }),
    );
  }

  await page.route("**/api/submit-form", (route) =>
    route.fulfill({
      status: options.submitStatus,
      body: options.submitBody,
      contentType: options.submitContentType ?? "application/json",
    }),
  );
  await page.route("**/api/clientes**", (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ clients: [] }) }),
  );
  await page.route("**/api/productos**", (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ products: [] }) }),
  );

  await page.goto("/form");
  await page.waitForURL("**/form", { timeout: 10000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Queue fixes", () => {
  test.beforeEach(async ({ page }) => {
    await setAuthCookie(page);
    await page.goto("/offline.html");
    await resetIndexedDB(page);
  });

  // -------------------------------------------------------------------------
  // Fix 5: Limpiar confirmation dialog
  // -------------------------------------------------------------------------

  test("Limpiar shows confirmation dialog when item has retryCount > 0", async ({
    page,
  }) => {
    await seedQueueItem(page, { retryCount: 1, status: "pending" });
    await goToForm(page);

    // Wait for the banner to appear
    const banner = page.locator("text=pendiente");
    await expect(banner).toBeVisible({ timeout: 8000 });

    // Click Limpiar
    await page.getByRole("button", { name: "Limpiar" }).click();

    // Dialog must appear — check the title (unique to the dialog)
    await expect(page.getByText("Verificar antes de limpiar")).toBeVisible({
      timeout: 3000,
    });
  });

  test("Limpiar shows confirmation dialog when item is in sending state", async ({
    page,
  }) => {
    await seedQueueItem(page, { retryCount: 0, status: "sending" });
    await goToForm(page);

    await expect(page.locator("text=pendiente")).toBeVisible({ timeout: 8000 });
    await page.getByRole("button", { name: "Limpiar" }).click();

    await expect(page.getByText("Verificar antes de limpiar")).toBeVisible({
      timeout: 3000,
    });
  });

  test("Limpiar dialog Cancel keeps the queue intact", async ({ page }) => {
    await seedQueueItem(page, { retryCount: 2, status: "pending" });
    await goToForm(page);

    await expect(page.locator("text=pendiente")).toBeVisible({ timeout: 8000 });
    await page.getByRole("button", { name: "Limpiar" }).click();
    await expect(page.getByText("Verificar antes de limpiar")).toBeVisible();

    // Cancel — queue must still exist
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(
      page.getByText("Verificar antes de limpiar"),
    ).not.toBeVisible();
    await expect(page.locator("text=pendiente")).toBeVisible();

    const count = await countQueueItems(page);
    expect(count).toBe(1);
  });

  test("Limpiar dialog 'Limpiar de todas formas' clears the queue", async ({
    page,
  }) => {
    await seedQueueItem(page, { retryCount: 1, status: "pending" });
    await goToForm(page);

    await expect(page.locator("text=pendiente")).toBeVisible({ timeout: 8000 });
    await page.getByRole("button", { name: "Limpiar" }).click();
    await expect(page.getByText("Verificar antes de limpiar")).toBeVisible();

    await page.getByRole("button", { name: "Limpiar de todas formas" }).click();

    // Banner (blue bg container) must disappear — use the queue count badge
    await expect(page.locator(".bg-blue-50")).not.toBeVisible({
      timeout: 5000,
    });

    const count = await countQueueItems(page);
    expect(count).toBe(0);
  });

  test("Limpiar skips dialog for fresh items (retryCount = 0, status = pending)", async ({
    page,
  }) => {
    await seedQueueItem(page, { retryCount: 0, status: "pending" });
    await goToForm(page);

    await expect(page.locator("text=pendiente")).toBeVisible({ timeout: 8000 });

    // Block any outgoing submit to prevent auto-send from removing the item
    await page.route("**/api/submit-form", (route) => route.abort());

    await page.getByRole("button", { name: "Limpiar" }).click();

    // No dialog
    await expect(
      page.getByText("Verificar antes de limpiar"),
    ).not.toBeVisible();

    // Queue cleared immediately
    await expect(page.locator(".bg-blue-50")).not.toBeVisible({
      timeout: 5000,
    });
  });

  // -------------------------------------------------------------------------
  // Fix 6: Queue diagnostics for retried and failed items
  // -------------------------------------------------------------------------

  test("Retried items show queue diagnostics instead of a generic duplicate warning", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedQueueItem(page, {
      id: "12345678-abcdef-9876",
      retryCount: 1,
      status: "pending",
      lastAttemptSource: "hook",
      lastHttpStatus: 500,
      lastServerState: "unknown",
      nextRetryAt: Date.now() + 15000,
      errorMessage: "Error del servidor: 500",
    });
    await goToForm(page);

    await expect(page.locator("text=pendiente")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/ID 12345678\.\.\.9876/)).toBeVisible();
    await expect(page.getByText("App web")).toBeVisible();
    await expect(page.getByText("HTTP 500")).toBeVisible();
    await expect(page.getByText(/Proximo/)).toBeVisible();
    await expect(page.getByText("Error del servidor: 500")).toBeVisible();
    await expect(
      page.getByText("Estado no confirmado. Reintentaremos automaticamente."),
    ).toBeVisible({ timeout: 3000 });
  });

  test("Fresh items do not show retry diagnostics", async ({ page }) => {
    await seedQueueItem(page, { retryCount: 0, status: "pending" });
    await goToForm(page);

    await expect(page.locator("text=pendiente")).toBeVisible({ timeout: 8000 });
    await expect(
      page.getByText("Estado no confirmado. Reintentaremos automaticamente."),
    ).not.toBeVisible();
  });

  test("HTTP 200 with invalid JSON still clears a queued item", async ({
    page,
  }) => {
    await seedQueueItem(page, { retryCount: 0, status: "pending" });
    await goToFormWithMocks(page, {
      disableServiceWorker: true,
      submitStatus: 200,
      submitBody: "ok",
      submitContentType: "text/plain",
    });

    await expect
      .poll(async () => countQueueItems(page), { timeout: 8000 })
      .toBe(0);
    await expect(page.locator(".bg-blue-50")).not.toBeVisible({
      timeout: 8000,
    });
  });

  test("HTTP 400 leaves the item failed with visible diagnostics", async ({
    page,
  }) => {
    await seedQueueItem(page, { retryCount: 0, status: "pending" });
    await goToFormWithMocks(page, {
      disableServiceWorker: true,
      submitStatus: 400,
      submitBody: JSON.stringify({
        error: "La precision del GPS es insuficiente.",
      }),
    });

    await expect(page.getByText("Error", { exact: true })).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByText("App web")).toBeVisible();
    await expect(page.getByText("HTTP 400")).toBeVisible();
    await expect(
      page.getByText("La precision del GPS es insuficiente."),
    ).toBeVisible();
    await expect(
      page.getByText("Estado no confirmado. Reintentaremos automaticamente."),
    ).not.toBeVisible();
  });

  test("HTTP 409 keeps the item pending and shows processing status", async ({
    page,
  }) => {
    await seedQueueItem(page, { retryCount: 0, status: "pending" });
    await goToFormWithMocks(page, {
      disableServiceWorker: true,
      submitStatus: 409,
      submitBody: JSON.stringify({
        code: "SUBMISSION_IN_PROGRESS",
        error: "Este pedido sigue procesandose en el servidor.",
        submissionState: "processing",
      }),
    });

    await expect
      .poll(
        async () => {
          const item = await getQueueItem(page, "test-submission-001");
          return item
            ? {
                retryCount: item.retryCount,
                lastServerState: item.lastServerState,
                hasNextRetryAt: typeof item.nextRetryAt === "number",
              }
            : null;
        },
        { timeout: 8000 },
      )
      .toEqual({
        retryCount: 0,
        lastServerState: "processing",
        hasNextRetryAt: true,
      });

    await expect(page.getByText("Procesando en servidor")).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByText("Procesando", { exact: true })).toBeVisible();
  });

  test("HTTP 500 keeps the item pending with neutral unknown status", async ({
    page,
  }) => {
    await seedQueueItem(page, { retryCount: 0, status: "pending" });
    await goToFormWithMocks(page, {
      disableServiceWorker: true,
      submitStatus: 500,
      submitBody: JSON.stringify({
        error:
          "Error al guardar en la base de datos. Estado no confirmado; se reintentara automaticamente.",
        retryable: true,
        submissionState: "unknown",
      }),
    });

    await expect
      .poll(
        async () => {
          const item = await getQueueItem(page, "test-submission-001");
          return item
            ? {
                retryCount: item.retryCount,
                lastServerState: item.lastServerState,
                hasNextRetryAt: typeof item.nextRetryAt === "number",
              }
            : null;
        },
        { timeout: 8000 },
      )
      .toEqual({
        retryCount: 1,
        lastServerState: "unknown",
        hasNextRetryAt: true,
      });

    await expect(
      page.getByText("Estado no confirmado. Reintentaremos automaticamente."),
    ).toBeVisible({ timeout: 8000 });
  });

  test("Confirmed submitted duplicate clears the queued item", async ({
    page,
  }) => {
    await seedQueueItem(page, { retryCount: 0, status: "pending" });
    await goToFormWithMocks(page, {
      disableServiceWorker: true,
      submitStatus: 200,
      submitBody: JSON.stringify({
        success: true,
        duplicate: true,
        submissionState: "submitted",
      }),
    });

    await expect
      .poll(async () => countQueueItems(page), { timeout: 8000 })
      .toBe(0);
    await expect(page.locator(".bg-blue-50")).not.toBeVisible({
      timeout: 8000,
    });
  });

  // -------------------------------------------------------------------------
  // Fix 1+2: visibilitychange & focus trigger loadQueue
  // -------------------------------------------------------------------------

  test("visibilitychange to visible refreshes queue state from IndexedDB", async ({
    page,
  }) => {
    // Start with a queue item
    await seedQueueItem(page, { retryCount: 0, status: "pending" });
    await goToForm(page);

    await expect(page.locator("text=pendiente")).toBeVisible({ timeout: 8000 });

    // Simulate the item being removed from IndexedDB externally (as the SW would do)
    await clearQueueStore(page);
    await expect
      .poll(async () => countQueueItems(page), { timeout: 5000 })
      .toBe(0);

    // Simulate the tab becoming visible again (triggers handleVisibilityChange)
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // The banner must clear — loadQueue() re-reads IndexedDB
    await expect(page.locator("text=pendiente")).not.toBeVisible({
      timeout: 5000,
    });
  });

  test("window focus event refreshes queue state from IndexedDB", async ({
    page,
  }) => {
    await seedQueueItem(page, { retryCount: 0, status: "pending" });
    await goToForm(page);

    await expect(page.locator("text=pendiente")).toBeVisible({ timeout: 8000 });

    // Remove item externally (simulates SW success)
    await clearQueueStore(page);
    await expect
      .poll(async () => countQueueItems(page), { timeout: 5000 })
      .toBe(0);

    // Dispatch focus event (triggers handleFocus → loadQueue)
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));

    await expect(page.locator("text=pendiente")).not.toBeVisible({
      timeout: 5000,
    });
  });
});
