/**
 * Offline-First Submission Queue
 *
 * This utility provides a robust queue system for form submissions that:
 * - Persists submissions in IndexedDB (survives app restarts)
 * - Automatically retries when connection is restored
 * - Handles location staleness gracefully
 * - Guarantees eventual delivery
 * - Uses Background Sync API for true background processing
 * - Prevents duplicate submissions via content fingerprinting
 */

const DB_NAME = "elrey-submissions";
const DB_VERSION = 1;
const STORE_NAME = "pending-orders";
const SYNC_TAG = "order-submission-sync";

// Location is considered stale after 90 seconds
const MAX_LOCATION_AGE_MS = 90000;

// Duplicate detection window (5 minutes)
const DUPLICATE_WINDOW_MS = 300000;

export type SubmissionStatus =
  | "pending" // Waiting to be sent
  | "sending" // Currently being sent
  | "locationStale" // Location too old, needs refresh
  | "failed" // Failed after max retries
  | "completed"; // Successfully sent

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
    date: string;
    cleyOrderValue: string | null;
    overridePeriod: string | null;
    overrideMonthCode: string | null;
  };
  status: SubmissionStatus;
  createdAt: number; // When the submission was queued
  lastAttemptAt: number | null; // Last retry attempt timestamp
  retryCount: number; // Number of retry attempts
  errorMessage: string | null; // Last error message
  isAdmin: boolean; // Admin users bypass location checks
}

class SubmissionQueue {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<boolean>;
  private listeners: Set<() => void> = new Set();
  private recentFingerprints: Map<string, number> = new Map();

  constructor() {
    this.dbReady = this.initDB();
    this.cleanupFingerprints();
  }

  /**
   * Clean up old fingerprints periodically
   */
  private cleanupFingerprints() {
    if (typeof window === "undefined") return;

    setInterval(() => {
      const now = Date.now();
      for (const [
        fingerprint,
        timestamp,
      ] of this.recentFingerprints.entries()) {
        if (now - timestamp > DUPLICATE_WINDOW_MS) {
          this.recentFingerprints.delete(fingerprint);
        }
      }
    }, 60000); // Clean every minute
  }

  /**
   * Generate a fingerprint for a submission payload to detect duplicates
   * Uses client name, products, and a time window
   */
  private generateFingerprint(payload: QueuedSubmission["payload"]): string {
    // Create a deterministic string from the key fields
    const productKeys = Object.keys(payload.products).sort();
    const productString = productKeys
      .map(
        (k) => `${k}:${payload.products[k as keyof typeof payload.products]}`,
      )
      .join("|");
    const photoCount =
      typeof payload.photoCount === "number"
        ? payload.photoCount
        : payload.photoIds?.length || 0;

    // Round timestamp to 30-second windows to catch rapid duplicates
    const timeWindow = Math.floor(Date.now() / 30000);

    return `${payload.clientName}|${payload.clientCode}|${productString}|${photoCount}|${payload.userEmail}|${timeWindow}`;
  }

  /**
   * Check if a submission is a duplicate based on content fingerprint
   */
  async isDuplicate(
    payload: QueuedSubmission["payload"],
  ): Promise<{ isDuplicate: boolean; existingId?: string }> {
    const fingerprint = this.generateFingerprint(payload);

    // Check in-memory cache first
    if (this.recentFingerprints.has(fingerprint)) {
      console.warn("🔄 DUPLICATE DETECTED (fingerprint match):", fingerprint);
      return { isDuplicate: true };
    }

    // Check existing queue items
    const pending = await this.getPending();
    for (const item of pending) {
      const itemFingerprint = this.generateFingerprint(item.payload);
      if (itemFingerprint === fingerprint) {
        console.warn("🔄 DUPLICATE DETECTED (queue match):", {
          fingerprint,
          existingId: item.id,
          existingStatus: item.status,
        });
        return { isDuplicate: true, existingId: item.id };
      }
    }

    return { isDuplicate: false };
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
      const registration = await navigator.serviceWorker.ready;

      // Check if Background Sync is supported
      if ("sync" in registration) {
        await (registration as any).sync.register(SYNC_TAG);
        console.log("📡 Background Sync registered:", SYNC_TAG);
        return true;
      } else {
        console.log(
          "Background Sync not supported, falling back to manual processing",
        );
        return false;
      }
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
      "status" | "createdAt" | "lastAttemptAt" | "retryCount" | "errorMessage"
    >,
  ): Promise<QueuedSubmission> {
    await this.dbReady;

    // Check for duplicates first
    const { isDuplicate, existingId } = await this.isDuplicate(
      submission.payload,
    );
    if (isDuplicate) {
      console.warn("🚫 Rejecting duplicate submission:", {
        clientName: submission.payload.clientName,
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
      retryCount: 0,
      errorMessage: null,
    };

    // Store fingerprint to prevent rapid duplicates
    const fingerprint = this.generateFingerprint(submission.payload);
    this.recentFingerprints.set(fingerprint, Date.now());

    if (this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db?.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(queuedSubmission);

        request.onsuccess = () => {
          console.log("✅ Submission queued:", queuedSubmission.id);
          this.notifyListeners();

          // Request Background Sync to process when online
          this.requestBackgroundSync().catch((err) => {
            console.log("Background Sync not triggered:", err.message);
          });

          resolve(queuedSubmission);
        };

        request.onerror = () => {
          console.error("Failed to queue submission:", request.error);
          // Remove fingerprint on failure
          this.recentFingerprints.delete(fingerprint);
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
          const all = request.result as QueuedSubmission[];
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
   * Update location for a queued submission
   */
  async updateLocation(
    id: string,
    location: QueuedSubmission["payload"]["location"],
  ): Promise<void> {
    await this.update(id, {
      payload: {
        ...(await this.getById(id))?.payload,
        location,
      } as QueuedSubmission["payload"],
      status: "pending", // Reset to pending since location is now fresh
      errorMessage: null,
    });
  }

  /**
   * Get a specific submission by ID
   */
  async getById(id: string): Promise<QueuedSubmission | null> {
    await this.dbReady;

    if (this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db?.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    }

    const queue = this.getLocalStorageQueue();
    return queue.find((s) => s.id === id) || null;
  }

  /**
   * Check if a location is still valid (not stale)
   */
  isLocationValid(submission: QueuedSubmission): boolean {
    // Admins bypass location checks
    if (submission.isAdmin) return true;

    const locationTimestamp = submission.payload.location.timestamp;
    if (!locationTimestamp) return false;

    const age = Date.now() - locationTimestamp;
    return age < MAX_LOCATION_AGE_MS;
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
          this.recentFingerprints.clear();
          this.notifyListeners();
          resolve();
        };

        request.onerror = () => reject(request.error);
      });
    }

    localStorage.removeItem("pending-submissions");
    this.recentFingerprints.clear();
    this.notifyListeners();
  }

  private getLocalStorageQueue(): QueuedSubmission[] {
    try {
      const stored = localStorage.getItem("pending-submissions");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
}

// Singleton instance
export const submissionQueue = new SubmissionQueue();
