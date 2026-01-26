/**
 * Service Worker with Background Sync for Offline-First Order Submission
 *
 * This service worker handles:
 * 1. Background Sync - Process queued orders when connection is restored
 * 2. Background tools for offline support
 *
 * Note: Workbox (next-pwa) handles runtime caching.
 */

const SYNC_TAG = "order-submission-sync";
const DB_NAME = "elrey-submissions";
const STORE_NAME = "pending-orders";
const PHOTO_DB_NAME = "elrey-photo-store";
const PHOTO_STORE_NAME = "cley-photos";

// Install event - activate immediately
self.addEventListener("install", (event) => {
    console.log("[SW] Service worker installed");
    self.skipWaiting();
});

// Activate event - claim clients
self.addEventListener("activate", (event) => {
    console.log("[SW] Service worker activated");
    event.waitUntil(self.clients.claim());
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
            // NOTE: Also include 'locationStale' for backwards compatibility - these should now be processed
            // since location is validated at submission time, not during queue processing
            const pending = all.filter(
                (s) => s.status === "pending" || s.status === "locationStale",
            );
            resolve(pending);
        };

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

/**
 * Send a single submission to the server
 */
async function sendSubmission(submission) {
    const response = await fetch("/api/submit-form", {
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
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
    }

    return data;
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

    const response = await fetch("/api/upload-photo", {
        method: "POST",
        body: formData,
    });
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
        const url = await uploadPhotoBlob(photoId, submission.id);
        existingUrls.push(url);
    }

    const updatedPayload = { ...submission.payload, photoUrls: existingUrls };
    await updateSubmission(submission.id, { payload: updatedPayload });

    return { ...submission, payload: updatedPayload };
}

/**
 * NOTE: isLocationValid is no longer used for queue processing.
 * Location is validated at submission time when the user clicks "Enviar Pedido".
 * The stored coordinates are proof the user was at the client location.
 * Keeping this function for potential future use but it's not called during processing.
 */
function isLocationValid(submission) {
    // Admins bypass location checks
    if (submission.isAdmin) return true;

    const locationTimestamp = submission.payload?.location?.timestamp;
    if (!locationTimestamp) return false;

    const age = Date.now() - locationTimestamp;
    const MAX_LOCATION_AGE_MS = 90000; // 90 seconds

    return age < MAX_LOCATION_AGE_MS;
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
        stale: 0,
    };

    try {
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
                    deletePhotoRecords(
                        preparedSubmission.payload.photoIds,
                    ).catch((error) => {
                        console.error(
                            `[SW] Failed to delete photo blobs for ${submission.id}:`,
                            error,
                        );
                    });
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

                const newRetryCount = (submission.retryCount || 0) + 1;
                const MAX_RETRIES = 5;

                if (isDuplicate) {
                    const cleanMessage = errorMessage
                        .replace(/^DUPLICATE_PHOTO:/, "")
                        .trim();
                    await updateSubmission(submission.id, {
                        status: "failed",
                        retryCount: newRetryCount,
                        errorMessage:
                            cleanMessage || "Foto duplicada. Toma una nueva.",
                    });

                    notifyClients({
                        type: "SUBMISSION_FAILED",
                        submissionId: submission.id,
                        error:
                            cleanMessage || "Foto duplicada. Toma una nueva.",
                    });

                    results.failed++;
                    continue;
                }

                if (newRetryCount >= MAX_RETRIES) {
                    await updateSubmission(submission.id, {
                        status: "failed",
                        retryCount: newRetryCount,
                        errorMessage:
                            error.message || "Maximo de reintentos alcanzado",
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
