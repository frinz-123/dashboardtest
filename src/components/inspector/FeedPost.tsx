"use client";

import React from "react";
import { Clock, MapPin, ShoppingBag, Image as ImageIcon, MessageSquare, CheckCircle2 } from "lucide-react";
import { EMAIL_TO_VENDOR_LABELS } from "@/utils/auth";

export type FeedSale = {
    clientName: string;
    venta: number;
    codigo: string;
    fechaSinHora: string;
    email: string;
    submissionTime?: string;
    products: Record<string, number>;
    photoUrls: string[];
};

type FeedPostProps = {
    sale: FeedSale;
    onPostClick: (sale: FeedSale) => void;
    getDisplayableImageUrl: (url: string) => string;
    formatCurrency: (value: number) => string;
    reviewNote?: string;
    isReviewed?: boolean;
};

const CODE_COLORS: Record<string, string> = {
    CONTADO: "#10b981",
    CREDITO: "#f59e0b",
    DEVOLUCION: "#ef4444",
    CAMBIO: "#8b5cf6",
    ANTICIPO: "#3b82f6",
    EFT: "#06b6d4",
};

// Generate consistent avatar colors based on email
const getAvatarColor = (email: string): string => {
    const colors = [
        "bg-blue-500",
        "bg-green-500",
        "bg-amber-500",
        "bg-red-500",
        "bg-purple-500",
        "bg-pink-500",
        "bg-cyan-500",
        "bg-lime-500",
        "bg-orange-500",
    ];
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
        hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string): string => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
};

export default function FeedPost({
    sale,
    onPostClick,
    getDisplayableImageUrl,
    formatCurrency,
    reviewNote,
    isReviewed,
}: FeedPostProps) {
    const sellerName = EMAIL_TO_VENDOR_LABELS[sale.email] || sale.email.split("@")[0];
    const avatarColor = getAvatarColor(sale.email);
    const initials = getInitials(sellerName);

    // Format date and time
    const saleDate = new Date(sale.fechaSinHora);
    const dateStr = saleDate.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
    });
    const timeStr = sale.submissionTime?.split(" ")[1]?.slice(0, 5) || "";

    // Calculate total products
    const totalProducts = Object.values(sale.products).reduce((sum, qty) => sum + qty, 0);

    return (
        <div
            onClick={() => onPostClick(sale)}
            className="bg-white border border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:border-gray-300 transition-colors active:bg-gray-50"
        >
            {/* Header */}
            <div className="px-4 py-3 flex items-center gap-3">
                {/* Avatar */}
                <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${avatarColor}`}
                >
                    {initials}
                </div>

                {/* Seller Info */}
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{sellerName}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{dateStr} {timeStr && `a las ${timeStr}`}</span>
                    </div>
                </div>

                {/* Badges container */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {isReviewed && (
                        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium bg-green-500 text-white">
                            <CheckCircle2 className="w-3 h-3" />
                            Revisado
                        </span>
                    )}
                    {/* Sale code badge */}
                    <span
                        className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{
                            backgroundColor: `${CODE_COLORS[sale.codigo] || "#6b7280"}20`,
                            color: CODE_COLORS[sale.codigo] || "#6b7280",
                        }}
                    >
                        {sale.codigo || "N/A"}
                    </span>
                </div>
            </div>

            {/* Client info */}
            <div className="px-4 pb-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    <span className="truncate">{sale.clientName}</span>
                </div>
            </div>

            {/* Photos Grid */}
            <div className="px-4 pb-3">
                {sale.photoUrls.length === 1 ? (
                    <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-gray-100">
                        <img
                            src={getDisplayableImageUrl(sale.photoUrls[0])}
                            alt={`Foto de venta a ${sale.clientName}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                    </div>
                ) : sale.photoUrls.length === 2 ? (
                    <div className="grid grid-cols-2 gap-1 rounded-lg overflow-hidden">
                        {sale.photoUrls.map((url, idx) => (
                            <div key={idx} className="aspect-square overflow-hidden bg-gray-100">
                                <img
                                    src={getDisplayableImageUrl(url)}
                                    alt={`Foto ${idx + 1}`}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                            </div>
                        ))}
                    </div>
                ) : sale.photoUrls.length === 3 ? (
                    <div className="grid grid-cols-2 gap-1 rounded-lg overflow-hidden">
                        <div className="aspect-square overflow-hidden bg-gray-100">
                            <img
                                src={getDisplayableImageUrl(sale.photoUrls[0])}
                                alt="Foto 1"
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                        </div>
                        <div className="grid grid-rows-2 gap-1">
                            {sale.photoUrls.slice(1, 3).map((url, idx) => (
                                <div key={idx} className="overflow-hidden bg-gray-100">
                                    <img
                                        src={getDisplayableImageUrl(url)}
                                        alt={`Foto ${idx + 2}`}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-1 rounded-lg overflow-hidden">
                        {sale.photoUrls.slice(0, 4).map((url, idx) => (
                            <div key={idx} className="aspect-square overflow-hidden bg-gray-100 relative">
                                <img
                                    src={getDisplayableImageUrl(url)}
                                    alt={`Foto ${idx + 1}`}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                                {idx === 3 && sale.photoUrls.length > 4 && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                        <span className="text-white font-semibold text-lg">
                                            +{sale.photoUrls.length - 4}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer - Sale summary */}
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>{totalProducts} productos</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>{sale.photoUrls.length} fotos</span>
                    </div>
                </div>
                <span className="font-bold text-gray-800">
                    {formatCurrency(sale.venta)}
                </span>
            </div>

            {/* Review Comment */}
            {reviewNote && (
                <div className="px-4 py-3 border-t border-gray-100 bg-green-50/50">
                    <div className="flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                        <p className="text-sm text-green-800">{reviewNote}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
