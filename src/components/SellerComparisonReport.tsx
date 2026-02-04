"use client";

import { Award, BarChart3, Target, TrendingUp, Users, Zap } from "lucide-react";

interface SellerMetrics {
  vendedor: string;
  rank: number;
  totalSales: number;
  totalVisits: number;
  uniqueClients: number;
  avgTicket: number;
  salesVelocity: {
    velocityScore: number;
    avgTimeBetweenVisits: number;
    visitFrequency: number;
  };
  retentionAnalysis: {
    retentionRate: number;
    avgLoyaltyScore: number;
  };
  territoryAnalysis: {
    territoryArea: number;
    clientDensity: number;
    coverageScore: number;
  };
}

interface SellerComparisonReportProps {
  sellers: SellerMetrics[];
  formatCurrency: (amount: number) => string;
}

export default function SellerComparisonReport({
  sellers,
  formatCurrency,
}: SellerComparisonReportProps) {
  // Calculate team averages
  const teamAverages = {
    sales: sellers.reduce((sum, s) => sum + s.totalSales, 0) / sellers.length,
    visits: sellers.reduce((sum, s) => sum + s.totalVisits, 0) / sellers.length,
    clients:
      sellers.reduce((sum, s) => sum + s.uniqueClients, 0) / sellers.length,
    avgTicket:
      sellers.reduce((sum, s) => sum + s.avgTicket, 0) / sellers.length,
    velocityScore:
      sellers.reduce((sum, s) => sum + s.salesVelocity.velocityScore, 0) /
      sellers.length,
    retentionRate:
      sellers.reduce((sum, s) => sum + s.retentionAnalysis.retentionRate, 0) /
      sellers.length,
    territoryArea:
      sellers.reduce((sum, s) => sum + s.territoryAnalysis.territoryArea, 0) /
      sellers.length,
    clientDensity:
      sellers.reduce((sum, s) => sum + s.territoryAnalysis.clientDensity, 0) /
      sellers.length,
  };

  // Calculate relative performance for each seller
  const sellersWithPerformance = sellers.map((seller) => ({
    ...seller,
    performance: {
      salesVsAvg: (seller.totalSales / teamAverages.sales - 1) * 100,
      visitsVsAvg: (seller.totalVisits / teamAverages.visits - 1) * 100,
      clientsVsAvg: (seller.uniqueClients / teamAverages.clients - 1) * 100,
      ticketVsAvg: (seller.avgTicket / teamAverages.avgTicket - 1) * 100,
      velocityVsAvg:
        (seller.salesVelocity.velocityScore / teamAverages.velocityScore - 1) *
        100,
      retentionVsAvg:
        (seller.retentionAnalysis.retentionRate / teamAverages.retentionRate -
          1) *
        100,
      densityVsAvg:
        teamAverages.clientDensity > 0
          ? (seller.territoryAnalysis.clientDensity /
              teamAverages.clientDensity -
              1) *
            100
          : 0,
    },
  }));

  // Performance categories
  const topPerformers = sellersWithPerformance.filter(
    (s) => s.performance.salesVsAvg > 20,
  );
  const averagePerformers = sellersWithPerformance.filter(
    (s) => s.performance.salesVsAvg >= -20 && s.performance.salesVsAvg <= 20,
  );
  const needsImprovement = sellersWithPerformance.filter(
    (s) => s.performance.salesVsAvg < -20,
  );

  // Best and worst in each category
  const bestSeller = sellersWithPerformance.reduce((best, current) =>
    current.totalSales > best.totalSales ? current : best,
  );
  const mostEfficient = sellersWithPerformance.reduce((best, current) =>
    current.salesVelocity.velocityScore > best.salesVelocity.velocityScore
      ? current
      : best,
  );
  const bestRetention = sellersWithPerformance.reduce((best, current) =>
    current.retentionAnalysis.retentionRate >
    best.retentionAnalysis.retentionRate
      ? current
      : best,
  );

  return (
    <div className="space-y-4">
      {/* Team Performance Overview */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <Award className="mr-2 h-4 w-4" /> Comparativa del Equipo de Ventas
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <Award className="w-6 h-6 text-blue-600 mx-auto mb-1" />
            <p className="text-xs text-gray-600">Mejor Vendedor</p>
            <p className="text-sm font-bold text-blue-600">
              {bestSeller.vendedor}
            </p>
            <p className="text-xs text-gray-500">
              {formatCurrency(bestSeller.totalSales)}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <Zap className="w-6 h-6 text-green-600 mx-auto mb-1" />
            <p className="text-xs text-gray-600">Más Eficiente</p>
            <p className="text-sm font-bold text-green-600">
              {mostEfficient.vendedor}
            </p>
            <p className="text-xs text-gray-500">
              {mostEfficient.salesVelocity.velocityScore}/100
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <Users className="w-6 h-6 text-purple-600 mx-auto mb-1" />
            <p className="text-xs text-gray-600">Mejor Retención</p>
            <p className="text-sm font-bold text-purple-600">
              {bestRetention.vendedor}
            </p>
            <p className="text-xs text-gray-500">
              {bestRetention.retentionAnalysis.retentionRate.toFixed(1)}%
            </p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <BarChart3 className="w-6 h-6 text-orange-600 mx-auto mb-1" />
            <p className="text-xs text-gray-600">Total Equipo</p>
            <p className="text-sm font-bold text-orange-600">
              {sellers.length} vendedores
            </p>
            <p className="text-xs text-gray-500">
              {formatCurrency(
                sellers.reduce((sum, s) => sum + s.totalSales, 0),
              )}
            </p>
          </div>
        </div>

        {/* Team Averages */}
        <div className="border-t pt-3">
          <h4 className="font-medium text-gray-700 mb-2">
            Promedios del Equipo
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-gray-600">Ventas</p>
              <p className="font-semibold">
                {formatCurrency(teamAverages.sales)}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Visitas</p>
              <p className="font-semibold">{teamAverages.visits.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-gray-600">Clientes</p>
              <p className="font-semibold">{teamAverages.clients.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-gray-600">Ticket Promedio</p>
              <p className="font-semibold">
                {formatCurrency(teamAverages.avgTicket)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Categories */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <TrendingUp className="mr-2 h-4 w-4" /> Categorías de Rendimiento
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Top Performers */}
          <div className="border-l-4 border-green-500 bg-green-50 p-3 rounded">
            <h4 className="font-medium text-green-700 mb-2">
              Alto Rendimiento
            </h4>
            <p className="text-2xl font-bold text-green-600 mb-1">
              {topPerformers.length}
            </p>
            <p className="text-xs text-gray-600 mb-2">
              &gt; 20% sobre promedio
            </p>
            <div className="space-y-1">
              {topPerformers.map((seller) => (
                <div
                  key={seller.vendedor}
                  className="flex justify-between text-xs"
                >
                  <span className="text-gray-700">{seller.vendedor}</span>
                  <span className="text-green-600 font-medium">
                    +{seller.performance.salesVsAvg.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Average Performers */}
          <div className="border-l-4 border-blue-500 bg-blue-50 p-3 rounded">
            <h4 className="font-medium text-blue-700 mb-2">
              Rendimiento Promedio
            </h4>
            <p className="text-2xl font-bold text-blue-600 mb-1">
              {averagePerformers.length}
            </p>
            <p className="text-xs text-gray-600 mb-2">±20% del promedio</p>
            <div className="space-y-1">
              {averagePerformers.slice(0, 5).map((seller) => (
                <div
                  key={seller.vendedor}
                  className="flex justify-between text-xs"
                >
                  <span className="text-gray-700">{seller.vendedor}</span>
                  <span className="text-blue-600 font-medium">
                    {seller.performance.salesVsAvg >= 0 ? "+" : ""}
                    {seller.performance.salesVsAvg.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Needs Improvement */}
          <div className="border-l-4 border-red-500 bg-red-50 p-3 rounded">
            <h4 className="font-medium text-red-700 mb-2">Necesita Apoyo</h4>
            <p className="text-2xl font-bold text-red-600 mb-1">
              {needsImprovement.length}
            </p>
            <p className="text-xs text-gray-600 mb-2">&lt; 20% bajo promedio</p>
            <div className="space-y-1">
              {needsImprovement.map((seller) => (
                <div
                  key={seller.vendedor}
                  className="flex justify-between text-xs"
                >
                  <span className="text-gray-700">{seller.vendedor}</span>
                  <span className="text-red-600 font-medium">
                    {seller.performance.salesVsAvg.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Performance Matrix */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <BarChart3 className="mr-2 h-4 w-4" /> Matriz de Rendimiento Detallada
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">Vendedor</th>
                <th className="py-2 pr-4 text-right">Ventas</th>
                <th className="py-2 pr-4 text-right">vs Promedio</th>
                <th className="py-2 pr-4 text-right">Velocidad</th>
                <th className="py-2 pr-4 text-right">Retención</th>
                <th className="py-2 pr-4 text-right">Densidad</th>
                <th className="py-2 pr-4 text-center">Score General</th>
              </tr>
            </thead>
            <tbody>
              {sellersWithPerformance
                .sort((a, b) => b.totalSales - a.totalSales)
                .map((seller, index) => {
                  // Calculate general score (0-100)
                  const generalScore =
                    seller.salesVelocity.velocityScore * 0.3 +
                    seller.retentionAnalysis.retentionRate * 0.3 +
                    Math.min(
                      100,
                      Math.max(0, seller.performance.salesVsAvg + 50),
                    ) *
                      0.4;

                  return (
                    <tr
                      key={seller.vendedor}
                      className="border-b border-gray-50 hover:bg-gray-50"
                    >
                      <td className="py-2 pr-4">
                        <div className="flex items-center">
                          <span
                            className={`w-4 h-4 rounded-full mr-2 ${
                              index === 0
                                ? "bg-yellow-400"
                                : index === 1
                                  ? "bg-gray-400"
                                  : index === 2
                                    ? "bg-orange-400"
                                    : "bg-blue-300"
                            }`}
                          ></span>
                          <span className="font-medium">{seller.vendedor}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-right font-semibold">
                        {formatCurrency(seller.totalSales)}
                      </td>
                      <td
                        className={`py-2 pr-4 text-right font-medium ${
                          seller.performance.salesVsAvg >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {seller.performance.salesVsAvg >= 0 ? "+" : ""}
                        {seller.performance.salesVsAvg.toFixed(0)}%
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            seller.salesVelocity.velocityScore >= 70
                              ? "bg-green-100 text-green-800"
                              : seller.salesVelocity.velocityScore >= 50
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {seller.salesVelocity.velocityScore}/100
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            seller.retentionAnalysis.retentionRate >= 80
                              ? "bg-green-100 text-green-800"
                              : seller.retentionAnalysis.retentionRate >= 60
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {seller.retentionAnalysis.retentionRate.toFixed(0)}%
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {seller.territoryAnalysis.clientDensity.toFixed(2)}
                      </td>
                      <td className="py-2 pr-4 text-center">
                        <div className="flex items-center justify-center">
                          <div className="w-12 bg-gray-200 rounded-full h-2 mr-2">
                            <div
                              className={`h-2 rounded-full ${
                                generalScore >= 80
                                  ? "bg-green-500"
                                  : generalScore >= 60
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                              }`}
                              style={{
                                width: `${Math.min(100, generalScore)}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-xs font-medium">
                            {generalScore.toFixed(0)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <Target className="mr-2 h-4 w-4" /> Insights de Rendimiento
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Strengths */}
          <div className="bg-green-50 rounded-lg p-3">
            <h4 className="font-medium text-green-700 mb-2">
              Fortalezas del Equipo
            </h4>
            <ul className="space-y-1 text-sm text-gray-700">
              <li>
                • {topPerformers.length} vendedores superan el promedio por +20%
              </li>
              <li>
                • Velocidad promedio del equipo:{" "}
                {teamAverages.velocityScore.toFixed(0)}/100
              </li>
              <li>
                • Retención promedio: {teamAverages.retentionRate.toFixed(1)}%
              </li>
              <li>
                •{" "}
                {
                  sellers.filter(
                    (s) =>
                      s.territoryAnalysis.clientDensity >
                      teamAverages.clientDensity,
                  ).length
                }{" "}
                territorios con buena densidad
              </li>
            </ul>
          </div>

          {/* Areas for Improvement */}
          <div className="bg-orange-50 rounded-lg p-3">
            <h4 className="font-medium text-orange-700 mb-2">
              Áreas de Mejora
            </h4>
            <ul className="space-y-1 text-sm text-gray-700">
              <li>
                • {needsImprovement.length} vendedores necesitan apoyo adicional
              </li>
              <li>
                •{" "}
                {
                  sellers.filter((s) => s.salesVelocity.velocityScore < 50)
                    .length
                }{" "}
                con velocidad &lt; 50/100
              </li>
              <li>
                •{" "}
                {
                  sellers.filter((s) => s.retentionAnalysis.retentionRate < 60)
                    .length
                }{" "}
                con retención &lt; 60%
              </li>
              <li>• Oportunidad de optimizar territorios extensos</li>
            </ul>
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600">
            <strong>Recomendaciones:</strong>
            1) Compartir mejores prácticas de vendedores top con el equipo. 2)
            Programas de mentoría entre vendedores de alto y bajo rendimiento.
            3) Optimización de rutas en territorios extensos. 4) Entrenamiento
            en técnicas de retención para vendedores con baja lealtad de
            clientes.
          </p>
        </div>
      </div>
    </div>
  );
}
