'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Menu, TrendingUp, DollarSign, Package, Calendar, Users, BarChart3, PieChart, Activity, Filter, Trophy, ArrowRight, Target, Lightbulb, AlertTriangle } from 'lucide-react'
import BlurIn from '@/components/ui/blur-in'
import SearchInput from '@/components/ui/SearchInput'
import InputGray from '@/components/ui/InputGray'

// Custom ScrollableTabs component for mobile-friendly tab navigation
function ScrollableTabs({
  tabs,
  activeTab,
  onTabChange,
  className = ""
}: {
  tabs: Array<{ id: string; label: string; icon: React.ComponentType<any> }>
  activeTab: string
  onTabChange: (tabId: string) => void
  className?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll active tab into view on mobile
  useEffect(() => {
    if (scrollRef.current && window.innerWidth < 768) {
      const activeButton = scrollRef.current.querySelector(`[data-tab-id="${activeTab}"]`) as HTMLElement
      if (activeButton) {
        const container = scrollRef.current
        const buttonLeft = activeButton.offsetLeft
        const buttonWidth = activeButton.offsetWidth
        const containerWidth = container.offsetWidth
        const scrollLeft = buttonLeft - (containerWidth / 2) + (buttonWidth / 2)

        container.scrollTo({
          left: scrollLeft,
          behavior: 'smooth'
        })
      }
    }
  }, [activeTab])

  return (
    <div className={`bg-white rounded-lg p-2 border border-[#E2E4E9] ${className}`}>
      <div
        ref={scrollRef}
        className="flex overflow-x-auto gap-1 pb-1"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth',
          touchAction: 'pan-x',
          maxWidth: '100%',
        }}
        onScroll={(e) => {
          // Hide scrollbar on scroll
          const target = e.target as HTMLElement
          target.style.scrollbarWidth = 'none'
        }}
      >
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              data-tab-id={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap
                ${isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                }
              `}
              style={{
                touchAction: 'manipulation',
                minWidth: 'fit-content',
              }}
            >
              <Icon className="w-4 h-4 mr-2 flex-shrink-0" />
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface ClientEntry {
  id: number
  clientName: string
  clientCode: string
  date: string
  total: number
  userEmail: string
  location: {
    clientLat: string
    clientLng: string
    currentLat: string
    currentLng: string
  }
  products: Record<string, number>
  periodWeek: string
  cleyOrderValue: string
}

interface ProductStats {
  product: string
  quantity: number
  revenue: number
}

interface SalesTrend {
  month: string
  sales: number
  entries: number
}

interface ClientStats {
  totalSales: number
  entries: number
  avgOrder: number
  lastVisit: string
}

interface ClientData {
  recentEntries: ClientEntry[]
  yearlySales: number
  allTimeSales: number
  productBreakdown: Record<string, { quantity: number, revenue: number }>
  salesTrend: SalesTrend[]
  totalEntries: number
}

interface AnalyticsData {
  totalSales: number
  totalClients: number
  topProducts: ProductStats[]
  monthlyTrend: Array<{ month: string, sales: number, clients: number }>
  topClients: Array<{ client: string } & ClientStats>
  clientStats: Record<string, ClientStats>
  // Optional mapping if backend provides client codes (client name -> code)
  clientCodes?: Record<string, string>
  // Aggregated products by client code for current year
  productsByCode?: Record<string, Record<string, number>>
}

// duplicate removed

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount)
}

const formatDate = (dateString: string): string => {
  if (!dateString) return 'Fecha no disponible'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return dateString
  }
}

// Returns items whose month belongs to the current year and is strictly before the current month
function getPastMonthsOfCurrentYear<T extends { month: string }>(items: T[]): T[] {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonthIndex = now.getMonth() // 0-11

  const parsed = items.filter(i => {
    if (!i?.month) return false
    const d = new Date(i.month + '-01')
    if (isNaN(d.getTime())) return false
    return d.getFullYear() === currentYear && d.getMonth() < currentMonthIndex
  })

  // Sort ascending by month within the year
  return parsed.sort((a, b) => {
    const da = new Date(a.month + '-01').getTime()
    const db = new Date(b.month + '-01').getTime()
    return da - db
  })
}

// Compute average ticket excluding entries with total <= 0
function computeAverageTicket(entries: ClientEntry[]): number {
  const valid = entries.filter(e => (e.total || 0) > 0)
  if (valid.length === 0) return 0
  const sum = valid.reduce((s, e) => s + (e.total || 0), 0)
  return sum / valid.length
}

function daysSince(dateString?: string): number {
  if (!dateString) return Number.POSITIVE_INFINITY
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return Number.POSITIVE_INFINITY
  const ms = Date.now() - d.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

// Dashboard widget: Clientes Desatendidos
function ClientesDesatendidos({
  analyticsData,
  isLoading,
  onSelectClient
}: {
  analyticsData: AnalyticsData | null
  isLoading: boolean
  onSelectClient: (clientName: string) => void
}) {
  const [sortBy, setSortBy] = useState<'score' | 'ventas' | 'visitas' | 'ultimaVisita'>('score')
  const [showMore, setShowMore] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const [isCodesOpen, setIsCodesOpen] = useState(false)

  const codeOptions = useMemo(() => {
    if (!analyticsData?.clientCodes) return [] as string[]
    const all = Object.values(analyticsData.clientCodes).filter(Boolean)
    return Array.from(new Set(all)).sort()
  }, [analyticsData])

  const items = useMemo(() => {
    if (!analyticsData?.clientStats) return []

    const rows = Object.entries(analyticsData.clientStats).map(([client, stats]) => {
      const code = analyticsData.clientCodes?.[client] ?? ''
      const lastDays = daysSince(stats.lastVisit)
      return {
        client,
        code,
        totalSales: stats.totalSales || 0,
        entries: stats.entries || 0,
        avgOrder: stats.avgOrder || 0,
        lastVisit: stats.lastVisit || '',
        lastDays
      }
    })
    // Ignore clients with no code
    .filter(r => !!r.code)

    // Filter by query on client or code
    const filtered = query
      ? rows.filter(r =>
          r.client.toLowerCase().includes(query.toLowerCase()) ||
          (r.code && r.code.toLowerCase().includes(query.toLowerCase()))
        )
      : rows

    const codeFiltered = selectedCodes.length > 0
      ? filtered.filter(r => selectedCodes.includes(r.code))
      : filtered

    const sorted = [...codeFiltered].sort((a, b) => {
      if (sortBy === 'ventas') {
        return a.totalSales - b.totalSales
      }
      if (sortBy === 'visitas') {
        return a.entries - b.entries
      }
      if (sortBy === 'ultimaVisita') {
        return b.lastDays - a.lastDays
      }
      // score: prioritize low sales, then low entries, then older last visit
      if (a.totalSales !== b.totalSales) return a.totalSales - b.totalSales
      if (a.entries !== b.entries) return a.entries - b.entries
      return b.lastDays - a.lastDays
    })

    return sorted
  }, [analyticsData, query, sortBy, selectedCodes])

  const limit = showMore ? 50 : 10
  const visible = items.slice(0, limit)

  return (
    <div>
      <div className="mb-3 space-y-2">
        <h3 className="font-semibold text-gray-700 flex items-center text-sm">
          <AlertTriangle className="mr-2 h-4 w-4 text-amber-500" /> Clientes Desatendidos
        </h3>
        <div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nombre o código"
            className="w-full text-base sm:text-sm border border-gray-300 rounded px-2 h-11"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Codes multi-select */}
          <div className="relative">
            <button
              type="button"
              className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
              onClick={() => setIsCodesOpen(!isCodesOpen)}
            >
              {selectedCodes.length > 0 ? `Códigos (${selectedCodes.length})` : 'Filtrar códigos'}
            </button>
            {isCodesOpen && (
              <div className="absolute z-10 mt-1 w-56 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto p-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-600">Selecciona uno o más</p>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => setSelectedCodes([])}
                  >
                    Limpiar
                  </button>
                </div>
                {codeOptions.length === 0 ? (
                  <p className="text-xs text-gray-500">Sin códigos disponibles</p>
                ) : (
                  codeOptions.map(code => {
                    const checked = selectedCodes.includes(code)
                    return (
                      <label key={code} className="flex items-center space-x-2 py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCodes(prev => [...prev, code])
                            } else {
                              setSelectedCodes(prev => prev.filter(c => c !== code))
                            }
                          }}
                        />
                        <span className="text-xs text-gray-700">{code}</span>
                      </label>
                    )
                  })
                )}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-1">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="score">Orden mixto</option>
              <option value="ventas">Menor ventas</option>
              <option value="visitas">Menor visitas</option>
              <option value="ultimaVisita">Última visita más antigua</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Cargando clientes...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500">No hay datos suficientes para mostrar.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {visible.map((row) => {
              const needsAttention = row.lastDays >= 60 || row.entries <= 1
              return (
                <div
                  key={row.client}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50 rounded"
                  onClick={() => onSelectClient(row.client)}
                >
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-3 ${needsAttention ? 'bg-amber-500' : 'bg-gray-300'}`}></div>
                    <div>
                      <p className="font-medium text-sm text-gray-800">{row.client}</p>
                      <p className="text-xs text-gray-500">{row.code || 'Sin código'}</p>
                    </div>
                  </div>
                  <div className="hidden sm:flex w-[400px]">
                    <div className="w-[120px] text-right">
                      <p className="text-xs text-gray-500">Ventas</p>
                      <p className="font-semibold text-sm text-green-600 tabular-nums">{formatCurrency(row.totalSales)}</p>
                    </div>
                    <div className="w-[80px] text-right">
                      <p className="text-xs text-gray-500">Visitas</p>
                      <p className="font-semibold text-sm text-blue-600 tabular-nums">{row.entries}</p>
                    </div>
                    <div className="w-[120px] text-right">
                      <p className="text-xs text-gray-500">Promedio</p>
                      <p className="font-semibold text-sm text-gray-800 tabular-nums">{formatCurrency(row.avgOrder)}</p>
                    </div>
                    <div className="w-[80px]"></div>
                  </div>
                  <div className="text-right w-[160px]">
                    <p className="text-xs text-gray-500">Última visita</p>
                    <p className="font-medium text-xs text-gray-700">
                      {row.lastVisit ? formatDate(row.lastVisit) : 'N/D'}
                      {row.lastDays >= 60 && <span className="ml-2 text-amber-600">· {row.lastDays} días</span>}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-gray-500">Mostrando {visible.length} de {Math.min(items.length, 50)}{items.length > 50 ? '+' : ''}</p>
            <button
              className="text-xs font-medium text-blue-600 hover:underline flex items-center"
              onClick={() => setShowMore(!showMore)}
            >
              {showMore ? 'Ver menos' : 'Ver más'}
              <ArrowRight className={`h-3 w-3 ml-1 ${showMore ? 'transform rotate-180' : ''}`} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// Dashboard widget: Productos por código
function ProductosPorCodigo({
  analyticsData,
  isLoading
}: {
  analyticsData: AnalyticsData | null
  isLoading: boolean
}) {
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<'quantity' | 'product' | 'code' | 'shareCode'>('quantity')
  const [topN, setTopN] = useState<10 | 25 | 50 | 100 | 1000>(25)
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const [isCodesOpen, setIsCodesOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const productsByCode = analyticsData?.productsByCode || {}

  const codeOptions = useMemo(() => {
    return Object.keys(productsByCode).sort()
  }, [productsByCode])

  const filteredCodes = selectedCodes

  const flattenedRows = useMemo(() => {
    type Row = {
      code: string
      product: string
      quantity: number
      percentOfCode: number
    }
    const rows: Row[] = []

    // Union of all products across ALL codes (used to show 0s when specific codes are filtered)
    const allProductsAllCodes = Array.from(
      new Set(
        Object.values(productsByCode).flatMap(map => Object.keys(map || {}))
      )
    ).sort()

    filteredCodes.forEach(code => {
      const map = productsByCode[code] || {}
      const codeTotal = Object.values(map).reduce((s, q) => s + (q || 0), 0)
      const productListForRows = selectedCodes.length > 0 ? allProductsAllCodes : Object.keys(map)

      productListForRows.forEach(product => {
        if (!product) return
        if (query && !product.toLowerCase().includes(query.toLowerCase())) return
        const quantity = map[product] || 0
        const percentOfCode = codeTotal > 0 ? quantity / codeTotal : 0
        rows.push({ code, product, quantity, percentOfCode })
      })
    })

    // Sort rows
    rows.sort((a, b) => {
      if (sortBy === 'quantity') return b.quantity - a.quantity
      if (sortBy === 'product') return a.product.localeCompare(b.product)
      if (sortBy === 'code') return a.code.localeCompare(b.code)
      if (sortBy === 'shareCode') return b.percentOfCode - a.percentOfCode
      return 0
    })

    return rows
  }, [productsByCode, filteredCodes, selectedCodes.length, query, sortBy])

  const visibleRows = useMemo(() => flattenedRows.slice(0, topN), [flattenedRows, topN])

  const totalsByCode = useMemo(() => {
    const totals: Record<string, number> = {}
    filteredCodes.forEach(code => {
      const qtySum = Object.values(productsByCode[code] || {}).reduce((s, q) => s + (q || 0), 0)
      totals[code] = qtySum
    })
    return totals
  }, [productsByCode, filteredCodes])

  const grandTotal = useMemo(() => Object.values(totalsByCode).reduce((s, v) => s + v, 0), [totalsByCode])

  const exportCSV = () => {
    try {
      const headers = ['Codigo', 'Producto', 'Cantidad', 'Part_codigo_%']
      const lines = [headers.join(',')]
      visibleRows.forEach(r => {
        const row = [r.code, r.product, String(r.quantity), (r.percentOfCode * 100).toFixed(2) + '%']
        // Escape commas and quotes
        const escaped = row.map(v => '"' + String(v).replace(/"/g, '""') + '"')
        lines.push(escaped.join(','))
      })
      const csvContent = lines.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'productos_por_codigo.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('CSV export failed', e)
    }
  }

  return (
    <div>
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-700 flex items-center text-sm">
            <Package className="mr-2 h-4 w-4" /> Productos por código
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? 'Expandir' : 'Colapsar'}
            </button>
            <button
              type="button"
              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
              onClick={exportCSV}
              disabled={isLoading || !analyticsData?.productsByCode || visibleRows.length === 0}
            >
              Exportar CSV
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">Resumen de unidades vendidas por producto agrupado por código de cliente (año actual).</p>
      </div>

      {isLoading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Cargando datos...</p>
        </div>
      ) : !analyticsData?.productsByCode || codeOptions.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500">No hay datos de productos por código disponibles.</p>
        </div>
      ) : (
        <>
          {/* Controls */}
          <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Codes multi-select */}
            <div className="relative">
              <label className="block text-xs text-gray-600 mb-1">Filtrar por códigos</label>
              <button
                type="button"
                className="w-full text-sm border border-gray-300 rounded px-2 py-2 bg-white text-left"
                onClick={() => setIsCodesOpen(!isCodesOpen)}
              >
                {selectedCodes.length > 0 ? `Códigos (${selectedCodes.length})` : 'Selecciona códigos'}
              </button>
              {isCodesOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-56 overflow-y-auto p-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-600">Selecciona uno o más</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => setSelectedCodes(codeOptions)}
                      >
                        Seleccionar todos
                      </button>
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => setSelectedCodes([])}
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>
                  {codeOptions.map(code => {
                    const checked = selectedCodes.includes(code)
                    return (
                      <label key={code} className="flex items-center space-x-2 py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedCodes(prev => Array.from(new Set([...prev, code])))
                            else setSelectedCodes(prev => prev.filter(c => c !== code))
                          }}
                        />
                        <span className="text-xs text-gray-700">{code}</span>
                        <span className="ml-auto text-[10px] text-gray-500">{Object.values(productsByCode[code] || {}).reduce((s, q) => s + (q || 0), 0)} u</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Product search */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">Buscar producto</label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nombre del producto"
                className="w-full text-sm border border-gray-300 rounded px-2 py-2"
              />
            </div>

            {/* Sort and Top N */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Ordenar por</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-2"
                  disabled={selectedCodes.length === 0}
                >
                  <option value="quantity">Cantidad (desc)</option>
                  <option value="product">Producto (A-Z)</option>
                  <option value="code">Código (A-Z)</option>
                  <option value="shareCode">Part. código (desc)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Top</label>
                <select
                  value={String(topN)}
                  onChange={(e) => setTopN(parseInt(e.target.value, 10) as any)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-2"
                  disabled={selectedCodes.length === 0}
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="1000">Todos</option>
                </select>
              </div>
            </div>
          </div>

          {selectedCodes.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-gray-200 rounded-md bg-gray-50">
              <p className="text-sm text-gray-600">Selecciona uno o más códigos para ver productos.</p>
            </div>
          ) : (
            <>
              {/* Summary by code */}
              {!collapsed && (
                <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {filteredCodes.map(code => {
                    const codeTotal = totalsByCode[code] || 0
                    const pct = grandTotal > 0 ? Math.round((codeTotal / grandTotal) * 100) : 0
                    return (
                      <div key={code} className="border border-gray-200 rounded-md p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-gray-700">{code}</p>
                          <p className="text-sm font-semibold text-blue-600">{codeTotal} u</p>
                        </div>
                        <div className="h-2 bg-gray-100 rounded">
                          <div className="h-2 bg-blue-500 rounded" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1">{pct}% del total seleccionado</p>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-2 pr-4">Código</th>
                      <th className="py-2 pr-4">Producto</th>
                      <th className="py-2 pr-4 text-right">Cantidad</th>
                      <th className="py-2 pr-4 text-right">Part. en código</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-4 text-gray-500">Sin resultados</td>
                      </tr>
                    ) : (
                      visibleRows.map(row => (
                        <tr key={`${row.code}-${row.product}`} className="border-t border-gray-100">
                          <td className="py-2 pr-4">{row.code}</td>
                          <td className="py-2 pr-4">{row.product}</td>
                          <td className="py-2 pr-4 text-right font-semibold text-gray-800 tabular-nums">{row.quantity}</td>
                          <td className="py-2 pr-4 text-right text-gray-600 tabular-nums">{(row.percentOfCode * 100).toFixed(1)}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default function ClientesPage() {
  const { data: session, status } = useSession()
  const allowedEmails = useMemo(() => (
    ['franzcharbell@gmail.com', 'alopezelrey@gmail.com', 'cesar.reyes.ochoa@gmail.com']
  ), [])
  const userEmail = (session?.user?.email || '').toLowerCase()
  const isAllowed = allowedEmails.includes(userEmail)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [clientNames, setClientNames] = useState<string[]>([])
  const [filteredClients, setFilteredClients] = useState<string[]>([])
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [clientData, setClientData] = useState<ClientData | null>(null)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'entries' | 'products' | 'trends' | 'insights' | 'dashboard'>('dashboard')
  const [entriesFilter, setEntriesFilter] = useState<'all' | 'recent' | 'month'>('all')
  const [viewMode, setViewMode] = useState<'dashboard' | 'client'>('dashboard')

  const throttledLocationUpdate = useRef(
    throttle((location: { lat: number, lng: number }) => {
      // Handle location updates if needed
    }, 1000)
  ).current

  const debouncedSearch = useRef(
    debounce((value: string) => {
      setDebouncedSearchTerm(value)
    }, 300)
  ).current

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    debouncedSearch(value)
  }

  useEffect(() => {
    if (!isAllowed || status !== 'authenticated') return
    fetchClientNames()
    fetchAnalyticsData()
  }, [isAllowed, status])

  useEffect(() => {
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase()
      const MAX_RESULTS = 20

      const filtered = clientNames
        .filter(name => name && name.toLowerCase().includes(searchLower))
        .slice(0, MAX_RESULTS)

      setFilteredClients(filtered)
    } else {
      setFilteredClients([])
    }
  }, [debouncedSearchTerm, clientNames])

  useEffect(() => {
    if (selectedClient) {
      fetchClientData(selectedClient)
      setViewMode('client')
      setActiveTab('overview')
    } else {
      setViewMode('dashboard')
      setActiveTab('dashboard')
    }
  }, [selectedClient])

  const fetchClientNames = async () => {
    try {
      const response = await fetch('/api/clientes?action=clients')
      const data = await response.json()
      if (data.success) {
        setClientNames(data.data.sort())
      }
    } catch (error) {
      console.error('Error fetching client names:', error)
    }
  }

  const fetchAnalyticsData = async () => {
    setIsLoadingAnalytics(true)
    try {
      console.log('🔍 Fetching analytics data from frontend...')
      const response = await fetch('/api/clientes?action=analytics')
      const data = await response.json()
      console.log('📊 Frontend received analytics data:', data)
      if (data.success) {
        console.log('✅ Setting analytics data:', data.data)
        console.log('Top products in data:', data.data?.topProducts)
        setAnalyticsData(data.data)
      } else {
        console.error('❌ Error fetching analytics:', data.error)
      }
    } catch (error) {
      console.error('🚨 Error fetching analytics data:', error)
    } finally {
      setIsLoadingAnalytics(false)
    }
  }

  const fetchClientData = async (clientName: string) => {
    setIsLoading(true)
    try {
      // Request a larger history to compute better insights
      const response = await fetch(`/api/clientes?action=client-data&client=${encodeURIComponent(clientName)}&limit=500`)
      const data = await response.json()
      if (data.success) {
        setClientData(data.data)
      }
    } catch (error) {
      console.error('Error fetching client data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getFilteredEntries = () => {
    if (!clientData) return []

    const now = new Date()
    let filteredEntries = clientData.recentEntries

    switch (entriesFilter) {
      case 'recent':
        filteredEntries = filteredEntries.slice(0, 10)
        break
      case 'month':
        const oneMonthAgo = new Date()
        oneMonthAgo.setMonth(now.getMonth() - 1)
        filteredEntries = filteredEntries.filter(entry => {
          const entryDate = new Date(entry.date)
          return entryDate >= oneMonthAgo
        })
        break
      default:
        // 'all' - no additional filtering
        break
    }

    return filteredEntries
  }

  // Gate rendering AFTER all hooks are declared to keep hooks order stable
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center border border-[#E2E4E9] rounded-lg p-6">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Acceso restringido</h2>
          <p className="text-sm text-gray-600">No tienes permisos para ver esta página.</p>
        </div>
      </div>
    )
  }

  if ((isLoadingAnalytics && !analyticsData) || (isLoading && !clientData && viewMode === 'client')) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }



  return (
    <div className="min-h-screen bg-white px-4 py-3 font-sans w-full" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem' }}>
      <header className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-600 rounded-full mr-2 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-center">
            {viewMode === 'client' && (
              <button
                onClick={() => {
                  setSelectedClient('')
                  setSearchTerm('')
                  setClientData(null)
                }}
                className="mr-3 text-gray-500 hover:text-gray-700"
              >
                ← Dashboard
              </button>
            )}
            <BlurIn
              word={viewMode === 'client' ? selectedClient : "Clientes"}
              className="text-2xl font-medium tracking-tight"
              duration={0.5}
              variant={{
                hidden: { filter: 'blur(4px)', opacity: 0 },
                visible: { filter: 'blur(0px)', opacity: 1 }
              }}
            />
          </div>
        </div>
        <div className="flex items-center relative">
          <div className="relative">
            <button
              className="p-1 rounded-full hover:bg-gray-200 transition-colors duration-200"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <Menu className="h-5 w-5 text-gray-600" />
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                <div className="py-1">
                  <Link
                    href="/"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/form"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Ventas
                  </Link>
                  <Link
                    href="/recorridos"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Recorridos
                  </Link>
                  <Link
                    href="/inventario"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Inventario
                  </Link>
                  <Link
                    href="/navegar"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Navegar
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Client Selection */}
      <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
        <div className="relative">
          <SearchInput
            value={searchTerm}
            onChange={handleSearchChange}
            onClear={() => {
              setSearchTerm('')
              setDebouncedSearchTerm('')
              setSelectedClient('')
              setFilteredClients([])
              setClientData(null)
            }}
            placeholder="Buscar cliente..."
          />
          {filteredClients.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {filteredClients.map((name) => (
                <div
                  key={name}
                  className="px-4 py-2 text-sm hover:bg-gray-100 cursor-pointer"
                  onClick={() => {
                    setSelectedClient(name)
                    setSearchTerm(name)
                    setFilteredClients([])
                  }}
                >
                  {name}
                </div>
              ))}
              {debouncedSearchTerm && filteredClients.length === 20 && (
                <div className="px-4 py-2 text-xs text-gray-500 italic">
                  Mostrando primeros 20 resultados. Continúa escribiendo para refinar la búsqueda.
                </div>
              )}
            </div>
          )}
        </div>
        {selectedClient && (
          <p className="text-sm text-gray-600 mt-2">
            Cliente seleccionado: <span className="font-medium">{selectedClient}</span>
          </p>
        )}
      </div>

      {/* Main Content */}
      {viewMode === 'dashboard' ? (
        // Dashboard View
        <div className="space-y-3">
          {/* Overall Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-600">Ventas Totales</p>
                  <p className="text-xl font-bold text-gray-900">
                    {isLoadingAnalytics ? 'Cargando...' : analyticsData ? formatCurrency(analyticsData.totalSales) : '$0.00'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-600">Total Clientes</p>
                  <p className="text-xl font-bold text-gray-900">
                    {isLoadingAnalytics ? 'Cargando...' : analyticsData?.totalClients || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Package className="w-5 h-5 text-purple-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-600">Productos Vendidos</p>
                  <p className="text-xl font-bold text-gray-900">
                    {isLoadingAnalytics ? 'Cargando...' : analyticsData ? analyticsData.topProducts.reduce((sum, p) => sum + p.quantity, 0) : 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Trophy className="w-5 h-5 text-orange-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-600">Top Cliente</p>
                  <p className="text-lg font-bold text-gray-900">
                    {isLoadingAnalytics ? 'Cargando...' : analyticsData?.topClients[0]?.client || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Top Clients Leaderboard */}
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700 flex items-center text-sm">
                <Trophy className="mr-2 h-4 w-4" /> Top 5 Clientes
              </h3>
              <p className="text-xs text-gray-500">Este año</p>
            </div>
            <div className="space-y-2">
              {isLoadingAnalytics ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">Cargando clientes...</p>
                </div>
              ) : analyticsData?.topClients && analyticsData.topClients.length > 0 ? (
                analyticsData.topClients.slice(0, 5).map((client, index) => (
                  <div
                    key={client.client}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50 rounded"
                    onClick={() => {
                      setSelectedClient(client.client);
                      setSearchTerm(client.client);
                    }}
                  >
                    <div className="flex items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${
                        index === 0 ? 'bg-yellow-100 text-yellow-800' :
                        index === 1 ? 'bg-gray-100 text-gray-800' :
                        index === 2 ? 'bg-orange-100 text-orange-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-800">{client.client}</p>
                        <p className="text-xs text-gray-500">{client.entries} pedidos</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm text-green-600">{formatCurrency(client.totalSales)}</p>
                      <p className="text-xs text-gray-500">Promedio: {formatCurrency(client.avgOrder)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500">No hay datos de clientes disponibles</p>
                </div>
              )}
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
              <Package className="mr-2 h-4 w-4" /> Productos Más Vendidos
            </h3>
            <div className="space-y-3">
              {(() => {
                console.log('🎯 Rendering top products section:', {
                  isLoading: isLoadingAnalytics,
                  hasAnalyticsData: !!analyticsData,
                  topProducts: analyticsData?.topProducts,
                  topProductsLength: analyticsData?.topProducts?.length
                })
                return null
              })()}

              {isLoadingAnalytics ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">Cargando productos...</p>
                </div>
              ) : analyticsData?.topProducts && analyticsData.topProducts.length > 0 ? (
                analyticsData.topProducts.slice(0, 5).map((product) => (
                  <div key={product.product} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-800">{product.product}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm text-blue-600">{product.quantity} unidades</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500">
                    No hay datos de productos disponibles
                    {analyticsData && (
                      <span className="block text-xs text-red-500 mt-1">
                        Debug: topProducts = {JSON.stringify(analyticsData.topProducts)}
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Monthly Trend */}
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
              <TrendingUp className="mr-2 h-4 w-4" /> Tendencia Mensual
            </h3>
            <div className="space-y-2">
              {isLoadingAnalytics ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">Cargando tendencias...</p>
                </div>
              ) : analyticsData?.monthlyTrend && analyticsData.monthlyTrend.length > 0 ? (
                ((): Array<{ month: string, sales: number, clients: number }> => {
                  const pastMonths = getPastMonthsOfCurrentYear(analyticsData.monthlyTrend)
                  // Fallback to last 6 entries if no past-months-of-current-year available
                  return pastMonths.length > 0 ? pastMonths : analyticsData.monthlyTrend.slice(-6)
                })().map((month) => (
                  <div key={month.month} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                    <div>
                      <p className="font-medium text-sm">
                        {new Date(month.month + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm text-green-600">{formatCurrency(month.sales)}</p>
                      <p className="text-xs text-gray-500">{month.clients} clientes</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500">No hay datos de tendencias disponibles</p>
                </div>
              )}
            </div>
          </div>

          {/* Clientes Desatendidos */}
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <ClientesDesatendidos
              analyticsData={analyticsData}
              isLoading={isLoadingAnalytics}
              onSelectClient={(name: string) => {
                setSelectedClient(name)
                setSearchTerm(name)
              }}
            />
          </div>

          {/* Productos por código */}
          <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
            <ProductosPorCodigo
              analyticsData={analyticsData}
              isLoading={isLoadingAnalytics}
            />
          </div>
        </div>
      ) : selectedClient && clientData ? (
        <div className="space-y-3">
          {/* Tab Navigation */}
          <ScrollableTabs
            tabs={[
              { id: 'overview', label: 'Resumen', icon: BarChart3 },
              { id: 'entries', label: 'Entradas', icon: Calendar },
              { id: 'products', label: 'Productos', icon: Package },
              { id: 'trends', label: 'Tendencias', icon: TrendingUp },
              { id: 'insights', label: 'Insights', icon: Lightbulb }
            ]}
            activeTab={activeTab}
            onTabChange={(tabId) => setActiveTab(tabId as any)}
          />

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-3">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-gray-600">Ventas este año</p>
                      <p className="text-lg font-bold text-gray-900">{formatCurrency(clientData.yearlySales)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-gray-600">Total histórico</p>
                      <p className="text-lg font-bold text-gray-900">{formatCurrency(clientData.allTimeSales)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
                  <div className="flex items-center">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Activity className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-gray-600">Total entradas</p>
                      <p className="text-lg font-bold text-gray-900">{clientData.totalEntries}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
                  <div className="flex items-center">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Package className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-gray-600">Productos vendidos</p>
                      <p className="text-lg font-bold text-gray-900">
                        {Object.values(clientData.productBreakdown).reduce((sum, p) => sum + p.quantity, 0)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Average Ticket */}
                <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
                  <div className="flex items-center">
                    <div className="p-2 bg-teal-100 rounded-lg">
                      <Target className="w-5 h-5 text-teal-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-gray-600">Ticket promedio</p>
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(computeAverageTicket(clientData.recentEntries || []))}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
                <h3 className="font-semibold text-gray-700 mb-3">Actividad Reciente</h3>
                <div className="space-y-2">
                  {clientData.recentEntries.slice(0, 5).map((entry) => (
                    <div key={entry.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                      <div>
                        <p className="font-medium text-sm">{formatDate(entry.date)}</p>
                        <p className="text-xs text-gray-500">
                          {Object.keys(entry.products).length} producto(s)
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{formatCurrency(entry.total)}</p>
                        <p className="text-xs text-gray-500">{entry.userEmail.split('@')[0]}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Insights Tab */}
          {activeTab === 'insights' && clientData && (
            <div className="space-y-3">
              <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
                <h3 className="font-semibold text-gray-700 mb-3 flex items-center text-sm">
                  <Lightbulb className="mr-2 h-4 w-4 text-amber-500" /> Sugerencias e Insights
                </h3>
                <InsightsList entries={clientData.recentEntries} productBreakdown={clientData.productBreakdown} />
              </div>
            </div>
          )}

          {/* Entries Tab */}
          {activeTab === 'entries' && (
            <div className="space-y-3">
              {/* Filter Controls */}
              <div className="bg-white rounded-lg p-3 border border-[#E2E4E9]">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-700">Entradas de {selectedClient}</h3>
                  <div className="flex items-center space-x-2">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <select
                      value={entriesFilter}
                      onChange={(e) => setEntriesFilter(e.target.value as any)}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="all">Todas las entradas</option>
                      <option value="recent">Últimas 10</option>
                      <option value="month">Último mes</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Entries List */}
              <div className="space-y-2">
                {getFilteredEntries().map((entry) => (
                  <div key={entry.id} className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-800">{formatDate(entry.date)}</h4>
                        <p className="text-sm text-gray-500">Por: {entry.userEmail.split('@')[0]}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-blue-600">{formatCurrency(entry.total)}</p>
                        <p className="text-xs text-gray-500">{entry.clientCode}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {Object.entries(entry.products).map(([product, quantity]) => (
                        <div key={product} className="flex justify-between items-center py-1">
                          <span className="text-sm text-gray-700">{product}</span>
                          <span className="text-sm font-medium text-gray-900">{quantity}x</span>
                        </div>
                      ))}
                    </div>

                    {entry.cleyOrderValue && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Orden CLEY:</span> {entry.cleyOrderValue}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Products Tab */}
          {activeTab === 'products' && (
            <div className="space-y-3">
              <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
                <h3 className="font-semibold text-gray-700 mb-3">Productos Más Vendidos</h3>
                <div className="space-y-3">
                  {Object.entries(clientData.productBreakdown)
                    .sort(([, a], [, b]) => b.quantity - a.quantity)
                    .slice(0, 10)
                    .map(([product, stats]) => (
                      <div key={product} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-gray-800">{product}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm text-blue-600">{stats.quantity} unidades</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Trends Tab */}
          {activeTab === 'trends' && (
            <div className="space-y-3">
              <div className="bg-white rounded-lg p-4 border border-[#E2E4E9]">
                <h3 className="font-semibold text-gray-700 mb-3">Tendencia de Ventas (Últimos 12 meses)</h3>
                <div className="space-y-2">
                  {((): Array<{ month: string, sales: number, entries: number }> => {
                    const pastMonths = getPastMonthsOfCurrentYear(clientData.salesTrend)
                    // Fallback to original data if empty after filtering
                    return pastMonths.length > 0 ? pastMonths : clientData.salesTrend
                  })().map((month) => (
                    <div key={month.month} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                      <div>
                        <p className="font-medium text-sm">
                          {new Date(month.month + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm text-green-600">{formatCurrency(month.sales)}</p>
                        <p className="text-xs text-gray-500">{month.entries} entradas</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : selectedClient ? (
        <div className="bg-white rounded-lg p-8 border border-[#E2E4E9] text-center">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No hay datos disponibles</h3>
          <p className="text-sm text-gray-500">No se encontraron registros para este cliente.</p>
        </div>
      ) : viewMode === 'client' ? (
        <div className="bg-white rounded-lg p-8 border border-[#E2E4E9] text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Selecciona un cliente</h3>
          <p className="text-sm text-gray-500">Busca y selecciona un cliente para ver su información detallada.</p>
        </div>
      ) : null}
    </div>
  )
}

// Insights renderer (top-level helper)
function InsightsList({ entries, productBreakdown }: { entries: ClientEntry[]; productBreakdown: Record<string, { quantity: number, revenue: number }> }) {
  // Prepare data
  const byDateDesc = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // 1) Products that stopped being sold (sold before, not in last N days)
  const DAYS_THRESHOLD = 60
  const thresholdDate = new Date()
  thresholdDate.setDate(thresholdDate.getDate() - DAYS_THRESHOLD)

  const lastSoldMap: Record<string, string> = {}
  byDateDesc.forEach(e => {
    Object.entries(e.products).forEach(([product, qty]) => {
      if (qty > 0 && !lastSoldMap[product]) {
        lastSoldMap[product] = e.date
      }
    })
  })

  const stoppedProducts = Object.keys(productBreakdown)
    .filter(p => productBreakdown[p]?.quantity > 0)
    .filter(p => {
      const last = lastSoldMap[p]
      if (!last) return true
      const lastDate = new Date(last)
      return lastDate < thresholdDate
    })
    .slice(0, 10)

  // 2) Time since last sale per key products
  const staleProducts = Object.entries(lastSoldMap)
    .map(([product, last]) => ({ product, lastDate: new Date(last) }))
    .sort((a, b) => a.lastDate.getTime() - b.lastDate.getTime())
    .slice(0, 10)

  // 3) Too many zero-$ visits (entries with total=0)
  const zeroVisits = byDateDesc.filter(e => (e.total || 0) <= 0)
  const zeroVisitRate = byDateDesc.length > 0 ? Math.round((zeroVisits.length / byDateDesc.length) * 100) : 0

  // 4) Basket size trend (last 5 vs previous 5)
  const recent = byDateDesc.slice(0, 5)
  const previous = byDateDesc.slice(5, 10)
  const avg = (arr: ClientEntry[]) => arr.length ? arr.reduce((s, e) => s + (e.total || 0), 0) / arr.length : 0
  const recentAvg = avg(recent)
  const previousAvg = avg(previous)
  const basketDelta = previousAvg ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0

  // 5) Top repeat products vs. one-off
  const productFrequency: Record<string, number> = {}
  byDateDesc.forEach(e => {
    Object.keys(e.products).forEach(p => {
      productFrequency[p] = (productFrequency[p] || 0) + 1
    })
  })
  const repeatProducts = Object.entries(productFrequency)
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <div className="space-y-4">
      {/* Zero sales visits insight */}
      <div className="p-3 border rounded-md">
        <div className="flex items-center mb-1">
          <AlertTriangle className="w-4 h-4 text-red-500 mr-2" />
          <p className="font-medium text-sm text-gray-800">Visitas con $0</p>
        </div>
        <p className="text-xs text-gray-600">
          {zeroVisits.length} de {byDateDesc.length} visitas sin venta ({zeroVisitRate}%).
          {zeroVisitRate >= 30 && ' Considera revisar motivos: inventario, precios, o decisión del comprador.'}
        </p>
      </div>

      {/* Products that seem to have stopped */}
      <div className="p-3 border rounded-md">
        <p className="font-medium text-sm text-gray-800 mb-1">Productos que pudieron dejar de venderse (≥ {DAYS_THRESHOLD} días)</p>
        {stoppedProducts.length > 0 ? (
          <ul className="list-disc ml-5 text-xs text-gray-700 space-y-1">
            {stoppedProducts.map(p => (
              <li key={p}>
                {p} {lastSoldMap[p] ? `(última venta: ${formatDate(lastSoldMap[p])})` : '(sin ventas registradas)'}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-500">No se detectaron productos detenidos.</p>
        )}
      </div>

      {/* Stale products (long time since last sale) */}
      <div className="p-3 border rounded-md">
        <p className="font-medium text-sm text-gray-800 mb-1">Productos con más tiempo sin venderse</p>
        {staleProducts.length > 0 ? (
          <ul className="list-disc ml-5 text-xs text-gray-700 space-y-1">
            {staleProducts.map(({ product, lastDate }) => (
              <li key={product}>{product} (última venta: {lastDate.toLocaleDateString('es-ES')})</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-500">Sin datos suficientes.</p>
        )}
      </div>

      {/* Basket size trend */}
      <div className="p-3 border rounded-md">
        <p className="font-medium text-sm text-gray-800 mb-1">Tendencia del ticket promedio</p>
        <p className="text-xs text-gray-600">
          Últimas 5 visitas: {formatCurrency(recentAvg)} · Previas: {formatCurrency(previousAvg)} · Cambio: {basketDelta.toFixed(1)}%
        </p>
      </div>

      {/* Repeat products */}
      <div className="p-3 border rounded-md">
        <p className="font-medium text-sm text-gray-800 mb-1">Productos recurrentes (≥ 3 visitas)</p>
        {repeatProducts.length > 0 ? (
          <ul className="list-disc ml-5 text-xs text-gray-700 space-y-1">
            {repeatProducts.map(([p, count]) => (
              <li key={p}>{p} · {count} visitas</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-500">No hay productos recurrentes aún.</p>
        )}
      </div>
    </div>
  )
}

// Utility functions
function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout
  return function(this: any, ...args: any[]) {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(this, args), wait)
  }
}

function throttle(func: Function, limit: number) {
  let inThrottle: boolean
  return function(this: any, ...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}
