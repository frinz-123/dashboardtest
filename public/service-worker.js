/**
 * Service Worker with Background Sync for Offline-First Order Submission
 *
 * This service worker handles:
 * 1. Background Sync - Process queued orders when connection is restored
 * 2. Offline app-shell caching for navigation/assets
 */

const SYNC_TAG = "order-submission-sync";
const CACHE_VERSION = "v2";
const APP_SHELL_CACHE = `elrey-app-shell-${CACHE_VERSION}`;
const ASSET_RUNTIME_CACHE = `elrey-assets-${CACHE_VERSION}`;
const IMAGE_RUNTIME_CACHE = `elrey-images-${CACHE_VERSION}`;
const CACHE_ALLOWLIST = [APP_SHELL_CACHE, ASSET_RUNTIME_CACHE, IMAGE_RUNTIME_CACHE];
const OFFLINE_FALLBACK_PATH = "/offline.html";
const APP_SHELL_PRECACHE_URLS = [
  OFFLINE_FALLBACK_PATH,
  "/auth/signin",
  "/login",
  "/manifest.json",
  "/icons/favicon.ico",
  "/icons/favicon.svg",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/google.svg",
];

const DB_NAME = "elrey-submissions";
const STORE_NAME = "pending-orders";
const PHOTO_DB_NAME = "elrey-photo-store";
const PHOTO_STORE_NAME = "cley-photos";
const MAX_RETRIES = 5;
const REQUEST_TIMEOUT_MS = 10000; // 10 seconds per network attempt
const PHOTO_UPLOAD_TIMEOUT_MS = 15000; // 15 seconds per photo upload
const STALE_SENDING_MS = 45000; // Recover "sending" items after 45 seconds

const CACHEABLE_DESTINATIONS = new Set(["script", "style", "font", "worker"]);

const isHttpRequest = (request) => request.url.startsWith("http");

const isCacheableResponse = (response) =>
  Boolean(response?.ok && (response.type === "basic" || response.type === "cors"));

const isNavigationRequest = (request) => request.mode === "navigate";

const isStaticAssetRequest = (request, url) =>
  url.pathname.startsWith("/_next/static/") ||
  CACHEABLE_DESTINATIONS.has(request.destination) ||
  url.pathname === "/manifest.json" ||
  url.pathname === "/favicon.ico";

const isImageRequest = (request, url) =>
  request.destination === "image" ||
  url.pathname.startsWith("/icons/") ||
  url.pathname.endsWith(".png") ||
  url.pathname.endsWith(".jpg") ||
  url.pathname.endsWith(".jpeg") ||
  url.pathname.endsWith(".svg") ||
  url.pathname.endsWith(".ico");

const toNavigationCacheKey = (request) => {
  const url = new URL(request.url);
  return new Request(`${url.origin}${url.pathname}`, {
    method: "GET",
  });
};

const shouldBypassCaching = (request, url) => {
  if (request.method !== "GET") return true;
  if (!isHttpRequest(request)) return true;
  if (url.origin !== self.location.origin) return true;
  if (url.pathname.startsWith("/api/")) return true;
  if (url.pathname === "/service-worker.js") return true;
  if (url.pathname.startsWith("/_next/webpack-hmr")) return true;
  return false;
};

async function precacheAppShell() {
  const cache = await caches.open(APP_SHELL_CACHE);

  await Promise.all(
    APP_SHELL_PRECACHE_URLS.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (isCacheableResponse(response)) {
          await cache.put(url, response.clone());
        } else {
          console.warn("[SW] Skipping non-cacheable precache response:", url);
        }
      } catch (error) {
        console.warn("[SW] Failed to precache:", url, error);
      }
    }),
  );
}

async function cleanupOutdatedCaches() {
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => name.startsWith("elrey-") && !CACHE_ALLOWLIST.includes(name))
      .map((name) => caches.delete(name)),
  );
}

