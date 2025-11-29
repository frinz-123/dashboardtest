'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ChevronDown, Calendar, TrendingUp, TrendingDown, Users, Target, ArrowLeft, CheckCircle2, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import BlurIn from '@/components/ui/blur-in'
import { isMasterAccount, EMAIL_TO_VENDOR_LABELS } from '@/utils/auth'
import { getAllPeriods, getPeriodDateRange, getPeriodWeeks, isDateInPeriod } from '@/utils/dateUtils'
import { getSellerGoal, getSellersWithGoals, GoalPeriod } from '@/utils/sellerGoals'

const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY
const spreadsheetId = process.env.NEXT_PUBLIC_SPREADSHEET_ID
const sheetName = process.env.NEXT_PUBLIC_SHEET_NAME

type Sale = {
  clientName: string
  venta: number
  codigo: string
  fechaSinHora: string
  email: string
}

type SellerStats = {
  email: string
  name: string
  totalSales: number
  goal: number
  progress: number
  weeklyBreakdown: number[]
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316']

export default function InspectorPeriodosPage() {
  const { data: session, status } = useSession()
  const [salesData, setSalesData] = useState<Sale[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false)

  const availablePeriods = useMemo(() => getAllPeriods().reverse(), [])
  const isAdmin = useMemo(() => isMasterAccount(session?.user?.email), [session])

  // Set default period to most recent completed or current
  useEffect(() => {
    if (availablePeriods.length > 0 && selectedPeriod === null) {
      // Find the most recent completed period, or current if none completed
      const completedPeriod = availablePeriods.find(p => p.isCompleted)
      setSelectedPeriod(completedPeriod?.periodNumber || availablePeriods[0].periodNumber)
    }
  }, [availablePeriods, selectedPeriod])

  // Fetch sales data
  useEffect(() => {
    if (isAdmin) {
      fetchData()
    }
  }, [isAdmin])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:AK?key=${googleApiKey}`
      )
      const data = await response.json()
      const rows = data.values?.slice(1) || []
      const sales: Sale[] = rows.map((row: string[]) => ({
        clientName: row[0] || 'Unknown',
        venta: parseFloat(row[33]) || 0,
        codigo: row[31] || '',
        fechaSinHora: row[32] || '',
        email: row[7] || '',
      }))
      setSalesData(sales)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate seller stats for selected period
  const sellerStats = useMemo((): SellerStats[] => {
    if (!selectedPeriod || salesData.length === 0) return []

    const { periodStartDate, periodEndDate } = getPeriodDateRange(selectedPeriod)
    const weeks = getPeriodWeeks(selectedPeriod)
    const sellers = getSellersWithGoals()

    return sellers.map(email => {
      const sellerSales = salesData.filter(sale => {
        if (sale.email !== email) return false
        const saleDate = new Date(sale.fechaSinHora)
        return isDateInPeriod(saleDate, periodStartDate, periodEndDate)
      })

      const totalSales = sellerSales.reduce((sum, sale) => sum + sale.venta, 0)
      const goal = getSellerGoal(email, selectedPeriod as GoalPeriod)
      const progress = goal > 0 ? (totalSales / goal) * 100 : 0

      // Calculate weekly breakdown
      const weeklyBreakdown = weeks.map(week => {
        return sellerSales
          .filter(sale => {
            const saleDate = new Date(sale.fechaSinHora)
            return isDateInPeriod(saleDate, week.weekStart, week.weekEnd)
          })
          .reduce((sum, sale) => sum + sale.venta, 0)
      })

      return {
        email,
        name: EMAIL_TO_VENDOR_LABELS[email] || email.split('@')[0],
        totalSales,
        goal,
        progress,
        weeklyBreakdown
      }
    }).sort((a, b) => b.totalSales - a.totalSales)
  }, [selectedPeriod, salesData])

  // Summary stats
  const summaryStats = useMemo(() => {
    if (sellerStats.length === 0) return null

    const totalTeamSales = sellerStats.reduce((sum, s) => sum + s.totalSales, 0)
    const totalTeamGoal = sellerStats.reduce((sum, s) => sum + s.goal, 0)
    const avgProgress = sellerStats.length > 0
      ? sellerStats.reduce((sum, s) => sum + s.progress, 0) / sellerStats.length
      : 0
    const sellersOnTrack = sellerStats.filter(s => s.progress >= 100).length
    const bestPerformer = sellerStats[0]

    return {
      totalTeamSales,
      totalTeamGoal,
      avgProgress,
      sellersOnTrack,
      bestPerformer
    }
  }, [sellerStats])

  const selectedPeriodInfo = useMemo(() => {
    if (!selectedPeriod) return null
    return getPeriodDateRange(selectedPeriod)
  }, [selectedPeriod])

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'text-green-600 bg-green-50'
    if (progress >= 75) return 'text-blue-600 bg-blue-50'
    if (progress >= 50) return 'text-amber-600 bg-amber-50'
    return 'text-red-600 bg-red-50'
  }

  const getProgressBarColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500'
    if (progress >= 75) return 'bg-blue-500'
    if (progress >= 50) return 'bg-amber-500'
    return 'bg-red-500'
  }

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Cargando...</div>
      </div>
    )
  }

  // Not authenticated
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 text-center max-w-md">
          <h1 className="text-xl font-bold text-gray-800 mb-2">Acceso Restringido</h1>
          <p className="text-gray-600 mb-4">Debes iniciar sesion para acceder a esta pagina.</p>
          <Link href="/" className="text-blue-600 hover:underline">
            Ir al inicio
          </Link>
        </div>
      </div>
    )
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 text-center max-w-md">
          <h1 className="text-xl font-bold text-gray-800 mb-2">Acceso Restringido</h1>
          <p className="text-gray-600 mb-4">Solo los administradores pueden acceder al Inspector de Periodos.</p>
          <Link href="/" className="text-blue-600 hover:underline">
            Volver al Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const currentPeriodData = availablePeriods.find(p => p.periodNumber === selectedPeriod)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <BlurIn word="Inspector de Periodos" className="text-lg font-bold text-gray-800" />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>{session.user?.email}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Period Selector */}
        <div className="bg-white rounded-xl p-4 mb-6 border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-1">Seleccionar Periodo</h2>
              <p className="text-xs text-gray-500">Elige un periodo para ver el detalle de ventas y metas</p>
            </div>

            <div className="relative">
              <button
                onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
                className="flex items-center justify-between gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg min-w-[200px] text-sm font-medium"
              >
                <span>
                  {currentPeriodData ? (
                    <>
                      Periodo {selectedPeriod}
                      {currentPeriodData.isCurrent && ' (Actual)'}
                    </>
                  ) : (
                    'Seleccionar...'
                  )}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isPeriodDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isPeriodDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-10 max-h-80 overflow-y-auto">
                  {availablePeriods.map((period) => (
                    <button
                      key={period.periodNumber}
                      onClick={() => {
                        setSelectedPeriod(period.periodNumber)
                        setIsPeriodDropdownOpen(false)
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                        selectedPeriod === period.periodNumber ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-800">Periodo {period.periodNumber}</span>
                        <span className="flex items-center gap-1">
                          {period.isCurrent ? (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Actual
                            </span>
                          ) : period.isCompleted ? (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Completado
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{period.label}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedPeriodInfo && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>
                  {selectedPeriodInfo.periodStartDate.toLocaleDateString('es-ES', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                  {' - '}
                  {selectedPeriodInfo.periodEndDate.toLocaleDateString('es-ES', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Cargando datos...</div>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            {summaryStats && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Ventas Totales</span>
                  </div>
                  <p className="text-xl font-bold text-gray-800">{formatCurrency(summaryStats.totalTeamSales)}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    de {formatCurrency(summaryStats.totalTeamGoal)} meta
                  </p>
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-green-50 rounded-lg">
                      <Target className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Progreso Promedio</span>
                  </div>
                  <p className="text-xl font-bold text-gray-800">{summaryStats.avgProgress.toFixed(1)}%</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {summaryStats.sellersOnTrack} de {sellerStats.length} en meta
                  </p>
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-amber-50 rounded-lg">
                      <Users className="w-4 h-4 text-amber-600" />
                    </div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Mejor Vendedor</span>
                  </div>
                  <p className="text-xl font-bold text-gray-800">{summaryStats.bestPerformer?.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatCurrency(summaryStats.bestPerformer?.totalSales || 0)}
                  </p>
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-purple-50 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Estado</span>
                  </div>
                  <p className="text-xl font-bold text-gray-800">
                    {currentPeriodData?.isCompleted ? 'Completado' : 'En Curso'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Periodo {selectedPeriod}
                  </p>
                </div>
              </div>
            )}

            {/* Seller Comparison Chart */}
            <div className="bg-white rounded-xl p-4 mb-6 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Comparativa de Vendedores</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sellerStats} layout="vertical" margin={{ left: 80, right: 20, top: 10, bottom: 10 }}>
                    <XAxis
                      type="number"
                      tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`}
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#374151' }}
                      width={70}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Ventas']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="totalSales" radius={[0, 4, 4, 0]}>
                      {sellerStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Seller Details Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">Detalle por Vendedor</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Vendedor</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Ventas</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Meta</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600">Progreso</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600 hidden sm:table-cell">S1</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600 hidden sm:table-cell">S2</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600 hidden sm:table-cell">S3</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600 hidden sm:table-cell">S4</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellerStats.map((seller, index) => (
                      <tr key={seller.email} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="font-medium text-gray-800">{seller.name}</span>
                          </div>
                        </td>
                        <td className="text-right py-3 px-4 font-medium text-gray-800">
                          {formatCurrency(seller.totalSales)}
                        </td>
                        <td className="text-right py-3 px-4 text-gray-600">
                          {formatCurrency(seller.goal)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${getProgressBarColor(seller.progress)}`}
                                style={{ width: `${Math.min(seller.progress, 100)}%` }}
                              />
                            </div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getProgressColor(seller.progress)}`}>
                              {seller.progress.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        {seller.weeklyBreakdown.map((weekSales, i) => (
                          <td key={i} className="text-right py-3 px-4 text-gray-600 hidden sm:table-cell">
                            ${(weekSales/1000).toFixed(1)}k
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-medium">
                      <td className="py-3 px-4 text-gray-800">Total</td>
                      <td className="text-right py-3 px-4 text-gray-800">
                        {formatCurrency(summaryStats?.totalTeamSales || 0)}
                      </td>
                      <td className="text-right py-3 px-4 text-gray-600">
                        {formatCurrency(summaryStats?.totalTeamGoal || 0)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getProgressColor(summaryStats?.avgProgress || 0)}`}>
                          {(summaryStats?.avgProgress || 0).toFixed(1)}% prom
                        </span>
                      </td>
                      {[0, 1, 2, 3].map(i => (
                        <td key={i} className="text-right py-3 px-4 text-gray-600 hidden sm:table-cell">
                          ${((sellerStats.reduce((sum, s) => sum + s.weeklyBreakdown[i], 0))/1000).toFixed(1)}k
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Progress Distribution Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribucion de Progreso</h3>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'En meta (100%+)', value: sellerStats.filter(s => s.progress >= 100).length },
                          { name: 'Cerca (75-99%)', value: sellerStats.filter(s => s.progress >= 75 && s.progress < 100).length },
                          { name: 'Medio (50-74%)', value: sellerStats.filter(s => s.progress >= 50 && s.progress < 75).length },
                          { name: 'Bajo (<50%)', value: sellerStats.filter(s => s.progress < 50).length },
                        ].filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={{ stroke: '#6b7280', strokeWidth: 1 }}
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#3b82f6" />
                        <Cell fill="#f59e0b" />
                        <Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Resumen del Periodo</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Periodo</span>
                    <span className="font-medium text-gray-800">#{selectedPeriod}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Vendedores activos</span>
                    <span className="font-medium text-gray-800">{sellerStats.filter(s => s.totalSales > 0).length}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Cumplieron meta</span>
                    <span className="font-medium text-green-600">{sellerStats.filter(s => s.progress >= 100).length}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">No cumplieron meta</span>
                    <span className="font-medium text-red-600">{sellerStats.filter(s => s.progress < 100 && s.totalSales > 0).length}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Diferencia vs Meta</span>
                    <span className={`font-medium ${(summaryStats?.totalTeamSales || 0) >= (summaryStats?.totalTeamGoal || 0) ? 'text-green-600' : 'text-red-600'}`}>
                      {(summaryStats?.totalTeamSales || 0) >= (summaryStats?.totalTeamGoal || 0) ? '+' : ''}
                      {formatCurrency((summaryStats?.totalTeamSales || 0) - (summaryStats?.totalTeamGoal || 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
