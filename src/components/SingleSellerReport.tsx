'use client'

import { useState } from 'react'
import { User, Calendar, MapPin, Target, TrendingUp, Users, AlertTriangle, Zap, Package } from 'lucide-react'

interface SingleSellerData {
  vendedor: string
  rank: number
  totalSales: number
  totalVisits: number
  uniqueClients: number
  avgTicket: number
  bestClients: Array<{
    clientName: string
    totalSales: number
    visitCount: number
    avgTicket: number
  }>
  productDistribution: Array<{
    product: string
    quantity: number
    percentage: number
  }>
  salesVelocity: {
    velocityScore: number
    avgTimeBetweenVisits: number
    visitFrequency: number
    monthlyVelocity: Array<{
      month: string
      salesChange: number
      visitsChange: number
    }>
    peakAnalysis: {
      bestSalesDay: string
      bestSalesDayAmount: number
      bestVisitsDay: string
      bestVisitsDayCount: number
      dayPerformance: Record<string, any>
    }
  }
  retentionAnalysis: {
    totalClients: number
    avgCustomerLifetime: number
    avgLoyaltyScore: number
    retentionRate: number
    loyaltySegments: {
      champions: number
      loyalCustomers: number
      potentialLoyalists: number
      atRisk: number
      newCustomers: number
    }
    churnRiskClients: Array<{
      clientName: string
      daysSinceLastVisit: number
      churnRisk: string
      customerValue: number
      lastVisit: string
    }>
  }
  territoryAnalysis: {
    totalClients: number
    territoryArea: number
    clientDensity: number
    avgDistanceBetweenClients: number
    coverageScore: number
  }
}

interface SingleSellerReportProps {
  seller: SingleSellerData
  formatCurrency: (amount: number) => string
  dateFrom?: string
  dateTo?: string
}

