/**
 * Service Worker with Background Sync for Offline-First Order Submission
 *
 * This service worker handles:
 * 1. Background Sync - Process queued orders when connection is restored
 * 2. Push Notifications - Show notifications for order status
 * 3. Caching - Basic caching for offline support
 */

const CACHE_NAME = 'elrey-v1';
const SYNC_TAG = 'order-submission-sync';
const DB_NAME = 'elrey-submissions';
const STORE_NAME = 'pending-orders';

// Install event - set up cache
self.addEventListener('install', (event) => {
  console.log('[SW] Service worker installed');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Service worker activated');
  event.waitUntil(self.clients.claim());
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;

  // Skip API routes - we want fresh data
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone the response for caching
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Background Sync event - process queued orders
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event received:', event.tag);

  if (event.tag === SYNC_TAG) {
    event.waitUntil(processQueuedOrders());
  }
});

// Periodic Background Sync (if supported)
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync event:', event.tag);

  if (event.tag === SYNC_TAG) {
    event.waitUntil(processQueuedOrders());
  }
});

// Push notification event
self.addEventListener('push', (event) => {
  const data = event.data?.json() || { title: 'El Rey', body: 'Notificacion' };
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      // Focus existing window or open new one
      for (const client of clients) {
        if (client.url.includes('/form') && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow('/form');
    })
  );
});

// Message event - handle messages from main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data?.type === 'PROCESS_QUEUE') {
    processQueuedOrders().then(result => {
      event.ports[0]?.postMessage(result);
    });
  }

  if (event.data?.type === 'SKIP_WAITING') {
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
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

/**
 * Get all pending submissions from IndexedDB
 */
async function getPendingSubmissions() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const all = request.result || [];
      // Filter to only pending items (not completed, failed, or currently sending)
      const pending = all.filter(s =>
        s.status === 'pending' || s.status === 'locationStale'
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
    const transaction = db.transaction([STORE_NAME], 'readwrite');
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
    const transaction = db.transaction([STORE_NAME], 'readwrite');
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
  const response = await fetch('/api/submit-form', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...submission.payload,
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

/**
 * Check if location is still valid (not stale)
 * Location is considered stale after 90 seconds
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
  console.log('[SW] Processing queued orders...');

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
        // Check if location is still valid
        if (!isLocationValid(submission)) {
          console.log(`[SW] Submission ${submission.id} has stale location, skipping`);
          await updateSubmission(submission.id, {
            status: 'locationStale',
            errorMessage: 'La ubicacion ha expirado. Por favor, refresca tu ubicacion.',
          });
          results.stale++;

          // Notify the main thread about stale location
          notifyClients({
            type: 'LOCATION_STALE',
            submissionId: submission.id,
          });
          continue;
        }

        // Mark as sending
        await updateSubmission(submission.id, {
          status: 'sending',
          lastAttemptAt: Date.now(),
        });

        // Send to server
        const result = await sendSubmission(submission);

        console.log(`[SW] Submission ${submission.id} succeeded`, result.duplicate ? '(duplicate)' : '');

        // Remove from queue on success
        await removeSubmission(submission.id);
        results.succeeded++;

        // Notify the main thread about success
        notifyClients({
          type: 'SUBMISSION_SUCCESS',
          submissionId: submission.id,
          duplicate: result.duplicate,
        });

      } catch (error) {
        console.error(`[SW] Submission ${submission.id} failed:`, error.message);

        const newRetryCount = (submission.retryCount || 0) + 1;
        const MAX_RETRIES = 5;

        if (newRetryCount >= MAX_RETRIES) {
          await updateSubmission(submission.id, {
            status: 'failed',
            retryCount: newRetryCount,
            errorMessage: error.message || 'Maximo de reintentos alcanzado',
          });

          // Notify about failure
          notifyClients({
            type: 'SUBMISSION_FAILED',
            submissionId: submission.id,
            error: error.message,
          });
        } else {
          await updateSubmission(submission.id, {
            status: 'pending',
            retryCount: newRetryCount,
            errorMessage: error.message,
          });
        }

        results.failed++;
      }
    }

  } catch (error) {
    console.error('[SW] Error processing queue:', error);
  }

  console.log('[SW] Queue processing complete:', results);

  // Notify clients to refresh their queue state
  notifyClients({
    type: 'QUEUE_PROCESSED',
    results,
  });

  return results;
}

/**
 * Notify all clients about an event
 */
async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: 'window' });

  for (const client of clients) {
    client.postMessage(message);
  }
}
