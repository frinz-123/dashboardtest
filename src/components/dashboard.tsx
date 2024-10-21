'use client'
import React, { useState, useEffect } from 'react'
import { ChevronDown, BarChart2, Users, Clock, ChevronRight, Target, Menu, Search } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar'
import 'react-circular-progressbar/dist/styles.css'
import BlurIn from './ui/blur-in'
import { getCurrentPeriodInfo, getWeekDates, isDateInPeriod, getCurrentPeriodNumber } from '@/utils/dateUtils'
import { getSellerGoal } from '@/utils/sellerGoals'
import { motion } from 'framer-motion'
import SaleDetailsPopup from './SaleDetailsPopup'

const googleApiKey = 'AIzaSyDFYvzbw3A1xUj8iFJCE6dnZBTKGCitYKo'
const spreadsheetId = '1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g'
const sheetName = 'Form_Data'

type TimePeriod = 'Diario' | 'Semanal' | 'Mensual'
type Sale = {
  clientName: string
  venta: number
  codigo: string
  fechaSinHora: string
  email: string
  products: Record<string, number>  // Add this line
}

const emailLabels: Record<string, string> = {
  'ventas1productoselrey@gmail.com': 'Ernesto',
  'ventas2productoselrey@gmail.com': 'Roel',
  'ventas3productoselrey@gmail.com': 'Lidia',
  'ventasmztproductoselrey.com@gmail.com': 'Mazatlan',
  'franzcharbell@gmail.com': 'Franz',
  'cesar.reyes.ochoa@gmail.com': 'Cesar'
}

