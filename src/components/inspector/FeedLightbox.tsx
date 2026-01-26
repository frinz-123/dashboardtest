"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    X,
    ChevronLeft,
    ChevronRight,
    MapPin,
    ShoppingBag,
    Clock,
    Check,
    MessageSquare,
    Send,
    CheckCircle2,
} from "lucide-react";
import { FeedSale } from "./FeedPost";
import { EMAIL_TO_VENDOR_LABELS } from "@/utils/auth";

type FeedReview = {
    saleId: string;
    reviewedAt: string;
    reviewedBy: string;
    note: string;
};

type FeedLightboxProps = {
    sale: FeedSale;
    initialPhotoIndex?: number;
    onClose: () => void;
    getDisplayableImageUrl: (url: string) => string;
    formatCurrency: (value: number) => string;
    review: FeedReview | null;
    onMarkReviewed: (note?: string) => Promise<void>;
    isSubmittingReview: boolean;
    isReadOnly?: boolean;
    isSeen?: boolean;
    onMarkSeen?: () => Promise<void> | void;
    isMarkingSeen?: boolean;
};

const CODE_COLORS: Record<string, string> = {
    CONTADO: "#10b981",
    CREDITO: "#f59e0b",
    DEVOLUCION: "#ef4444",
    CAMBIO: "#8b5cf6",
    ANTICIPO: "#3b82f6",
    EFT: "#06b6d4",
};

