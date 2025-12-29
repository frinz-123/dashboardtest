"use client";

import {
  AlertTriangle,
  Users,
  Clock,
  TrendingDown,
  Shield,
  Target,
} from "lucide-react";

interface ChurnRiskClient {
  clientName: string;
  daysSinceLastVisit: number;
  churnRisk: string;
  customerValue: number;
  lastVisit: string;
}

interface LoyaltySegments {
  champions: number;
  loyalCustomers: number;
  potentialLoyalists: number;
  atRisk: number;
  newCustomers: number;
}

interface RetentionAnalysis {
  totalClients: number;
  avgCustomerLifetime: number;
  avgLoyaltyScore: number;
  retentionRate: number;
  loyaltySegments: LoyaltySegments;
  topLoyalClients: Array<{
    clientName: string;
    loyaltyScore: number;
    customerValue: number;
    visitCount: number;
    lastVisit: string;
  }>;
  churnRiskClients: ChurnRiskClient[];
}

interface SellerRetentionData {
  vendedor: string;
  totalSales: number;
  uniqueClients: number;
  retentionAnalysis: RetentionAnalysis;
}

interface ChurnRiskReportProps {
  sellers: SellerRetentionData[];
  formatCurrency: (amount: number) => string;
}

export default function ChurnRiskReport({
  sellers,
  formatCurrency,
}: ChurnRiskReportProps) {
  // Aggregate all churn risk clients across all sellers
  const allChurnRiskClients = sellers
    .flatMap((seller) =>
      seller.retentionAnalysis.churnRiskClients.map((client) => ({
        ...client,
        vendedor: seller.vendedor,
        sellerTotalSales: seller.totalSales,
      })),
    )
    .sort((a, b) => b.customerValue - a.customerValue);

  // Calculate overall churn metrics
  const totalAtRiskClients = allChurnRiskClients.length;
  const totalAtRiskValue = allChurnRiskClients.reduce(
    (sum, client) => sum + client.customerValue,
    0,
  );
  const avgRetentionRate =
    sellers.reduce((sum, s) => sum + s.retentionAnalysis.retentionRate, 0) /
    sellers.length;

  // Categorize by risk level
  const highRiskClients = allChurnRiskClients.filter(
    (c) => c.daysSinceLastVisit > 180,
  );
  const mediumRiskClients = allChurnRiskClients.filter(
    (c) => c.daysSinceLastVisit <= 180 && c.daysSinceLastVisit > 90,
  );
  const lowRiskClients = allChurnRiskClients.filter(
    (c) => c.daysSinceLastVisit <= 90 && c.daysSinceLastVisit > 30,
  );

  // Sellers with highest churn risk
  const sellersWithHighChurn = sellers
    .map((seller) => ({
      vendedor: seller.vendedor,
      churnRiskCount: seller.retentionAnalysis.churnRiskClients.length,
      churnRiskValue: seller.retentionAnalysis.churnRiskClients.reduce(
        (sum, c) => sum + c.customerValue,
        0,
      ),
      retentionRate: seller.retentionAnalysis.retentionRate,
      atRiskPercentage:
        seller.uniqueClients > 0
          ? (seller.retentionAnalysis.churnRiskClients.length /
              seller.uniqueClients) *
            100
          : 0,
    }))
    .sort((a, b) => b.churnRiskCount - a.churnRiskCount)
    .slice(0, 5);

  // Calculate loyalty segment totals
  const totalLoyaltySegments = sellers.reduce(
    (acc, seller) => ({
      champions:
        acc.champions + seller.retentionAnalysis.loyaltySegments.champions,
      loyalCustomers:
        acc.loyalCustomers +
        seller.retentionAnalysis.loyaltySegments.loyalCustomers,
      potentialLoyalists:
        acc.potentialLoyalists +
        seller.retentionAnalysis.loyaltySegments.potentialLoyalists,
      atRisk: acc.atRisk + seller.retentionAnalysis.loyaltySegments.atRisk,
      newCustomers:
        acc.newCustomers +
        seller.retentionAnalysis.loyaltySegments.newCustomers,
    }),
    {
      champions: 0,
      loyalCustomers: 0,
      potentialLoyalists: 0,
      atRisk: 0,
      newCustomers: 0,
    },
  );

  const totalClientsInSegments = Object.values(totalLoyaltySegments).reduce(
    (sum, count) => sum + count,
    0,
  );

  return (
    <div className="space-y-4">
      {/* Overall Churn Risk Summary */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <AlertTriangle className="mr-2 h-4 w-4 text-red-500" /> Resumen de
          Riesgo de Pérdida
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-red-50 rounded-lg p-3">
            <div className="flex items-center">
              <AlertTriangle className="w-4 h-4 text-red-600 mr-2" />
              <div>
                <p className="text-xs text-gray-600">Clientes en Riesgo</p>
                <p className="text-sm font-bold text-red-600">
                  {totalAtRiskClients}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <div className="flex items-center">
              <TrendingDown className="w-4 h-4 text-orange-600 mr-2" />
              <div>
                <p className="text-xs text-gray-600">Valor en Riesgo</p>
                <p className="text-sm font-bold text-orange-600">
                  {formatCurrency(totalAtRiskValue)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center">
              <Shield className="w-4 h-4 text-green-600 mr-2" />
              <div>
                <p className="text-xs text-gray-600">Retención Promedio</p>
                <p className="text-sm font-bold text-green-600">
                  {avgRetentionRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center">
              <Users className="w-4 h-4 text-blue-600 mr-2" />
              <div>
                <p className="text-xs text-gray-600">Alto Riesgo</p>
                <p className="text-sm font-bold text-blue-600">
                  {highRiskClients.length}
                </p>
                <p className="text-xs text-gray-500">&gt; 6 meses</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Level Distribution */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <Clock className="mr-2 h-4 w-4" /> Distribución por Nivel de Riesgo
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* High Risk */}
          <div className="border-l-4 border-red-500 bg-red-50 p-3 rounded">
            <h4 className="font-medium text-red-700 mb-2">Alto Riesgo</h4>
            <p className="text-2xl font-bold text-red-600 mb-1">
              {highRiskClients.length}
            </p>
            <p className="text-xs text-gray-600 mb-2">
              &gt; 6 meses sin visita
            </p>
            <p className="text-sm font-medium text-red-600">
              {formatCurrency(
                highRiskClients.reduce((sum, c) => sum + c.customerValue, 0),
              )}
            </p>
            <p className="text-xs text-gray-500">valor total en riesgo</p>
          </div>

          {/* Medium Risk */}
          <div className="border-l-4 border-orange-500 bg-orange-50 p-3 rounded">
            <h4 className="font-medium text-orange-700 mb-2">Riesgo Medio</h4>
            <p className="text-2xl font-bold text-orange-600 mb-1">
              {mediumRiskClients.length}
            </p>
            <p className="text-xs text-gray-600 mb-2">3-6 meses sin visita</p>
            <p className="text-sm font-medium text-orange-600">
              {formatCurrency(
                mediumRiskClients.reduce((sum, c) => sum + c.customerValue, 0),
              )}
            </p>
            <p className="text-xs text-gray-500">valor total en riesgo</p>
          </div>

          {/* Low Risk */}
          <div className="border-l-4 border-yellow-500 bg-yellow-50 p-3 rounded">
            <h4 className="font-medium text-yellow-700 mb-2">Riesgo Bajo</h4>
            <p className="text-2xl font-bold text-yellow-600 mb-1">
              {lowRiskClients.length}
            </p>
            <p className="text-xs text-gray-600 mb-2">1-3 meses sin visita</p>
            <p className="text-sm font-medium text-yellow-600">
              {formatCurrency(
                lowRiskClients.reduce((sum, c) => sum + c.customerValue, 0),
              )}
            </p>
            <p className="text-xs text-gray-500">valor total en riesgo</p>
          </div>
        </div>
      </div>

      {/* Sellers with Highest Churn Risk */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <TrendingDown className="mr-2 h-4 w-4 text-red-500" /> Vendedores con
          Mayor Riesgo de Pérdida
        </h3>
        <div className="space-y-2">
          {sellersWithHighChurn.map((seller, index) => (
            <div
              key={seller.vendedor}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 bg-red-100 text-red-800">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-800">
                    {seller.vendedor}
                  </p>
                  <p className="text-xs text-gray-500">
                    Retención: {seller.retentionRate.toFixed(1)}%
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm text-red-600">
                  {seller.churnRiskCount} clientes
                </p>
                <div className="flex items-center space-x-2">
                  <p className="text-xs text-gray-500">
                    {seller.atRiskPercentage.toFixed(1)}% del total
                  </p>
                  <p className="text-xs text-orange-600">
                    {formatCurrency(seller.churnRiskValue)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Value Clients at Risk */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <Target className="mr-2 h-4 w-4 text-orange-500" /> Clientes de Alto
          Valor en Riesgo
        </h3>
        <div className="space-y-2">
          {allChurnRiskClients.slice(0, 10).map((client, index) => (
            <div
              key={`${client.vendedor}-${client.clientName}`}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${
                    client.daysSinceLastVisit > 180
                      ? "bg-red-100 text-red-800"
                      : client.daysSinceLastVisit > 90
                        ? "bg-orange-100 text-orange-800"
                        : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-800">
                    {client.clientName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {client.vendedor} • {client.daysSinceLastVisit} días sin
                    visita
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm text-orange-600">
                  {formatCurrency(client.customerValue)}
                </p>
                <p className="text-xs text-gray-500">
                  {client.daysSinceLastVisit > 180
                    ? "Alto riesgo"
                    : client.daysSinceLastVisit > 90
                      ? "Riesgo medio"
                      : "Riesgo bajo"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Customer Loyalty Segments */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <Users className="mr-2 h-4 w-4" /> Segmentos de Lealtad del Cliente
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">
              {totalLoyaltySegments.champions}
            </div>
            <div className="text-xs font-medium text-yellow-700">Campeones</div>
            <div className="text-xs text-gray-500">
              {totalClientsInSegments > 0
                ? (
                    (totalLoyaltySegments.champions / totalClientsInSegments) *
                    100
                  ).toFixed(0)
                : 0}
              %
            </div>
          </div>

          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {totalLoyaltySegments.loyalCustomers}
            </div>
            <div className="text-xs font-medium text-green-700">Leales</div>
            <div className="text-xs text-gray-500">
              {totalClientsInSegments > 0
                ? (
                    (totalLoyaltySegments.loyalCustomers /
                      totalClientsInSegments) *
                    100
                  ).toFixed(0)
                : 0}
              %
            </div>
          </div>

          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {totalLoyaltySegments.potentialLoyalists}
            </div>
            <div className="text-xs font-medium text-blue-700">Potenciales</div>
            <div className="text-xs text-gray-500">
              {totalClientsInSegments > 0
                ? (
                    (totalLoyaltySegments.potentialLoyalists /
                      totalClientsInSegments) *
                    100
                  ).toFixed(0)
                : 0}
              %
            </div>
          </div>

          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {totalLoyaltySegments.atRisk}
            </div>
            <div className="text-xs font-medium text-red-700">En Riesgo</div>
            <div className="text-xs text-gray-500">
              {totalClientsInSegments > 0
                ? (
                    (totalLoyaltySegments.atRisk / totalClientsInSegments) *
                    100
                  ).toFixed(0)
                : 0}
              %
            </div>
          </div>

          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {totalLoyaltySegments.newCustomers}
            </div>
            <div className="text-xs font-medium text-purple-700">Nuevos</div>
            <div className="text-xs text-gray-500">
              {totalClientsInSegments > 0
                ? (
                    (totalLoyaltySegments.newCustomers /
                      totalClientsInSegments) *
                    100
                  ).toFixed(0)
                : 0}
              %
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600">
            <strong>Recomendaciones:</strong> Enfócate en retener a los clientes
            "En Riesgo" con alto valor. Convierte "Potenciales" en "Leales" con
            programas de fidelización. Mantén la comunicación regular con
            "Campeones" y "Leales".
          </p>
        </div>
      </div>
    </div>
  );
}
