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

function formatSubmissionId(id: string) {
  if (id.length <= 18) {
    return id;
  }

  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function getStatusIcon(item: QueuedSubmission) {
  if (item.lastServerState === "processing" && item.status === "pending") {
    return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
  }

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
  if (item.lastServerState === "processing" && item.status === "pending") {
    return "Procesando";
  }

  switch (item.status) {
    case "sending":
      return "Enviando";
    case "failed":
      return "Error";
    case "pending":
      return isOnline ? "En cola" : "Sin conexion";
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

  if (item.nextRetryAt && item.nextRetryAt > Date.now()) {
    parts.push(`Proximo ${formatTime(item.nextRetryAt)}`);
  }

  return parts.length > 0 ? parts.join(" • ") : null;
}

function getQueueNote(item: QueuedSubmission): string | null {
  if (item.lastServerState === "processing" && item.status === "pending") {
    return "Procesando en servidor";
  }

  if (item.lastServerState === "unknown" && item.status === "pending") {
    return "Estado no confirmado. Reintentaremos automaticamente.";
  }

  return null;
}

function getStatusPillClass(item: QueuedSubmission) {
  if (item.lastServerState === "processing" && item.status === "pending") {
    return "bg-blue-100 text-blue-700";
  }

  if (item.status === "sending") {
    return "bg-blue-100 text-blue-700";
  }

  if (item.status === "failed") {
    return "bg-red-100 text-red-700";
  }

  return "bg-gray-100 text-gray-700";
}

export default function PendingOrdersBanner({
  state,
  onRetry,
  onRemove,
  onClearQueue,
}: PendingOrdersBannerProps) {
  const { pendingCount, isProcessing, isOnline, items, currentItem } = state;

  if (pendingCount === 0 && isOnline) {
    return null;
  }

  return (
    <div className="fixed left-0 right-0 top-0 z-50 animate-in slide-in-from-top duration-300">
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 bg-red-500 px-4 py-2 text-white">
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">
            Sin conexion. Los pedidos se enviaran automaticamente.
          </span>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="border-b border-blue-200 bg-blue-50 px-4 py-3">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              {isProcessing && currentItem && (
                <span className="truncate text-xs text-blue-700 sm:max-w-48">
                  Enviando: {currentItem.payload.clientName}
                </span>
              )}
              <button
                type="button"
                onClick={onClearQueue}
                className="min-h-11 rounded-full bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-200"
              >
                Limpiar
              </button>
            </div>
          </div>

          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {items.slice(0, 5).map((item) => {
              const attemptSummary = getAttemptSummary(item);
              const queueNote = getQueueNote(item);

              return (
                <div
                  key={item.id}
                  className={`rounded-xl bg-white px-3 py-3 text-sm shadow-sm ${
                    item.status === "failed"
                      ? "border border-red-200"
                      : item.lastServerState === "processing"
                        ? "border border-blue-200"
                        : "border border-gray-200"
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <div className="pt-0.5">{getStatusIcon(item)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-gray-900">
                            {item.payload.clientName}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 tabular-nums">
                            <span>${item.payload.total.toFixed(2)}</span>
                            <span>Creado {formatTime(item.createdAt)}</span>
                            {item.retryCount > 0 && (
                              <span className="text-orange-600">
                                Intento {item.retryCount + 1}
                              </span>
                            )}
                          </div>
                          <div
                            className="mt-1 truncate font-mono text-[11px] text-slate-500"
                            title={item.id}
                          >
                            ID {formatSubmissionId(item.id)}
                          </div>
                          {attemptSummary && (
                            <div className="mt-1 text-[11px] text-slate-600 tabular-nums">
                              {attemptSummary}
                            </div>
                          )}
                          {queueNote && (
                            <div className="mt-2 rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-medium text-blue-800">
                              {queueNote}
                            </div>
                          )}
                          {item.errorMessage && (
                            <div
                              className={`mt-2 text-xs ${
                                item.status === "failed"
                                  ? "text-red-600"
                                  : "text-slate-600"
                              }`}
                            >
                              {item.errorMessage}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:max-w-44 md:justify-end">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusPillClass(
                          item,
                        )}`}
                      >
                        {getStatusText(item, isOnline)}
                      </span>

                      {item.status === "failed" && (
                        <button
                          type="button"
                          onClick={() => onRetry(item.id)}
                          className="min-h-11 rounded-full bg-orange-100 px-3 py-2 text-xs font-semibold text-orange-700 transition-colors hover:bg-orange-200"
                          title="Volver a intentar"
                        >
                          Volver a intentar
                        </button>
                      )}

                      {item.status === "failed" && (
                        <button
                          type="button"
                          onClick={() => onRemove(item.id)}
                          className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 transition-colors hover:bg-red-50"
                          title="Eliminar"
                          aria-label={`Eliminar pedido pendiente ${item.payload.clientName}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
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