export default function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('Diario')
  const [selectedEmail, setSelectedEmail] = useState<string>('')
  const [salesData, setSalesData] = useState<Sale[]>([])
  const [emails, setEmails] = useState<string[]>([])
  const [chartData, setChartData] = useState<{ x: string; venta: number }[]>([])
  const [percentageDifference, setPercentageDifference] = useState<number>(0)
  const [showAllSales, setShowAllSales] = useState(false)
  const [goalProgress, setGoalProgress] = useState<number>(0)
  const [currentPeriodSales, setCurrentPeriodSales] = useState<number>(0)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [clientNames, setClientNames] = useState<string[]>([])
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [clientSales, setClientSales] = useState<Sale[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredClientNames, setFilteredClientNames] = useState<string[]>([])
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)

  const periods: TimePeriod[] = ['Diario', 'Semanal', 'Mensual']

  const updateChartData = React.useCallback(() => {
    const filteredSales = salesData
      .filter((sale) => sale.email === selectedEmail)
      .filter((sale) => filterSalesByDate([sale], selectedPeriod).length > 0)

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
    }

    // Calculate percentage difference
    const currentPeriodTotal = filteredSales.reduce((sum, sale) => sum + sale.venta, 0)
    let previousPeriodStartDate: Date
    let previousPeriodEndDate: Date

    if (selectedPeriod === 'Diario') {
      previousPeriodStartDate = new Date(new Date().setDate(new Date().getDate() - 1))
      previousPeriodStartDate.setHours(0, 0, 0, 0)
      previousPeriodEndDate = new Date(previousPeriodStartDate)
      previousPeriodEndDate.setHours(23, 59, 59, 999)
    } else {
      previousPeriodStartDate = new Date(new Date().getTime() - getTimeDifference(selectedPeriod) * 2)
      previousPeriodEndDate = new Date(new Date().getTime() - getTimeDifference(selectedPeriod))
    }

    const previousPeriodSales = salesData
      .filter((sale) => sale.email === selectedEmail)
      .filter((sale) => {
        const saleDate = new Date(sale.fechaSinHora)
        return saleDate >= previousPeriodStartDate && saleDate <= previousPeriodEndDate
      })
    const previousPeriodTotal = previousPeriodSales.reduce((sum, sale) => sum + sale.venta, 0)

    const difference = previousPeriodTotal !== 0 
      ? ((currentPeriodTotal - previousPeriodTotal) / previousPeriodTotal) * 100 
      : 0
    setPercentageDifference(difference)
  }, [salesData, selectedEmail, selectedPeriod])

  const updateGoalProgress = React.useCallback(() => {
    const currentPeriodNumber = getCurrentPeriodNumber()
    console.log('Current Period Number:', currentPeriodNumber)

    const { periodStartDate, periodEndDate } = getCurrentPeriodInfo()
    
    const periodSales = salesData
      .filter((sale) => sale.email === selectedEmail)
      .filter((sale) => {
        const saleDate = new Date(sale.fechaSinHora)
        return isDateInPeriod(saleDate, periodStartDate, periodEndDate)
      })
      .reduce((sum, sale) => sum + sale.venta, 0)

    console.log('Period Sales:', periodSales)
    setCurrentPeriodSales(periodSales)

    const goal = getSellerGoal(selectedEmail, currentPeriodNumber as 11 | 12 | 13)
    console.log('Goal:', goal)

    const progress = goal > 0 ? (periodSales / goal) * 100 : 0
    console.log('Progress:', progress)

    setGoalProgress(isNaN(progress) ? 0 : progress)
  }, [salesData, selectedEmail])

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (salesData.length > 0 && selectedEmail) {
      updateChartData()
      updateGoalProgress()
    }
  }, [selectedPeriod, selectedEmail, salesData, updateChartData, updateGoalProgress])

  useEffect(() => {
    if (selectedClient) {
      const filteredSales = salesData.filter(sale => sale.clientName === selectedClient)
      setClientSales(filteredSales)
    }
  }, [selectedClient, salesData])

  useEffect(() => {
    if (searchTerm) {
      const filtered = clientNames.filter(name => 
        name && name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredClientNames(filtered)
      if (filtered.length > 0) {
        setSelectedClient(filtered[0])
      }
    } else {
      setFilteredClientNames([])
    }
  }, [searchTerm, clientNames])

  const fetchData = async () => {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:AK?key=${googleApiKey}`
    )
    const data = await response.json()
    const rows = data.values.slice(1) // Remove header row
    const sales: Sale[] = rows.map((row: string[]) => {
      const products: Record<string, number> = {}
      for (let i = 8; i <= 31; i++) {
        if (row[i] && row[i] !== '0') {
          products[data.values[0][i]] = parseInt(row[i], 10)
        }
      }
      for (let i = 34; i <= 36; i++) {
        if (row[i] && row[i] !== '0') {
          products[data.values[0][i]] = parseInt(row[i], 10)
        }
      }
      return {
        clientName: row[0] || 'Unknown',
        venta: parseFloat(row[33]),
        codigo: row[31],
        fechaSinHora: row[32],
        email: row[7],
        products: products
      }
    })
    setSalesData(sales)
    const uniqueEmails = [...new Set(sales.map((sale) => sale.email))]
    setEmails(uniqueEmails)
    if (uniqueEmails.length > 0) setSelectedEmail(uniqueEmails[0])

    // Extract unique client names
    const uniqueClientNames = Array.from(new Set(sales.map(sale => sale.clientName))).filter(Boolean)
    setClientNames(uniqueClientNames)
    // Remove or comment out the following lines:
    // if (uniqueClientNames.length > 0) {
    //   setSelectedClient(uniqueClientNames[0])
    // }
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
    }

    return sales.filter((sale) => {
      const saleDate = new Date(sale.fechaSinHora);
      return isDateInPeriod(saleDate, startDate, endDate);
    });
  };

  const getTimeDifference = (period: TimePeriod) => {
    switch (period) {
      case 'Diario':
        return 24 * 60 * 60 * 1000 // 1 day in milliseconds
      case 'Semanal':
        return 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
      case 'Mensual':
        return 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds (approximate)
    }
  }

  const filteredSales = salesData
    .filter((sale) => sale.email === selectedEmail)
    .filter((sale) => filterSalesByDate([sale], selectedPeriod).length > 0)

  const totalSales = filteredSales.reduce((sum, sale) => sum + sale.venta, 0)

  const salesByType = filteredSales.reduce((acc, sale) => {
    acc[sale.codigo] = (acc[sale.codigo] || 0) + sale.venta
    return acc
  }, {} as Record<string, number>)

  const visitsCount = filteredSales.length
  const maxVisits = selectedPeriod === 'Diario' ? 30 : selectedPeriod === 'Semanal' ? 180 : 720
  const visitPercentage = (visitsCount / maxVisits) * 100

  const getVisitStatus = () => {
    if (visitPercentage >= 66) return { color: 'bg-green-400', text: 'Es considerado un numero alto' }
    if (visitPercentage >= 33) return { color: 'bg-yellow-400', text: 'Es considerado un numero medio' }
    return { color: 'bg-red-400', text: 'Es considerado un numero bajo' }
  }

  const visitStatus = getVisitStatus()

  const currentPeriodNumber = getCurrentPeriodNumber()
  const currentGoal = getSellerGoal(selectedEmail, currentPeriodNumber as 11 | 12 | 13); // Añadido punto y coma

  return (
    <div className="min-h-screen bg-white px-4 py-3 font-sans w-full" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem' }}>
      <header className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-600 rounded-full mr-2 flex items-center justify-center">
            <div className="w-5 h-0.5 bg-white rounded-full transform -rotate-45"></div>
          </div>
          <BlurIn
            word="Ventas"
            className="text-2xl font-medium tracking-tight"
            duration={0.5}
            variant={{
              hidden: { filter: 'blur(4px)', opacity: 0 },
              visible: { filter: 'blur(0px)', opacity: 1 }
            }}
          />
        </div>
        <div className="flex items-center">
          <div className="relative mr-2">
            <select
              className="appearance-none flex items-center text-gray-600 bg-white rounded-full pl-2 pr-6 py-0.5 text-xs border border-gray-300"
              value={selectedEmail}
              onChange={(e) => setSelectedEmail(e.target.value)}
            >
              {emails.map((email) => (
                <option key={email} value={email}>
                  {emailLabels[email] || email}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
          </div>
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
                  <a
                    href="#"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Dashboard
                  </a>
                  <a
                    href="/admin"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Admin
                  </a>
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
        <h2 className="text-gray-500 text-xs mb-0.5">Vendido</h2>
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

      {selectedPeriod === 'Mensual' && (
        <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
          <h2 className="text-gray-500 text-xs mb-0.5 flex items-center">
            <Target className="mr-1.5 h-4 w-4" /> Meta del Periodo
          </h2>
          <div className="flex items-center mb-2">
            <span className="text-2xl font-bold mr-2">
              ${currentGoal ? currentGoal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${goalProgress >= 100 ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
              {goalProgress ? goalProgress.toFixed(1) : '0.0'}%
            </span>
          </div>
          <motion.div 
            className="flex flex-col items-center justify-center w-full"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div style={{ width: 250, height: 250, marginTop: '20px' }}>
              <CircularProgressbar
                value={goalProgress}
                text={`${goalProgress.toFixed(1)}%`}
                circleRatio={0.75}
                strokeWidth={12}
                styles={buildStyles({
                  rotation: 1 / 2 + 1 / 8,
                  strokeLinecap: "round", // Changed from "butt" to "round"
                  trailColor: "#eee",
                  pathColor: goalProgress >= 100 ? "#2ECC71" : goalProgress >= 66 ? "#FFC371" : "#FF5F6D",
                  textColor: "#333333",
                  textSize: '16px',
                })}
              />
            </div>
          </motion.div>
          <p className="text-xs text-gray-500 text-center mt-2">
            {goalProgress < 100
              ? `Faltan $${(currentGoal - currentPeriodSales).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} para alcanzar la meta`
              : 'Meta alcanzada!'}
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
        <h2 className="text-gray-700 font-semibold mb-2 flex items-center text-xs">
          <BarChart2 className="mr-1.5 h-4 w-4" /> Ventas por tipo
        </h2>
        {Object.entries(salesByType).map(([codigo, venta], index) => (
          <div key={index} className="mb-1.5">
            <div className="flex justify-between text-xs mb-0.5">
              <span>{codigo}</span>
              <span className="text-gray-500">${venta.toFixed(2)}</span>
            </div>
            <div className="w-full bg-gray-200 h-1.5 rounded-full">
              <div
                className={`h-1.5 rounded-full ${
                  index % 4 === 0 ? 'bg-blue-500' : index % 4 === 1 ? 'bg-cyan-400' : index % 4 === 2 ? 'bg-purple-500' : 'bg-orange-400'
                }`}
                style={{ width: `${(venta / Math.max(...Object.values(salesByType))) * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
        
        <h2 className="text-gray-700 font-semibold mb-2 flex items-center text-xs">
          <Users className="mr-1.5 h-4 w-4" /> Visitas
        </h2>
        <p className="text-sm">Tus Visitas son <strong>{visitsCount}</strong></p>
        <p className="text-xs text-gray-500 mb-1.5">{visitStatus.text}</p>
        <div className="w-full bg-gray-200 h-1.5 rounded-full">
          <div className={`${visitStatus.color} h-1.5 rounded-full`} style={{ width: `${visitPercentage}%` }}></div>
        </div>
      </div>

      <div className="bg-white rounded-lg mb-3 border border-[#E2E4E9]">
        <div className="p-3 pb-1.5">
          <div className="flex justify-between items-center">
            <h2 className="text-gray-700 font-semibold flex items-center text-xs">
              <Clock className="mr-1.5 h-4 w-4" /> Ventas Recientes
            </h2>
            <button 
              className="text-blue-600 text-xs"
              onClick={() => setShowAllSales(!showAllSales)}
            >
              {showAllSales ? 'Ver Menos' : 'Ver Todas'}
            </button>
          </div>
        </div>
        <div className="px-3">
          {filteredSales.slice(0, showAllSales ? undefined : 4).map((sale, index) => (
            <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
              <div>
                <p className="text-xs font-medium">{sale.clientName}</p>
                <p className="text-xxs text-gray-500">{sale.codigo}</p>
              </div>
              <div className="flex items-center">
                <div className="text-right mr-1.5">
                  <p className="text-xs font-medium">${sale.venta.toFixed(2)}</p>
                  <p className="text-xxs text-gray-500">{sale.fechaSinHora}</p>
                </div>
                <ChevronRight className="h-4 w-3 text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#E2E4E9]">
        <div className="p-3">
          <div className="mb-2">
            <h2 className="text-gray-700 font-semibold flex items-center text-xs">
              <Clock className="mr-1.5 h-4 w-4" /> Historial De Cliente
            </h2>
            {selectedClient && (
              <p className="text-xs text-gray-500 mt-1">Cliente: {selectedClient}</p>
            )}
          </div>
          <div className="relative">
            <div className="flex items-center border border-gray-300 rounded-full w-full">
              <Search className="h-4 w-4 text-gray-400 ml-2" />
              <input
                type="text"
                className="appearance-none bg-transparent py-1 pl-2 pr-8 text-xs focus:outline-none focus:text-base transition-all duration-200 ease-in-out w-full"
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {filteredClientNames.length > 0 && (
              <div className="absolute z-10 mt-1 left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg">
                {filteredClientNames.map((name) => (
                  <div
                    key={name}
                    className="px-4 py-2 text-xs hover:bg-gray-100 cursor-pointer"
                    onClick={() => {
                      setSelectedClient(name)
                      setSearchTerm('')
                    }}
                  >
                    {name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="max-h-60 overflow-y-auto mt-2">
            {selectedClient && searchTerm === '' ? (
              clientSales.length > 0 ? (
                clientSales
                  .sort((a, b) => new Date(b.fechaSinHora).getTime() - new Date(a.fechaSinHora).getTime())
                  .map((sale, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between py-2 border-b last:border-b-0 cursor-pointer hover:bg-gray-100"
                      onClick={() => setSelectedSale(sale)}
                    >
                      <div className="flex items-center">
                        <div className="text-left">
                          <p className="text-xs font-medium">${sale.venta.toFixed(2)}</p>
                          <p className="text-xxs text-gray-500">{sale.fechaSinHora}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-3 text-gray-400" />
                    </div>
                  ))
              ) : (
                <p className="text-xs text-gray-500 text-center py-4">No hay ventas para este cliente.</p>
              )
            ) : (
              <p className="text-xs text-gray-500 text-center py-4">Selecciona un cliente para ver su historial de ventas.</p>
            )}
          </div>
        </div>
      </div>

      {selectedSale && (
        <SaleDetailsPopup 
          sale={selectedSale} 
          onClose={() => setSelectedSale(null)} 
        />
      )}
    </div>
  )
}
