/**
 * Offline-First Submission Queue
 *
 * This utility provides a robust queue system for form submissions that:
 * - Persists submissions in IndexedDB (survives app restarts)
 * - Automatically retries when connection is restored
 * - Handles location staleness gracefully
 * - Guarantees eventual delivery
 */

const DB_NAME = 'elrey-submissions';
const DB_VERSION = 1;
const STORE_NAME = 'pending-orders';

// Location is considered stale after 90 seconds
const MAX_LOCATION_AGE_MS = 90000;

export type SubmissionStatus =
  | 'pending'           // Waiting to be sent
  | 'sending'           // Currently being sent
  | 'locationStale'     // Location too old, needs refresh
  | 'failed'            // Failed after max retries
  | 'completed';        // Successfully sent

export interface QueuedSubmission {
  id: string;                    // Unique submission ID
  payload: {
    clientName: string;
    clientCode: string;
    products: Record<string, number>;
    total: number;
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
  };
  status: SubmissionStatus;
  createdAt: number;             // When the submission was queued
  lastAttemptAt: number | null;  // Last retry attempt timestamp
  retryCount: number;            // Number of retry attempts
  errorMessage: string | null;   // Last error message
  isAdmin: boolean;              // Admin users bypass location checks
}

class SubmissionQueue {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<boolean>;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.dbReady = this.initDB();
  }

  private async initDB(): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        console.warn('IndexedDB not available, queue will not persist');
        resolve(false);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        resolve(false);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized for submission queue');
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
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
   */
  async add(submission: Omit<QueuedSubmission, 'status' | 'createdAt' | 'lastAttemptAt' | 'retryCount' | 'errorMessage'>): Promise<QueuedSubmission> {
    await this.dbReady;

    const queuedSubmission: QueuedSubmission = {
      ...submission,
      status: 'pending',
      createdAt: Date.now(),
      lastAttemptAt: null,
      retryCount: 0,
      errorMessage: null,
    };

    if (this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(queuedSubmission);

        request.onsuccess = () => {
          console.log('Submission queued:', queuedSubmission.id);
          this.notifyListeners();
          resolve(queuedSubmission);
        };

        request.onerror = () => {
          console.error('Failed to queue submission:', request.error);
          reject(request.error);
        };
      });
    }

    // Fallback to localStorage if IndexedDB is not available
    const queue = this.getLocalStorageQueue();
    queue.push(queuedSubmission);
    localStorage.setItem('pending-submissions', JSON.stringify(queue));
    this.notifyListeners();
    return queuedSubmission;
  }

  /**
   * Get all pending submissions
   */
  async getPending(): Promise<QueuedSubmission[]> {
    await this.dbReady;

    if (this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          const all = request.result as QueuedSubmission[];
          // Return items that are not completed, sorted by creation time
          const pending = all
            .filter(s => s.status !== 'completed')
            .sort((a, b) => a.createdAt - b.createdAt);
          resolve(pending);
        };

        request.onerror = () => reject(request.error);
      });
    }

    return this.getLocalStorageQueue().filter(s => s.status !== 'completed');
  }

  /**
   * Update a submission's status
   */
  async update(id: string, updates: Partial<QueuedSubmission>): Promise<void> {
    await this.dbReady;

    if (this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
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
    const index = queue.findIndex(s => s.id === id);
    if (index !== -1) {
      queue[index] = { ...queue[index], ...updates };
      localStorage.setItem('pending-submissions', JSON.stringify(queue));
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
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
          console.log('Submission removed from queue:', id);
          this.notifyListeners();
          resolve();
        };

        request.onerror = () => reject(request.error);
      });
    }

    const queue = this.getLocalStorageQueue().filter(s => s.id !== id);
    localStorage.setItem('pending-submissions', JSON.stringify(queue));
    this.notifyListeners();
  }

  /**
   * Update location for a queued submission
   */
  async updateLocation(id: string, location: QueuedSubmission['payload']['location']): Promise<void> {
    await this.update(id, {
      payload: {
        ...(await this.getById(id))?.payload,
        location,
      } as QueuedSubmission['payload'],
      status: 'pending', // Reset to pending since location is now fresh
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
        const transaction = this.db!.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    }

    const queue = this.getLocalStorageQueue();
    return queue.find(s => s.id === id) || null;
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
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const all = request.result as QueuedSubmission[];
        all.filter(s => s.status === 'completed').forEach(s => {
          store.delete(s.id);
        });
        this.notifyListeners();
      };
      return;
    }

    const queue = this.getLocalStorageQueue().filter(s => s.status !== 'completed');
    localStorage.setItem('pending-submissions', JSON.stringify(queue));
    this.notifyListeners();
  }

  private getLocalStorageQueue(): QueuedSubmission[] {
    try {
      const stored = localStorage.getItem('pending-submissions');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
}

// Singleton instance
export const submissionQueue = new SubmissionQueue();
