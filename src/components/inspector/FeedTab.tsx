"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
    ChevronDown,
    Camera,
    X,
    CheckCircle2,
    Search,
    Calendar,
    User,
    SlidersHorizontal,
} from "lucide-react";
import FeedPost, { FeedSale } from "./FeedPost";
import FeedLightbox from "./FeedLightbox";
import { EMAIL_TO_VENDOR_LABELS } from "@/utils/auth";
import { useSession } from "next-auth/react";
import { getAllPeriods, getPeriodDateRange } from "@/utils/dateUtils";

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

type ActiveFilter = "none" | "seller" | "client" | "date" | "period";

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

    const diffTime = todayOnly.getTime() - saleDateOnly.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Hoy";
    if (diffDays === 1) return "Ayer";
    if (diffDays <= 7) return "Esta semana";
    if (diffDays <= 14) return "Semana pasada";
    if (diffDays <= 30) return "Este mes";

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

    // Filter states
    const [selectedSeller, setSelectedSeller] = useState<string | null>(null);
    const [clientSearch, setClientSearch] = useState("");
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
    const [showOnlyUnreviewed, setShowOnlyUnreviewed] = useState(false);
    const [activeFilter, setActiveFilter] = useState<ActiveFilter>("none");

    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

    // Lightbox state
    const [lightboxSale, setLightboxSale] = useState<FeedSale | null>(null);
    const [lightboxPhotoIndex, setLightboxPhotoIndex] = useState(0);

    // Reviews state
    const [reviews, setReviews] = useState<Map<string, FeedReview>>(new Map());
    const [isLoadingReviews, setIsLoadingReviews] = useState(true);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);

    // Get available periods
    const availablePeriods = useMemo(() => getAllPeriods().reverse(), []);

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

    // Get unique sellers
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

    // Get unique clients for search suggestions
    const clientSuggestions = useMemo(() => {
        if (clientSearch.length < 2) return [];
        const search = clientSearch.toLowerCase();
        const seen = new Set<string>();
        return salesWithPhotos
            .filter((sale) => {
                const name = sale.clientName.toLowerCase();
                if (seen.has(name) || !name.includes(search)) return false;
                seen.add(name);
                return true;
            })
            .slice(0, 5)
            .map((s) => s.clientName);
    }, [salesWithPhotos, clientSearch]);

    // Get unique dates available
    const availableDates = useMemo(() => {
        const dates = new Set<string>();
        salesWithPhotos.forEach((sale) => {
            dates.add(sale.fechaSinHora);
        });
        return Array.from(dates)
            .sort((a, b) => b.localeCompare(a))
            .slice(0, 14);
    }, [salesWithPhotos]);

    // Apply all filters
    const filteredSales = useMemo(() => {
        let result = salesWithPhotos;

        if (selectedSeller) {
            result = result.filter((sale) => sale.email === selectedSeller);
        }

        if (clientSearch.trim()) {
            const search = clientSearch.toLowerCase().trim();
            result = result.filter((sale) =>
                sale.clientName.toLowerCase().includes(search),
            );
        }

        if (selectedDate) {
            result = result.filter(
                (sale) => sale.fechaSinHora === selectedDate,
            );
        }

        if (selectedPeriod) {
            const { periodStartDate, periodEndDate } =
                getPeriodDateRange(selectedPeriod);
            result = result.filter((sale) => {
                const saleDate = new Date(sale.fechaSinHora);
                return saleDate >= periodStartDate && saleDate <= periodEndDate;
            });
        }

        if (showOnlyUnreviewed) {
            result = result.filter((sale) => !reviews.has(getSaleId(sale)));
        }

        return result;
    }, [
        salesWithPhotos,
        selectedSeller,
        clientSearch,
        selectedDate,
        selectedPeriod,
        showOnlyUnreviewed,
        reviews,
    ]);

    // Get visible sales
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

        const result: GroupedSales[] = [];
        const seenLabels = new Set<string>();
        visibleSales.forEach((sale) => {
            const label = getTimeLabel(sale.fechaSinHora);
            if (!seenLabels.has(label)) {
                seenLabels.add(label);
                result.push({ label, sales: groups.get(label) || [] });
            }
        });
        return result;
    }, [visibleSales]);

    // Count active filters
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (selectedSeller) count++;
        if (clientSearch.trim()) count++;
        if (selectedDate) count++;
        if (selectedPeriod) count++;
        return count;
    }, [selectedSeller, clientSearch, selectedDate, selectedPeriod]);

    // Count unreviewed
    const unreviewedCount = useMemo(() => {
        return salesWithPhotos.filter((sale) => !reviews.has(getSaleId(sale)))
            .length;
    }, [salesWithPhotos, reviews]);

    const hasMoreSales = visibleCount < filteredSales.length;

    const handleLoadMore = () => {
        setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
    };

    const clearAllFilters = () => {
        setSelectedSeller(null);
        setClientSearch("");
        setSelectedDate(null);
        setSelectedPeriod(null);
        setActiveFilter("none");
        setVisibleCount(ITEMS_PER_PAGE);
    };

    const handleFilterSelect = (filter: ActiveFilter) => {
        setActiveFilter(activeFilter === filter ? "none" : filter);
    };

    // Reset pagination when filters change
    useEffect(() => {
        setVisibleCount(ITEMS_PER_PAGE);
    }, [
        selectedSeller,
        clientSearch,
        selectedDate,
        selectedPeriod,
        showOnlyUnreviewed,
    ]);

    const handlePostClick = useCallback((sale: FeedSale) => {
        setLightboxSale(sale);
        setLightboxPhotoIndex(0);
    }, []);

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
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* Filter Chips Row */}
                    <div className="p-3 flex items-center gap-2 overflow-x-auto">
                        {/* Seller Filter */}
                        <button
                            onClick={() => handleFilterSelect("seller")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                                selectedSeller
                                    ? "bg-blue-100 text-blue-700"
                                    : activeFilter === "seller"
                                      ? "bg-gray-200 text-gray-800"
                                      : "bg-gray-100 text-gray-600"
                            }`}
                        >
                            <User className="w-3.5 h-3.5" />
                            <span>{selectedSellerName || "Vendedor"}</span>
                            {selectedSeller && (
                                <X
                                    className="w-3.5 h-3.5 ml-0.5"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedSeller(null);
                                    }}
                                />
                            )}
                        </button>

                        {/* Client Search */}
                        <button
                            onClick={() => handleFilterSelect("client")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                                clientSearch.trim()
                                    ? "bg-blue-100 text-blue-700"
                                    : activeFilter === "client"
                                      ? "bg-gray-200 text-gray-800"
                                      : "bg-gray-100 text-gray-600"
                            }`}
                        >
                            <Search className="w-3.5 h-3.5" />
                            <span>{clientSearch.trim() || "Cliente"}</span>
                            {clientSearch.trim() && (
                                <X
                                    className="w-3.5 h-3.5 ml-0.5"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setClientSearch("");
                                    }}
                                />
                            )}
                        </button>

                        {/* Date Filter */}
                        <button
                            onClick={() => handleFilterSelect("date")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                                selectedDate
                                    ? "bg-blue-100 text-blue-700"
                                    : activeFilter === "date"
                                      ? "bg-gray-200 text-gray-800"
                                      : "bg-gray-100 text-gray-600"
                            }`}
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>
                                {selectedDate
                                    ? new Date(selectedDate).toLocaleDateString(
                                          "es-ES",
                                          {
                                              day: "numeric",
                                              month: "short",
                                          },
                                      )
                                    : "Fecha"}
                            </span>
                            {selectedDate && (
                                <X
                                    className="w-3.5 h-3.5 ml-0.5"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedDate(null);
                                    }}
                                />
                            )}
                        </button>

                        {/* Period Filter */}
                        <button
                            onClick={() => handleFilterSelect("period")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                                selectedPeriod
                                    ? "bg-blue-100 text-blue-700"
                                    : activeFilter === "period"
                                      ? "bg-gray-200 text-gray-800"
                                      : "bg-gray-100 text-gray-600"
                            }`}
                        >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            <span>
                                {selectedPeriod
                                    ? `P${selectedPeriod}`
                                    : "Periodo"}
                            </span>
                            {selectedPeriod && (
                                <X
                                    className="w-3.5 h-3.5 ml-0.5"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedPeriod(null);
                                    }}
                                />
                            )}
                        </button>

                        {/* Clear all */}
                        {activeFilterCount > 0 && (
                            <button
                                onClick={clearAllFilters}
                                className="flex items-center gap-1 px-2 py-1.5 text-xs text-red-600 hover:text-red-700 whitespace-nowrap"
                            >
                                <X className="w-3 h-3" />
                                Limpiar
                            </button>
                        )}
                    </div>

                    {/* Expandable Filter Panels */}
                    {activeFilter === "seller" && (
                        <div className="border-t border-gray-100 p-3 max-h-48 overflow-y-auto">
                            <div className="space-y-1">
                                <button
                                    onClick={() => {
                                        setSelectedSeller(null);
                                        setActiveFilter("none");
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                        !selectedSeller
                                            ? "bg-blue-50 text-blue-700"
                                            : "hover:bg-gray-50"
                                    }`}
                                >
                                    Todos los vendedores
                                </button>
                                {sellers.map((seller) => (
                                    <button
                                        key={seller.email}
                                        onClick={() => {
                                            setSelectedSeller(seller.email);
                                            setActiveFilter("none");
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between items-center transition-colors ${
                                            selectedSeller === seller.email
                                                ? "bg-blue-50 text-blue-700"
                                                : "hover:bg-gray-50"
                                        }`}
                                    >
                                        <span>{seller.name}</span>
                                        <span className="text-xs text-gray-400">
                                            {seller.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeFilter === "client" && (
                        <div className="border-t border-gray-100 p-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={clientSearch}
                                    onChange={(e) =>
                                        setClientSearch(e.target.value)
                                    }
                                    placeholder="Buscar cliente..."
                                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    autoFocus
                                />
                            </div>
                            {clientSuggestions.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {clientSuggestions.map((name) => (
                                        <button
                                            key={name}
                                            onClick={() => {
                                                setClientSearch(name);
                                                setActiveFilter("none");
                                            }}
                                            className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                                        >
                                            {name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeFilter === "date" && (
                        <div className="border-t border-gray-100 p-3 max-h-48 overflow-y-auto">
                            <div className="space-y-1">
                                <button
                                    onClick={() => {
                                        setSelectedDate(null);
                                        setActiveFilter("none");
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                        !selectedDate
                                            ? "bg-blue-50 text-blue-700"
                                            : "hover:bg-gray-50"
                                    }`}
                                >
                                    Todas las fechas
                                </button>
                                {availableDates.map((date) => (
                                    <button
                                        key={date}
                                        onClick={() => {
                                            setSelectedDate(date);
                                            setActiveFilter("none");
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                            selectedDate === date
                                                ? "bg-blue-50 text-blue-700"
                                                : "hover:bg-gray-50"
                                        }`}
                                    >
                                        {new Date(date).toLocaleDateString(
                                            "es-ES",
                                            {
                                                weekday: "short",
                                                day: "numeric",
                                                month: "short",
                                            },
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeFilter === "period" && (
                        <div className="border-t border-gray-100 p-3 max-h-48 overflow-y-auto">
                            <div className="space-y-1">
                                <button
                                    onClick={() => {
                                        setSelectedPeriod(null);
                                        setActiveFilter("none");
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                        !selectedPeriod
                                            ? "bg-blue-50 text-blue-700"
                                            : "hover:bg-gray-50"
                                    }`}
                                >
                                    Todos los periodos
                                </button>
                                {availablePeriods.map((period) => (
                                    <button
                                        key={period.periodNumber}
                                        onClick={() => {
                                            setSelectedPeriod(
                                                period.periodNumber,
                                            );
                                            setActiveFilter("none");
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between items-center transition-colors ${
                                            selectedPeriod ===
                                            period.periodNumber
                                                ? "bg-blue-50 text-blue-700"
                                                : "hover:bg-gray-50"
                                        }`}
                                    >
                                        <span>
                                            Periodo {period.periodNumber}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {period.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Stats Row */}
                    <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                        <span>
                            <strong className="text-gray-700">
                                {filteredSales.length}
                            </strong>{" "}
                            ventas
                        </span>
                        <button
                            onClick={() =>
                                setShowOnlyUnreviewed(!showOnlyUnreviewed)
                            }
                            className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                                showOnlyUnreviewed
                                    ? "bg-amber-100 text-amber-700"
                                    : "hover:bg-gray-200"
                            }`}
                        >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>
                                {showOnlyUnreviewed
                                    ? "Sin revisar"
                                    : `${unreviewedCount} sin revisar`}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Grouped Feed Posts */}
                {groupedSales.map((group) => (
                    <div key={group.label} className="space-y-4">
                        <div className="flex items-center gap-3 px-1">
                            <div className="h-px flex-1 bg-gray-200" />
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                {group.label}
                            </span>
                            <div className="h-px flex-1 bg-gray-200" />
                        </div>

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
                                        onPostClick={handlePostClick}
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

                {/* Load More */}
                {hasMoreSales && (
                    <div className="flex justify-center pt-4 pb-8">
                        <button
                            onClick={handleLoadMore}
                            className="px-6 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                        >
                            Ver mas ({filteredSales.length - visibleCount}{" "}
                            restantes)
                        </button>
                    </div>
                )}

                {/* End of feed */}
                {!hasMoreSales && visibleSales.length > 0 && (
                    <div className="text-center py-8 text-sm text-gray-400">
                        Has llegado al final del feed
                    </div>
                )}

                {/* Empty state */}
                {visibleSales.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <p className="text-lg font-medium">No hay resultados</p>
                        <p className="text-sm mt-1">
                            {activeFilterCount > 0
                                ? "Intenta con otros filtros"
                                : showOnlyUnreviewed
                                  ? "Todas las ventas han sido revisadas"
                                  : "No hay ventas que mostrar"}
                        </p>
                        {activeFilterCount > 0 && (
                            <button
                                onClick={clearAllFilters}
                                className="mt-3 text-blue-600 text-sm hover:underline"
                            >
                                Limpiar filtros
                            </button>
                        )}
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
