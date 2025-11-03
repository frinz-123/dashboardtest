'use client'
import React, { useState, useEffect } from 'react'
import { ChevronDown, BarChart2, Users, Clock, ChevronRight, Target, Menu, Search } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar'
import 'react-circular-progressbar/dist/styles.css'
import BlurIn from './ui/blur-in'
import { getCurrentPeriodInfo, getWeekDates, isDateInPeriod, getCurrentPeriodNumber } from '@/utils/dateUtils'
import { getSellerGoal } from '@/utils/sellerGoals'
import { motion } from 'framer-motion'
import SaleDetailsPopup from './SaleDetailsPopup'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'

const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY
const spreadsheetId = process.env.NEXT_PUBLIC_SPREADSHEET_ID
const sheetName = process.env.NEXT_PUBLIC_SHEET_NAME

type TimePeriod = 'Diario' | 'Ayer' | 'Semanal' | 'Mensual'
type Sale = {
  clientName: string
  venta: number
  codigo: string
  fechaSinHora: string
  email: string
  products: Record<string, number>  // Add this line
  submissionTime?: string
}

const emailLabels: Record<string, string> = {
  'ventas1productoselrey@gmail.com': 'Ernesto',
  'ventas2productoselrey@gmail.com': 'Roel',
  'ventas3productoselrey@gmail.com': 'Lidia',
  'ventasmztproductoselrey.com@gmail.com': 'Mazatlan',
  'ventasmochisproductoselrey@gmail.com': 'Mochis',
  'franzcharbell@gmail.com': 'Franz',
  'cesar.reyes.ochoa@gmail.com': 'Cesar',
  'arturo.elreychiltepin@gmail.com': 'Arturo Mty',
  'alopezelrey@gmail.com': 'Arlyn',
  'promotoriaelrey@gmail.com': 'Karla',
  'ventas4productoselrey@gmail.com': 'Reyna', 
  'bodegaelrey034@gmail.com': 'Bodega',
}
  
