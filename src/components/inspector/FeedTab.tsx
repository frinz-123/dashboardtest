"use client";

import React, { useState, useMemo } from "react";
import { ChevronDown, Camera, Filter, X } from "lucide-react";
import FeedPost, { FeedSale } from "./FeedPost";
import { EMAIL_TO_VENDOR_LABELS } from "@/utils/auth";

type FeedTabProps = {
    salesData: FeedSale[];
    onPostClick: (sale: FeedSale) => void;
    getDisplayableImageUrl: (url: string) => string;
    formatCurrency: (value: number) => string;
    isLoading: boolean;
};

const ITEMS_PER_PAGE = 20;

export default function FeedTab({
    salesData,
    onPostClick,
    getDisplayableImageUrl,
    formatCurrency,
    isLoading,
}: FeedTabProps) {
    const [selectedSeller, setSelectedSeller] = useState<string | null>(null);
    const [isSellerFilterOpen, setIsSellerFilterOpen] = useState(false);
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

    // Filter sales with photos and sort by most recent
    const salesWithPhotos = useMemo(() => {
        return salesData
            .filter((sale) => sale.photoUrls && sale.photoUrls.length > 0)
            .sort((a, b) => {
                // Sort by date first, then by submission time
                const dateA = new Date(a.fechaSinHora + " " + (a.submissionTime?.split(" ")[1] || "00:00:00"));
                const dateB = new Date(b.fechaSinHora + " " + (b.submissionTime?.split(" ")[1] || "00:00:00"));
                return dateB.getTime() - dateA.getTime();
            });
    }, [salesData]);

    // Get unique sellers from sales with photos
    const sellers = useMemo(() => {
        const sellerMap = new Map<string, { email: string; name: string; count: number }>();
        salesWithPhotos.forEach((sale) => {
            const existing = sellerMap.get(sale.email);
            if (existing) {
                existing.count++;
            } else {
                sellerMap.set(sale.email, {
                    email: sale.email,
                    name: EMAIL_TO_VENDOR_LABELS[sale.email] || sale.email.split("@")[0],
                    count: 1,
                });
            }
        });
        return Array.from(sellerMap.values()).sort((a, b) => b.count - a.count);
    }, [salesWithPhotos]);

    // Apply seller filter
    const filteredSales = useMemo(() => {
        if (!selectedSeller) return salesWithPhotos;
        return salesWithPhotos.filter((sale) => sale.email === selectedSeller);
    }, [salesWithPhotos, selectedSeller]);

    // Get visible sales based on pagination
    const visibleSales = useMemo(() => {
        return filteredSales.slice(0, visibleCount);
    }, [filteredSales, visibleCount]);

    const hasMoreSales = visibleCount < filteredSales.length;

    const handleLoadMore = () => {
        setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
    };

    // Reset pagination when filter changes
    const handleSelectSeller = (email: string | null) => {
        setSelectedSeller(email);
        setVisibleCount(ITEMS_PER_PAGE);
        setIsSellerFilterOpen(false);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-gray-200 rounded-full" />
                    <div className="h-4 w-32 bg-gray-200 rounded" />
                </div>
            </div>
        );
    }

    if (salesWithPhotos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Camera className="w-12 h-12 mb-4 text-gray-300" />
                <p className="text-lg font-medium">No hay fotos disponibles</p>
                <p className="text-sm">Las ventas con fotos apareceran aqui</p>
            </div>
        );
    }

    const selectedSellerName = selectedSeller
        ? EMAIL_TO_VENDOR_LABELS[selectedSeller] || selectedSeller.split("@")[0]
        : null;

    return (
        <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <button
                            onClick={() => setIsSellerFilterOpen(!isSellerFilterOpen)}
                            className={`flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg w-full text-sm font-medium border transition-colors ${
                                selectedSeller
                                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                                    : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4" />
                                <span>
                                    {selectedSellerName || "Todos los vendedores"}
                                </span>
                            </div>
                            <ChevronDown
                                className={`w-4 h-4 transition-transform ${
                                    isSellerFilterOpen ? "rotate-180" : ""
                                }`}
                            />
                        </button>

                        {isSellerFilterOpen && (
                            <div className="absolute left-0 top-full mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-20 max-h-80 overflow-y-auto">
                                <button
                                    onClick={() => handleSelectSeller(null)}
                                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 ${
                                        !selectedSeller ? "bg-blue-50" : ""
                                    }`}
                                >
                                    <span className="font-medium text-gray-800">
                                        Todos los vendedores
                                    </span>
                                    <span className="text-xs text-gray-500 ml-2">
                                        ({salesWithPhotos.length} posts)
                                    </span>
                                </button>
                                {sellers.map((seller) => (
                                    <button
                                        key={seller.email}
                                        onClick={() => handleSelectSeller(seller.email)}
                                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                                            selectedSeller === seller.email
                                                ? "bg-blue-50"
                                                : ""
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-gray-800">
                                                {seller.name}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {seller.count} posts
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {selectedSeller && (
                        <button
                            onClick={() => handleSelectSeller(null)}
                            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            title="Limpiar filtro"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Stats summary */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
                    <span>
                        <strong className="text-gray-700">{filteredSales.length}</strong>{" "}
                        {filteredSales.length === 1 ? "venta" : "ventas"} con fotos
                    </span>
                    <span>
                        <strong className="text-gray-700">
                            {filteredSales.reduce((sum, s) => sum + s.photoUrls.length, 0)}
                        </strong>{" "}
                        fotos totales
                    </span>
                </div>
            </div>

            {/* Feed Posts */}
            <div className="space-y-4 max-w-2xl mx-auto">
                {visibleSales.map((sale, index) => (
                    <FeedPost
                        key={`${sale.email}-${sale.fechaSinHora}-${sale.clientName}-${index}`}
                        sale={sale}
                        onPostClick={onPostClick}
                        getDisplayableImageUrl={getDisplayableImageUrl}
                        formatCurrency={formatCurrency}
                    />
                ))}
            </div>

            {/* Load More Button */}
            {hasMoreSales && (
                <div className="flex justify-center pt-4 pb-8">
                    <button
                        onClick={handleLoadMore}
                        className="px-6 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
                    >
                        Ver mas ({filteredSales.length - visibleCount} restantes)
                    </button>
                </div>
            )}

            {/* End of feed message */}
            {!hasMoreSales && visibleSales.length > 0 && (
                <div className="text-center py-8 text-sm text-gray-400">
                    Has llegado al final del feed
                </div>
            )}
        </div>
    );
}
