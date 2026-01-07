"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { ChevronDown, Camera, Filter, X, CheckCircle2 } from "lucide-react";
import FeedPost, { FeedSale } from "./FeedPost";
import FeedLightbox from "./FeedLightbox";
import { EMAIL_TO_VENDOR_LABELS } from "@/utils/auth";
import { useSession } from "next-auth/react";

type FeedReview = {
    saleId: string;
    reviewedAt: string;
    reviewedBy: string;
    note: string;
};

type FeedTabProps = {
    salesData: FeedSale[];
    getDisplayableImageUrl: (url: string) => string;
    formatCurrency: (value: number) => string;
    isLoading: boolean;
};

type GroupedSales = {
    label: string;
    sales: FeedSale[];
};

const ITEMS_PER_PAGE = 20;

// Generate a unique ID for a sale
const getSaleId = (sale: FeedSale): string => {
    return `${sale.email}|${sale.fechaSinHora}|${sale.clientName}`;
};

// Get time-based label for a date
const getTimeLabel = (dateStr: string): string => {
    const saleDate = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Reset time for comparison
    const saleDateOnly = new Date(
        saleDate.getFullYear(),
        saleDate.getMonth(),
        saleDate.getDate(),
    );
    const todayOnly = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
    );
    const yesterdayOnly = new Date(
        yesterday.getFullYear(),
        yesterday.getMonth(),
        yesterday.getDate(),
    );

    // Calculate days difference
    const diffTime = todayOnly.getTime() - saleDateOnly.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Hoy";
    if (diffDays === 1) return "Ayer";
    if (diffDays <= 7) return "Esta semana";
    if (diffDays <= 14) return "Semana pasada";
    if (diffDays <= 30) return "Este mes";

    // For older dates, show the month name
    return saleDate.toLocaleDateString("es-ES", {
        month: "long",
        year: "numeric",
    });
};