async function handleNavigationFetch(request) {
  const cacheKey = toNavigationCacheKey(request);
  const cache = await caches.open(APP_SHELL_CACHE);

  try {
    const networkResponse = await fetch(request);
    const contentType = networkResponse.headers.get("content-type") || "";

    if (networkResponse.ok && contentType.includes("text/html")) {
      await cache.put(cacheKey, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    const cached = await cache.match(cacheKey, { ignoreSearch: true });
    if (cached) return cached;

    const fallback = await cache.match(OFFLINE_FALLBACK_PATH);
    if (fallback) return fallback;

    return new Response("Sin conexion y sin contenido en cache.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function handleCacheFirstAsset(event, request) {
  const cache = await caches.open(ASSET_RUNTIME_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });

  const refresh = fetch(request)
    .then(async (response) => {
      if (isCacheableResponse(response)) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }

  const networkResponse = await refresh;
  if (networkResponse) return networkResponse;

  return new Response("Asset unavailable offline", { status: 503 });
}

async function handleStaleWhileRevalidateImage(event, request) {
  const cache = await caches.open(IMAGE_RUNTIME_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });

  const refresh = fetch(request)
    .then(async (response) => {
      if (isCacheableResponse(response)) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }

  const networkResponse = await refresh;
  if (networkResponse) return networkResponse;

  return new Response("", { status: 504 });
}

// Install event - precache app shell then activate immediately.
self.addEventListener("install", (event) => {
  console.log("[SW] Service worker installed");
  event.waitUntil(
    (async () => {
      await precacheAppShell();
      await self.skipWaiting();
    })(),
  );
});

// Activate event - remove old caches and claim clients.
self.addEventListener("activate", (event) => {
  console.log("[SW] Service worker activated");
  event.waitUntil(
    (async () => {
      await cleanupOutdatedCaches();
      await self.clients.claim();
    })(),
  );
});

// Background Sync event - process queued orders
self.addEventListener("sync", (event) => {
  console.log("[SW] Sync event received:", event.tag);

  if (event.tag === SYNC_TAG) {
    event.waitUntil(processQueuedOrders());
  }
});

// Periodic Background Sync (if supported)
self.addEventListener("periodicsync", (event) => {
  console.log("[SW] Periodic sync event:", event.tag);

  if (event.tag === SYNC_TAG) {
    event.waitUntil(processQueuedOrders());
  }
});

// Message event - handle messages from main thread
self.addEventListener("message", (event) => {
  console.log("[SW] Message received:", event.data);

  if (event.data?.type === "PROCESS_QUEUE") {
    processQueuedOrders().then((result) => {
      event.ports[0]?.postMessage(result);
    });
  }

  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Fetch event - conservative offline app shell caching only.
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.cache === "only-if-cached" && request.mode !== "same-origin") {
    return;
  }

  const url = new URL(request.url);
  if (shouldBypassCaching(request, url)) {
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(handleNavigationFetch(request));
    return;
  }

  if (isStaticAssetRequest(request, url)) {
    event.respondWith(handleCacheFirstAsset(event, request));
    return;
  }

  if (isImageRequest(request, url)) {
    event.respondWith(handleStaleWhileRevalidateImage(event, request));
  }
});

/**
 * Open IndexedDB database
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
        });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
  });
}

/**
 * Open IndexedDB for stored photos
 */
function openPhotoDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PHOTO_DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE_NAME)) {
        db.createObjectStore(PHOTO_STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

async function getPhotoRecord(id) {
  const db = await openPhotoDatabase();
  if (!db.objectStoreNames.contains(PHOTO_STORE_NAME)) return null;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PHOTO_STORE_NAME], "readonly");
    const store = transaction.objectStore(PHOTO_STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function deletePhotoRecords(ids) {
  if (!ids || ids.length === 0) return;
  const db = await openPhotoDatabase();
  if (!db.objectStoreNames.contains(PHOTO_STORE_NAME)) return;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PHOTO_STORE_NAME], "readwrite");
    const store = transaction.objectStore(PHOTO_STORE_NAME);

    ids.forEach((id) => {
      store.delete(id);
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

/**
 * Get all pending submissions from IndexedDB
 */
async function getPendingSubmissions() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const all = request.result || [];
      // Filter to only pending items (not completed, failed, or currently sending)
      const pending = all.filter((s) => s.status === "pending");
      resolve(pending);
    };

    request.onerror = () => reject(request.error);
  });
}

async function getAllSubmissions() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update a submission's status in IndexedDB
 */