export default function SingleSellerReport({
  seller,
  formatCurrency,
  dateFrom,
  dateTo
}: SingleSellerReportProps) {
  const [activeSection, setActiveSection] = useState<'overview' | 'clients' | 'products' | 'velocity' | 'retention' | 'territory'>('overview')

  const periodLabel = (dateFrom && dateTo)
    ? `${dateFrom} al ${dateTo}`
    : 'Año actual'

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
            <div className="text-2xl font-bold">{formatCurrency(seller.totalSales)}</div>
            <p className="text-blue-100">Puesto #{seller.rank} en ranking</p>
          </div>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="bg-white rounded-lg p-3 border border-[#E2E4E9]">
        <div className="flex overflow-x-auto gap-1">
          {[
            { id: 'overview', label: 'Resumen', icon: Target },
            { id: 'clients', label: 'Clientes', icon: Users },
            { id: 'products', label: 'Productos', icon: Package },
            { id: 'velocity', label: 'Velocidad', icon: Zap },
            { id: 'retention', label: 'Retención', icon: AlertTriangle },
            { id: 'territory', label: 'Territorio', icon: MapPin }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id as any)}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap ${
                activeSection === id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeSection === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Ventas Totales</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(seller.totalSales)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Clientes Únicos</p>
                <p className="text-xl font-bold text-blue-600">{seller.uniqueClients}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <div className="flex items-center">
              <Target className="w-8 h-8 text-purple-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Ticket Promedio</p>
                <p className="text-xl font-bold text-purple-600">{formatCurrency(seller.avgTicket)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <div className="flex items-center">
              <Zap className="w-8 h-8 text-orange-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Velocidad</p>
                <p className="text-xl font-bold text-orange-600">{seller.salesVelocity.velocityScore}/100</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'clients' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Best Clients */}
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
              <Users className="mr-2 h-4 w-4" /> Mejores Clientes
            </h3>
            <div className="space-y-2">
              {seller.bestClients.slice(0, 10).map((client, index) => (
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

          {/* Client Segments */}
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
              <Target className="mr-2 h-4 w-4" /> Segmentos de Clientes
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Campeones', value: seller.retentionAnalysis.loyaltySegments.champions, color: 'bg-yellow-100 text-yellow-800' },
                { label: 'Leales', value: seller.retentionAnalysis.loyaltySegments.loyalCustomers, color: 'bg-green-100 text-green-800' },
                { label: 'Potenciales', value: seller.retentionAnalysis.loyaltySegments.potentialLoyalists, color: 'bg-blue-100 text-blue-800' },
                { label: 'En Riesgo', value: seller.retentionAnalysis.loyaltySegments.atRisk, color: 'bg-red-100 text-red-800' },
                { label: 'Nuevos', value: seller.retentionAnalysis.loyaltySegments.newCustomers, color: 'bg-purple-100 text-purple-800' }
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-700">{label}</span>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${color}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSection === 'products' && (
        <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
            <Package className="mr-2 h-4 w-4" /> Distribución de Productos
          </h3>
          <div className="space-y-2">
            {seller.productDistribution.slice(0, 15).map((product) => (
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
      )}

      {activeSection === 'velocity' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <h3 className="font-semibold text-gray-700 mb-3">Métricas de Velocidad</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Puntaje de Velocidad</span>
                <span className="font-semibold text-blue-600">{seller.salesVelocity.velocityScore}/100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Tiempo entre visitas</span>
                <span className="font-semibold">{seller.salesVelocity.avgTimeBetweenVisits.toFixed(1)} días</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Frecuencia de visitas</span>
                <span className="font-semibold">{seller.salesVelocity.visitFrequency.toFixed(1)}/mes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Mejor día (ventas)</span>
                <span className="font-semibold text-green-600">{seller.salesVelocity.peakAnalysis.bestSalesDay}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <h3 className="font-semibold text-gray-700 mb-3">Tendencia Mensual</h3>
            <div className="space-y-2">
              {seller.salesVelocity.monthlyVelocity.map((month) => {
                const monthName = new Date(month.month + '-01').toLocaleDateString('es-ES', { month: 'long' })
                return (
                  <div key={month.month} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                    <span className="text-sm font-medium capitalize">{monthName}</span>
                    <div className="text-right">
                      <span className={`text-sm font-semibold ${month.salesChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {month.salesChange >= 0 ? '+' : ''}{month.salesChange.toFixed(1)}%
                      </span>
                      <p className="text-xs text-gray-500">ventas</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {activeSection === 'retention' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <h3 className="font-semibold text-gray-700 mb-3">Métricas de Retención</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Tasa de retención</span>
                <span className="font-semibold text-green-600">{seller.retentionAnalysis.retentionRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Lealtad promedio</span>
                <span className="font-semibold">{seller.retentionAnalysis.avgLoyaltyScore.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Vida promedio cliente</span>
                <span className="font-semibold">{seller.retentionAnalysis.avgCustomerLifetime.toFixed(0)} días</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <h3 className="font-semibold text-gray-700 mb-3">Clientes en Riesgo</h3>
            <div className="space-y-2">
              {seller.retentionAnalysis.churnRiskClients.slice(0, 5).map((client) => (
                <div key={client.clientName} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                  <div>
                    <p className="font-medium text-sm text-gray-800">{client.clientName}</p>
                    <p className="text-xs text-gray-500">{client.daysSinceLastVisit} días sin visita</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm text-orange-600">{formatCurrency(client.customerValue)}</p>
                    <p className="text-xs text-red-500">{client.churnRisk}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSection === 'territory' && (
        <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
            <MapPin className="mr-2 h-4 w-4" /> Análisis de Territorio
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{seller.territoryAnalysis.totalClients}</div>
              <div className="text-xs text-gray-600">Total Clientes</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{seller.territoryAnalysis.territoryArea.toFixed(0)}</div>
              <div className="text-xs text-gray-600">km² Territorio</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{seller.territoryAnalysis.clientDensity.toFixed(2)}</div>
              <div className="text-xs text-gray-600">Clientes/km²</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{seller.territoryAnalysis.coverageScore}</div>
              <div className="text-xs text-gray-600">Score Cobertura</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}