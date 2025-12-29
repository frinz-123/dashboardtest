"use client";

import { useMemo, useState } from "react";
import {
  User,
  Calendar,
  MapPin,
  Target,
  TrendingUp,
  Users,
  AlertTriangle,
  Zap,
  Package,
} from "lucide-react";

interface SingleSellerData {
  vendedor: string;
  rank: number;
  totalSales: number;
  totalVisits: number;
  uniqueClients: number;
  avgTicket: number;
  monthlyTrends?: Array<{
    month: string;
    sales: number;
    visits: number;
  }>;
  bestClients: Array<{
    clientName: string;
    totalSales: number;
    visitCount: number;
    avgTicket: number;
  }>;
  productDistribution: Array<{
    product: string;
    quantity: number;
    percentage: number;
  }>;
  salesVelocity: {
    velocityScore: number;
    avgTimeBetweenVisits: number;
    visitFrequency: number;
    monthlyVelocity: Array<{
      month: string;
      salesChange: number;
      visitsChange: number;
    }>;
    peakAnalysis: {
      bestSalesDay: string;
      bestSalesDayAmount: number;
      bestVisitsDay: string;
      bestVisitsDayCount: number;
      dayPerformance: Record<string, any>;
    };
  };
  retentionAnalysis: {
    totalClients: number;
    avgCustomerLifetime: number;
    avgLoyaltyScore: number;
    retentionRate: number;
    loyaltySegments: {
      champions: number;
      loyalCustomers: number;
      potentialLoyalists: number;
      atRisk: number;
      newCustomers: number;
    };
    churnRiskClients: Array<{
      clientName: string;
      daysSinceLastVisit: number;
      churnRisk: string;
      customerValue: number;
      lastVisit: string;
    }>;
  };
  territoryAnalysis: {
    totalClients: number;
    territoryArea: number;
    clientDensity: number;
    avgDistanceBetweenClients: number;
    coverageScore: number;
  };
}

interface SingleSellerReportProps {
  seller: SingleSellerData;
  formatCurrency: (amount: number) => string;
  dateFrom?: string;
  dateTo?: string;
  onSelectClient?: (clientName: string) => void;
}