async function updateSubmission(id, updates) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const existing = getRequest.result;
      if (!existing) {
        reject(new Error(`Submission ${id} not found`));
        return;
      }

      const updated = { ...existing, ...updates };
      const putRequest = store.put(updated);

      putRequest.onsuccess = () => resolve(updated);
      putRequest.onerror = () => reject(putRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Remove a submission from IndexedDB
 */
async function removeSubmission(id) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function fetchWithTimeout(input, init, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Tiempo de espera agotado");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function recoverStaleSendingSubmissions() {
  const now = Date.now();
  const all = await getAllSubmissions();
  const staleSending = all.filter((submission) => {
    if (submission.status !== "sending") return false;
    const lastAttemptAt = submission.lastAttemptAt || submission.createdAt;
    return now - lastAttemptAt > STALE_SENDING_MS;
  });

  for (const submission of staleSending) {
    const nextRetryCount = (submission.retryCount || 0) + 1;
    const timeoutMessage = "Tiempo de espera agotado. Pulsa Volver a intentar.";

    if (nextRetryCount >= MAX_RETRIES) {
      await updateSubmission(submission.id, {
        status: "failed",
        retryCount: nextRetryCount,
        errorMessage: timeoutMessage,
      });
      console.error(
        `[SW] ${submission.id} recovered from stale sending -> failed`,
        { retryCount: nextRetryCount },
      );
      continue;
    }

    await updateSubmission(submission.id, {
      status: "pending",
      retryCount: nextRetryCount,
      errorMessage: timeoutMessage,
    });
    console.warn(
      `[SW] ${submission.id} recovered from stale sending -> pending`,
      {
        retryCount: nextRetryCount,
      },
    );
  }
}

/**
 * Send a single submission to the server
 */
async function sendSubmission(submission) {
  const response = await fetchWithTimeout(
    "/api/submit-form",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...submission.payload,
        queuedAt: submission.payload?.queuedAt ?? submission.createdAt,
        submissionId: submission.id,
        attemptNumber: submission.retryCount + 1,
        fromBackgroundSync: true,
      }),
    },
    REQUEST_TIMEOUT_MS,
  );

  // If the server returned 2xx, treat as success even if body parsing fails.
  // Network can drop mid-transfer after headers arrive but before the body
  // completes — throwing here would leave the item in "pending" even though
  // the server already wrote the order to Google Sheets.
  if (response.ok) {
    let data = {};
    try {
      data = await response.json();
    } catch {
      console.warn(
        "[SW] HTTP 200 but body parse failed — treating as success",
      );
    }
    return data;
  }

  let errorData = {};
  try {
    errorData = await response.json();
  } catch {
    // Ignore body parse errors on error responses
  }
  throw new Error(errorData.error || `Server error: ${response.status}`);
}

async function uploadPhotoBlob(photoId, submissionId) {
  const record = await getPhotoRecord(photoId);
  if (!record || !record.blob) {
    throw new Error(`Foto no encontrada (${photoId})`);
  }

  const formData = new FormData();
  formData.append("file", record.blob, `${submissionId}-${photoId}.jpg`);
  formData.append("photoId", photoId);
  formData.append("submissionId", submissionId);

  const response = await fetchWithTimeout(
    "/api/upload-photo",
    {
      method: "POST",
      body: formData,
    },
    PHOTO_UPLOAD_TIMEOUT_MS,
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.error || `Upload error: ${response.status}`;
    if (data.duplicate || response.status === 409) {
      throw new Error(`DUPLICATE_PHOTO:${message}`);
    }
    throw new Error(message);
  }

  if (!data?.url) {
    throw new Error("Respuesta invalida del servidor");
  }

  return data.url;
}

async function ensurePhotoUploads(submission) {
  const photoIds = submission.payload?.photoIds || [];
  if (photoIds.length === 0) return submission;

  const existingUrls = Array.isArray(submission.payload?.photoUrls)
    ? [...submission.payload.photoUrls]
    : [];

  if (existingUrls.length >= photoIds.length) return submission;

  for (let index = existingUrls.length; index < photoIds.length; index++) {
    const photoId = photoIds[index];

    // Pre-check: is the blob still in IndexedDB?
    const record = await getPhotoRecord(photoId);
    if (!record || !record.blob) {
      throw new Error(
        `PHOTO_LOST:Foto perdida (${index + 1}/${photoIds.length}). Elimina este pedido y crealo de nuevo.`,
      );
    }

    const url = await uploadPhotoBlob(photoId, submission.id);
    existingUrls.push(url);

    // Save progress after EACH successful upload
    const progressPayload = { ...submission.payload, photoUrls: [...existingUrls] };
    await updateSubmission(submission.id, { payload: progressPayload });
  }

  const updatedPayload = { ...submission.payload, photoUrls: existingUrls };
  return { ...submission, payload: updatedPayload };
}

