"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { haptics } from "@/utils/haptics";
import { deletePhotos, getPhoto } from "@/utils/photoStore";
import {
  type QueuedSubmission,
  submissionQueue,
} from "@/utils/submissionQueue";

const MAX_RETRIES = 5;
const RETRY_DELAY_BASE = 2000; // 2 seconds
const PROCESS_INTERVAL = 5000; // Check queue every 5 seconds

// Service Worker message types
interface SWMessage {
  type:
    | "SUBMISSION_SUCCESS"
    | "SUBMISSION_FAILED"
    | "LOCATION_STALE"
    | "QUEUE_PROCESSED";
  submissionId?: string;
  duplicate?: boolean;
  error?: string;
  results?: {
    processed: number;
    succeeded: number;
    failed: number;
    stale: number;
  };
}

export interface QueueState {
  pendingCount: number;
  isProcessing: boolean;
  isOnline: boolean;
  currentItem: QueuedSubmission | null;
  items: QueuedSubmission[];
  hasStaleLocation: boolean;
  staleLocationItemId: string | null;
}

export interface UseSubmissionQueueReturn {
  state: QueueState;
  addToQueue: (
    submission: Omit<
      QueuedSubmission,
      "status" | "createdAt" | "lastAttemptAt" | "retryCount" | "errorMessage"
    >,
  ) => Promise<QueuedSubmission>;
  processQueue: () => Promise<void>;
  updateItemLocation: (
    id: string,
    location: QueuedSubmission["payload"]["location"],
  ) => Promise<void>;
  retryItem: (id: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearQueue: () => Promise<void>;
  refreshStaleLocation: (
    newLocation: QueuedSubmission["payload"]["location"],
  ) => Promise<void>;
}

export function useSubmissionQueue(): UseSubmissionQueueReturn {
  const [state, setState] = useState<QueueState>({
    pendingCount: 0,
    isProcessing: false,
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    currentItem: null,
    items: [],
    hasStaleLocation: false,
    staleLocationItemId: null,
  });

  const isProcessingRef = useRef(false);
  const processIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoRetriedIdsRef = useRef<Set<string>>(new Set());
  const hasBackgroundSyncRef = useRef(false);

  const tryRegisterBackgroundSync = useCallback(async (): Promise<boolean> => {
    const syncRegistered = await submissionQueue.requestBackgroundSync();
    hasBackgroundSyncRef.current = syncRegistered;
    return syncRegistered;
  }, []);

  // Load initial state
  const loadQueue = useCallback(async () => {
    try {
      const items = await submissionQueue.getPending();

      // NOTE: We no longer check for stale location in queued items.
      // Location was validated at submission time - queued orders should always process.

      setState((prev) => ({
        ...prev,
        items,
        pendingCount: items.length,
        hasStaleLocation: false,
        staleLocationItemId: null,
      }));
    } catch (error) {
      console.error("Failed to load queue:", error);
    }
  }, []);

  // Send a single submission to the server
  const sendSubmission = useCallback(
    async (
      submission: QueuedSubmission,
    ): Promise<{
      success: boolean;
      error?: string;
      duplicate?: boolean;
    }> => {
      try {
        const response = await fetch("/api/submit-form", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...submission.payload,
            queuedAt: submission.payload.queuedAt ?? submission.createdAt,
            submissionId: submission.id,
            attemptNumber: submission.retryCount + 1,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          return {
            success: false,
            error: data.error || `Server error: ${response.status}`,
          };
        }

        return { success: true, duplicate: data.duplicate };
      } catch (error: any) {
        // Network error
        if (error.name === "TypeError" && error.message.includes("fetch")) {
          return { success: false, error: "Sin conexion a internet" };
        }
        return {
          success: false,
          error: error.message || "Error desconocido",
        };
      }
    },
    [],
  );

  const uploadPhoto = useCallback(
    async (photoId: string, submissionId: string): Promise<string> => {
      const stored = await getPhoto(photoId);
      if (!stored) {
        throw new Error(`Foto no encontrada (${photoId})`);
      }

      const formData = new FormData();
      formData.append("file", stored.blob, `${submissionId}-${photoId}.jpg`);
      formData.append("photoId", photoId);
      formData.append("submissionId", submissionId);

      const response = await fetch("/api/upload-photo", {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = data?.error || `Upload error: ${response.status}`;
        const error = new Error(message) as Error & {
          code?: string;
        };
        if (data?.duplicate || response.status === 409) {
          error.code = "DUPLICATE_PHOTO";
        }
        throw error;
      }

      if (!data?.url) {
        throw new Error("Respuesta invalida del servidor");
      }

      return data.url as string;
    },
    [],
  );

  const prepareSubmission = useCallback(
    async (
      item: QueuedSubmission,
    ): Promise<{
      success: boolean;
      item?: QueuedSubmission;
      error?: string;
      fatal?: boolean;
    }> => {
      const photoIds = item.payload.photoIds;
      if (!photoIds || photoIds.length === 0) {
        return { success: true, item };
      }

      const existingUrls = Array.isArray(item.payload.photoUrls)
        ? [...item.payload.photoUrls]
        : [];

      if (existingUrls.length >= photoIds.length) {
        return { success: true, item };
      }

      try {
        for (
          let index = existingUrls.length;
          index < photoIds.length;
          index++
        ) {
          const photoId = photoIds[index];
          const url = await uploadPhoto(photoId, item.id);
          existingUrls.push(url);
        }

        const updatedPayload = {
          ...item.payload,
          photoUrls: existingUrls,
        };
        await submissionQueue.update(item.id, {
          payload: updatedPayload,
        });

        return {
          success: true,
          item: { ...item, payload: updatedPayload },
        };
      } catch (error: any) {
        const isDuplicate =
          typeof error?.code === "string" && error.code === "DUPLICATE_PHOTO";
        return {
          success: false,
          error: error?.message || "No se pudieron subir las fotos",
          fatal: isDuplicate,
        };
      }
    },
    [uploadPhoto],
  );

  // Process a single item from the queue
  const processItem = useCallback(
    async (item: QueuedSubmission): Promise<boolean> => {
      // NOTE: We do NOT re-validate location here.
      // Location was already validated at submission time when the user clicked "Enviar Pedido".
      // The stored coordinates are proof the user was at the client location.
      // Re-validating based on timestamp would break offline-first queue processing.

      // Mark as sending
      await submissionQueue.update(item.id, {
        status: "sending",
        lastAttemptAt: Date.now(),
      });

      setState((prev) => ({ ...prev, currentItem: item }));

      const prepared = await prepareSubmission(item);
      const finalItem = prepared.item ?? item;

      if (!prepared.success) {
        const newRetryCount = item.retryCount + 1;

        if (prepared.fatal) {
          await submissionQueue.update(item.id, {
            status: "failed",
            retryCount: newRetryCount,
            errorMessage: prepared.error || "No se pudieron subir las fotos",
          });
          haptics.error();
          return false;
        }

        if (newRetryCount >= MAX_RETRIES) {
          console.error("Max retries reached for submission:", item.id);
          await submissionQueue.update(item.id, {
            status: "failed",
            retryCount: newRetryCount,
            errorMessage: prepared.error || "Maximo de reintentos alcanzado",
          });
          haptics.error();
          return false;
        }

        await submissionQueue.update(item.id, {
          status: "pending",
          retryCount: newRetryCount,
          errorMessage: prepared.error,
        });

        return false;
      }

      const result = await sendSubmission(finalItem);

      if (result.success) {
        console.log(
          "Submission successful:",
          finalItem.id,
          result.duplicate ? "(duplicate)" : "",
        );
        await submissionQueue.remove(finalItem.id);
        if (finalItem.payload.photoIds?.length) {
          deletePhotos(finalItem.payload.photoIds).catch((error) => {
            console.error("Failed to delete uploaded photos:", error);
          });
        }
        haptics.success();
        return true;
      }

      // Handle failure
      const newRetryCount = item.retryCount + 1;

      if (newRetryCount >= MAX_RETRIES) {
        console.error("Max retries reached for submission:", item.id);
        await submissionQueue.update(item.id, {
          status: "failed",
          retryCount: newRetryCount,
          errorMessage: result.error || "Maximo de reintentos alcanzado",
        });
        haptics.error();
        return false;
      }

      // Mark for retry
      await submissionQueue.update(item.id, {
        status: "pending",
        retryCount: newRetryCount,
        errorMessage: result.error,
      });

      return false;
    },
    [prepareSubmission, sendSubmission],
  );

  // Determine if a failed item should be auto-retried (typically location errors)
  const shouldAutoRetryFailedItem = useCallback((item: QueuedSubmission) => {
    if (autoRetriedIdsRef.current.has(item.id)) return false;
    if (item.status !== "failed") return false;
    if (typeof item.errorMessage !== "string") return false;
    if (!/ubicaci|location|gps|precisi|lejos|distance/i.test(item.errorMessage))
      return false;

    const location = item.payload?.location;
    if (
      !location ||
      typeof location.lat !== "number" ||
      typeof location.lng !== "number"
    ) {
      return false;
    }

    return true;
  }, []);

  // Process all pending items in the queue
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) {
      console.log("Queue already being processed");
      return;
    }

    if (!navigator.onLine) {
      console.log("Offline, skipping queue processing");
      return;
    }

    isProcessingRef.current = true;
    setState((prev) => ({ ...prev, isProcessing: true }));

    try {
      let items = await submissionQueue.getPending();

      // Auto-recover failed items that were blocked by location checks
      const failedToRecover = items.filter(shouldAutoRetryFailedItem);
      for (const item of failedToRecover) {
        console.log(
          "♻️ Auto-retrying failed item after location bypass fix:",
          item.id,
          item.errorMessage,
        );
        await submissionQueue.update(item.id, {
          status: "pending",
          retryCount: Math.min(item.retryCount, MAX_RETRIES - 1),
          errorMessage: null,
        });
        autoRetriedIdsRef.current.add(item.id);
      }

      // Refresh items after recovery to ensure we process the updated state
      if (failedToRecover.length > 0) {
        items = await submissionQueue.getPending();
      }

      for (const item of items) {
        // Skip items that are already being sent or have failed
        if (item.status === "sending") continue;
        if (item.status === "failed") continue;

        // NOTE: We no longer check for 'locationStale' status or re-validate location.
        // Location was validated at submission time - the stored coordinates are proof
        // the user was at the client. Queued orders should always be processed.

        const success = await processItem(item);

        if (!success && item.retryCount < MAX_RETRIES) {
          // Wait before processing next item (exponential backoff)
          const delay = Math.min(
            RETRY_DELAY_BASE * 2 ** item.retryCount,
            16000,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    } catch (error) {
      console.error("Error processing queue:", error);
    } finally {
      isProcessingRef.current = false;
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        currentItem: null,
      }));
      await loadQueue();
    }
  }, [processItem, loadQueue, shouldAutoRetryFailedItem]);

  // Add a new submission to the queue
  const addToQueue = useCallback(
    async (
      submission: Omit<
        QueuedSubmission,
        "status" | "createdAt" | "lastAttemptAt" | "retryCount" | "errorMessage"
      >,
    ): Promise<QueuedSubmission> => {
      const queued = await submissionQueue.add(submission);
      await loadQueue();

      // Immediately try to process if online
      if (navigator.onLine) {
        const syncRegistered = await tryRegisterBackgroundSync();
        if (!syncRegistered) {
          // Small delay to let UI update first
          setTimeout(() => processQueue(), 100);
        }
      }

      return queued;
    },
    [loadQueue, processQueue, tryRegisterBackgroundSync],
  );

  // Update location for a specific item
  const updateItemLocation = useCallback(
    async (id: string, location: QueuedSubmission["payload"]["location"]) => {
      await submissionQueue.updateLocation(id, location);
      await loadQueue();

      // Try to process immediately
      if (navigator.onLine) {
        const syncRegistered = await tryRegisterBackgroundSync();
        if (!syncRegistered) {
          setTimeout(() => processQueue(), 100);
        }
      }
    },
    [loadQueue, processQueue, tryRegisterBackgroundSync],
  );

  // Refresh location for the stale item
  const refreshStaleLocation = useCallback(
    async (newLocation: QueuedSubmission["payload"]["location"]) => {
      const { staleLocationItemId } = state;
      if (!staleLocationItemId) return;

      await updateItemLocation(staleLocationItemId, newLocation);
    },
    [state, updateItemLocation],
  );

  // Retry a specific item
  const retryItem = useCallback(
    async (id: string) => {
      await submissionQueue.update(id, {
        status: "pending",
        retryCount: 0,
        errorMessage: null,
      });
      await loadQueue();

      if (navigator.onLine) {
        const syncRegistered = await tryRegisterBackgroundSync();
        if (!syncRegistered) {
          setTimeout(() => processQueue(), 100);
        }
      }
    },
    [loadQueue, processQueue, tryRegisterBackgroundSync],
  );

  // Remove an item from the queue
  const removeItem = useCallback(
    async (id: string) => {
      await submissionQueue.remove(id);
      await loadQueue();
    },
    [loadQueue],
  );

  const clearQueue = useCallback(async () => {
    const items = await submissionQueue.getPending();
    const photoIds = items.flatMap((item) => item.payload.photoIds ?? []);
    await submissionQueue.clearAll();

    if (photoIds.length > 0) {
      const uniquePhotoIds = Array.from(new Set(photoIds));
      deletePhotos(uniquePhotoIds).catch((error) => {
        console.error("Failed to delete queued photos:", error);
      });
    }

    await loadQueue();
  }, [loadQueue]);

  // Set up online/offline listeners
  useEffect(() => {
    const handleOnline = async () => {
      console.log("Connection restored, triggering Background Sync...");
      setState((prev) => ({ ...prev, isOnline: true }));

      // Try Background Sync first, fall back to manual processing
      const syncRegistered = await tryRegisterBackgroundSync();
      if (!syncRegistered) {
        console.log("Background Sync not available, processing manually...");
        processQueue();
      }
    };

    const handleOffline = () => {
      console.log("Connection lost");
      setState((prev) => ({ ...prev, isOnline: false }));
    };

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        console.log("Tab visible, triggering Background Sync...");

        // Try Background Sync first, fall back to manual processing
        const syncRegistered = await tryRegisterBackgroundSync();
        if (!syncRegistered) {
          processQueue();
        }
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [processQueue, tryRegisterBackgroundSync]);

  // Detect initial Background Sync support once and prefer SW processing if available.
  useEffect(() => {
    let mounted = true;

    const detectBackgroundSync = async () => {
      try {
        const syncRegistered = await tryRegisterBackgroundSync();
        if (!mounted) return;
        hasBackgroundSyncRef.current = syncRegistered;
      } catch {
        if (!mounted) return;
        hasBackgroundSyncRef.current = false;
      }
    };

    detectBackgroundSync();

    return () => {
      mounted = false;
    };
  }, [tryRegisterBackgroundSync]);

  // Set up periodic queue processing
  useEffect(() => {
    loadQueue();

    processIntervalRef.current = setInterval(() => {
      if (
        navigator.onLine &&
        !isProcessingRef.current &&
        !hasBackgroundSyncRef.current
      ) {
        processQueue();
      }
    }, PROCESS_INTERVAL);

    return () => {
      if (processIntervalRef.current) {
        clearInterval(processIntervalRef.current);
      }
    };
  }, [loadQueue, processQueue]);

  // Subscribe to queue changes
  useEffect(() => {
    const unsubscribe = submissionQueue.subscribe(loadQueue);
    return unsubscribe;
  }, [loadQueue]);

  // Listen for messages from Service Worker (Background Sync results)
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const handleSWMessage = (event: MessageEvent<SWMessage>) => {
      const { type, submissionId, duplicate, error, results } =
        event.data || {};

      console.log("[Hook] SW message received:", event.data);

      switch (type) {
        case "SUBMISSION_SUCCESS":
          console.log(
            `✅ [SW] Submission ${submissionId} succeeded`,
            duplicate ? "(duplicate)" : "",
          );
          haptics.success();
          loadQueue();
          break;

        case "SUBMISSION_FAILED":
          console.log(`❌ [SW] Submission ${submissionId} failed:`, error);
          haptics.error();
          loadQueue();
          break;

        case "LOCATION_STALE":
          // NOTE: This case is kept for backwards compatibility but should no longer be triggered.
          // Location is validated at submission time, not during queue processing.
          console.log(
            `📍 [SW] Submission ${submissionId} - location stale message (ignored)`,
          );
          loadQueue();
          break;

        case "QUEUE_PROCESSED":
          console.log("[SW] Queue processing complete:", results);
          loadQueue();
          break;
      }
    };

    navigator.serviceWorker.addEventListener("message", handleSWMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleSWMessage);
    };
  }, [loadQueue]);

  return {
    state,
    addToQueue,
    processQueue,
    updateItemLocation,
    retryItem,
    removeItem,
    clearQueue,
    refreshStaleLocation,
  };
}