export default function SingleSellerReport({
  seller,
  formatCurrency,
  dateFrom,
  dateTo,
  onSelectClient,
}: SingleSellerReportProps) {
  const [activeSection, setActiveSection] = useState<
    "overview" | "clients" | "products" | "velocity" | "retention" | "territory"
  >("overview");
  const [expandedSegment, setExpandedSegment] = useState<string | null>(null);

  const periodLabel =
    dateFrom && dateTo ? `${dateFrom} al ${dateTo}` : "Año actual";

  const getWorkingDays = (year: number, monthNumber: number) => {
    if (Number.isNaN(year) || Number.isNaN(monthNumber)) return 30;
    const totalDays = new Date(year, monthNumber, 0).getDate();
    let workingDays = 0;
    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(year, monthNumber - 1, day);
      if (date.getDay() !== 0) {
        workingDays += 1;
      }
    }
    return workingDays;
  };

  const { averageVisitsPerDay, avgClientsPerMonth } = (() => {
    const trends = seller.monthlyTrends || [];
    if (trends.length === 0) {
      const assumedWorkingDays = 26;
      const avgVisits =
        seller.totalVisits > 0 ? seller.totalVisits / assumedWorkingDays : 0;
      return {
        averageVisitsPerDay: avgVisits.toFixed(1),
        avgClientsPerMonth: seller.uniqueClients.toFixed(1),
      };
    }

    const totals = trends.reduce(
      (acc, month) => {
        const visits = month.visits || 0;
        acc.visits += visits;

        const [year, monthNumber] = (month.month || "").split("-").map(Number);
        const workingDays = getWorkingDays(year, monthNumber);
        acc.days += workingDays;

        return acc;
      },
      { visits: 0, days: 0 },
    );

    const averagePerDay = totals.days > 0 ? totals.visits / totals.days : 0;
    const monthsTracked = trends.length;
    const averageClients =
      monthsTracked > 0
        ? seller.uniqueClients / monthsTracked
        : seller.uniqueClients;

    return {
      averageVisitsPerDay: averagePerDay.toFixed(1),
      avgClientsPerMonth: averageClients.toFixed(1),
    };
  })();

  const loyaltySegments = seller.retentionAnalysis?.loyaltySegments || {
    champions: 0,
    loyalCustomers: 0,
    potentialLoyalists: 0,
    atRisk: 0,
    newCustomers: 0,
  };

  const totalSegmentClients = useMemo(
    () =>
      Object.values(loyaltySegments).reduce(
        (sum, count) => sum + (count || 0),
        0,
      ),
    [loyaltySegments],
  );

  const segmentConfig = useMemo(
    () => [
      {
        key: "champions",
        label: "Campeones",
        value: loyaltySegments.champions,
        color: "bg-yellow-100 text-yellow-800",
        description:
          "Clientes con compras frecuentes y alto ticket. Mantén programas de reconocimiento e incentivos personalizados.",
      },
      {
        key: "loyalCustomers",
        label: "Leales",
        value: loyaltySegments.loyalCustomers,
        color: "bg-green-100 text-green-800",
        description:
          "Clientes constantes. Refuerza la relación con promociones exclusivas y seguimiento oportuno.",
      },
      {
        key: "potentialLoyalists",
        label: "Potenciales",
        value: loyaltySegments.potentialLoyalists,
        color: "bg-blue-100 text-blue-800",
        description:
          "Clientes con señales positivas. Ofréceles bundles o descuentos para convertirlos en leales.",
      },
      {
        key: "atRisk",
        label: "En Riesgo",
        value: loyaltySegments.atRisk,
        color: "bg-red-100 text-red-800",
        description:
          "Clientes con actividad decreciente. Contacta de inmediato y revisa su historial para ofrecer soluciones.",
      },
      {
        key: "newCustomers",
        label: "Nuevos",
        value: loyaltySegments.newCustomers,
        color: "bg-purple-100 text-purple-800",
        description:
          "Clientes recientes. Da seguimiento cercano durante las primeras semanas para asegurar recompra.",
      },
    ],
    [loyaltySegments],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <User className="w-8 h-8 mr-3" />
            <div>
              <h2 className="text-xl font-bold">{seller.vendedor}</h2>
              <p className="text-blue-100">Reporte Detallado • {periodLabel}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {formatCurrency(seller.totalSales)}
            </div>
            <p className="text-blue-100">Puesto #{seller.rank} en ranking</p>
          </div>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="bg-white rounded-lg p-3 border border-[#E2E4E9]">
        <div className="flex overflow-x-auto gap-1">
          {[
            { id: "overview", label: "Resumen", icon: Target },
            { id: "clients", label: "Clientes", icon: Users },
            { id: "products", label: "Productos", icon: Package },
            { id: "velocity", label: "Velocidad", icon: Zap },
            { id: "retention", label: "Retención", icon: AlertTriangle },
            { id: "territory", label: "Territorio", icon: MapPin },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id as any)}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap ${
                activeSection === id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeSection === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Ventas Totales</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(seller.totalSales)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Clientes Únicos</p>
                <p className="text-xl font-bold text-blue-600">
                  {seller.uniqueClients}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <div className="flex items-center">
              <Target className="w-8 h-8 text-purple-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Ticket Promedio</p>
                <p className="text-xl font-bold text-purple-600">
                  {formatCurrency(seller.avgTicket)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <div className="flex items-center">
              <Zap className="w-8 h-8 text-orange-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Velocidad</p>
                <p className="text-xl font-bold text-orange-600">
                  {seller.salesVelocity.velocityScore}/100
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-indigo-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Visitas promedio</p>
                <p className="text-xl font-bold text-indigo-600">
                  {averageVisitsPerDay}
                </p>
                <p className="text-xs text-gray-500">Visitas por día</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-teal-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Promedio clientes/mes</p>
                <p className="text-xl font-bold text-teal-600">
                  {avgClientsPerMonth}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === "clients" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Best Clients */}
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
              <Users className="mr-2 h-4 w-4" /> Mejores Clientes
            </h3>
            <div className="space-y-2">
              {seller.bestClients.slice(0, 10).map((client, index) => (
                <button
                  key={client.clientName}
                  type="button"
                  onClick={() => onSelectClient?.(client.clientName)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${
                          index === 0
                            ? "bg-yellow-100 text-yellow-800"
                            : index === 1
                              ? "bg-gray-100 text-gray-800"
                              : index === 2
                                ? "bg-orange-100 text-orange-800"
                                : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-800">
                          {client.clientName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {client.visitCount} visitas
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm text-green-600">
                        {formatCurrency(client.totalSales)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Promedio: {formatCurrency(client.avgTicket)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Client Segments */}
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
              <Target className="mr-2 h-4 w-4" /> Segmentos de Clientes
            </h3>
            <div className="space-y-3">
              {segmentConfig.map(
                ({ key, label, value, color, description }) => {
                  const percentage =
                    totalSegmentClients > 0
                      ? ((value / totalSegmentClients) * 100).toFixed(0)
                      : "0";
                  const isExpanded = expandedSegment === key;
                  return (
                    <div
                      key={key}
                      className="border border-gray-100 rounded-lg"
                    >
                      <button
                        type="button"
                        className="w-full px-3 py-2 flex items-center justify-between"
                        onClick={() =>
                          setExpandedSegment(isExpanded ? null : key)
                        }
                      >
                        <span className="text-sm text-gray-700">{label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            {percentage}%
                          </span>
                          <span
                            className={`px-2 py-1 rounded text-sm font-medium ${color}`}
                          >
                            {value}
                          </span>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 text-xs text-gray-600 space-y-2">
                          <p>{description}</p>
                          {key === "champions" &&
                            seller.retentionAnalysis.topLoyalClients?.length >
                              0 && (
                              <div>
                                <p className="font-medium text-gray-700 mb-1">
                                  Top clientes
                                </p>
                                <div className="space-y-1">
                                  {seller.retentionAnalysis.topLoyalClients
                                    .slice(0, 3)
                                    .map((client) => (
                                      <button
                                        key={client.clientName}
                                        type="button"
                                        onClick={() =>
                                          onSelectClient?.(client.clientName)
                                        }
                                        className="w-full text-left p-2 bg-gray-50 rounded hover:bg-gray-100"
                                      >
                                        <p className="text-sm text-gray-700">
                                          {client.clientName}
                                        </p>
                                        <p className="text-[11px] text-gray-500">
                                          {client.visitCount} visitas •{" "}
                                          {formatCurrency(client.customerValue)}
                                        </p>
                                      </button>
                                    ))}
                                </div>
                              </div>
                            )}
                          {key === "loyalCustomers" &&
                            seller.retentionAnalysis.loyalCustomersList
                              ?.length > 0 && (
                              <div>
                                <p className="font-medium text-gray-700 mb-1">
                                  Clientes leales
                                </p>
                                <div className="space-y-1">
                                  {seller.retentionAnalysis.loyalCustomersList
                                    .slice(0, 3)
                                    .map((client) => (
                                      <button
                                        key={client.clientName}
                                        type="button"
                                        onClick={() =>
                                          onSelectClient?.(client.clientName)
                                        }
                                        className="w-full text-left p-2 bg-green-50 rounded hover:bg-green-100"
                                      >
                                        <p className="text-sm text-gray-700">
                                          {client.clientName}
                                        </p>
                                        <p className="text-[11px] text-gray-500">
                                          Score {client.loyaltyScore} •{" "}
                                          {formatCurrency(client.customerValue)}
                                        </p>
                                      </button>
                                    ))}
                                </div>
                              </div>
                            )}
                          {key === "potentialLoyalists" &&
                            seller.retentionAnalysis.potentialLoyalistsList
                              ?.length > 0 && (
                              <div>
                                <p className="font-medium text-gray-700 mb-1">
                                  Convertir en leales
                                </p>
                                <div className="space-y-1">
                                  {seller.retentionAnalysis.potentialLoyalistsList
                                    .slice(0, 3)
                                    .map((client) => (
                                      <button
                                        key={client.clientName}
                                        type="button"
                                        onClick={() =>
                                          onSelectClient?.(client.clientName)
                                        }
                                        className="w-full text-left p-2 bg-blue-50 rounded hover:bg-blue-100"
                                      >
                                        <p className="text-sm text-gray-700">
                                          {client.clientName}
                                        </p>
                                        <p className="text-[11px] text-gray-500">
                                          Score {client.loyaltyScore} •{" "}
                                          {formatCurrency(client.customerValue)}
                                        </p>
                                      </button>
                                    ))}
                                </div>
                              </div>
                            )}
                          {key === "atRisk" &&
                            seller.retentionAnalysis.churnRiskClients?.length >
                              0 && (
                              <div>
                                <p className="font-medium text-gray-700 mb-1">
                                  Clientes a recuperar
                                </p>
                                <div className="space-y-1">
                                  {seller.retentionAnalysis.churnRiskClients
                                    .slice(0, 3)
                                    .map((client) => (
                                      <button
                                        key={client.clientName}
                                        type="button"
                                        onClick={() =>
                                          onSelectClient?.(client.clientName)
                                        }
                                        className="w-full text-left p-2 bg-red-50 rounded hover:bg-red-100"
                                      >
                                        <p className="text-sm text-gray-700">
                                          {client.clientName}
                                        </p>
                                        <p className="text-[11px] text-gray-500">
                                          {client.daysSinceLastVisit} días sin
                                          visita •{" "}
                                          {formatCurrency(client.customerValue)}
                                        </p>
                                      </button>
                                    ))}
                                </div>
                              </div>
                            )}
                          {key === "newCustomers" &&
                            seller.retentionAnalysis.newCustomersList?.length >
                              0 && (
                              <div>
                                <p className="font-medium text-gray-700 mb-1">
                                  Primer seguimiento
                                </p>
                                <div className="space-y-1">
                                  {seller.retentionAnalysis.newCustomersList
                                    .slice(0, 3)
                                    .map((client) => (
                                      <button
                                        key={client.clientName}
                                        type="button"
                                        onClick={() =>
                                          onSelectClient?.(client.clientName)
                                        }
                                        className="w-full text-left p-2 bg-purple-50 rounded hover:bg-purple-100"
                                      >
                                        <p className="text-sm text-gray-700">
                                          {client.clientName}
                                        </p>
                                        <p className="text-[11px] text-gray-500">
                                          Última visita: {client.lastVisit}
                                        </p>
                                      </button>
                                    ))}
                                </div>
                              </div>
                            )}
                          {key === "newCustomers" && (
                            <p className="text-[11px] text-gray-500">
                              Da seguimiento con una visita dentro de la primera
                              semana para afianzar la relación.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          </div>
        </div>
      )}

      {activeSection === "products" && (
        <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
            <Package className="mr-2 h-4 w-4" /> Distribución de Productos
          </h3>
          <div className="space-y-2">
            {seller.productDistribution.slice(0, 15).map((product) => (
              <div
                key={product.product}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-800">
                    {product.product}
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${Math.min(product.percentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-right ml-3">
                  <p className="font-semibold text-sm text-blue-600">
                    {product.quantity} unidades
                  </p>
                  <p className="text-xs text-gray-500">
                    {product.percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSection === "velocity" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <h3 className="font-semibold text-gray-700 mb-3">
              Métricas de Velocidad
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">
                  Puntaje de Velocidad
                </span>
                <span className="font-semibold text-blue-600">
                  {seller.salesVelocity.velocityScore}/100
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">
                  Tiempo entre visitas
                </span>
                <span className="font-semibold">
                  {seller.salesVelocity.avgTimeBetweenVisits.toFixed(1)} días
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">
                  Frecuencia de visitas
                </span>
                <span className="font-semibold">
                  {seller.salesVelocity.visitFrequency.toFixed(1)}/mes
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">
                  Mejor día (ventas)
                </span>
                <span className="font-semibold text-green-600">
                  {seller.salesVelocity.peakAnalysis.bestSalesDay}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <h3 className="font-semibold text-gray-700 mb-3">
              Tendencia Mensual
            </h3>
            <div className="space-y-2">
              {seller.salesVelocity.monthlyVelocity.map((month) => {
                const monthName = new Date(
                  month.month + "-01",
                ).toLocaleDateString("es-ES", { month: "long" });
                return (
                  <div
                    key={month.month}
                    className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0"
                  >
                    <span className="text-sm font-medium capitalize">
                      {monthName}
                    </span>
                    <div className="text-right">
                      <span
                        className={`text-sm font-semibold ${month.salesChange >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {month.salesChange >= 0 ? "+" : ""}
                        {month.salesChange.toFixed(1)}%
                      </span>
                      <p className="text-xs text-gray-500">ventas</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeSection === "retention" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <h3 className="font-semibold text-gray-700 mb-3">
              Métricas de Retención
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Tasa de retención</span>
                <span className="font-semibold text-green-600">
                  {seller.retentionAnalysis.retentionRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Lealtad promedio</span>
                <span className="font-semibold">
                  {seller.retentionAnalysis.avgLoyaltyScore.toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">
                  Vida promedio cliente
                </span>
                <span className="font-semibold">
                  {seller.retentionAnalysis.avgCustomerLifetime.toFixed(0)} días
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <h3 className="font-semibold text-gray-700 mb-3">
              Clientes en Riesgo
            </h3>
            <div className="space-y-2">
              {seller.retentionAnalysis.churnRiskClients
                .slice(0, 5)
                .map((client) => (
                  <div
                    key={client.clientName}
                    className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0"
                  >
                    <div>
                      <p className="font-medium text-sm text-gray-800">
                        {client.clientName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {client.daysSinceLastVisit} días sin visita
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm text-orange-600">
                        {formatCurrency(client.customerValue)}
                      </p>
                      <p className="text-xs text-red-500">{client.churnRisk}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {activeSection === "territory" && (
        <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
            <MapPin className="mr-2 h-4 w-4" /> Análisis de Territorio
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {seller.territoryAnalysis.totalClients}
              </div>
              <div className="text-xs text-gray-600">Total Clientes</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {seller.territoryAnalysis.territoryArea.toFixed(0)}
              </div>
              <div className="text-xs text-gray-600">km² Territorio</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {seller.territoryAnalysis.clientDensity.toFixed(2)}
              </div>
              <div className="text-xs text-gray-600">Clientes/km²</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {seller.territoryAnalysis.coverageScore}
              </div>
              <div className="text-xs text-gray-600">Score Cobertura</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
