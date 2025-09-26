'use client'

import { TrendingUp, Users, Target, Award, Calendar, Clock } from 'lucide-react'

interface SellerAnalytics {
  vendedor: string
  rank: number
  totalSales: number
  totalVisits: number
  uniqueClients: number
  avgTicket: number
  salesVelocity: {
    avgTimeBetweenVisits: number
    avgTimeToDeal: number
    visitFrequency: number
    velocityScore: number
    peakAnalysis: {
      bestSalesDay: string
      bestSalesDayAmount: number
      bestVisitsDay: string
      bestVisitsDayCount: number
    }
  }
  retentionAnalysis: {
    retentionRate: number
    avgLoyaltyScore: number
    avgCustomerLifetime: number
  }
}

interface SellerPerformanceReportProps {
  sellers: SellerAnalytics[]
  formatCurrency: (amount: number) => string
}

export default function SellerPerformanceReport({
  sellers,
  formatCurrency
}: SellerPerformanceReportProps) {
  // Performance metrics calculations
  const avgSales = sellers.reduce((sum, s) => sum + s.totalSales, 0) / sellers.length
  const avgTicket = sellers.reduce((sum, s) => sum + s.avgTicket, 0) / sellers.length
  const avgRetention = sellers.reduce((sum, s) => sum + s.retentionAnalysis.retentionRate, 0) / sellers.length

  // Top performers by different metrics
  const topBySales = [...sellers].sort((a, b) => b.totalSales - a.totalSales).slice(0, 3)
  const topByVelocity = [...sellers].sort((a, b) => b.salesVelocity.velocityScore - a.salesVelocity.velocityScore).slice(0, 3)
  const topByRetention = [...sellers].sort((a, b) => b.retentionAnalysis.retentionRate - a.retentionAnalysis.retentionRate).slice(0, 3)

  return (
    <div className="space-y-4">
      {/* Overall Performance Metrics */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <Award className="mr-2 h-4 w-4" /> Métricas Generales de Equipo
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center">
              <TrendingUp className="w-4 h-4 text-green-600 mr-2" />
              <div>
                <p className="text-xs text-gray-600">Ventas Promedio</p>
                <p className="text-sm font-bold text-green-600">{formatCurrency(avgSales)}</p>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center">
              <Target className="w-4 h-4 text-blue-600 mr-2" />
              <div>
                <p className="text-xs text-gray-600">Ticket Promedio</p>
                <p className="text-sm font-bold text-blue-600">{formatCurrency(avgTicket)}</p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="flex items-center">
              <Users className="w-4 h-4 text-purple-600 mr-2" />
              <div>
                <p className="text-xs text-gray-600">Retención Prom.</p>
                <p className="text-sm font-bold text-purple-600">{avgRetention.toFixed(1)}%</p>
              </div>
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <div className="flex items-center">
              <Award className="w-4 h-4 text-orange-600 mr-2" />
              <div>
                <p className="text-xs text-gray-600">Total Vendedores</p>
                <p className="text-sm font-bold text-orange-600">{sellers.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Performers by Sales */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <TrendingUp className="mr-2 h-4 w-4 text-green-500" /> Top 3 - Ventas Totales
        </h3>
        <div className="space-y-2">
          {topBySales.map((seller, index) => (
            <div key={seller.vendedor} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
              <div className="flex items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${
                  index === 0 ? 'bg-yellow-100 text-yellow-800' :
                  index === 1 ? 'bg-gray-100 text-gray-800' :
                  'bg-orange-100 text-orange-800'
                }`}>
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-800">{seller.vendedor}</p>
                  <p className="text-xs text-gray-500">{seller.uniqueClients} clientes • {seller.totalVisits} visitas</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm text-green-600">{formatCurrency(seller.totalSales)}</p>
                <p className="text-xs text-gray-500">
                  {((seller.totalSales / avgSales - 1) * 100).toFixed(0)}% vs promedio
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Performers by Velocity */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <Clock className="mr-2 h-4 w-4 text-blue-500" /> Top 3 - Velocidad de Ventas
        </h3>
        <div className="space-y-2">
          {topByVelocity.map((seller, index) => (
            <div key={seller.vendedor} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
              <div className="flex items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${
                  index === 0 ? 'bg-yellow-100 text-yellow-800' :
                  index === 1 ? 'bg-gray-100 text-gray-800' :
                  'bg-orange-100 text-orange-800'
                }`}>
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-800">{seller.vendedor}</p>
                  <p className="text-xs text-gray-500">
                    Mejor día: {seller.salesVelocity.peakAnalysis.bestSalesDay}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm text-blue-600">{seller.salesVelocity.velocityScore}/100</p>
                <p className="text-xs text-gray-500">
                  {seller.salesVelocity.avgTimeBetweenVisits.toFixed(1)} días entre visitas
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Performers by Client Retention */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <Users className="mr-2 h-4 w-4 text-purple-500" /> Top 3 - Retención de Clientes
        </h3>
        <div className="space-y-2">
          {topByRetention.map((seller, index) => (
            <div key={seller.vendedor} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
              <div className="flex items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${
                  index === 0 ? 'bg-yellow-100 text-yellow-800' :
                  index === 1 ? 'bg-gray-100 text-gray-800' :
                  'bg-orange-100 text-orange-800'
                }`}>
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-800">{seller.vendedor}</p>
                  <p className="text-xs text-gray-500">
                    Lealtad promedio: {seller.retentionAnalysis.avgLoyaltyScore.toFixed(0)}%
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm text-purple-600">
                  {seller.retentionAnalysis.retentionRate.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500">
                  {seller.retentionAnalysis.avgCustomerLifetime.toFixed(0)} días vida cliente
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Distribution */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
          <Calendar className="mr-2 h-4 w-4" /> Análisis de Días de Mejor Rendimiento
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
            const dayInSpanish = {
              'Monday': 'Lunes',
              'Tuesday': 'Martes',
              'Wednesday': 'Miércoles',
              'Thursday': 'Jueves',
              'Friday': 'Viernes',
              'Saturday': 'Sábado',
              'Sunday': 'Domingo'
            }[day] || day

            const sellersWithBestDay = sellers.filter(s => s.salesVelocity.peakAnalysis.bestSalesDay === day)
            const count = sellersWithBestDay.length
            const percentage = sellers.length > 0 ? (count / sellers.length) * 100 : 0

            return (
              <div key={day} className="text-center p-2 bg-gray-50 rounded">
                <p className="text-xs font-medium text-gray-700">{dayInSpanish}</p>
                <p className="text-lg font-bold text-blue-600">{count}</p>
                <p className="text-xs text-gray-500">{percentage.toFixed(0)}%</p>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Número de vendedores que tienen su mejor día de ventas en cada día de la semana
        </p>
      </div>
    </div>
  )
}