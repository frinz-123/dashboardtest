'use client'

import { useState } from 'react'
import { Award, DollarSign, Users, Activity, Target, Package, Download, BarChart3, Map, AlertTriangle, Zap, TrendingUp } from 'lucide-react'
import SellerPerformanceReport from './SellerPerformanceReport'
import TerritoryAnalysisReport from './TerritoryAnalysisReport'
import ChurnRiskReport from './ChurnRiskReport'
import SalesVelocityReport from './SalesVelocityReport'
import SellerComparisonReport from './SellerComparisonReport'

interface BestClient {
  clientName: string
  totalSales: number
  visitCount: number
  avgTicket: number
}

interface ProductDistribution {
  product: string
  quantity: number
  percentage: number
}

interface Seller {
  vendedor: string
  totalSales: number
  uniqueClients: number
  totalVisits: number
  avgTicket: number
  rank: number
  bestClients: BestClient[]
  productDistribution: ProductDistribution[]
}

interface SellerAnalyticsData {
  sellers: Seller[]
  totalSellers: number
  topSellerName: string
  topSellerSales: number
}

interface VendedoresSectionProps {
  sellerAnalyticsData: SellerAnalyticsData | null
  isLoadingSellerAnalytics: boolean
  selectedSeller: string
  setSelectedSeller: (seller: string) => void
  exportSellerData: (type: 'leaderboard' | 'clients' | 'products', vendedor?: string) => void
  formatCurrency: (amount: number) => string
}

