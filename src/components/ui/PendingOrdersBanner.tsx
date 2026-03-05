"use client";

import {
  AlertTriangle,
  Clock,
  RefreshCw,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import type { QueueState } from "@/hooks/useSubmissionQueue";
import type {
  QueueAttemptSource,
  QueuedSubmission,
} from "@/utils/submissionQueue";

interface PendingOrdersBannerProps {
  state: QueueState;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onClearQueue: () => void;
}

function formatAttemptSource(source: QueueAttemptSource | null): string | null {
  if (source === "hook") return "App web";
  if (source === "service-worker") return "Background Sync";
  return null;
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusIcon(item: QueuedSubmission) {
  switch (item.status) {
    case "sending":
      return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
    case "failed":
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "pending":
      return <Clock className="h-4 w-4 text-gray-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-500" />;
  }
}

function getStatusText(item: QueuedSubmission, isOnline: boolean) {
  switch (item.status) {
    case "sending":
      return "Enviando...";
    case "failed":
      return "Error - Toca para reintentar";
    case "pending":
      return isOnline ? "En cola..." : "Esperando conexion...";
    default:
      return "Pendiente";
  }
}

function getAttemptSummary(item: QueuedSubmission): string | null {
  const parts: string[] = [];
  if (item.lastAttemptAt) {
    parts.push(`Ultimo intento ${formatTime(item.lastAttemptAt)}`);
  }

  const sourceLabel = formatAttemptSource(item.lastAttemptSource);
  if (sourceLabel) {
    parts.push(sourceLabel);
  }

  if (typeof item.lastHttpStatus === "number") {
    parts.push(`HTTP ${item.lastHttpStatus}`);
  }

  return parts.length > 0 ? parts.join(" • ") : null;
}

function getRetryNote(item: QueuedSubmission): string | null {
  if (item.retryCount === 0 || item.status === "sending") {
    return null;
  }

  return "Ultimo intento fallido; no implica duplicado. Si ya aparece en el Dashboard, puedes limpiar este pendiente.";
}

export default function PendingOrdersBanner({
  state,
  onRetry,
  onRemove,
  onClearQueue,
}: PendingOrdersBannerProps) {
  const { pendingCount, isProcessing, isOnline, items, currentItem } = state;

  // Don't show anything if there are no pending items and we're online
  if (pendingCount === 0 && isOnline) {
    return null;
  }

  return (
    <div className="fixed left-0 right-0 top-0 z-50 animate-in slide-in-from-top duration-300">
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 bg-red-500 px-4 py-2 text-white">
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">
            Sin conexion - Los pedidos se enviaran automaticamente
          </span>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="border-b border-blue-200 bg-blue-50 px-4 py-2">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isProcessing ? (
                <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
              ) : isOnline ? (
                <Wifi className="h-4 w-4 text-green-600" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-600" />
              )}
              <span className="text-sm font-medium text-blue-900">
                {pendingCount} pedido
                {pendingCount !== 1 ? "s" : ""} pendiente
                {pendingCount !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isProcessing && currentItem && (
                <span className="text-xs text-blue-600">
                  Enviando: {currentItem.payload.clientName}
                </span>
              )}
              <button
                type="button"
                onClick={onClearQueue}
                className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-200"
              >
                Limpiar
              </button>
            </div>
          </div>

          <div className="max-h-48 space-y-1 overflow-y-auto">
            {items.slice(0, 5).map((item) => {
              const attemptSummary = getAttemptSummary(item);
              const retryNote = getRetryNote(item);

              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between rounded bg-white px-2 py-1.5 text-sm ${
                    item.status === "failed"
                      ? "border border-red-200"
                      : item.status === "sending"
                        ? "border border-blue-200"
                        : "border border-gray-200"
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <div className="pt-0.5">{getStatusIcon(item)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-gray-900">
                        {item.payload.clientName}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>${item.payload.total.toFixed(2)}</span>
                        <span>•</span>
                        <span>Creado {formatTime(item.createdAt)}</span>
                        {item.retryCount > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-orange-600">
                              Intento {item.retryCount + 1}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="mt-0.5 break-all font-mono text-[11px] text-slate-500">
                        ID: {item.id}
                      </div>
                      {attemptSummary && (
                        <div className="mt-0.5 text-[11px] text-slate-600">
                          {attemptSummary}
                        </div>
                      )}
                      {item.errorMessage && (
                        <div
                          className={`mt-1 text-xs ${
                            item.status === "failed"
                              ? "text-red-600"
                              : "text-amber-700"
                          }`}
                        >
                          {item.errorMessage}
                        </div>
                      )}
                      {retryNote && (
                        <div className="mt-0.5 text-xs text-amber-700">
                          {retryNote}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="ml-2 flex items-center gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        item.status === "sending"
                          ? "bg-blue-100 text-blue-700"
                          : item.status === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {getStatusText(item, isOnline)}
                    </span>

                    {item.status === "failed" && (
                      <button
                        type="button"
                        onClick={() => onRetry(item.id)}
                        className="rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-700 transition-colors hover:bg-orange-200"
                        title="Volver a intentar"
                      >
                        Volver a intentar
                      </button>
                    )}

                    {item.status === "failed" && (
                      <button
                        type="button"
                        onClick={() => onRemove(item.id)}
                        className="rounded p-1 hover:bg-red-100"
                        title="Eliminar"
                      >
                        <X className="h-3 w-3 text-red-600" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {items.length > 5 && (
              <div className="py-1 text-center text-xs text-gray-500">
                +{items.length - 5} pedidos mas...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
