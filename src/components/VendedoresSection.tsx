"use client";

import {
  AlertTriangle,
  Award,
  BarChart3,
  Calendar,
  Download,
  Filter,
  Map,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { debounce, getCurrentYearDateRange } from "@/utils/dateUtils";
import ChurnRiskReport from "./ChurnRiskReport";
import SalesVelocityReport from "./SalesVelocityReport";
import SellerComparisonReport from "./SellerComparisonReport";
import SellerPerformanceReport from "./SellerPerformanceReport";
import SingleSellerReport from "./SingleSellerReport";
import TerritoryAnalysisReport from "./TerritoryAnalysisReport";
import SellerSkeleton from "./ui/SellerSkeleton";

interface BestClient {
  clientName: string;
  totalSales: number;
  visitCount: number;
  avgTicket: number;
  lastVisit: string;
  loyaltyScore: number;
}

interface ProductDistribution {
  product: string;
  quantity: number;
  percentage: number;
  salesCount: number;
}

interface MonthlyTrend {
  month: string;
  sales: number;
  visits: number;
}

interface Seller {
  vendedor: string;
  rank: number;
  totalSales: number;
  totalVisits: number;
  uniqueClients: number;
  avgTicket: number;
  bestClients: BestClient[];
  productDistribution: ProductDistribution[];
  monthlyTrends: MonthlyTrend[];
  territoryAnalysis: {
    coverage: {
      totalArea: number;
      clientDensity: number;
      avgDistance: number;
    };
    boundaries: {
      north: number;
      south: number;
      east: number;
      west: number;
    };
    efficiency: {
      coverageScore: number;
      description: string;
    };
  };
  salesVelocity: {
    avgTimeBetweenVisits: number;
    avgTimeToDeal: number;
    visitFrequency: number;
    velocityScore: number;
    peakAnalysis: {
      bestSalesDay: string;
      bestSalesDayAmount: number;
      bestVisitsDay: string;
      bestVisitsDayCount: number;
    };
  };
  retentionAnalysis: {
    loyaltyScore: number;
    churnRisk: number;
    clientSegments: {
      champions: number;
      loyalists: number;
      atRisk: number;
      newClients: number;
    };
    retentionRate: number;
    avgClientLifetime: number;
  };
}

export interface VendedoresAnalyticsData {
  sellers: Seller[];
  totalSellers: number;
  topSellerName: string;
  topSellerSales: number;
}

interface VendedoresSectionProps {
  sellerAnalyticsData: VendedoresAnalyticsData | null;
  isLoadingSellerAnalytics: boolean;
  selectedSeller: string;
  setSelectedSeller: (seller: string) => void;
  exportSellerData: (
    type: "leaderboard" | "clients" | "products",
    vendedor?: string,
  ) => void;
  formatCurrency: (amount: number) => string;
  onRefetchData: (dateFrom?: string, dateTo?: string) => void;
  onSelectClient?: (clientName: string) => void;
}

export default function VendedoresSection({
  sellerAnalyticsData,
  isLoadingSellerAnalytics,
  selectedSeller,
  setSelectedSeller,
  exportSellerData,
  formatCurrency,
  onRefetchData,
  onSelectClient,
}: VendedoresSectionProps) {
  const [activeReport, setActiveReport] = useState<
    | "ranking"
    | "performance"
    | "territory"
    | "churn"
    | "velocity"
    | "comparison"
  >("ranking");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  const filteredSellers = sellerAnalyticsData?.sellers ?? [];

  // Create debounced refetch function
  const debouncedRefetch = useRef(
    debounce((from: string, to: string) => {
      onRefetchData(from, to);
    }, 500),
  ).current;

  // Refetch data when date filters change (with debounce)
  useEffect(() => {
    if (dateFrom || dateTo) {
      debouncedRefetch(dateFrom, dateTo);
    }
  }, [dateFrom, dateTo, debouncedRefetch]);

  const selectedSellerData = useMemo(() => {
    if (!selectedSeller) return null;
    return (
      filteredSellers.find((seller) => seller.vendedor === selectedSeller) ??
      null
    );
  }, [filteredSellers, selectedSeller]);

  const isSingleSellerView = Boolean(selectedSellerData);

  useEffect(() => {
    if (!selectedSeller) return;
    if (!selectedSellerData) {
      setSelectedSeller("");
    }
  }, [selectedSeller, selectedSellerData, setSelectedSeller]);

  // Get current year for default date range using utility
  const { dateFrom: defaultDateFrom, dateTo: defaultDateTo } =
    getCurrentYearDateRange();

  return (
    <div className="space-y-3">
      {/* Report Navigation */}
      <div className="bg-white rounded-lg p-3 border border-[#E2E4E9]">
        <div className="flex overflow-x-auto gap-1">
          <button
            onClick={() => setActiveReport("ranking")}
            className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap ${
              activeReport === "ranking"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            <Award className="w-4 h-4 mr-2" />
            Ranking
          </button>
          <button
            onClick={() => setActiveReport("performance")}
            className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap ${
              activeReport === "performance"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Rendimiento
          </button>
          <button
            onClick={() => setActiveReport("territory")}
            className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap ${
              activeReport === "territory"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            <Map className="w-4 h-4 mr-2" />
            Territorios
          </button>
          <button
            onClick={() => setActiveReport("churn")}
            className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap ${
              activeReport === "churn"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Riesgo Pérdida
          </button>
          <button
            onClick={() => setActiveReport("velocity")}
            className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap ${
              activeReport === "velocity"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            <Zap className="w-4 h-4 mr-2" />
            Velocidad
          </button>
          <button
            onClick={() => setActiveReport("comparison")}
            className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap ${
              activeReport === "comparison"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Comparativa
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-3 border border-[#E2E4E9]">
        {/* Filter Header (always visible on mobile) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filtros</span>
            {(selectedSeller || dateFrom || dateTo) && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                {[selectedSeller, dateFrom || dateTo].filter(Boolean).length}
              </span>
            )}
          </div>
          <button
            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
            className="md:hidden text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            {isFiltersExpanded ? "Ocultar" : "Mostrar"}
          </button>
        </div>

        {/* Filter Content (collapsible on mobile, always visible on desktop) */}
        <div className={`${isFiltersExpanded ? "block" : "hidden"} md:block`}>
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center mt-3 md:mt-3">
            {/* Seller Filter */}
            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 w-full md:w-auto">
              <label className="text-xs md:text-sm text-gray-600">
                Vendedor:
              </label>
              <select
                value={selectedSeller || "all"}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedSeller(value === "all" ? "" : value);
                }}
                className="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-auto"
              >
                <option value="all">Todos los vendedores</option>
                {sellerAnalyticsData?.sellers?.map((seller) => (
                  <option key={seller.vendedor} value={seller.vendedor}>
                    {seller.vendedor}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Filter */}
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-xs text-gray-600">Rango de fechas:</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600 w-12 flex-shrink-0">
                    Desde:
                  </label>
                  <input
                    type="date"
                    value={dateFrom || defaultDateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600 w-12 flex-shrink-0">
                    Hasta:
                  </label>
                  <input
                    type="date"
                    value={dateTo || defaultDateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Reset Filters */}
            <button
              onClick={() => {
                setSelectedSeller("");
                setDateFrom("");
                setDateTo("");
                // Refetch with no date filters (defaults to current year)
                onRefetchData();
              }}
              className="text-xs text-gray-500 hover:text-gray-700 underline mt-2 md:mt-0 self-start md:self-auto"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* Filter Summary */}
        {(selectedSeller || dateFrom || dateTo) && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="flex flex-wrap gap-2 text-xs">
              {selectedSeller && (
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Vendedor: {selectedSeller}
                </span>
              )}
              {(dateFrom || dateTo) && (
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                  Período: {dateFrom || defaultDateFrom} al{" "}
                  {dateTo || defaultDateTo}
                </span>
              )}
              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">
                {filteredSellers.length} vendedor
                {filteredSellers.length !== 1 ? "es" : ""} disponible
                {filteredSellers.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Report Content */}
      {isSingleSellerView ? (
        <div className="space-y-3">
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9] flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedSeller("")}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                ← Volver al resumen
              </button>
              <span className="text-xs text-gray-500">
                Visualizando detalle de {selectedSellerData?.vendedor}
              </span>
            </div>
            {selectedSellerData && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    exportSellerData("clients", selectedSellerData.vendedor)
                  }
                  className="text-xs border border-gray-300 rounded px-3 py-2 bg-white hover:bg-gray-50 flex items-center"
                >
                  <Download className="w-3 h-3 mr-2" />
                  Exportar clientes
                </button>
                <button
                  onClick={() =>
                    exportSellerData("products", selectedSellerData.vendedor)
                  }
                  className="text-xs border border-gray-300 rounded px-3 py-2 bg-white hover:bg-gray-50 flex items-center"
                >
                  <Download className="w-3 h-3 mr-2" />
                  Exportar productos
                </button>
              </div>
            )}
          </div>

          {selectedSellerData && (
            <SingleSellerReport
              seller={selectedSellerData as any}
              formatCurrency={formatCurrency}
              dateFrom={dateFrom || defaultDateFrom}
              dateTo={dateTo || defaultDateTo}
              onSelectClient={onSelectClient}
            />
          )}
        </div>
      ) : activeReport === "ranking" ? (
        <div>
          {/* Seller Leaderboard */}
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700 flex items-center text-sm">
                <Award className="mr-2 h-4 w-4" /> Ranking de Vendedores
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => exportSellerData("leaderboard")}
                  className="text-xs border border-gray-300 rounded px-2 py-1 bg-white hover:bg-gray-50 flex items-center"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Exportar
                </button>
                <p className="text-xs text-gray-500">Año actual</p>
              </div>
            </div>
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
              <div className="space-y-2 min-w-[500px] md:min-w-0">
                {isLoadingSellerAnalytics ? (
                  <SellerSkeleton />
                ) : filteredSellers && filteredSellers.length > 0 ? (
                  filteredSellers.map((seller) => (
                    <div
                      key={seller.vendedor}
                      className={`flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0 cursor-pointer rounded px-2 ${
                        selectedSeller === seller.vendedor
                          ? "bg-blue-50 border border-blue-200"
                          : "hover:bg-gray-50"
                      }`}
                      onClick={() =>
                        setSelectedSeller(
                          selectedSeller === seller.vendedor
                            ? ""
                            : seller.vendedor,
                        )
                      }
                    >
                      <div className="flex items-center min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-3 ${
                            seller.rank === 1
                              ? "bg-yellow-100 text-yellow-800"
                              : seller.rank === 2
                                ? "bg-gray-100 text-gray-800"
                                : seller.rank === 3
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {seller.rank}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-gray-800">
                            {seller.vendedor}
                          </p>
                          <div className="flex items-center space-x-3 text-xs text-gray-500">
                            <span>{seller.uniqueClients} clientes</span>
                            <span>•</span>
                            <span>{seller.totalVisits} visitas</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm text-green-600">
                          {formatCurrency(seller.totalSales)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Promedio: {formatCurrency(seller.avgTicket)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500">
                      No hay datos de vendedores disponibles
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : activeReport === "performance" ? (
        filteredSellers.length > 0 ? (
          <SellerPerformanceReport
            sellers={filteredSellers as any}
            formatCurrency={formatCurrency}
          />
        ) : (
          <div className="bg-white rounded-lg p-8 border border-[#E2E4E9] text-center">
            <p className="text-gray-500">
              No hay datos de vendedores disponibles
            </p>
          </div>
        )
      ) : activeReport === "territory" ? (
        filteredSellers.length > 0 ? (
          <TerritoryAnalysisReport
            sellers={filteredSellers as any}
            formatCurrency={formatCurrency}
          />
        ) : (
          <div className="bg-white rounded-lg p-8 border border-[#E2E4E9] text-center">
            <p className="text-gray-500">
              No hay datos de vendedores disponibles
            </p>
          </div>
        )
      ) : activeReport === "churn" ? (
        filteredSellers.length > 0 ? (
          <ChurnRiskReport
            sellers={filteredSellers as any}
            formatCurrency={formatCurrency}
          />
        ) : (
          <div className="bg-white rounded-lg p-8 border border-[#E2E4E9] text-center">
            <p className="text-gray-500">
              No hay datos de vendedores disponibles
            </p>
          </div>
        )
      ) : activeReport === "velocity" ? (
        filteredSellers.length > 0 ? (
          <SalesVelocityReport
            sellers={filteredSellers as any}
            formatCurrency={formatCurrency}
          />
        ) : (
          <div className="bg-white rounded-lg p-8 border border-[#E2E4E9] text-center">
            <p className="text-gray-500">
              No hay datos de vendedores disponibles
            </p>
          </div>
        )
      ) : activeReport === "comparison" ? (
        filteredSellers.length > 0 ? (
          <SellerComparisonReport
            sellers={filteredSellers as any}
            formatCurrency={formatCurrency}
          />
        ) : (
          <div className="bg-white rounded-lg p-8 border border-[#E2E4E9] text-center">
            <p className="text-gray-500">
              No hay datos de vendedores disponibles
            </p>
          </div>
        )
      ) : null}
    </div>
  );
}
