'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { submissionQueue, QueuedSubmission, SubmissionStatus } from '@/utils/submissionQueue';
import { haptics } from '@/utils/haptics';

const MAX_RETRIES = 5;
const RETRY_DELAY_BASE = 2000; // 2 seconds
const PROCESS_INTERVAL = 5000; // Check queue every 5 seconds

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
  addToQueue: (submission: Omit<QueuedSubmission, 'status' | 'createdAt' | 'lastAttemptAt' | 'retryCount' | 'errorMessage'>) => Promise<QueuedSubmission>;
  processQueue: () => Promise<void>;
  updateItemLocation: (id: string, location: QueuedSubmission['payload']['location']) => Promise<void>;
  retryItem: (id: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  refreshStaleLocation: (newLocation: QueuedSubmission['payload']['location']) => Promise<void>;
}

export function useSubmissionQueue(): UseSubmissionQueueReturn {
  const [state, setState] = useState<QueueState>({
    pendingCount: 0,
    isProcessing: false,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    currentItem: null,
    items: [],
    hasStaleLocation: false,
    staleLocationItemId: null,
  });

  const isProcessingRef = useRef(false);
  const processIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial state
  const loadQueue = useCallback(async () => {
    try {
      const items = await submissionQueue.getPending();
      const staleItem = items.find(
        item => item.status === 'locationStale' ||
        (item.status === 'pending' && !submissionQueue.isLocationValid(item) && !item.isAdmin)
      );

      setState(prev => ({
        ...prev,
        items,
        pendingCount: items.length,
        hasStaleLocation: !!staleItem,
        staleLocationItemId: staleItem?.id || null,
      }));
    } catch (error) {
      console.error('Failed to load queue:', error);
    }
  }, []);

  // Send a single submission to the server
  const sendSubmission = useCallback(async (submission: QueuedSubmission): Promise<{ success: boolean; error?: string; duplicate?: boolean }> => {
    try {
      const response = await fetch('/api/submit-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...submission.payload,
          submissionId: submission.id,
          attemptNumber: submission.retryCount + 1,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || `Server error: ${response.status}` };
      }

      return { success: true, duplicate: data.duplicate };
    } catch (error: any) {
      // Network error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return { success: false, error: 'Sin conexion a internet' };
      }
      return { success: false, error: error.message || 'Error desconocido' };
    }
  }, []);

  // Process a single item from the queue
  const processItem = useCallback(async (item: QueuedSubmission): Promise<boolean> => {
    // Check if location is still valid (for non-admin users)
    if (!item.isAdmin && !submissionQueue.isLocationValid(item)) {
      console.log('Location stale for submission:', item.id);
      await submissionQueue.update(item.id, {
        status: 'locationStale',
        errorMessage: 'La ubicacion ha expirado. Por favor, refresca tu ubicacion.',
      });
      return false;
    }

    // Mark as sending
    await submissionQueue.update(item.id, {
      status: 'sending',
      lastAttemptAt: Date.now(),
    });

    setState(prev => ({ ...prev, currentItem: item }));

    const result = await sendSubmission(item);

    if (result.success) {
      console.log('Submission successful:', item.id, result.duplicate ? '(duplicate)' : '');
      await submissionQueue.remove(item.id);
      haptics.success();
      return true;
    }

    // Handle failure
    const newRetryCount = item.retryCount + 1;

    if (newRetryCount >= MAX_RETRIES) {
      console.error('Max retries reached for submission:', item.id);
      await submissionQueue.update(item.id, {
        status: 'failed',
        retryCount: newRetryCount,
        errorMessage: result.error || 'Maximo de reintentos alcanzado',
      });
      haptics.error();
      return false;
    }

    // Mark for retry
    await submissionQueue.update(item.id, {
      status: 'pending',
      retryCount: newRetryCount,
      errorMessage: result.error,
    });

    return false;
  }, [sendSubmission]);

  // Process all pending items in the queue
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) {
      console.log('Queue already being processed');
      return;
    }

    if (!navigator.onLine) {
      console.log('Offline, skipping queue processing');
      return;
    }

    isProcessingRef.current = true;
    setState(prev => ({ ...prev, isProcessing: true }));

    try {
      const items = await submissionQueue.getPending();

      for (const item of items) {
        // Skip items that are already being sent or have stale locations
        if (item.status === 'sending') continue;
        if (item.status === 'failed') continue;
        if (item.status === 'locationStale') {
          setState(prev => ({
            ...prev,
            hasStaleLocation: true,
            staleLocationItemId: item.id,
          }));
          continue;
        }

        // Check location validity before processing
        if (!item.isAdmin && !submissionQueue.isLocationValid(item)) {
          await submissionQueue.update(item.id, {
            status: 'locationStale',
            errorMessage: 'La ubicacion ha expirado. Por favor, refresca tu ubicacion.',
          });
          setState(prev => ({
            ...prev,
            hasStaleLocation: true,
            staleLocationItemId: item.id,
          }));
          continue;
        }

        const success = await processItem(item);

        if (!success && item.retryCount < MAX_RETRIES) {
          // Wait before processing next item (exponential backoff)
          const delay = Math.min(RETRY_DELAY_BASE * Math.pow(2, item.retryCount), 16000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } catch (error) {
      console.error('Error processing queue:', error);
    } finally {
      isProcessingRef.current = false;
      setState(prev => ({ ...prev, isProcessing: false, currentItem: null }));
      await loadQueue();
    }
  }, [processItem, loadQueue]);

  // Add a new submission to the queue
  const addToQueue = useCallback(async (
    submission: Omit<QueuedSubmission, 'status' | 'createdAt' | 'lastAttemptAt' | 'retryCount' | 'errorMessage'>
  ): Promise<QueuedSubmission> => {
    const queued = await submissionQueue.add(submission);
    await loadQueue();

    // Immediately try to process if online
    if (navigator.onLine) {
      // Small delay to let UI update first
      setTimeout(() => processQueue(), 100);
    }

    return queued;
  }, [loadQueue, processQueue]);

  // Update location for a specific item
  const updateItemLocation = useCallback(async (
    id: string,
    location: QueuedSubmission['payload']['location']
  ) => {
    await submissionQueue.updateLocation(id, location);
    await loadQueue();

    // Try to process immediately
    if (navigator.onLine) {
      setTimeout(() => processQueue(), 100);
    }
  }, [loadQueue, processQueue]);

  // Refresh location for the stale item
  const refreshStaleLocation = useCallback(async (
    newLocation: QueuedSubmission['payload']['location']
  ) => {
    const { staleLocationItemId } = state;
    if (!staleLocationItemId) return;

    await updateItemLocation(staleLocationItemId, newLocation);
  }, [state, updateItemLocation]);

  // Retry a specific item
  const retryItem = useCallback(async (id: string) => {
    await submissionQueue.update(id, {
      status: 'pending',
      retryCount: 0,
      errorMessage: null,
    });
    await loadQueue();

    if (navigator.onLine) {
      setTimeout(() => processQueue(), 100);
    }
  }, [loadQueue, processQueue]);

  // Remove an item from the queue
  const removeItem = useCallback(async (id: string) => {
    await submissionQueue.remove(id);
    await loadQueue();
  }, [loadQueue]);

  // Set up online/offline listeners
  useEffect(() => {
    const handleOnline = () => {
      console.log('Connection restored, processing queue...');
      setState(prev => ({ ...prev, isOnline: true }));
      processQueue();
    };

    const handleOffline = () => {
      console.log('Connection lost');
      setState(prev => ({ ...prev, isOnline: false }));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        console.log('Tab visible, checking queue...');
        processQueue();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [processQueue]);

  // Set up periodic queue processing
  useEffect(() => {
    loadQueue();

    processIntervalRef.current = setInterval(() => {
      if (navigator.onLine && !isProcessingRef.current) {
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

  return {
    state,
    addToQueue,
    processQueue,
    updateItemLocation,
    retryItem,
    removeItem,
    refreshStaleLocation,
  };
}