export default function VendedoresSection({
  sellerAnalyticsData,
  isLoadingSellerAnalytics,
  selectedSeller,
  setSelectedSeller,
  exportSellerData,
  formatCurrency
}: VendedoresSectionProps) {
  const [activeReport, setActiveReport] = useState<'ranking' | 'performance' | 'territory' | 'churn' | 'velocity' | 'comparison'>('ranking')

  return (
    <div className="space-y-3">
      {/* Report Navigation */}
      <div className="bg-white rounded-lg p-3 border border-[#E2E4E9]">
        <div className="flex overflow-x-auto gap-1">
          <button
            onClick={() => setActiveReport('ranking')}
            className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap ${
              activeReport === 'ranking'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
            }`}
          >
            <Award className="w-4 h-4 mr-2" />
            Ranking
          </button>
          <button
            onClick={() => setActiveReport('performance')}
            className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap ${
              activeReport === 'performance'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
            }`}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Rendimiento
          </button>
          <button
            onClick={() => setActiveReport('territory')}
            className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap ${
              activeReport === 'territory'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
            }`}
          >
            <Map className="w-4 h-4 mr-2" />
            Territorios
          </button>
          <button
            onClick={() => setActiveReport('churn')}
            className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap ${
              activeReport === 'churn'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Riesgo Pérdida
          </button>
          <button
            onClick={() => setActiveReport('velocity')}
            className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap ${
              activeReport === 'velocity'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
            }`}
          >
            <Zap className="w-4 h-4 mr-2" />
            Velocidad
          </button>
          <button
            onClick={() => setActiveReport('comparison')}
            className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap ${
              activeReport === 'comparison'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
            }`}
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Comparativa
          </button>
        </div>
      </div>

      {/* Report Content */}
      {activeReport === 'ranking' ? (
        <div>
          {/* Seller Leaderboard */}
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-700 flex items-center text-sm">
            <Award className="mr-2 h-4 w-4" /> Ranking de Vendedores
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={() => exportSellerData('leaderboard')}
              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white hover:bg-gray-50 flex items-center"
            >
              <Download className="w-3 h-3 mr-1" />
              Exportar
            </button>
            <p className="text-xs text-gray-500">Año actual</p>
          </div>
        </div>
        <div className="space-y-2">
          {isLoadingSellerAnalytics ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Cargando vendedores...</p>
            </div>
          ) : sellerAnalyticsData?.sellers && sellerAnalyticsData.sellers.length > 0 ? (
            sellerAnalyticsData.sellers.map((seller) => (
              <div
                key={seller.vendedor}
                className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50 rounded px-2"
                onClick={() => setSelectedSeller(selectedSeller === seller.vendedor ? '' : seller.vendedor)}
              >
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-3 ${
                    seller.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                    seller.rank === 2 ? 'bg-gray-100 text-gray-800' :
                    seller.rank === 3 ? 'bg-orange-100 text-orange-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {seller.rank}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-800">{seller.vendedor}</p>
                    <div className="flex items-center space-x-3 text-xs text-gray-500">
                      <span>{seller.uniqueClients} clientes</span>
                      <span>•</span>
                      <span>{seller.totalVisits} visitas</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm text-green-600">{formatCurrency(seller.totalSales)}</p>
                  <p className="text-xs text-gray-500">Promedio: {formatCurrency(seller.avgTicket)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">No hay datos de vendedores disponibles</p>
            </div>
          )}
        </div>
      </div>

      {/* Selected Seller Details */}
      {selectedSeller && sellerAnalyticsData && (
        (() => {
          const seller = sellerAnalyticsData.sellers.find(s => s.vendedor === selectedSeller)
          if (!seller) return null

          return (
            <div className="space-y-3">
              {/* Seller Overview */}
              <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-700 flex items-center text-sm">
                    <Award className="mr-2 h-4 w-4" /> {seller.vendedor} - Resumen
                  </h3>
                  <button
                    onClick={() => setSelectedSeller('')}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cerrar
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="flex items-center">
                      <DollarSign className="w-5 h-5 text-green-600 mr-2" />
                      <div>
                        <p className="text-xs text-gray-600">Ventas Totales</p>
                        <p className="text-lg font-bold text-green-600">{formatCurrency(seller.totalSales)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="flex items-center">
                      <Users className="w-5 h-5 text-blue-600 mr-2" />
                      <div>
                        <p className="text-xs text-gray-600">Clientes Únicos</p>
                        <p className="text-lg font-bold text-blue-600">{seller.uniqueClients}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3">
                    <div className="flex items-center">
                      <Activity className="w-5 h-5 text-purple-600 mr-2" />
                      <div>
                        <p className="text-xs text-gray-600">Visitas Totales</p>
                        <p className="text-lg font-bold text-purple-600">{seller.totalVisits}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3">
                    <div className="flex items-center">
                      <Target className="w-5 h-5 text-orange-600 mr-2" />
                      <div>
                        <p className="text-xs text-gray-600">Ticket Promedio</p>
                        <p className="text-lg font-bold text-orange-600">{formatCurrency(seller.avgTicket)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Best Clients */}
              <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-700 flex items-center text-sm">
                    <Users className="mr-2 h-4 w-4" /> Mejores Clientes - {seller.vendedor}
                  </h3>
                  <button
                    onClick={() => exportSellerData('clients', seller.vendedor)}
                    className="text-xs border border-gray-300 rounded px-2 py-1 bg-white hover:bg-gray-50"
                  >
                    Exportar CSV
                  </button>
                </div>
                <div className="space-y-2">
                  {seller.bestClients.slice(0, 8).map((client, index) => (
                    <div key={client.clientName} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${
                          index === 0 ? 'bg-yellow-100 text-yellow-800' :
                          index === 1 ? 'bg-gray-100 text-gray-800' :
                          index === 2 ? 'bg-orange-100 text-orange-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-gray-800">{client.clientName}</p>
                          <p className="text-xs text-gray-500">{client.visitCount} visitas</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm text-green-600">{formatCurrency(client.totalSales)}</p>
                        <p className="text-xs text-gray-500">Promedio: {formatCurrency(client.avgTicket)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Product Distribution */}
              <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-700 flex items-center text-sm">
                    <Package className="mr-2 h-4 w-4" /> Distribución de Productos - {seller.vendedor}
                  </h3>
                  <button
                    onClick={() => exportSellerData('products', seller.vendedor)}
                    className="text-xs border border-gray-300 rounded px-2 py-1 bg-white hover:bg-gray-50"
                  >
                    Exportar CSV
                  </button>
                </div>
                <div className="space-y-2">
                  {seller.productDistribution.slice(0, 10).map((product) => (
                    <div key={product.product} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-800">{product.product}</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${Math.min(product.percentage, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="text-right ml-3">
                        <p className="font-semibold text-sm text-blue-600">{product.quantity} unidades</p>
                        <p className="text-xs text-gray-500">{product.percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })()
      )}
        </div>
      ) : activeReport === 'performance' ? (
        sellerAnalyticsData?.sellers ? (
          <SellerPerformanceReport
            sellers={sellerAnalyticsData.sellers}
            formatCurrency={formatCurrency}
          />
        ) : (
          <div className="bg-white rounded-lg p-8 border border-[#E2E4E9] text-center">
            <p className="text-gray-500">No hay datos de vendedores disponibles</p>
          </div>
        )
      ) : activeReport === 'territory' ? (
        sellerAnalyticsData?.sellers ? (
          <TerritoryAnalysisReport
            sellers={sellerAnalyticsData.sellers}
            formatCurrency={formatCurrency}
          />
        ) : (
          <div className="bg-white rounded-lg p-8 border border-[#E2E4E9] text-center">
            <p className="text-gray-500">No hay datos de vendedores disponibles</p>
          </div>
        )
      ) : activeReport === 'churn' ? (
        sellerAnalyticsData?.sellers ? (
          <ChurnRiskReport
            sellers={sellerAnalyticsData.sellers}
            formatCurrency={formatCurrency}
          />
        ) : (
          <div className="bg-white rounded-lg p-8 border border-[#E2E4E9] text-center">
            <p className="text-gray-500">No hay datos de vendedores disponibles</p>
          </div>
        )
      ) : activeReport === 'velocity' ? (
        sellerAnalyticsData?.sellers ? (
          <SalesVelocityReport
            sellers={sellerAnalyticsData.sellers}
            formatCurrency={formatCurrency}
          />
        ) : (
          <div className="bg-white rounded-lg p-8 border border-[#E2E4E9] text-center">
            <p className="text-gray-500">No hay datos de vendedores disponibles</p>
          </div>
        )
      ) : activeReport === 'comparison' ? (
        sellerAnalyticsData?.sellers ? (
          <SellerComparisonReport
            sellers={sellerAnalyticsData.sellers}
            formatCurrency={formatCurrency}
          />
        ) : (
          <div className="bg-white rounded-lg p-8 border border-[#E2E4E9] text-center">
            <p className="text-gray-500">No hay datos de vendedores disponibles</p>
          </div>
        )
      ) : null}
    </div>
  )
}