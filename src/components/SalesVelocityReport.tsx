"use client";

import {
  BarChart3,
  Calendar,
  Clock,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

interface MonthlyVelocity {
  month: string;
  salesChange: number;
  visitsChange: number;
}

interface PeakPerformance {
  bestSalesDay: string;
  bestSalesDayAmount: number;
  bestVisitsDay: string;
  bestVisitsDayCount: number;
  dayPerformance: Record<
    string,
    {
      totalSales: number;
      totalVisits: number;
      avgSales: number;
      avgVisits: number;
    }
  >;
}

interface SalesVelocity {
  avgTimeBetweenVisits: number;
  avgTimeToDeal: number;
  visitFrequency: number;
  velocityScore: number;
  monthlyVelocity: MonthlyVelocity[];
  peakAnalysis: PeakPerformance;
}

interface SellerVelocityData {
  vendedor: string;
  totalSales: number;
  totalVisits: number;
  salesVelocity: SalesVelocity;
}

interface SalesVelocityReportProps {
  sellers: SellerVelocityData[];
  formatCurrency: (amount: number) => string;
}

export default function SalesVelocityReport({
  sellers,
  formatCurrency,
}: SalesVelocityReportProps) {
  // Calculate averages
  const avgVelocityScore =
    sellers.reduce((sum, s) => sum + s.salesVelocity.velocityScore, 0) /
    sellers.length;
  const avgTimeBetweenVisits =
    sellers.reduce((sum, s) => sum + s.salesVelocity.avgTimeBetweenVisits, 0) /
    sellers.length;
  const avgVisitFrequency =
    sellers.reduce((sum, s) => sum + s.salesVelocity.visitFrequency, 0) /
    sellers.length;

  // Top performers by velocity metrics
  const topByVelocityScore = [...sellers]
    .sort(
      (a, b) => b.salesVelocity.velocityScore - a.salesVelocity.velocityScore,
    )
    .slice(0, 5);
  const fastestVisitCycle = [...sellers]
    .sort(
      (a, b) =>
        a.salesVelocity.avgTimeBetweenVisits -
        b.salesVelocity.avgTimeBetweenVisits,
    )
    .slice(0, 5);
  const _highestFrequency = [...sellers]
    .sort(
      (a, b) => b.salesVelocity.visitFrequency - a.salesVelocity.visitFrequency,
    )
    .slice(0, 5);

  // Day of week analysis - aggregate across all sellers
  const dayPerformanceAgg = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ].map((day) => {
    const dayInSpanish =
      {
        Monday: "Lunes",
        Tuesday: "Martes",
        Wednesday: "Miércoles",
        Thursday: "Jueves",
        Friday: "Viernes",
        Saturday: "Sábado",
        Sunday: "Domingo",
      }[day] || day;

    const sellersData = sellers
      .map((s) => s.salesVelocity.peakAnalysis.dayPerformance[day])
      .filter(Boolean);
    const totalSales = sellersData.reduce(
      (sum, d) => sum + (d?.totalSales || 0),
      0,
    );
    const totalVisits = sellersData.reduce(
      (sum, d) => sum + (d?.totalVisits || 0),
      0,
    );
    const avgSales =
      sellersData.length > 0 ? totalSales / sellersData.length : 0;
    const avgVisits =
      sellersData.length > 0 ? totalVisits / sellersData.length : 0;

    return {
      day,
      dayInSpanish,
      totalSales,
      totalVisits,
      avgSales,
      avgVisits,
      sellersCount: sellersData.length,
    };
  });

  // Best performing day overall
  const bestSalesDay = dayPerformanceAgg.reduce((best, current) =>
    current.totalSales > best.totalSales ? current : best,
  );
  const bestVisitsDay = dayPerformanceAgg.reduce((best, current) =>
    current.totalVisits > best.totalVisits ? current : best,
  );

  // Monthly trend analysis
  const monthlyTrends = sellers.reduce(
    (acc, seller) => {
      seller.salesVelocity.monthlyVelocity.forEach((month) => {
        if (!acc[month.month]) {
          acc[month.month] = { salesChanges: [], visitsChanges: [] };
        }
        acc[month.month].salesChanges.push(month.salesChange);
        acc[month.month].visitsChanges.push(month.visitsChange);
      });
      return acc;
    },
    {} as Record<string, { salesChanges: number[]; visitsChanges: number[] }>,
  );

  const monthlyAvgs = Object.entries(monthlyTrends)
    .map(([month, data]) => ({
      month,
      avgSalesChange:
        data.salesChanges.reduce((sum, val) => sum + val, 0) /
        data.salesChanges.length,
      avgVisitsChange:
        data.visitsChanges.reduce((sum, val) => sum + val, 0) /
        data.visitsChanges.length,
      sellersCount: data.salesChanges.length,
    }))
    .sort();

  return (
    <div className="space-y-4">
      {/* Velocity Overview */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <Zap className="mr-2 h-4 w-4 text-blue-500" /> Resumen de Velocidad de
          Ventas
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center">
              <Zap className="w-4 h-4 text-blue-600 mr-2" />
              <div>
                <p className="text-xs text-gray-600">Velocidad Promedio</p>
                <p className="text-sm font-bold text-blue-600">
                  {avgVelocityScore.toFixed(0)}/100
                </p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center">
              <Clock className="w-4 h-4 text-green-600 mr-2" />
              <div>
                <p className="text-xs text-gray-600">Tiempo Entre Visitas</p>
                <p className="text-sm font-bold text-green-600">
                  {avgTimeBetweenVisits.toFixed(1)} días
                </p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="flex items-center">
              <TrendingUp className="w-4 h-4 text-purple-600 mr-2" />
              <div>
                <p className="text-xs text-gray-600">Frecuencia Promedio</p>
                <p className="text-sm font-bold text-purple-600">
                  {avgVisitFrequency.toFixed(1)} visitas/mes
                </p>
              </div>
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <div className="flex items-center">
              <Calendar className="w-4 h-4 text-orange-600 mr-2" />
              <div>
                <p className="text-xs text-gray-600">Mejor Día Ventas</p>
                <p className="text-sm font-bold text-orange-600">
                  {bestSalesDay.dayInSpanish}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top by Velocity Score */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <Zap className="mr-2 h-4 w-4 text-blue-500" /> Top 5 - Puntaje de
          Velocidad
        </h3>
        <div className="space-y-2">
          {topByVelocityScore.map((seller, index) => (
            <div
              key={seller.vendedor}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${
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
                    {seller.vendedor}
                  </p>
                  <p className="text-xs text-gray-500">
                    {seller.salesVelocity.avgTimeBetweenVisits.toFixed(1)} días
                    entre visitas
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm text-blue-600">
                  {seller.salesVelocity.velocityScore}/100
                </p>
                <p className="text-xs text-gray-500">
                  {seller.salesVelocity.visitFrequency.toFixed(1)} visitas/mes
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fastest Visit Cycle */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <Clock className="mr-2 h-4 w-4 text-green-500" /> Ciclo de Visitas Más
          Rápido
        </h3>
        <div className="space-y-2">
          {fastestVisitCycle.map((seller, index) => (
            <div
              key={seller.vendedor}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${
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
                    {seller.vendedor}
                  </p>
                  <p className="text-xs text-gray-500">
                    {seller.totalVisits} visitas totales
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm text-green-600">
                  {seller.salesVelocity.avgTimeBetweenVisits.toFixed(1)} días
                </p>
                <p className="text-xs text-gray-500">entre visitas</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Day of Week Performance */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <Calendar className="mr-2 h-4 w-4" /> Rendimiento por Día de la Semana
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2 mb-4">
          {dayPerformanceAgg.map((day) => {
            const maxSales = Math.max(
              ...dayPerformanceAgg.map((d) => d.totalSales),
            );
            const percentage =
              maxSales > 0 ? (day.totalSales / maxSales) * 100 : 0;

            return (
              <div key={day.day} className="text-center p-2 border rounded">
                <p className="text-xs font-medium text-gray-700">
                  {day.dayInSpanish}
                </p>
                <p className="text-lg font-bold text-blue-600">
                  {formatCurrency(day.totalSales)}
                </p>
                <p className="text-xs text-gray-500">
                  {day.totalVisits} visitas
                </p>
                <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                  <div
                    className="bg-blue-600 h-1 rounded-full"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">
            <strong>Mejor día para ventas:</strong> {bestSalesDay.dayInSpanish}{" "}
            ({formatCurrency(bestSalesDay.totalSales)}) •
            <strong> Mejor día para visitas:</strong>{" "}
            {bestVisitsDay.dayInSpanish} ({bestVisitsDay.totalVisits} visitas)
          </p>
        </div>
      </div>

      {/* Monthly Velocity Trends */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <BarChart3 className="mr-2 h-4 w-4" /> Tendencias Mensuales de
          Velocidad
        </h3>
        <div className="space-y-3">
          {monthlyAvgs.map((month) => {
            const monthName = new Date(`${month.month}-01`).toLocaleDateString(
              "es-ES",
              {
                month: "long",
                year: "numeric",
              },
            );

            return (
              <div key={month.month} className="border rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium text-gray-800">{monthName}</h4>
                  <p className="text-xs text-gray-500">
                    {month.sellersCount} vendedores
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <TrendingUp className="w-4 h-4 mr-2 text-green-500" />
                    <div>
                      <p className="text-xs text-gray-600">Cambio en Ventas</p>
                      <p
                        className={`text-sm font-semibold ${
                          month.avgSalesChange >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {month.avgSalesChange >= 0 ? "+" : ""}
                        {month.avgSalesChange.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Target className="w-4 h-4 mr-2 text-blue-500" />
                    <div>
                      <p className="text-xs text-gray-600">Cambio en Visitas</p>
                      <p
                        className={`text-sm font-semibold ${
                          month.avgVisitsChange >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {month.avgVisitsChange >= 0 ? "+" : ""}
                        {month.avgVisitsChange.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Velocity Performance Categories */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <Target className="mr-2 h-4 w-4" /> Categorías de Rendimiento de
          Velocidad
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* High Performers */}
          <div className="border-l-4 border-green-500 bg-green-50 p-3 rounded">
            <h4 className="font-medium text-green-700 mb-2">
              Alto Rendimiento
            </h4>
            <p className="text-2xl font-bold text-green-600 mb-1">
              {
                sellers.filter((s) => s.salesVelocity.velocityScore >= 70)
                  .length
              }
            </p>
            <p className="text-xs text-gray-600 mb-2">Velocidad ≥ 70/100</p>
            <div className="space-y-1">
              {sellers
                .filter((s) => s.salesVelocity.velocityScore >= 70)
                .slice(0, 3)
                .map((s) => (
                  <p key={s.vendedor} className="text-xs text-gray-700">
                    {s.vendedor} ({s.salesVelocity.velocityScore}/100)
                  </p>
                ))}
            </div>
          </div>

          {/* Medium Performers */}
          <div className="border-l-4 border-yellow-500 bg-yellow-50 p-3 rounded">
            <h4 className="font-medium text-yellow-700 mb-2">
              Rendimiento Medio
            </h4>
            <p className="text-2xl font-bold text-yellow-600 mb-1">
              {
                sellers.filter(
                  (s) =>
                    s.salesVelocity.velocityScore >= 40 &&
                    s.salesVelocity.velocityScore < 70,
                ).length
              }
            </p>
            <p className="text-xs text-gray-600 mb-2">Velocidad 40-69/100</p>
            <div className="space-y-1">
              {sellers
                .filter(
                  (s) =>
                    s.salesVelocity.velocityScore >= 40 &&
                    s.salesVelocity.velocityScore < 70,
                )
                .slice(0, 3)
                .map((s) => (
                  <p key={s.vendedor} className="text-xs text-gray-700">
                    {s.vendedor} ({s.salesVelocity.velocityScore}/100)
                  </p>
                ))}
            </div>
          </div>

          {/* Low Performers */}
          <div className="border-l-4 border-red-500 bg-red-50 p-3 rounded">
            <h4 className="font-medium text-red-700 mb-2">Necesita Mejora</h4>
            <p className="text-2xl font-bold text-red-600 mb-1">
              {sellers.filter((s) => s.salesVelocity.velocityScore < 40).length}
            </p>
            <p className="text-xs text-gray-600 mb-2">Velocidad &lt; 40/100</p>
            <div className="space-y-1">
              {sellers
                .filter((s) => s.salesVelocity.velocityScore < 40)
                .slice(0, 3)
                .map((s) => (
                  <p key={s.vendedor} className="text-xs text-gray-700">
                    {s.vendedor} ({s.salesVelocity.velocityScore}/100)
                  </p>
                ))}
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600">
            <strong>Interpretación:</strong> La velocidad de ventas combina
            frecuencia de visitas, tiempo entre visitas y conversión. Los
            vendedores con alta velocidad visitan clientes más frecuentemente y
            cierran ventas más rápidamente.
          </p>
        </div>
      </div>
    </div>
  );
}