export default function FeedLightbox({
    sale,
    initialPhotoIndex = 0,
    onClose,
    getDisplayableImageUrl,
    formatCurrency,
    review,
    onMarkReviewed,
    isSubmittingReview,
    isReadOnly = false,
    isSeen = false,
    onMarkSeen,
    isMarkingSeen = false,
}: FeedLightboxProps) {
    const [currentIndex, setCurrentIndex] = useState(initialPhotoIndex);
    const [showNoteInput, setShowNoteInput] = useState(false);
    const [noteText, setNoteText] = useState("");

    const sellerName =
        EMAIL_TO_VENDOR_LABELS[sale.email] || sale.email.split("@")[0];
    const totalProducts = Object.values(sale.products).reduce(
        (sum, qty) => sum + qty,
        0
    );

    // Format date and time
    const saleDate = new Date(sale.fechaSinHora);
    const dateStr = saleDate.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });
    const timeStr = sale.submissionTime?.split(" ")[1]?.slice(0, 5) || "";
    const reviewerName = review?.reviewedBy
        ? EMAIL_TO_VENDOR_LABELS[review.reviewedBy] ||
          review.reviewedBy.split("@")[0]
        : null;

    const goToPrevious = useCallback(() => {
        setCurrentIndex((prev) =>
            prev === 0 ? sale.photoUrls.length - 1 : prev - 1
        );
    }, [sale.photoUrls.length]);

    const goToNext = useCallback(() => {
        setCurrentIndex((prev) =>
            prev === sale.photoUrls.length - 1 ? 0 : prev + 1
        );
    }, [sale.photoUrls.length]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowLeft") goToPrevious();
            if (e.key === "ArrowRight") goToNext();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, goToPrevious, goToNext]);

    // Prevent body scroll when lightbox is open
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "";
        };
    }, []);

    const handleMarkReviewed = async () => {
        if (showNoteInput && noteText.trim()) {
            await onMarkReviewed(noteText.trim());
            setNoteText("");
            setShowNoteInput(false);
        } else if (!showNoteInput) {
            await onMarkReviewed();
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 text-white">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-semibold">
                        {sellerName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <p className="font-semibold">{sellerName}</p>
                        <p className="text-sm text-white/70">
                            {dateStr} {timeStr && `a las ${timeStr}`}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Photo Section */}
                <div className="flex-1 relative flex items-center justify-center min-h-0">
                    {/* Navigation Arrows */}
                    {sale.photoUrls.length > 1 && (
                        <>
                            <button
                                type="button"
                                onClick={goToPrevious}
                                className="absolute left-4 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors z-10"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <button
                                type="button"
                                onClick={goToNext}
                                className="absolute right-4 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors z-10"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        </>
                    )}

                    {/* Current Photo */}
                    <img
                        src={getDisplayableImageUrl(sale.photoUrls[currentIndex])}
                        alt={`Foto ${currentIndex + 1} de ${sale.photoUrls.length}`}
                        className="max-h-full max-w-full object-contain"
                    />

                    {/* Photo Counter */}
                    {sale.photoUrls.length > 1 && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                            {sale.photoUrls.map((url, idx) => (
                                <button
                                    type="button"
                                    key={`${sale.email}-${sale.fechaSinHora}-${url}`}
                                    onClick={() => setCurrentIndex(idx)}
                                    className={`w-2 h-2 rounded-full transition-colors ${
                                        idx === currentIndex
                                            ? "bg-white"
                                            : "bg-white/40 hover:bg-white/60"
                                    }`}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Details Panel */}
                <div className="lg:w-80 bg-white lg:rounded-tl-2xl overflow-y-auto">
                    <div className="p-4 space-y-4">
                        {/* Client & Sale Info */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-gray-600">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <span className="font-medium text-gray-900">
                                    {sale.clientName}
                                </span>
                            </div>

                            <div className="flex items-center justify-between">
                                <span
                                    className="text-xs px-2 py-1 rounded-full font-medium"
                                    style={{
                                        backgroundColor: `${CODE_COLORS[sale.codigo] || "#6b7280"}20`,
                                        color: CODE_COLORS[sale.codigo] || "#6b7280",
                                    }}
                                >
                                    {sale.codigo || "N/A"}
                                </span>
                                <span className="text-xl font-bold text-gray-900">
                                    {formatCurrency(sale.venta)}
                                </span>
                            </div>
                        </div>

                        {/* Products */}
                        <div className="border-t border-gray-100 pt-4">
                            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <ShoppingBag className="w-4 h-4" />
                                Productos ({totalProducts})
                            </h4>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {Object.entries(sale.products)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([name, qty]) => (
                                        <div
                                            key={name}
                                            className="flex items-center justify-between text-sm"
                                        >
                                            <span className="text-gray-700">{name}</span>
                                            <span className="font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                                {qty}
                                            </span>
                                        </div>
                                    ))}
                            </div>
                        </div>

                        {/* Review Section */}
                        <div className="border-t border-gray-100 pt-4">
                            {review ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-green-600">
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span className="text-sm font-medium">
                                            Revisado
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        {new Date(review.reviewedAt).toLocaleDateString(
                                            "es-ES",
                                            {
                                                day: "numeric",
                                                month: "short",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            }
                                        )}
                                    </p>
                                    {isReadOnly && reviewerName && (
                                        <p className="text-xs text-gray-500">
                                            Comentario de {reviewerName}
                                        </p>
                                    )}
                                    {review.note && (
                                        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                                            {review.note}
                                        </div>
                                    )}
                                    {isReadOnly && onMarkSeen ? (
                                        isSeen ? (
                                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                                <Check className="w-3 h-3" />
                                                Visto
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={onMarkSeen}
                                                disabled={isMarkingSeen}
                                                className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                                            >
                                                {isMarkingSeen ? "Guardando..." : "Marcar visto"}
                                            </button>
                                        )
                                    ) : null}
                                </div>
                            ) : isReadOnly ? (
                                <p className="text-xs text-gray-500">
                                    Sin comentarios
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {showNoteInput ? (
                                        <div className="space-y-2">
                                            <textarea
                                                value={noteText}
                                                onChange={(e) => setNoteText(e.target.value)}
                                                placeholder="Agregar nota (opcional)..."
                                                className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                rows={3}
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowNoteInput(false);
                                                        setNoteText("");
                                                    }}
                                                    className="flex-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleMarkReviewed}
                                                    disabled={isSubmittingReview}
                                                    className="flex-1 px-3 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {isSubmittingReview ? (
                                                        "Guardando..."
                                                    ) : (
                                                        <>
                                                            <Send className="w-4 h-4" />
                                                            Guardar
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={handleMarkReviewed}
                                                disabled={isSubmittingReview}
                                                className="flex-1 px-3 py-2.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {isSubmittingReview ? (
                                                    "Guardando..."
                                                ) : (
                                                    <>
                                                        <Check className="w-4 h-4" />
                                                        Marcar revisado
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowNoteInput(true)}
                                                className="px-3 py-2.5 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                                                title="Agregar nota"
                                            >
                                                <MessageSquare className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Photo Thumbnails */}
                        {sale.photoUrls.length > 1 && (
                            <div className="border-t border-gray-100 pt-4">
                                <p className="text-xs text-gray-500 mb-2">
                                    {currentIndex + 1} de {sale.photoUrls.length} fotos
                                </p>
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {sale.photoUrls.map((url, idx) => (
                                        <button
                                            type="button"
                                            key={`${sale.email}-${sale.fechaSinHora}-${url}`}
                                            onClick={() => setCurrentIndex(idx)}
                                            className={`w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                                                idx === currentIndex
                                                    ? "border-blue-500"
                                                    : "border-transparent opacity-60 hover:opacity-100"
                                            }`}
                                        >
                                            <img
                                                src={getDisplayableImageUrl(url)}
                                                alt={`Thumbnail ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
