'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, Lock, DollarSign, BarChart2 } from 'lucide-react'
import BlurIn from '@/components/ui/blur-in'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts'
import { getCurrentPeriodInfo, getWeekDates, isDateInPeriod } from '@/utils/dateUtils'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY
const spreadsheetId = process.env.NEXT_PUBLIC_SPREADSHEET_ID
const sheetName = process.env.NEXT_PUBLIC_SHEET_NAME

type Sale = {
  venta: number
  fechaSinHora: string
  products?: Record<string, number>
  clientName?: string
  sellerEmail?: string
}

type TimePeriod = 'Diario' | 'Semanal' | 'Mensual' | 'Anual'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
const STORE_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD'];

export default function AdminPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [salesData, setSalesData] = useState<Sale[]>([])
  const [totalSales, setTotalSales] = useState(0)
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('Diario')
  const [chartData, setChartData] = useState<{ x: string; venta: number }[]>([])
  const [percentageDifference, setPercentageDifference] = useState<number>(0)
  const [productStats, setProductStats] = useState<{ name: string; value: number }[]>([])
  const [topStores, setTopStores] = useState<{ name: string; value: number }[]>([])
  const [isStoresExpanded, setIsStoresExpanded] = useState(false)
  const [sellerComparison, setSellerComparison] = useState<{ name: string; venta: number }[]>([])

  const periods: TimePeriod[] = ['Diario', 'Semanal', 'Mensual', 'Anual']

  const sellerEmails = {
    'ventas1productoselrey@gmail.com': 'Ernesto',
    'ventas2productoselrey@gmail.com': 'Roel',
    'ventas3productoselrey@gmail.com': 'Lidia'
  }

  const updateChartData = () => {
    const filteredSales = filterSalesByDate(salesData, selectedPeriod)

    if (selectedPeriod === 'Diario') {
      const sortedSales = filteredSales.sort((a, b) => new Date(a.fechaSinHora).getTime() - new Date(b.fechaSinHora).getTime())
      setChartData(sortedSales.map((sale, index) => ({ x: `${index + 1}`, venta: sale.venta })))
    } else if (selectedPeriod === 'Semanal') {
      const groupedData = filteredSales.reduce((acc, sale) => {
        const date = new Date(sale.fechaSinHora)
        const key = date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
        if (!acc[key]) {
          acc[key] = 0
        }
        acc[key] += sale.venta
        return acc
      }, {} as Record<string, number>)

      const sortedData = Object.entries(groupedData)
        .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
        .map(([date, venta]) => ({ x: date, venta }))

      setChartData(sortedData)
    } else if (selectedPeriod === 'Mensual') {
      const { periodStartDate } = getCurrentPeriodInfo();
      const groupedData = filteredSales.reduce((acc, sale) => {
        const saleDate = new Date(sale.fechaSinHora);
        const weekNumber = Math.floor((saleDate.getTime() - periodStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
        const key = `S${weekNumber}`;
        if (!acc[key]) {
          acc[key] = 0;
        }
        acc[key] += sale.venta;
        return acc;
      }, {} as Record<string, number>);

      const sortedData = Object.entries(groupedData)
        .sort(([weekA], [weekB]) => weekA.localeCompare(weekB))
        .map(([week, venta]) => ({ x: week, venta }));

      setChartData(sortedData);
    } else if (selectedPeriod === 'Anual') {
      const groupedData = filteredSales.reduce((acc, sale) => {
        const date = new Date(sale.fechaSinHora)
        let key = date.toLocaleDateString('es-ES', { month: 'short' }).toLowerCase()
        key = key === 'sept' ? 'sep' : key
        
        if (!acc[key]) {
          acc[key] = 0
        }
        acc[key] += sale.venta
        return acc
      }, {} as Record<string, number>)

      const months = [
        'ene', 'feb', 'mar', 'abr', 'may', 'jun',
        'jul', 'ago', 'sep', 'oct', 'nov', 'dic'
      ]

      const sortedData = months.map(month => ({
        x: month,
        venta: groupedData[month] || 0
      }))

      setChartData(sortedData)
    }

    const currentTotal = filteredSales.reduce((sum, sale) => {
      const saleAmount = parseFloat(sale.venta.toString());
      return sum + (isNaN(saleAmount) ? 0 : saleAmount);
    }, 0);
    
    setTotalSales(currentTotal);

    const previousPeriodSales = getPreviousPeriodSales(salesData, selectedPeriod);
    const previousTotal = previousPeriodSales.reduce((sum, sale) => {
      const saleAmount = parseFloat(sale.venta.toString());
      return sum + (isNaN(saleAmount) ? 0 : saleAmount);
    }, 0);

    const difference = previousTotal !== 0 
      ? ((currentTotal - previousTotal) / previousTotal) * 100 
      : 0;
    
    setPercentageDifference(difference);
  }

  useEffect(() => {
    const authStatus = localStorage.getItem('adminAuthenticated')
    if (authStatus === 'true') {
      setIsAuthenticated(true)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      fetchData()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (salesData.length > 0) {
      updateChartData()
      updateProductStats(salesData)
      updateTopStores(salesData)
      updateSellerComparison(salesData)
    }
  }, [selectedPeriod, salesData])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      setError('')
      localStorage.setItem('adminAuthenticated', 'true')
    } else {
      setError('Incorrect password. Please try again.')
    }
  }

  const fetchData = async () => {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:AH?key=${googleApiKey}`
    )
    const data = await response.json()
    const rows = data.values.slice(1)
    const sales: Sale[] = rows.map((row: string[]) => {
      const products: Record<string, number> = {};
      
      const productMappings = [
        { col: 8, name: "Chiltepin Molido 50 g" },
        { col: 9, name: "Chiltepin Molido 20 g" },
        { col: 10, name: "Chiltepin Entero 30 g" },
        { col: 11, name: "Salsa Chiltepin El rey 195 ml" },
        { col: 12, name: "Salsa Especial El Rey 195 ml" },
        { col: 13, name: "Salsa Reina El rey 195 ml" },
        { col: 14, name: "Salsa Habanera El Rey 195 ml" },
        { col: 15, name: "Paquete El Rey" },
        { col: 16, name: "Molinillo El Rey 30 g" },
        { col: 17, name: "Tira Entero" },
        { col: 18, name: "Tira Molido" },
        { col: 19, name: "Salsa chiltepin Litro" },
        { col: 20, name: "Salsa Especial Litro" },
        { col: 21, name: "Salsa Reina Litro" },
        { col: 22, name: "Salsa Habanera Litro" },
        { col: 23, name: "Michela Mix Tamarindo" },
        { col: 24, name: "Michela Mix Mango" },
        { col: 25, name: "Michela Mix Sandia" },
        { col: 26, name: "Michela Mix Fuego" },
        { col: 34, name: "Michela Mix Picafresa" },
        { col: 27, name: "El Rey Mix Original" },
        { col: 28, name: "El Rey Mix Especial" },
        { col: 29, name: "Medio Kilo Chiltepin Entero" },
        { col: 35, name: "Habanero Molido 50 g" },
        { col: 36, name: "Habanero Molido 20 g" }
      ];

      productMappings.forEach(({ col, name }) => {
        const quantity = parseInt(row[col]) || 0;
        if (quantity > 0) {
          products[name] = quantity;
        }
      });

      return {
        venta: parseFloat(row[33]),
        fechaSinHora: row[32],
        products,
        clientName: row[0],
        sellerEmail: row[7]
      }
    })
    setSalesData(sales)
    updateProductStats(sales)
    updateTopStores(sales)
    updateSellerComparison(sales)
  }

  const getProductNameFromIndex = (index: number): string => {
    const products = [
      "Chiltepin Molido 50 g",
      "Chiltepin Molido 20 g",
      "Chiltepin Entero 30 g",
      "Salsa Chiltepin El rey 195 ml",
      "Salsa Especial El Rey 195 ml",
      "Salsa Reina El rey 195 ml",
      "Salsa Habanera El Rey 195 ml",
      "Paquete El Rey",
      "Molinillo El Rey 30 g",
      "Tira Entero",
      "Tira Molido",
      "Salsa chiltepin Litro",
      "Salsa Especial Litro",
      "Salsa Reina Litro",
      "Salsa Habanera Litro",
      "Michela Mix Tamarindo",
      "Michela Mix Mango",
      "Michela Mix Sandia",
      "Michela Mix Fuego",
      "Michela Mix Picafresa",
      "El Rey Mix Original",
      "El Rey Mix Especial",
      "Medio Kilo Chiltepin Entero",
      "Habanero Molido 50 g",
      "Habanero Molido 20 g"
    ]
    return products[index - 2] || "Unknown Product"
  }

  const updateProductStats = (sales: Sale[]) => {
    const filteredSales = filterSalesByDate(sales, selectedPeriod)
    
    const productTotals: Record<string, number> = {}
    
    filteredSales.forEach(sale => {
      if (sale.products) {
        Object.entries(sale.products).forEach(([product, quantity]) => {
          productTotals[product] = (productTotals[product] || 0) + quantity
        })
      }
    })

    const sortedProducts = Object.entries(productTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    setProductStats(sortedProducts)
  }

  const updateTopStores = (sales: Sale[]) => {
    const filteredSales = filterSalesByDate(sales, selectedPeriod)
    
    const storeTotal: Record<string, number> = {}
    
    filteredSales.forEach(sale => {
      if (sale.clientName) {
        storeTotal[sale.clientName] = (storeTotal[sale.clientName] || 0) + sale.venta
      }
    })

    const sortedStores = Object.entries(storeTotal)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 25)

    setTopStores(sortedStores)
  }

  const updateSellerComparison = (sales: Sale[]) => {
    const filteredSales = filterSalesByDate(sales, selectedPeriod)
    
    const sellerTotals = Object.entries(sellerEmails).map(([email, name]) => {
      const total = filteredSales
        .filter(sale => {
          if (!sale.sellerEmail) return false;
          const saleEmail = sale.sellerEmail.trim().toLowerCase();
          const compareEmail = email.trim().toLowerCase();
          return saleEmail === compareEmail;
        })
        .reduce((sum, sale) => {
          const amount = parseFloat(sale.venta.toString());
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0);
      
      return {
        name,
        venta: total
      }
    });

    setSellerComparison(sellerTotals);
  }

  const filterSalesByDate = (sales: Sale[], period: TimePeriod) => {
    const currentDate = new Date();
    let startDate: Date, endDate: Date;

    if (period === 'Diario') {
      startDate = new Date(currentDate.setHours(0, 0, 0, 0));
      endDate = new Date(currentDate.setHours(23, 59, 59, 999));
    } else if (period === 'Semanal') {
      const { weekStart, weekEnd } = getWeekDates(currentDate);
      startDate = weekStart;
      endDate = weekEnd;
    } else if (period === 'Mensual') {
      const { periodStartDate, periodEndDate } = getCurrentPeriodInfo(currentDate);
      startDate = periodStartDate;
      endDate = periodEndDate;
    } else if (period === 'Anual') {
      startDate = new Date(currentDate.getFullYear(), 0, 1);
      endDate = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59, 999);
    }

    return sales.filter((sale) => {
      if (!sale.fechaSinHora) return false;
      const saleDate = new Date(sale.fechaSinHora);
      return saleDate >= startDate && saleDate <= endDate;
    });
  };

  const getPreviousPeriodSales = (sales: Sale[], period: TimePeriod) => {
    const currentDate = new Date();
    let startDate: Date, endDate: Date;

    if (period === 'Diario') {
      endDate = new Date(currentDate.setHours(0, 0, 0, 0));
      startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
    } else if (period === 'Semanal') {
      const { weekStart } = getWeekDates(currentDate);
      endDate = new Date(weekStart.getTime() - 1);
      startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'Mensual') {
      const { periodStartDate } = getCurrentPeriodInfo(currentDate);
      endDate = new Date(periodStartDate.getTime() - 1);
      startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (period === 'Anual') {
      endDate = new Date(currentDate.getFullYear() - 1, 11, 31, 23, 59, 59, 999); // Dec 31st last year
      startDate = new Date(currentDate.getFullYear() - 1, 0, 1); // Jan 1st last year
    }

    return sales.filter((sale) => {
      const saleDate = new Date(sale.fechaSinHora);
      return isDateInPeriod(saleDate, startDate, endDate);
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Admin Login</h2>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="password" className="sr-only">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-xs italic">{error}</p>}

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-indigo-500 group-hover:text-indigo-400" aria-hidden="true" />
                </span>
                Sign in
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white px-4 py-3 font-sans w-full" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem' }}>
      <header className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-600 rounded-full mr-2 flex items-center justify-center">
            <div className="w-5 h-0.5 bg-white rounded-full transform -rotate-45"></div>
          </div>
          <BlurIn
            word="Admin"
            className="text-2xl font-medium tracking-tight"
            duration={0.5}
            variant={{
              hidden: { filter: 'blur(4px)', opacity: 0 },
              visible: { filter: 'blur(0px)', opacity: 1 }
            }}
          />
        </div>
        <div className="flex items-center">
          <div className="relative">
            <button
              className="p-1 rounded-full hover:bg-gray-200 transition-colors duration-200"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <Menu className="h-5 w-5 text-gray-600" />
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                  <Link
                    href="/"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/admin"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Admin
                  </Link>
                  <Link
                    href="/form"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Form
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="bg-gray-100 rounded-lg mb-3 p-0.5">
        <div className="inline-flex rounded-md w-full">
          {periods.map((period) => (
            <button
              key={period}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-200 ease-in-out ${
                selectedPeriod === period
                  ? 'bg-white text-gray-900'
                  : 'bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setSelectedPeriod(period)}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
        <h2 className="text-gray-500 text-xs mb-0.5 flex items-center">
          <DollarSign className="h-4 w-4 mr-1" />
          Total Ventas
        </h2>
        <div className="flex items-center">
          <span className="text-2xl font-bold mr-2">${totalSales.toFixed(2)}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${percentageDifference >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {percentageDifference >= 0 ? '+' : ''}{percentageDifference.toFixed(2)}%
          </span>
        </div>
        {selectedPeriod === 'Mensual' && (
          <p className="text-xs text-gray-500 mt-1">
            Periodo {getCurrentPeriodInfo().periodNumber}, Semana {getCurrentPeriodInfo().weekInPeriod}
          </p>
        )}
        <div className="mt-3 h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis 
                dataKey="x" 
                tickFormatter={(value) => value}
                tick={{ fontSize: 8 }}
              />
              <YAxis hide />
              <Tooltip 
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Venta']}
                labelFormatter={(label) => label}
                contentStyle={{ fontSize: '10px' }}
              />
              <Line type="monotone" dataKey="venta" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
        <h2 className="text-gray-700 font-semibold mb-2 flex items-center text-xs">
          <BarChart2 className="mr-1.5 h-4 w-4" /> Productos Más Vendidos
        </h2>
        <div className="mt-3 h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={productStats}
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                labelLine={true}
                label={({ name, percent, x, y, cx }) => {
                  return (
                    <text
                      x={x}
                      y={y}
                      fill="#666"
                      textAnchor={x > cx ? 'start' : 'end'}
                      dominantBaseline="central"
                      fontSize={11}
                    >
                      {`${(percent * 100).toFixed(0)}%`}
                    </text>
                  );
                }}
              >
                {productStats.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [`${value} unidades`, 'Cantidad']}
                contentStyle={{ fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 space-y-2">
          {productStats.map((product, index) => (
            <div key={index} className="flex items-center justify-between text-xs">
              <div className="flex items-center">
                <div 
                  className="w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span>{product.name}</span>
              </div>
              <span className="font-medium">{product.value} unidades</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-gray-700 font-semibold flex items-center text-xs">
            <BarChart2 className="mr-1.5 h-4 w-4" /> Tiendas Estrella
          </h2>
          <button
            onClick={() => setIsStoresExpanded(!isStoresExpanded)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            {isStoresExpanded ? 'Ver Menos' : 'Ver Más'}
          </button>
        </div>
        <div className="space-y-3">
          {topStores.slice(0, isStoresExpanded ? 25 : 5).map((store, index) => (
            <div key={index} className="relative">
              <div className="flex justify-between items-center mb-1 text-xs">
                <span className="font-medium truncate pr-2" style={{ maxWidth: '70%' }}>
                  {store.name}
                </span>
                <span className="text-gray-600">
                  ${store.value.toFixed(2)}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(store.value / topStores[0].value) * 100}%`,
                    backgroundColor: STORE_COLORS[index % STORE_COLORS.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
        <h2 className="text-gray-700 font-semibold mb-2 flex items-center text-xs">
          <BarChart2 className="mr-1.5 h-4 w-4" /> Comparativa Vendedores
        </h2>
        <div className="mt-3 h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sellerComparison}>
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 10 }}
              />
              <YAxis 
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Venta']}
                contentStyle={{ fontSize: '12px' }}
              />
              <Bar 
                dataKey="venta" 
                fill="#3b82f6"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 space-y-2">
          {sellerComparison.map((seller, index) => (
            <div key={index} className="flex items-center justify-between text-xs">
              <span className="font-medium">{seller.name}</span>
              <span className="text-gray-600">${seller.venta.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* More admin content can be added here */}
    </div>
  )
}
