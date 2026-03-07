/**
 * Offline-First Submission Queue
 *
 * This utility provides a robust queue system for form submissions that:
 * - Persists submissions in IndexedDB (survives app restarts)
 * - Automatically retries when connection is restored
 * - Guarantees eventual delivery
 * - Uses Background Sync API for true background processing
 * - Prevents re-queueing the same active submission ID
 */

const DB_NAME = "elrey-submissions";
const DB_VERSION = 1;
const STORE_NAME = "pending-orders";
const SYNC_TAG = "order-submission-sync";
const SW_READY_TIMEOUT_MS = 1500;

export type SubmissionStatus =
  | "pending" // Waiting to be sent
  | "sending" // Currently being sent
  | "failed" // Failed after max retries
  | "completed"; // Successfully sent

export type QueueAttemptSource = "hook" | "service-worker";
export type SubmissionServerState = "processing" | "submitted" | "unknown";

const ACTIVE_DUPLICATE_STATUSES: SubmissionStatus[] = ["pending", "sending"];

export function isActiveDuplicateStatus(status: SubmissionStatus): boolean {
  return ACTIVE_DUPLICATE_STATUSES.includes(status);
}

export interface QueuedSubmission {
  id: string; // Unique submission ID
  payload: {
    clientName: string;
    clientCode: string;
    products: Record<string, number>;
    photoIds?: string[];
    photoUrls?: string[];
    photoCount?: number;
    photoTotalBytes?: number;
    allowDuplicatePhotos?: boolean;
    total: number;
    queuedAt?: number;
    location: {
      lat: number;
      lng: number;
      accuracy?: number;
      timestamp?: number;
    };
    userEmail: string;
    actorEmail: string | null;
    isAdminOverride: boolean;
    overrideTargetEmail: string | null;
    date: string | null;
    cleyOrderValue: string | null;
    overridePeriod: string | null;
    overrideMonthCode: string | null;
    skipRequiredPhotos?: boolean;
  };
  status: SubmissionStatus;
  createdAt: number; // When the submission was queued
  lastAttemptAt: number | null; // Last retry attempt timestamp
  lastAttemptSource: QueueAttemptSource | null; // Where the last attempt ran
  lastHttpStatus: number | null; // Last HTTP status returned by the network step
  lastServerState: SubmissionServerState | null; // Last state reported by the backend
  nextRetryAt: number | null; // Cooldown before the next retry attempt
  retryCount: number; // Number of retry attempts
  errorMessage: string | null; // Last error message
  isAdmin: boolean; // Admin users bypass location checks
}

export function findActiveDuplicateSubmission(
  items: Pick<QueuedSubmission, "id" | "status">[],
  id: string,
): Pick<QueuedSubmission, "id" | "status"> | undefined {
  return items.find(
    (item) => item.id === id && isActiveDuplicateStatus(item.status),
  );
}

function normalizeQueuedSubmission(item: QueuedSubmission): QueuedSubmission {
  return {
    ...item,
    lastServerState: item.lastServerState ?? null,
    nextRetryAt: item.nextRetryAt ?? null,
  };
}

