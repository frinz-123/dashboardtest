"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import type { UseSubmissionQueueReturn } from "@/hooks/useSubmissionQueue";
import type { QueuedSubmission } from "@/utils/submissionQueue";

const REQUEST_TIMEOUT_MS = 10_000;
const ENABLE_IMMEDIATE_SUBMIT =
  process.env.NEXT_PUBLIC_ENABLE_IMMEDIATE_SUBMIT !== "false";

type AddToQueueFn = UseSubmissionQueueReturn["addToQueue"];

export type SubmitOrderOutcome = "submitted" | "queued" | "duplicate";

export interface SubmitOrderArgs {
  id: string;
  payload: QueuedSubmission["payload"];
  isAdmin: boolean;
}

export interface SubmitOrderResult {
  outcome: SubmitOrderOutcome;
}

interface SubmitError extends Error {
  status?: number;
  retryable?: boolean;
  queueable?: boolean;
}

interface SubmitApiSuccess {
  duplicate?: boolean;
}

type JsonObject = Record<string, unknown>;

interface UseOrderSubmitMutationOptions {
  addToQueue: AddToQueueFn;
}

function buildSubmitError(
  message: string,
  details: Omit<SubmitError, keyof Error>,
): SubmitError {
  return Object.assign(new Error(message), details);
}

function isSubmitError(value: unknown): value is SubmitError {
  return value instanceof Error;
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Error desconocido";
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw buildSubmitError("Tiempo de espera agotado", {
        retryable: true,
        queueable: true,
      });
    }

    if (error instanceof TypeError) {
      throw buildSubmitError("Sin conexion a internet", {
        retryable: true,
        queueable: true,
      });
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function submitImmediateAttempt(
  args: SubmitOrderArgs,
  attemptNumber: number,
): Promise<SubmitApiSuccess> {
  const { queuedAt: _queuedAt, ...payloadWithoutQueuedAt } = args.payload;

  const response = await fetchWithTimeout("/api/submit-form", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payloadWithoutQueuedAt,
      submissionId: args.id,
      attemptNumber,
    }),
  });

  if (response.ok) {
    let data: JsonObject = {};
    try {
      const parsed = await response.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        data = parsed as JsonObject;
      }
    } catch {
      console.warn(
        "[OrderSubmit] HTTP 200 but body parse failed, treating as success",
      );
    }
    return { duplicate: data.duplicate === true };
  }

  let errorData: JsonObject = {};
  try {
    const parsed = await response.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      errorData = parsed as JsonObject;
    }
  } catch {
    // Ignore parse errors for non-2xx responses
  }

  if (response.status === 409 || errorData.duplicate === true) {
    return { duplicate: true };
  }

  const errorText =
    typeof errorData.error === "string" ? errorData.error.trim() : "";

  const message =
    errorText.length > 0 ? errorText : `Error del servidor: ${response.status}`;

  throw buildSubmitError(message, {
    status: response.status,
    retryable: isTransientStatus(response.status),
    queueable: isTransientStatus(response.status),
  });
}

function shouldRetryImmediately(error: unknown): boolean {
  if (!isSubmitError(error)) return false;
  return Boolean(error.retryable);
}

function shouldQueueFallback(error: unknown): boolean {
  if (!isSubmitError(error)) return false;
  return Boolean(error.queueable);
}

function isQueueDuplicateError(error: unknown): boolean {
  return getErrorMessage(error).includes("DUPLICATE");
}

function hasPendingPhotoUploads(payload: QueuedSubmission["payload"]): boolean {
  const photoIds = Array.isArray(payload.photoIds) ? payload.photoIds : [];
  const photoUrls = Array.isArray(payload.photoUrls) ? payload.photoUrls : [];
  return photoIds.length > 0 && photoUrls.length < photoIds.length;
}

export function useOrderSubmitMutation({
  addToQueue,
}: UseOrderSubmitMutationOptions) {
  const mutation = useMutation<SubmitOrderResult, Error, SubmitOrderArgs>({
    notifyOnChangeProps: [],
    mutationFn: async (args) => {
      const enqueue = async (): Promise<SubmitOrderResult> => {
        try {
          await addToQueue({
            id: args.id,
            payload: {
              ...args.payload,
              queuedAt: args.payload.queuedAt ?? Date.now(),
            },
            isAdmin: args.isAdmin,
          });
          return { outcome: "queued" };
        } catch (queueError) {
          if (isQueueDuplicateError(queueError)) {
            return { outcome: "duplicate" };
          }
          throw queueError;
        }
      };

      if (!ENABLE_IMMEDIATE_SUBMIT) {
        return enqueue();
      }

      if (hasPendingPhotoUploads(args.payload)) {
        return enqueue();
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return enqueue();
      }

      try {
        const firstAttempt = await submitImmediateAttempt(args, 1);
        if (firstAttempt.duplicate) {
          return { outcome: "duplicate" };
        }
        return { outcome: "submitted" };
      } catch (firstError) {
        if (shouldRetryImmediately(firstError)) {
          try {
            const secondAttempt = await submitImmediateAttempt(args, 2);
            if (secondAttempt.duplicate) {
              return { outcome: "duplicate" };
            }
            return { outcome: "submitted" };
          } catch (secondError) {
            if (shouldQueueFallback(secondError)) {
              return enqueue();
            }
            throw secondError;
          }
        }

        if (shouldQueueFallback(firstError)) {
          return enqueue();
        }

        throw firstError;
      }
    },
  });

  return useCallback(
    (args: SubmitOrderArgs) => mutation.mutateAsync(args),
    [mutation.mutateAsync],
  );
}
