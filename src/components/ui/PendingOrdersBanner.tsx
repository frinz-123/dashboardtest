"use client";

import React from "react";
import {
    Wifi,
    WifiOff,
    Clock,
    AlertTriangle,
    CheckCircle,
    RefreshCw,
    MapPin,
    X,
} from "lucide-react";
import { QueueState } from "@/hooks/useSubmissionQueue";
import { QueuedSubmission } from "@/utils/submissionQueue";

interface PendingOrdersBannerProps {
    state: QueueState;
    onRefreshLocation: () => void;
    onRetry: (id: string) => void;
    onRemove: (id: string) => void;
    isRefreshingLocation?: boolean;
}

export default function PendingOrdersBanner({
    state,
    onRefreshLocation,
    onRetry,
    onRemove,
    isRefreshingLocation = false,
}: PendingOrdersBannerProps) {
    const {
        pendingCount,
        isProcessing,
        isOnline,
        items,
        hasStaleLocation,
        currentItem,
    } = state;

    // Don't show anything if there are no pending items and we're online
    if (pendingCount === 0 && isOnline) {
        return null;
    }

    const getStatusIcon = (item: QueuedSubmission) => {
        switch (item.status) {
            case "sending":
                return (
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                );
            case "locationStale":
                return <MapPin className="w-4 h-4 text-orange-500" />;
            case "failed":
                return <AlertTriangle className="w-4 h-4 text-red-500" />;
            case "pending":
                return <Clock className="w-4 h-4 text-gray-500" />;
            default:
                return <Clock className="w-4 h-4 text-gray-500" />;
        }
    };

    const getStatusText = (item: QueuedSubmission) => {
        switch (item.status) {
            case "sending":
                return "Enviando...";
            case "locationStale":
                return "Ubicacion expirada";
            case "failed":
                return "Error - Toca para reintentar";
            case "pending":
                return isOnline ? "En cola..." : "Esperando conexion...";
            default:
                return "Pendiente";
        }
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top duration-300">
            {/* Connection status bar */}
            {!isOnline && (
                <div className="bg-red-500 text-white px-4 py-2 flex items-center justify-center gap-2">
                    <WifiOff className="w-4 h-4" />
                    <span className="text-sm font-medium">
                        Sin conexion - Los pedidos se enviaran automaticamente
                    </span>
                </div>
            )}

            {/* Stale location warning */}
            {hasStaleLocation && isOnline && (
                <div className="bg-orange-500 text-white px-4 py-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span className="text-sm font-medium">
                                Tu ubicacion ha expirado
                            </span>
                        </div>
                        <button
                            onClick={onRefreshLocation}
                            disabled={isRefreshingLocation}
                            className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {isRefreshingLocation ? (
                                <>
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    Actualizando...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-3 h-3" />
                                    Refrescar ubicacion
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Pending orders list */}
            {pendingCount > 0 && (
                <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            {isProcessing ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                            ) : isOnline ? (
                                <Wifi className="w-4 h-4 text-green-600" />
                            ) : (
                                <WifiOff className="w-4 h-4 text-red-600" />
                            )}
                            <span className="text-sm font-medium text-blue-900">
                                {pendingCount} pedido
                                {pendingCount !== 1 ? "s" : ""} pendiente
                                {pendingCount !== 1 ? "s" : ""}
                            </span>
                        </div>
                        {isProcessing && currentItem && (
                            <span className="text-xs text-blue-600">
                                Enviando: {currentItem.payload.clientName}
                            </span>
                        )}
                    </div>

                    {/* Individual items */}
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                        {items.slice(0, 5).map((item) => (
                            <div
                                key={item.id}
                                className={`flex items-center justify-between bg-white rounded px-2 py-1.5 text-sm ${
                                    item.status === "failed"
                                        ? "border border-red-200"
                                        : item.status === "locationStale"
                                          ? "border border-orange-200"
                                          : item.status === "sending"
                                            ? "border border-blue-200"
                                            : "border border-gray-200"
                                }`}
                            >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {getStatusIcon(item)}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-gray-900 truncate">
                                            {item.payload.clientName}
                                        </div>
                                        <div className="text-xs text-gray-500 flex items-center gap-2">
                                            <span>
                                                ${item.payload.total.toFixed(2)}
                                            </span>
                                            <span>•</span>
                                            <span>
                                                {formatTime(item.createdAt)}
                                            </span>
                                            {item.retryCount > 0 && (
                                                <>
                                                    <span>•</span>
                                                    <span className="text-orange-600">
                                                        Intento{" "}
                                                        {item.retryCount + 1}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        {item.status === "failed" &&
                                            item.errorMessage && (
                                                <div className="text-xs text-red-600 mt-1">
                                                    {item.errorMessage}
                                                </div>
                                            )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 ml-2">
                                    <span
                                        className={`text-xs px-2 py-0.5 rounded-full ${
                                            item.status === "sending"
                                                ? "bg-blue-100 text-blue-700"
                                                : item.status ===
                                                    "locationStale"
                                                  ? "bg-orange-100 text-orange-700"
                                                  : item.status === "failed"
                                                    ? "bg-red-100 text-red-700"
                                                    : "bg-gray-100 text-gray-700"
                                        }`}
                                    >
                                        {getStatusText(item)}
                                    </span>

                                    {item.status === "failed" && (
                                        <button
                                            onClick={() => onRetry(item.id)}
                                            className="p-1 hover:bg-gray-100 rounded"
                                            title="Reintentar"
                                        >
                                            <RefreshCw className="w-3 h-3 text-gray-600" />
                                        </button>
                                    )}

                                    {(item.status === "failed" ||
                                        item.status === "locationStale") && (
                                        <button
                                            onClick={() => onRemove(item.id)}
                                            className="p-1 hover:bg-red-100 rounded"
                                            title="Eliminar"
                                        >
                                            <X className="w-3 h-3 text-red-600" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {items.length > 5 && (
                            <div className="text-xs text-center text-gray-500 py-1">
                                +{items.length - 5} pedidos mas...
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