class SubmissionQueue {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<boolean>;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.dbReady = this.initDB();
  }

  /**
   * Check if a submission is already active in the queue by its id
   */
  async isDuplicate(
    id: string,
  ): Promise<{ isDuplicate: boolean; existingId?: string }> {
    const items = await this.getPending();
    const existing = findActiveDuplicateSubmission(items, id);
    if (existing) {
      console.warn("Duplicate queued submission blocked:", {
        submissionId: id,
        existingId: existing.id,
        existingStatus: existing.status,
      });
      return { isDuplicate: true, existingId: existing.id };
    }

    return { isDuplicate: false };
  }

  private async resolveServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return null;
    }

    try {
      const existingRegistration =
        await navigator.serviceWorker.getRegistration();
      if (existingRegistration) return existingRegistration;

      const readyRegistration =
        await Promise.race<ServiceWorkerRegistration | null>([
          navigator.serviceWorker.ready,
          new Promise<null>((resolve) => {
            window.setTimeout(() => resolve(null), SW_READY_TIMEOUT_MS);
          }),
        ]);

      return readyRegistration;
    } catch (error) {
      console.warn("Unable to resolve service worker registration:", error);
      return null;
    }
  }

  /**
   * Request Background Sync to process the queue
   * Falls back to manual processing if Background Sync is not supported
   */
  async requestBackgroundSync(): Promise<boolean> {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      console.log("Background Sync not available: no service worker");
      return false;
    }

    try {
      const registration = await this.resolveServiceWorkerRegistration();
      if (!registration) {
        console.log(
          "Background Sync not available: no active service worker registration",
        );
        return false;
      }

      // Check if Background Sync is supported
      if ("sync" in registration) {
        await registration.sync.register(SYNC_TAG);
        console.log("Background Sync registered:", SYNC_TAG);
        return true;
      }

      console.log(
        "Background Sync not supported, falling back to manual processing",
      );
      return false;
    } catch (error) {
      console.error("Failed to register Background Sync:", error);
      return false;
    }
  }

  private async initDB(): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.indexedDB) {
        console.warn("IndexedDB not available, queue will not persist");
        resolve(false);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("Failed to open IndexedDB:", request.error);
        resolve(false);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log("IndexedDB initialized for submission queue");
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: "id",
          });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("createdAt", "createdAt", {
            unique: false,
          });
        }
      };
    });
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      listener();
    });
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Add a submission to the queue
   * Returns the queued submission, or throws if it's a duplicate
   */
  async add(
    submission: Omit<
      QueuedSubmission,
      | "status"
      | "createdAt"
      | "lastAttemptAt"
      | "lastAttemptSource"
      | "lastHttpStatus"
      | "retryCount"
      | "errorMessage"
    >,
  ): Promise<QueuedSubmission> {
    await this.dbReady;

    // Check for duplicates first
    const { isDuplicate, existingId } = await this.isDuplicate(submission.id);
    if (isDuplicate) {
      console.warn("Rejecting duplicate queued submission:", {
        submissionId: submission.id,
        existingId,
      });
      throw new Error(
        `DUPLICATE: Este pedido ya esta en cola${existingId ? ` (ID: ${existingId})` : ""}`,
      );
    }

    const queuedSubmission: QueuedSubmission = {
      ...submission,
      status: "pending",
      createdAt: Date.now(),
      lastAttemptAt: null,
      lastAttemptSource: null,
      lastHttpStatus: null,
      lastServerState: null,
      nextRetryAt: null,
      retryCount: 0,
      errorMessage: null,
    };

    if (this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db?.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(queuedSubmission);

        request.onsuccess = () => {
          console.log("Submission queued:", queuedSubmission.id);
          this.notifyListeners();

          // Request Background Sync to process when online
          this.requestBackgroundSync().catch((err) => {
            console.log("Background Sync not triggered:", err.message);
          });

          resolve(queuedSubmission);
        };

        request.onerror = () => {
          console.error("Failed to queue submission:", request.error);
          reject(request.error);
        };
      });
    }

    // Fallback to localStorage if IndexedDB is not available
    const queue = this.getLocalStorageQueue();
    queue.push(queuedSubmission);
    localStorage.setItem("pending-submissions", JSON.stringify(queue));
    this.notifyListeners();

    // Request Background Sync
    this.requestBackgroundSync().catch(() => {});

    return queuedSubmission;
  }

  /**
   * Get all pending submissions
   */
  async getPending(): Promise<QueuedSubmission[]> {
    await this.dbReady;

    if (this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db?.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          const all = (request.result as QueuedSubmission[]).map(
            normalizeQueuedSubmission,
          );
          // Return items that are not completed, sorted by creation time
          const pending = all
            .filter((s) => s.status !== "completed")
            .sort((a, b) => a.createdAt - b.createdAt);
          resolve(pending);
        };

        request.onerror = () => reject(request.error);
      });
    }

    return this.getLocalStorageQueue().filter((s) => s.status !== "completed");
  }

  /**
   * Update a submission's status
   */
  async update(id: string, updates: Partial<QueuedSubmission>): Promise<void> {
    await this.dbReady;

    if (this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db?.transaction([STORE_NAME], "readwrite");
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

          putRequest.onsuccess = () => {
            this.notifyListeners();
            resolve();
          };

          putRequest.onerror = () => reject(putRequest.error);
        };

        getRequest.onerror = () => reject(getRequest.error);
      });
    }

    // Fallback to localStorage
    const queue = this.getLocalStorageQueue();
    const index = queue.findIndex((s) => s.id === id);
    if (index !== -1) {
      queue[index] = { ...queue[index], ...updates };
      localStorage.setItem("pending-submissions", JSON.stringify(queue));
      this.notifyListeners();
    }
  }

  /**
   * Atomically claim a queue item for processing.
   * Reads the item and marks it as "sending" within a single readwrite transaction.
   * Returns the item only if its current status is "pending" - otherwise returns null.
   * This prevents the race condition where both the hook and service worker
   * pick up the same item simultaneously.
   */
  async claim(
    id: string,
    source: QueueAttemptSource,
  ): Promise<QueuedSubmission | null> {
    await this.dbReady;

    if (this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db?.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
          const item = getRequest.result as QueuedSubmission | undefined;
          if (!item || item.status !== "pending") {
            resolve(null);
            return;
          }

          const claimed: QueuedSubmission = {
            ...item,
            status: "sending",
            lastAttemptAt: Date.now(),
            lastAttemptSource: source,
            lastHttpStatus: null,
            lastServerState: null,
            nextRetryAt: null,
          };
          const putRequest = store.put(claimed);

          putRequest.onsuccess = () => {
            this.notifyListeners();
            resolve(claimed);
          };

          putRequest.onerror = () => reject(putRequest.error);
        };

        getRequest.onerror = () => reject(getRequest.error);
      });
    }

    // Fallback to localStorage
    const queue = this.getLocalStorageQueue();
    const index = queue.findIndex((s) => s.id === id);
    if (index !== -1 && queue[index].status === "pending") {
      queue[index] = {
        ...queue[index],
        status: "sending",
        lastAttemptAt: Date.now(),
        lastAttemptSource: source,
        lastHttpStatus: null,
        lastServerState: null,
        nextRetryAt: null,
      };
      localStorage.setItem("pending-submissions", JSON.stringify(queue));
      this.notifyListeners();
      return queue[index];
    }
    return null;
  }

  /**
   * Remove a submission from the queue
   */
  async remove(id: string): Promise<void> {
    await this.dbReady;

    if (this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db?.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
          console.log("Submission removed from queue:", id);
          this.notifyListeners();
          resolve();
        };

        request.onerror = () => reject(request.error);
      });
    }

    const queue = this.getLocalStorageQueue().filter((s) => s.id !== id);
    localStorage.setItem("pending-submissions", JSON.stringify(queue));
    this.notifyListeners();
  }

  /**
   * Get the count of pending submissions
   */
  async getCount(): Promise<number> {
    const pending = await this.getPending();
    return pending.length;
  }

  /**
   * Clear all completed submissions (cleanup)
   */
  async clearCompleted(): Promise<void> {
    await this.dbReady;

    if (this.db) {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const all = request.result as QueuedSubmission[];
        all
          .filter((s) => s.status === "completed")
          .forEach((s) => {
            store.delete(s.id);
          });
        this.notifyListeners();
      };
      return;
    }

    const queue = this.getLocalStorageQueue().filter(
      (s) => s.status !== "completed",
    );
    localStorage.setItem("pending-submissions", JSON.stringify(queue));
    this.notifyListeners();
  }

  /**
   * Clear all submissions (pending/failed/sending)
   */
  async clearAll(): Promise<void> {
    await this.dbReady;

    if (this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db?.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
          this.notifyListeners();
          resolve();
        };

        request.onerror = () => reject(request.error);
      });
    }

    localStorage.removeItem("pending-submissions");
    this.notifyListeners();
  }

  private getLocalStorageQueue(): QueuedSubmission[] {
    try {
      const stored = localStorage.getItem("pending-submissions");
      return stored
        ? (JSON.parse(stored) as QueuedSubmission[]).map(
            normalizeQueuedSubmission,
          )
        : [];
    } catch {
      return [];
    }
  }
}

// Singleton instance
export const submissionQueue = new SubmissionQueue();