/**
 * Process all queued orders
 * Called by Background Sync when connection is restored
 */
async function processQueuedOrders() {
  console.log("[SW] Processing queued orders...");

  const results = {
    processed: 0,
    succeeded: 0,
    failed: 0,
  };

  try {
    await recoverStaleSendingSubmissions();
    const pending = await getPendingSubmissions();
    console.log(`[SW] Found ${pending.length} pending submissions`);

    for (const submission of pending) {
      results.processed++;

      try {
        // NOTE: We no longer check location validity here.
        // Location was validated at submission time when the user clicked "Enviar Pedido".
        // The stored coordinates are proof the user was at the client location.
        // Re-validating would break offline-first queue processing.

        // Mark as sending
        await updateSubmission(submission.id, {
          status: "sending",
          lastAttemptAt: Date.now(),
        });

        const preparedSubmission = await ensurePhotoUploads(submission);

        // Send to server
        const result = await sendSubmission(preparedSubmission);

        console.log(
          `[SW] Submission ${submission.id} succeeded`,
          result.duplicate ? "(duplicate)" : "",
        );

        // Remove from queue on success
        await removeSubmission(submission.id);
        if (preparedSubmission.payload?.photoIds?.length) {
          deletePhotoRecords(preparedSubmission.payload.photoIds).catch(
            (error) => {
              console.error(
                `[SW] Failed to delete photo blobs for ${submission.id}:`,
                error,
              );
            },
          );
        }
        results.succeeded++;

        // Notify the main thread about success
        notifyClients({
          type: "SUBMISSION_SUCCESS",
          submissionId: submission.id,
          duplicate: result.duplicate,
        });
      } catch (error) {
        console.error(
          `[SW] Submission ${submission.id} failed:`,
          error.message,
        );

        const errorMessage =
          typeof error?.message === "string"
            ? error.message
            : "Error desconocido";
        const isDuplicate =
          typeof errorMessage === "string" &&
          errorMessage.startsWith("DUPLICATE_PHOTO:");
        const isPhotoLost =
          typeof errorMessage === "string" &&
          errorMessage.startsWith("PHOTO_LOST:");

        const newRetryCount = (submission.retryCount || 0) + 1;

        if (isDuplicate || isPhotoLost) {
          const cleanMessage = errorMessage
            .replace(/^(DUPLICATE_PHOTO|PHOTO_LOST):/, "")
            .trim();
          const fallbackMessage = isPhotoLost
            ? "Foto perdida. Elimina este pedido y crealo de nuevo."
            : "Foto duplicada. Toma una nueva.";
          await updateSubmission(submission.id, {
            status: "failed",
            retryCount: newRetryCount,
            errorMessage: cleanMessage || fallbackMessage,
          });

          notifyClients({
            type: "SUBMISSION_FAILED",
            submissionId: submission.id,
            error: cleanMessage || fallbackMessage,
          });

          results.failed++;
          continue;
        }

        if (newRetryCount >= MAX_RETRIES) {
          await updateSubmission(submission.id, {
            status: "failed",
            retryCount: newRetryCount,
            errorMessage: error.message || "Maximo de reintentos alcanzado",
          });

          // Notify about failure
          notifyClients({
            type: "SUBMISSION_FAILED",
            submissionId: submission.id,
            error: error.message,
          });
        } else {
          await updateSubmission(submission.id, {
            status: "pending",
            retryCount: newRetryCount,
            errorMessage: error.message,
          });
        }

        results.failed++;
      }
    }
  } catch (error) {
    console.error("[SW] Error processing queue:", error);
  }

  console.log("[SW] Queue processing complete:", results);

  // Notify clients to refresh their queue state
  notifyClients({
    type: "QUEUE_PROCESSED",
    results,
  });

  return results;
}

/**
 * Notify all clients about an event
 */
async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: "window" });

  for (const client of clients) {
    client.postMessage(message);
  }
}