export default function FeedTab({
    salesData,
    getDisplayableImageUrl,
    formatCurrency,
    isLoading,
}: FeedTabProps) {
    const { data: session } = useSession();
    const [selectedSeller, setSelectedSeller] = useState<string | null>(null);
    const [isSellerFilterOpen, setIsSellerFilterOpen] = useState(false);
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
    const [showOnlyUnreviewed, setShowOnlyUnreviewed] = useState(false);

    // Lightbox state
    const [lightboxSale, setLightboxSale] = useState<FeedSale | null>(null);
    const [lightboxPhotoIndex, setLightboxPhotoIndex] = useState(0);

    // Reviews state
    const [reviews, setReviews] = useState<Map<string, FeedReview>>(new Map());
    const [isLoadingReviews, setIsLoadingReviews] = useState(true);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);

    // Fetch reviews on mount
    useEffect(() => {
        const fetchReviews = async () => {
            try {
                const response = await fetch("/api/feed-reviews");
                if (response.ok) {
                    const data = await response.json();
                    const reviewMap = new Map<string, FeedReview>();
                    data.reviews.forEach((review: FeedReview) => {
                        reviewMap.set(review.saleId, review);
                    });
                    setReviews(reviewMap);
                }
            } catch (error) {
                console.error("Error fetching reviews:", error);
            } finally {
                setIsLoadingReviews(false);
            }
        };

        fetchReviews();
    }, []);

    // Filter sales with photos and sort by most recent
    const salesWithPhotos = useMemo(() => {
        return salesData
            .filter((sale) => sale.photoUrls && sale.photoUrls.length > 0)
            .sort((a, b) => {
                // Sort by date first, then by submission time
                const dateA = new Date(
                    a.fechaSinHora +
                        " " +
                        (a.submissionTime?.split(" ")[1] || "00:00:00"),
                );
                const dateB = new Date(
                    b.fechaSinHora +
                        " " +
                        (b.submissionTime?.split(" ")[1] || "00:00:00"),
                );
                return dateB.getTime() - dateA.getTime();
            });
    }, [salesData]);

    // Get unique sellers from sales with photos
    const sellers = useMemo(() => {
        const sellerMap = new Map<
            string,
            { email: string; name: string; count: number }
        >();
        salesWithPhotos.forEach((sale) => {
            const existing = sellerMap.get(sale.email);
            if (existing) {
                existing.count++;
            } else {
                sellerMap.set(sale.email, {
                    email: sale.email,
                    name:
                        EMAIL_TO_VENDOR_LABELS[sale.email] ||
                        sale.email.split("@")[0],
                    count: 1,
                });
            }
        });
        return Array.from(sellerMap.values()).sort((a, b) => b.count - a.count);
    }, [salesWithPhotos]);

    // Apply seller filter and review filter
    const filteredSales = useMemo(() => {
        let result = salesWithPhotos;

        if (selectedSeller) {
            result = result.filter((sale) => sale.email === selectedSeller);
        }

        if (showOnlyUnreviewed) {
            result = result.filter((sale) => !reviews.has(getSaleId(sale)));
        }

        return result;
    }, [salesWithPhotos, selectedSeller, showOnlyUnreviewed, reviews]);

    // Get visible sales based on pagination
    const visibleSales = useMemo(() => {
        return filteredSales.slice(0, visibleCount);
    }, [filteredSales, visibleCount]);

    // Group sales by time period
    const groupedSales = useMemo((): GroupedSales[] => {
        const groups: Map<string, FeedSale[]> = new Map();

        visibleSales.forEach((sale) => {
            const label = getTimeLabel(sale.fechaSinHora);
            const existing = groups.get(label) || [];
            existing.push(sale);
            groups.set(label, existing);
        });

        // Convert to array maintaining order
        const result: GroupedSales[] = [];
        const seenLabels = new Set<string>();

        visibleSales.forEach((sale) => {
            const label = getTimeLabel(sale.fechaSinHora);
            if (!seenLabels.has(label)) {
                seenLabels.add(label);
                result.push({
                    label,
                    sales: groups.get(label) || [],
                });
            }
        });

        return result;
    }, [visibleSales]);

    // Count unreviewed sales
    const unreviewedCount = useMemo(() => {
        return salesWithPhotos.filter((sale) => !reviews.has(getSaleId(sale)))
            .length;
    }, [salesWithPhotos, reviews]);

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

    // Open lightbox
    const handlePostClick = useCallback(
        (sale: FeedSale, photoIndex: number = 0) => {
            setLightboxSale(sale);
            setLightboxPhotoIndex(photoIndex);
        },
        [],
    );

    // Mark as reviewed
    const handleMarkReviewed = useCallback(
        async (note?: string) => {
            if (!lightboxSale || !session?.user?.email) return;

            setIsSubmittingReview(true);
            try {
                const saleId = getSaleId(lightboxSale);
                const response = await fetch("/api/feed-reviews", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        saleId,
                        reviewedBy: session.user.email,
                        note: note || "",
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    setReviews((prev) => {
                        const newMap = new Map(prev);
                        newMap.set(saleId, data.review);
                        return newMap;
                    });
                }
            } catch (error) {
                console.error("Error saving review:", error);
            } finally {
                setIsSubmittingReview(false);
            }
        },
        [lightboxSale, session?.user?.email],
    );

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
        <>
            <div className="space-y-4 max-w-2xl mx-auto">
                {/* Filter Bar */}
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <button
                                onClick={() =>
                                    setIsSellerFilterOpen(!isSellerFilterOpen)
                                }
                                className={`flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg w-full text-sm font-medium border transition-colors ${
                                    selectedSeller
                                        ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                                        : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Filter className="w-4 h-4" />
                                    <span>
                                        {selectedSellerName ||
                                            "Todos los vendedores"}
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
                                            onClick={() =>
                                                handleSelectSeller(seller.email)
                                            }
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

                    {/* Stats summary and review filter */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
                        <span>
                            <strong className="text-gray-700">
                                {filteredSales.length}
                            </strong>{" "}
                            {filteredSales.length === 1 ? "venta" : "ventas"}{" "}
                            con fotos
                        </span>
                        <span>
                            <strong className="text-gray-700">
                                {filteredSales.reduce(
                                    (sum, s) => sum + s.photoUrls.length,
                                    0,
                                )}
                            </strong>{" "}
                            fotos totales
                        </span>

                        {/* Review filter toggle */}
                        <button
                            onClick={() =>
                                setShowOnlyUnreviewed(!showOnlyUnreviewed)
                            }
                            className={`ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors ${
                                showOnlyUnreviewed
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                                {showOnlyUnreviewed
                                    ? "Solo sin revisar"
                                    : `${unreviewedCount} sin revisar`}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Grouped Feed Posts */}
                {groupedSales.map((group) => (
                    <div key={group.label} className="space-y-4">
                        {/* Time Group Header */}
                        <div className="flex items-center gap-3 px-1">
                            <div className="h-px flex-1 bg-gray-200" />
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                {group.label}
                            </span>
                            <div className="h-px flex-1 bg-gray-200" />
                        </div>

                        {/* Posts in this group */}
                        {group.sales.map((sale, index) => {
                            const saleId = getSaleId(sale);
                            const isReviewed = reviews.has(saleId);

                            return (
                                <div
                                    key={`${saleId}-${index}`}
                                    className="relative"
                                >
                                    {isReviewed && (
                                        <div className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-1 bg-green-500 text-white text-xs font-medium rounded-full">
                                            <CheckCircle2 className="w-3 h-3" />
                                            <span>Revisado</span>
                                        </div>
                                    )}
                                    <FeedPost
                                        sale={sale}
                                        onPostClick={(s) =>
                                            handlePostClick(s, 0)
                                        }
                                        getDisplayableImageUrl={
                                            getDisplayableImageUrl
                                        }
                                        formatCurrency={formatCurrency}
                                    />
                                </div>
                            );
                        })}
                    </div>
                ))}

                {/* Load More Button */}
                {hasMoreSales && (
                    <div className="flex justify-center pt-4 pb-8">
                        <button
                            onClick={handleLoadMore}
                            className="px-6 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
                        >
                            Ver mas ({filteredSales.length - visibleCount}{" "}
                            restantes)
                        </button>
                    </div>
                )}

                {/* End of feed message */}
                {!hasMoreSales && visibleSales.length > 0 && (
                    <div className="text-center py-8 text-sm text-gray-400">
                        Has llegado al final del feed
                    </div>
                )}

                {/* Empty state when filtering */}
                {visibleSales.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <p className="text-lg font-medium">No hay resultados</p>
                        <p className="text-sm mt-1">
                            {showOnlyUnreviewed
                                ? "Todas las ventas han sido revisadas"
                                : "No hay ventas que coincidan con el filtro"}
                        </p>
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {lightboxSale && (
                <FeedLightbox
                    sale={lightboxSale}
                    initialPhotoIndex={lightboxPhotoIndex}
                    onClose={() => setLightboxSale(null)}
                    getDisplayableImageUrl={getDisplayableImageUrl}
                    formatCurrency={formatCurrency}
                    review={reviews.get(getSaleId(lightboxSale)) || null}
                    onMarkReviewed={handleMarkReviewed}
                    isSubmittingReview={isSubmittingReview}
                />
            )}
        </>
    );
}