export default function Dashboard() {
  const { data: session } = useSession()
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

  const periods: TimePeriod[] = ['Diario', 'Ayer', 'Semanal', 'Mensual']

  const updateChartData = React.useCallback(() => {
    const filteredSales = salesData
      .filter((sale) => sale.email === selectedEmail)
      .filter((sale) => filterSalesByDate([sale], selectedPeriod).length > 0)

    if (selectedPeriod === 'Diario' || selectedPeriod === 'Ayer') {
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
    } else if (selectedPeriod === 'Ayer') {
      previousPeriodStartDate = new Date(new Date().setDate(new Date().getDate() - 2))
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

  useEffect(() => {
    if (session?.user?.email) {
      console.log('[Dashboard] Session detected, setting selectedEmail to session user', session.user.email)
      setSelectedEmail(session.user.email)
      fetchData()
    }
  }, [session])

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
        products: products,
    submissionTime: row[4] && row[4].trim() !== '' ? row[4] : undefined,
      }
    })
    setSalesData(sales)
    const uniqueEmails = [...new Set(sales.map((sale) => sale.email))]
    console.log('[Dashboard] Fetched unique emails from sheet', uniqueEmails)
    setEmails(uniqueEmails)
    if (uniqueEmails.length > 0) {
      setSelectedEmail((prevSelectedEmail) => {
        const sessionEmail = session?.user?.email
        const fallbackEmail = uniqueEmails[0]

        const nextSelectedEmail =
          prevSelectedEmail && uniqueEmails.includes(prevSelectedEmail)
            ? prevSelectedEmail
            : sessionEmail && uniqueEmails.includes(sessionEmail)
            ? sessionEmail
            : fallbackEmail

        console.log('[Dashboard] Resolving selectedEmail', {
          prevSelectedEmail,
          sessionEmail,
          fallbackEmail,
          nextSelectedEmail
        })

        return nextSelectedEmail
      })
    }

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
    } else if (period === 'Ayer') {
      const yesterday = new Date(currentDate);
      yesterday.setDate(yesterday.getDate() - 1);
      startDate = new Date(yesterday.setHours(0, 0, 0, 0));
      endDate = new Date(yesterday.setHours(23, 59, 59, 999));
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
      case 'Ayer':
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

  const periodInfo = getCurrentPeriodInfo()

  const previousPeriodLabel = React.useMemo(() => {
    switch (selectedPeriod) {
      case 'Diario':
        return 'ayer'
      case 'Ayer':
        return 'antier'
      case 'Semanal':
        return 'la semana previa'
      case 'Mensual':
        return 'el periodo anterior'
      default:
        return 'el periodo previo'
    }
  }, [selectedPeriod])

  const currentVsGoalDelta = React.useMemo(() => {
    if (!currentGoal) {
      return currentPeriodSales
    }
    return currentPeriodSales - currentGoal
  }, [currentGoal, currentPeriodSales])

  const insightBadges = React.useMemo(
    () => [
      {
        label: 'Meta actual',
        value: currentGoal
          ? `$${currentGoal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : 'Sin meta',
        tone: 'neutral' as const
      },
      {
        label: 'Progreso',
        value: `${goalProgress ? goalProgress.toFixed(1) : '0.0'}%`,
        tone: goalProgress >= 100 ? ('positive' as const) : goalProgress >= 66 ? ('warning' as const) : ('neutral' as const)
      },
      {
        label: `Vs ${previousPeriodLabel}`,
        value: `${percentageDifference >= 0 ? '+' : ''}${percentageDifference.toFixed(1)}%`,
        tone: percentageDifference >= 0 ? ('positive' as const) : ('negative' as const)
      }
    ],
    [currentGoal, goalProgress, percentageDifference, previousPeriodLabel]
  )

  const topPerformers = React.useMemo(() => {
    const ranked = emails
      .map((email) => {
        const userSales = salesData
          .filter((sale) => sale.email === email)
          .filter((sale) => filterSalesByDate([sale], selectedPeriod).length > 0)
        const total = userSales.reduce((sum, sale) => sum + sale.venta, 0)
        return {
          email,
          label: emailLabels[email] || email,
          total
        }
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total)

    return ranked.slice(0, 3)
  }, [emails, salesData, selectedPeriod])

  const hasLeaderboard = topPerformers.length > 0

  const formatCurrency = React.useCallback((value: number) => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }, [])

  const goalPacing = React.useMemo(() => {
    if (!currentGoal || selectedPeriod !== 'Mensual') {
      return null
    }

    const { periodStartDate, periodEndDate, dayInWeek, weekInPeriod } = periodInfo
    const today = new Date()
    const totalDays = Math.ceil((periodEndDate.getTime() - periodStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const elapsedDays = Math.min(
      totalDays,
      Math.max(1, Math.ceil((today.getTime() - periodStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    )

    const achievedDaily = currentPeriodSales / elapsedDays
    const targetDaily = currentGoal / totalDays
    const projectedTotal = achievedDaily * totalDays
    const paceDifference = achievedDaily - targetDaily

    return {
      totalDays,
      elapsedDays,
      dayInWeek,
      weekInPeriod,
      achievedDaily,
      targetDaily,
      projectedTotal,
      paceDifference
    }
  }, [currentGoal, currentPeriodSales, periodInfo, selectedPeriod])

  const goalMilestones = React.useMemo(() => {
    if (!currentGoal || selectedPeriod !== 'Mensual') {
      return []
    }

    const thresholds = [25, 50, 75, 100]
    return thresholds.map((threshold) => {
      const required = (threshold / 100) * currentGoal
      const achieved = currentPeriodSales >= required
      const remaining = Math.max(0, required - currentPeriodSales)
      return {
        threshold,
        required,
        achieved,
        remaining
      }
    })
  }, [currentGoal, currentPeriodSales, selectedPeriod])

  const clientInsights = React.useMemo(() => {
    const now = new Date()
    const ATTENTION_THRESHOLD_DAYS = 14
    const SIX_MONTHS_AGO = new Date()
    SIX_MONTHS_AGO.setMonth(SIX_MONTHS_AGO.getMonth() - 6)

    const salesByClient = salesData
      .filter((sale) => sale.email === selectedEmail)
      .filter((sale) => !(sale.clientName || '').toUpperCase().includes('ARCHIVADO NO USAR'))
      .reduce((acc, sale) => {
        if (!acc[sale.clientName]) {
          acc[sale.clientName] = []
        }
        acc[sale.clientName].push(sale)
        return acc
      }, {} as Record<string, Sale[]>)

    const clients = Object.entries(salesByClient).map(([client, sales]) => {
      const sortedSales = [...sales].sort((a, b) => new Date(b.fechaSinHora).getTime() - new Date(a.fechaSinHora).getTime())
      const mostRecent = sortedSales[0]
      const lastPositive = sortedSales.find((sale) => sale.venta > 0) || null
      const previousPositive = sortedSales.find((sale) => {
        if (!lastPositive) return false
        return new Date(sale.fechaSinHora).getTime() < new Date(lastPositive.fechaSinHora).getTime() && sale.venta > 0
      }) || null

      const totalThisPeriod = sales
        .filter((sale) => filterSalesByDate([sale], selectedPeriod).length > 0)
        .reduce((sum, sale) => sum + sale.venta, 0)

      const previousPeriodStartDate = new Date(periodInfo.periodStartDate)
      previousPeriodStartDate.setDate(previousPeriodStartDate.getDate() - 28)
      const previousPeriodEndDate = new Date(periodInfo.periodStartDate)
      previousPeriodEndDate.setDate(previousPeriodEndDate.getDate() - 1)

      const totalPreviousPeriod = sales
        .filter((sale) => {
          const saleDate = new Date(sale.fechaSinHora)
          return saleDate >= previousPeriodStartDate && saleDate <= previousPeriodEndDate
        })
        .reduce((sum, sale) => sum + sale.venta, 0)

      const mostRecentDate = mostRecent ? new Date(mostRecent.fechaSinHora) : null
      const daysSinceLastPurchase = mostRecentDate
        ? Math.floor((now.getTime() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24))
        : Infinity
      const hasRecentVisit = !!mostRecentDate && mostRecentDate >= SIX_MONTHS_AGO
      const deltaFromPreviousSale =
        lastPositive && previousPositive
          ? lastPositive.venta - previousPositive.venta
          : null

      return {
        client,
        mostRecent,
        lastPositive,
        previousPositive,
        totalThisPeriod,
        totalPreviousPeriod,
        growth: totalThisPeriod - totalPreviousPeriod,
        daysSinceLastPurchase,
        hasRecentVisit,
        deltaFromPreviousSale
      }
    })

    const attentionClients = clients
      .filter((c) => c.hasRecentVisit && c.daysSinceLastPurchase >= ATTENTION_THRESHOLD_DAYS)
      .sort((a, b) => b.daysSinceLastPurchase - a.daysSinceLastPurchase)
      .slice(0, 3)

    const clientsWithDelta = clients.filter((c) => c.deltaFromPreviousSale !== null)

    const topGrowth = clientsWithDelta
      .filter((c) => (c.deltaFromPreviousSale as number) > 0)
      .sort((a, b) => (b.deltaFromPreviousSale as number) - (a.deltaFromPreviousSale as number))
      .slice(0, 3)

    const topDecline = clientsWithDelta
      .filter((c) => (c.deltaFromPreviousSale as number) < 0)
      .sort((a, b) => (a.deltaFromPreviousSale as number) - (b.deltaFromPreviousSale as number))
      .slice(0, 3)

    return {
      attentionClients,
      topGrowth,
      topDecline,
      attentionThreshold: ATTENTION_THRESHOLD_DAYS
    }
  }, [salesData, selectedEmail, selectedPeriod, periodInfo])

  return (
    <div className="min-h-screen bg-white px-4 py-4 font-sans w-full" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem' }}>
      <header className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-500 rounded-2xl mr-2 flex items-center justify-center">
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
              className="appearance-none flex items-center text-gray-600 bg-white rounded-full pl-3 pr-8 py-1 text-xs border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-300 transition"
              value={selectedEmail}
              onChange={(e) => setSelectedEmail(e.target.value)}
            >
              {emails.map((email) => (
                <option key={email} value={email}>
                  {emailLabels[email] || email}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <button
              className="p-1.5 rounded-full hover:bg-gray-200 transition-colors duration-200"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <Menu className="h-5 w-5 text-gray-600" />
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-[100]">
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
                    Ventas
                  </Link>
                  <Link
                    href="/clientes"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Clientes
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
                  <button
                    onClick={() => signOut()}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="bg-white rounded-lg mb-3 p-0.5 border border-[#E2E4E9]/70">
        <div className="inline-flex rounded-md w-full">
          {periods.map((period) => (
            <button
              key={period}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ease-in-out ${
                selectedPeriod === period
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
                  : 'bg-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setSelectedPeriod(period)}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl mb-3 p-5 border border-[#E2E4E9]/70">
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
        <div className="mt-3 h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis
                dataKey="x"
                tickFormatter={(value) => value}
                tick={{ fontSize: 9 }}
              />
              <YAxis hide />
              <Tooltip
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Venta']}
                labelFormatter={(label) => label}
                contentStyle={{ fontSize: '10px' }}
              />
              <Bar dataKey="venta" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {goalPacing && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
          <div className="bg-white rounded-xl p-4 border border-[#E2E4E9]/70">
            <h3 className="text-xs font-semibold text-gray-700 mb-1">Ritmo del Periodo</h3>
            <p className="text-xxs uppercase tracking-wide text-gray-500 mb-3">Seguimiento de meta mensual</p>
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Ventas diarias</p>
                <p className="text-sm font-semibold text-blue-600">{formatCurrency(goalPacing.achievedDaily || 0)}/día</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Ritmo objetivo</p>
                <p className="text-sm font-semibold text-gray-700">{formatCurrency(goalPacing.targetDaily || 0)}/día</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Días transcurridos</p>
                <p className="text-sm font-semibold text-gray-700">{goalPacing.elapsedDays} / {goalPacing.totalDays}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Proyección</p>
                <p className={`text-sm font-semibold ${goalPacing.projectedTotal >= currentGoal ? 'text-green-600' : 'text-amber-600'}`}>
                  {formatCurrency(goalPacing.projectedTotal || 0)}
                </p>
              </div>
            </div>
            <div className={`mt-3 border rounded-lg px-3 py-2 text-xs ${goalPacing.paceDifference >= 0 ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
              {goalPacing.paceDifference >= 0
                ? `Vas arriba del ritmo por ${formatCurrency(goalPacing.paceDifference)} por día.`
                : `Debes incrementar ${formatCurrency(Math.abs(goalPacing.paceDifference))} por día para recuperar el objetivo.`}
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-[#E2E4E9]/70">
            <h3 className="text-xs font-semibold text-gray-700 mb-1">Hitos de la Meta</h3>
            <p className="text-xxs uppercase tracking-wide text-gray-500 mb-3">Avance hacia {formatCurrency(currentGoal)}</p>
            <div className="space-y-2">
              {goalMilestones.map((milestone) => (
                <div
                  key={milestone.threshold}
                  className={`flex items-center justify-between border rounded-lg px-3 py-2 text-xs ${milestone.achieved ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-600'}`}
                >
                  <div>
                    <p className="text-[10px] uppercase tracking-wide">{milestone.threshold}% alcanzado</p>
                    <p className="text-sm font-semibold">{formatCurrency(milestone.required)}</p>
                  </div>
                  {!milestone.achieved && (
                    <span className="text-xxs text-gray-500">Faltan {formatCurrency(milestone.remaining)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-[#E2E4E9]/70">
            <h3 className="text-xs font-semibold text-gray-700 mb-1">Semana actual</h3>
            <p className="text-xxs uppercase tracking-wide text-gray-500 mb-3">Contexto del periodo</p>
            <ul className="text-xs text-gray-600 space-y-2">
              <li className="flex justify-between">
                <span>Semana en el periodo</span>
                <span className="font-semibold">{goalPacing.weekInPeriod} / 4</span>
              </li>
              <li className="flex justify-between">
                <span>Día de la semana</span>
                <span className="font-semibold">{goalPacing.dayInWeek}</span>
              </li>
              <li className="flex justify-between">
                <span>Meta restante</span>
                <span className="font-semibold">{formatCurrency(Math.max(0, currentGoal - currentPeriodSales))}</span>
              </li>
              <li className="flex justify-between">
                <span>Ventas por lograr/día</span>
                <span className="font-semibold">
                  {formatCurrency(currentGoal > currentPeriodSales
                    ? (currentGoal - currentPeriodSales) / Math.max(1, goalPacing.totalDays - goalPacing.elapsedDays)
                    : 0)}
                </span>
              </li>
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <div className="bg-white rounded-xl p-4 border border-[#E2E4E9]/70">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-700">Resumen Personalizado</h2>
            <span className="text-[10px] uppercase tracking-wide text-blue-500 font-semibold bg-blue-50 px-2 py-0.5 rounded-full">
              Insights
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            {emailLabels[selectedEmail] || 'Tu'} cierre {selectedPeriod.toLowerCase()}.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            {insightBadges.map((badge) => (
              <div
                key={badge.label}
                className={`flex-1 border rounded-lg px-3 py-2 bg-gradient-to-br from-white to-gray-50 ${
                  badge.tone === 'positive'
                    ? 'border-green-200 text-green-700'
                    : badge.tone === 'negative'
                    ? 'border-red-200 text-red-600'
                    : badge.tone === 'warning'
                    ? 'border-amber-200 text-amber-600'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                <span className="text-[10px] uppercase tracking-wide block">{badge.label}</span>
                <span className="text-sm font-semibold">{badge.value}</span>
              </div>
            ))}
          </div>
          {currentGoal ? (
            <div className="mt-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
              {currentVsGoalDelta >= 0
                ? `Vas delante de la meta por ${formatCurrency(currentVsGoalDelta)}. Excelente ritmo.`
                : `Necesitas ${formatCurrency(Math.abs(currentVsGoalDelta))} para alcanzar la meta.`}
            </div>
          ) : (
            <div className="mt-3 bg-gradient-to-r from-gray-100 to-gray-200 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600">
              No hay meta definida para este periodo.
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#E2E4E9]/70">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-700">Actividad del Equipo</h2>
            <span className="text-[10px] uppercase tracking-wide text-purple-500 font-semibold bg-purple-50 px-2 py-0.5 rounded-full">
              Colaboración
            </span>
          </div>
          {hasLeaderboard ? (
            <div className="space-y-2">
              {topPerformers.map((performer, index) => (
                <div
                  key={performer.email}
                  className={`flex items-center justify-between border rounded-lg px-3 py-2 bg-gradient-to-r ${
                    index === 0
                      ? 'from-yellow-50 to-amber-100 border-amber-200'
                      : index === 1
                      ? 'from-slate-50 to-slate-100 border-slate-200'
                      : 'from-orange-50 to-orange-100 border-orange-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                      index === 0
                        ? 'bg-amber-400 text-white'
                        : index === 1
                        ? 'bg-gray-400 text-white'
                        : 'bg-orange-400 text-white'
                    }`}>
                      #{index + 1}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{performer.label}</p>
                      <p className="text-xxs text-gray-500">{selectedPeriod} • {periodInfo.periodNumber ? `Periodo ${periodInfo.periodNumber}` : 'Tiempo actual'}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-gray-700">{formatCurrency(performer.total)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-gray-500 border border-dashed border-gray-300 rounded-lg py-6">
              No hay datos del equipo para este periodo.
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-[#E2E4E9]/70 mb-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-gray-700">Clientes a Vigilar</h2>
          <span className="text-[10px] uppercase tracking-wide text-emerald-500 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
            Inteligencia
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs text-gray-600">
          <div>
            <h3 className="text-xxs uppercase tracking-wide text-gray-500 mb-2">Necesitan atención</h3>
            <div className="space-y-1.5">
              {clientInsights.attentionClients.length > 0 ? (
                clientInsights.attentionClients.map((client) => (
                  <div key={client.client} className="border border-amber-200 bg-amber-50 rounded-lg px-3 py-2">
                    <p className="text-sm font-semibold text-amber-700">{client.client}</p>
                    <p className="text-xxs text-amber-600">Última compra hace {client.daysSinceLastPurchase} días</p>
                  </div>
                ))
              ) : (
                <p className="text-xxs text-gray-500">Sin alertas recientes en clientes activos.</p>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-xxs uppercase tracking-wide text-gray-500 mb-2">Mayor crecimiento</h3>
            <div className="space-y-1.5">
              {clientInsights.topGrowth.length > 0 ? (
                clientInsights.topGrowth.map((client) => (
                  <div key={client.client} className="border border-green-200 bg-green-50 rounded-lg px-3 py-2">
                    <p className="text-sm font-semibold text-green-700">{client.client}</p>
                    <p className="text-xxs text-green-600">Última venta vs anterior +{formatCurrency(client.deltaFromPreviousSale as number)}</p>
                  </div>
                ))
              ) : (
                <p className="text-xxs text-gray-500">Aún no hay tendencias positivas.</p>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-xxs uppercase tracking-wide text-gray-500 mb-2">Mayor caída</h3>
            <div className="space-y-1.5">
              {clientInsights.topDecline.length > 0 ? (
                clientInsights.topDecline.map((client) => (
                  <div key={client.client} className="border border-red-200 bg-red-50 rounded-lg px-3 py-2">
                    <p className="text-sm font-semibold text-red-700">{client.client}</p>
                    <p className="text-xxs text-red-600">Última venta vs anterior {formatCurrency(client.deltaFromPreviousSale as number)}</p>
                  </div>
                ))
              ) : (
                <p className="text-xxs text-gray-500">Sin caídas relevantes detectadas.</p>
              )}
            </div>
          </div>
        </div>
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

      <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
        <h2 className="text-gray-700 font-semibold mb-2 flex items-center text-xs">
          <BarChart2 className="mr-1.5 h-4 w-4" /> Ventas por Código
        </h2>
        {Object.keys(salesByType).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(salesByType)
              .sort(([, a], [, b]) => b - a)
              .map(([codigo, venta]) => {
                const maxVenta = Math.max(...Object.values(salesByType))
                const percentage = (venta / maxVenta) * 100
                return (
                  <div key={codigo}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-gray-700">{codigo}</p>
                      <p className="text-xs font-semibold text-gray-900">${venta.toFixed(2)}</p>
                    </div>
                    <div className="w-full bg-gray-200 h-1.5 rounded-full">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                )
              })}
          </div>
        ) : (
          <p className="text-xs text-gray-500">No hay ventas en este periodo.</p>
        )}
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
                  <p className="text-xxs text-gray-500">
                    {sale.fechaSinHora}
                    {sale.submissionTime ? ` • ${sale.submissionTime}` : ''}
                  </p>
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
                className="appearance-none bg-transparent py-2 pl-2 pr-8 text-base focus:outline-none w-full"
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ fontSize: '16px' }} // Ensure minimum font size of 16px
              />
            </div>
            {filteredClientNames.length > 0 && (
              <div className="absolute z-10 mt-1 left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg">
                {filteredClientNames.map((name) => (
                  <div
                    key={name}
                    className="px-4 py-2 text-base hover:bg-gray-100 cursor-pointer"
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
                <p className="text-xxs text-gray-500">
                  {sale.fechaSinHora}
                  {sale.submissionTime ? ` • ${sale.submissionTime}` : ''}
                </p>
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
