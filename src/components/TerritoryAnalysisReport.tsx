"use client";

import { BarChart3, Map, MapPin, Target, Users } from "lucide-react";

interface TerritoryAnalysis {
  totalClients: number;
  territoryBounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  territoryCenter: { lat: number; lng: number };
  territoryArea: number;
  clientDensity: number;
  avgDistanceBetweenClients: number;
  coverageScore: number;
}

interface SellerTerritoryData {
  vendedor: string;
  totalSales: number;
  uniqueClients: number;
  territoryAnalysis: TerritoryAnalysis;
}

interface TerritoryAnalysisReportProps {
  sellers: SellerTerritoryData[];
  formatCurrency: (amount: number) => string;
}

export default function TerritoryAnalysisReport({
  sellers,
  formatCurrency,
}: TerritoryAnalysisReportProps) {
  // Territory efficiency calculations
  const territoryMetrics = sellers.map((seller) => ({
    vendedor: seller.vendedor,
    totalSales: seller.totalSales,
    clients: seller.uniqueClients,
    area: seller.territoryAnalysis.territoryArea,
    density: seller.territoryAnalysis.clientDensity,
    avgDistance: seller.territoryAnalysis.avgDistanceBetweenClients,
    coverageScore: seller.territoryAnalysis.coverageScore,
    salesPerKm2:
      seller.territoryAnalysis.territoryArea > 0
        ? seller.totalSales / seller.territoryAnalysis.territoryArea
        : 0,
    salesPerClient:
      seller.uniqueClients > 0 ? seller.totalSales / seller.uniqueClients : 0,
  }));

  // Sort by different metrics
  const topByDensity = [...territoryMetrics]
    .sort((a, b) => b.density - a.density)
    .slice(0, 5);
  const topByCoverage = [...territoryMetrics]
    .sort((a, b) => b.coverageScore - a.coverageScore)
    .slice(0, 5);
  const topByEfficiency = [...territoryMetrics]
    .sort((a, b) => b.salesPerKm2 - a.salesPerKm2)
    .slice(0, 5);

  // Territory size categories
  const smallTerritories = territoryMetrics.filter((t) => t.area < 1000);
  const mediumTerritories = territoryMetrics.filter(
    (t) => t.area >= 1000 && t.area < 10000,
  );
  const largeTerritories = territoryMetrics.filter((t) => t.area >= 10000);

  return (
    <div className="space-y-4">
      {/* Territory Overview */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <Map className="mr-2 h-4 w-4" /> Resumen de Territorios
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center">
              <MapPin className="w-4 h-4 text-green-600 mr-2" />
              <div>
                <p className="text-xs text-gray-600">Territorios Compactos</p>
                <p className="text-sm font-bold text-green-600">
                  {smallTerritories.length}
                </p>
                <p className="text-xs text-gray-500">&lt; 1,000 km²</p>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center">
              <MapPin className="w-4 h-4 text-blue-600 mr-2" />
              <div>
                <p className="text-xs text-gray-600">Territorios Medianos</p>
                <p className="text-sm font-bold text-blue-600">
                  {mediumTerritories.length}
                </p>
                <p className="text-xs text-gray-500">1K - 10K km²</p>
              </div>
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <div className="flex items-center">
              <MapPin className="w-4 h-4 text-orange-600 mr-2" />
              <div>
                <p className="text-xs text-gray-600">Territorios Extensos</p>
                <p className="text-sm font-bold text-orange-600">
                  {largeTerritories.length}
                </p>
                <p className="text-xs text-gray-500">&gt; 10K km²</p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="flex items-center">
              <Users className="w-4 h-4 text-purple-600 mr-2" />
              <div>
                <p className="text-xs text-gray-600">Promedio Clientes</p>
                <p className="text-sm font-bold text-purple-600">
                  {(
                    territoryMetrics.reduce((sum, t) => sum + t.clients, 0) /
                    territoryMetrics.length
                  ).toFixed(0)}
                </p>
                <p className="text-xs text-gray-500">por territorio</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top by Client Density */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <Users className="mr-2 h-4 w-4 text-blue-500" /> Mayor Densidad de
          Clientes
        </h3>
        <div className="space-y-2">
          {topByDensity.map((territory, index) => (
            <div
              key={territory.vendedor}
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
                    {territory.vendedor}
                  </p>
                  <p className="text-xs text-gray-500">
                    {territory.clients} clientes • {territory.area.toFixed(0)}{" "}
                    km²
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm text-blue-600">
                  {territory.density.toFixed(2)} cl/km²
                </p>
                <p className="text-xs text-gray-500">
                  {territory.avgDistance.toFixed(1)} km promedio
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top by Sales Efficiency per km² */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <BarChart3 className="mr-2 h-4 w-4 text-green-500" /> Mayor Eficiencia
          en Ventas por km²
        </h3>
        <div className="space-y-2">
          {topByEfficiency.map((territory, index) => (
            <div
              key={territory.vendedor}
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
                    {territory.vendedor}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatCurrency(territory.salesPerClient)} por cliente
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm text-green-600">
                  {formatCurrency(territory.salesPerKm2)} /km²
                </p>
                <p className="text-xs text-gray-500">
                  {territory.area.toFixed(0)} km² total
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Territory Coverage Score */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <Target className="mr-2 h-4 w-4 text-purple-500" /> Puntaje de
          Cobertura Territorial
        </h3>
        <div className="space-y-2">
          {topByCoverage.map((territory, index) => (
            <div
              key={territory.vendedor}
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
                    {territory.vendedor}
                  </p>
                  <p className="text-xs text-gray-500">
                    Densidad: {territory.density.toFixed(2)} clientes/km²
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm text-purple-600">
                  {territory.coverageScore}/100
                </p>
                <p className="text-xs text-gray-500">
                  {territory.coverageScore >= 15
                    ? "Excelente"
                    : territory.coverageScore >= 10
                      ? "Buena"
                      : territory.coverageScore >= 5
                        ? "Regular"
                        : "Mejorable"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Territory Distribution Analysis */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <Map className="mr-2 h-4 w-4" /> Distribución de Territorios
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Small Territories */}
          <div className="border rounded-lg p-3">
            <h4 className="font-medium text-green-700 mb-2">
              Territorios Compactos
            </h4>
            <p className="text-2xl font-bold text-green-600 mb-1">
              {smallTerritories.length}
            </p>
            <p className="text-xs text-gray-500 mb-2">&lt; 1,000 km²</p>
            {smallTerritories.slice(0, 3).map((t) => (
              <div
                key={t.vendedor}
                className="flex justify-between text-xs py-1"
              >
                <span className="text-gray-700">{t.vendedor}</span>
                <span className="text-gray-500">{t.area.toFixed(0)} km²</span>
              </div>
            ))}
            {smallTerritories.length > 3 && (
              <p className="text-xs text-gray-400 mt-1">
                +{smallTerritories.length - 3} más
              </p>
            )}
          </div>

          {/* Medium Territories */}
          <div className="border rounded-lg p-3">
            <h4 className="font-medium text-blue-700 mb-2">
              Territorios Medianos
            </h4>
            <p className="text-2xl font-bold text-blue-600 mb-1">
              {mediumTerritories.length}
            </p>
            <p className="text-xs text-gray-500 mb-2">1K - 10K km²</p>
            {mediumTerritories.slice(0, 3).map((t) => (
              <div
                key={t.vendedor}
                className="flex justify-between text-xs py-1"
              >
                <span className="text-gray-700">{t.vendedor}</span>
                <span className="text-gray-500">{t.area.toFixed(0)} km²</span>
              </div>
            ))}
            {mediumTerritories.length > 3 && (
              <p className="text-xs text-gray-400 mt-1">
                +{mediumTerritories.length - 3} más
              </p>
            )}
          </div>

          {/* Large Territories */}
          <div className="border rounded-lg p-3">
            <h4 className="font-medium text-orange-700 mb-2">
              Territorios Extensos
            </h4>
            <p className="text-2xl font-bold text-orange-600 mb-1">
              {largeTerritories.length}
            </p>
            <p className="text-xs text-gray-500 mb-2">&gt; 10K km²</p>
            {largeTerritories.slice(0, 3).map((t) => (
              <div
                key={t.vendedor}
                className="flex justify-between text-xs py-1"
              >
                <span className="text-gray-700">{t.vendedor}</span>
                <span className="text-gray-500">{t.area.toFixed(0)} km²</span>
              </div>
            ))}
            {largeTerritories.length > 3 && (
              <p className="text-xs text-gray-400 mt-1">
                +{largeTerritories.length - 3} más
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600">
            <strong>Interpretación:</strong> Los territorios compactos suelen
            tener mayor eficiencia de visitas, mientras que los territorios
            extensos pueden requerir mayor planificación de rutas. El puntaje de
            cobertura considera la densidad de clientes y la eficiencia
            geográfica.
          </p>
        </div>
      </div>
    </div>
  );
}
