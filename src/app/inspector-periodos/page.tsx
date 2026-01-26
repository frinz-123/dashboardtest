"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ChevronDown,
  Calendar,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  ShoppingBag,
  List,
  BarChart2,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
} from "recharts";
import BlurIn from "@/components/ui/blur-in";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isMasterAccount, EMAIL_TO_VENDOR_LABELS } from "@/utils/auth";
import {
  getAllPeriods,
  getPeriodDateRange,
  getPeriodWeeks,
  isDateInPeriod,
} from "@/utils/dateUtils";
import {
  getSellerGoal,
  getSellersWithGoals,
  GoalPeriod,
} from "@/utils/sellerGoals";
import FeedTab from "@/components/inspector/FeedTab";
import { Camera, BarChart3, MessageSquare, Send, Check } from "lucide-react";

const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const spreadsheetId = process.env.NEXT_PUBLIC_SPREADSHEET_ID;
const sheetName = process.env.NEXT_PUBLIC_SHEET_NAME;

type Sale = {
  clientName: string;
  venta: number;
  codigo: string;
  fechaSinHora: string;
  email: string;
  submissionTime?: string;
  products: Record<string, number>;
  photoUrls: string[];
};

type SellerStats = {
  email: string;
  name: string;
  totalSales: number;
  goal: number;
  progress: number;
  weeklyBreakdown: number[];
  visitsCount: number;
  salesCount: number;
  efectivoSales: number;
};

type ViewMode = "overview" | "seller-detail";
type TabMode = "inspector" | "feed";

type FeedReview = {
  saleId: string;
  reviewedAt: string;
  reviewedBy: string;
  note: string;
};

// Generate a unique ID for a sale (must match FeedTab's getSaleId)
const getSaleId = (sale: Sale): string => {
  return `${sale.email}|${sale.fechaSinHora}|${sale.clientName}`;
};

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
];
const CODE_COLORS: Record<string, string> = {
  CONTADO: "#10b981",
  CREDITO: "#f59e0b",
  DEVOLUCION: "#ef4444",
  CAMBIO: "#8b5cf6",
  ANTICIPO: "#3b82f6",
  EFT: "#06b6d4",
};

const normalizePhotoUrls = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((url) => String(url))
      .filter((url) => url.trim() && url.includes("http"));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    // Try parsing as JSON first
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((url) => String(url))
          .filter((url) => url.trim() && url.includes("http"));
      }
      // If parsed is a string (single URL wrapped in JSON), use it
      if (typeof parsed === "string" && parsed.includes("http")) {
        return [parsed];
      }
    } catch {
      // Not valid JSON, continue to other parsing methods
    }

    // Handle Google Sheets formula results that might look like: ["url1", "url2"]
    // but aren't valid JSON due to smart quotes or other formatting issues
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const inner = trimmed.slice(1, -1);
      const urls = inner
        .split(/[,;]/)
        .map((url) =>
          url
            .trim()
            .replace(/^["'""'']+|["'""'']+$/g, "")
            .trim(),
        )
        .filter((url) => url && url.includes("http"));
      if (urls.length > 0) return urls;
    }

    // Fallback: split by common delimiters (comma, semicolon, newline, space between URLs)
    const urls = trimmed
      .split(/[,;\n]+|\s+(?=https?:)/)
      .map((url) =>
        url
          .trim()
          .replace(/^["'""'']+|["'""'']+$/g, "")
          .trim(),
      )
      .filter((url) => url && url.includes("http"));

    return urls;
  }

  return [];
};

// Convert Google Drive URLs to direct image URLs that can be used in <img> tags
const getDisplayableImageUrl = (url: string): string => {
  if (!url) return "";

  // Already a direct image URL (not Google Drive)
  if (!url.includes("drive.google.com")) {
    return url;
  }

  // Extract file ID from various Google Drive URL formats
  let fileId: string | null = null;

  // Format: https://drive.google.com/file/d/FILE_ID/view...
  const fileMatch = url.match(/\/file\/d\/([^/]+)/);
  if (fileMatch) {
    fileId = fileMatch[1];
  }

  // Format: https://drive.google.com/open?id=FILE_ID
  if (!fileId) {
    const openMatch = url.match(/[?&]id=([^&]+)/);
    if (openMatch) {
      fileId = openMatch[1];
    }
  }

  // Format: https://drive.google.com/uc?id=FILE_ID&export=...
  if (!fileId) {
    const ucMatch = url.match(/\/uc\?.*id=([^&]+)/);
    if (ucMatch) {
      fileId = ucMatch[1];
    }
  }

  if (fileId) {
    // Use lh3.googleusercontent.com for reliable direct image access
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  // Fallback: return original URL
  return url;
};

// Efectivo goals for specific sellers (by name)
const EFECTIVO_GOALS: Record<string, number> = {
  Christian: 65000,
  Reyna: 55000,
  Mochis: 65000,
};

export default function InspectorPeriodosPage() {
  const { data: session, status } = useSession();
  const [salesData, setSalesData] = useState<Sale[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const [isSellerDropdownOpen, setIsSellerDropdownOpen] = useState(false);

  // New states for enhanced functionality
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null); // null = all weeks, 1-4 = specific week
  const [selectedDay, setSelectedDay] = useState<string | null>(null); // null = all days
  const [showAllSales, setShowAllSales] = useState(false);
  const [isHideModeEnabled, setIsHideModeEnabled] = useState(false);
  const [hiddenSellers, setHiddenSellers] = useState<Set<string>>(new Set());
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [expandedPhotoUrl, setExpandedPhotoUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabMode>("inspector");

  // Reviews state
  const [reviews, setReviews] = useState<Map<string, FeedReview>>(new Map());
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");

  const availablePeriods = useMemo(() => getAllPeriods().reverse(), []);
  const isAdmin = useMemo(
    () => isMasterAccount(session?.user?.email),
    [session],
  );

  // Get weeks for the selected period
  const periodWeeks = useMemo(() => {
    if (!selectedPeriod) return [];
    return getPeriodWeeks(selectedPeriod);
  }, [selectedPeriod]);

  // Get all days in the selected period (grouped by week)
  const periodDays = useMemo(() => {
    if (!selectedPeriod) return [];
    const { periodStartDate, periodEndDate } =
      getPeriodDateRange(selectedPeriod);
    const days: {
      date: Date;
      label: string;
      dateStr: string;
      weekNumber: number;
    }[] = [];
    const current = new Date(periodStartDate);
    let dayIndex = 0;

    while (current <= periodEndDate) {
      const weekNumber = Math.floor(dayIndex / 7) + 1;
      days.push({
        date: new Date(current),
        label: current.toLocaleDateString("es-ES", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
        dateStr: current.toISOString().split("T")[0],
        weekNumber,
      });
      current.setDate(current.getDate() + 1);
      dayIndex++;
    }
    return days;
  }, [selectedPeriod]);

  // Get days for the selected week only
  const daysInSelectedWeek = useMemo(() => {
    if (!selectedWeek) return [];
    return periodDays.filter((day) => day.weekNumber === selectedWeek);
  }, [selectedWeek, periodDays]);

  // Get today's date string and current week number for visual cues
  const { todayDateStr, currentWeekNumber } = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Find which week today falls into
    let weekNum: number | null = null;
    for (const week of periodWeeks) {
      const startStr = week.weekStart.toISOString().split("T")[0];
      const endStr = week.weekEnd.toISOString().split("T")[0];
      if (todayStr >= startStr && todayStr <= endStr) {
        weekNum = week.weekNumber;
        break;
      }
    }

    return { todayDateStr: todayStr, currentWeekNumber: weekNum };
  }, [periodWeeks]);

  // Set default period to the current one (not completed)
  useEffect(() => {
    if (availablePeriods.length > 0 && selectedPeriod === null) {
      const currentPeriod = availablePeriods.find((p) => !p.isCompleted);
      setSelectedPeriod(
        currentPeriod?.periodNumber || availablePeriods[0].periodNumber,
      );
    }
  }, [availablePeriods, selectedPeriod]);

  // Reset week and day selection when period changes
  useEffect(() => {
    setSelectedWeek(null);
    setSelectedDay(null);
  }, [selectedPeriod]);

  // Reset day selection when week changes
  useEffect(() => {
    setSelectedDay(null);
  }, [selectedWeek]);

  // Fetch sales data
  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  useEffect(() => {
    setExpandedPhotoUrl(null);
    setShowNoteInput(false);
    setNoteText("");
  }, [selectedSale]);

  // Fetch reviews on mount
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await fetch("/api/feed-reviews");
        if (response.ok) {
          const data = await response.json();
          const reviewMap = new Map<string, FeedReview>();
          data.reviews.forEach((review: FeedReview) => {
            reviewMap.set(review.saleId, review);
          });
          setReviews(reviewMap);
        }
      } catch (error) {
        console.error("Error fetching reviews:", error);
      }
    };
    fetchReviews();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch up to column AQ (43 columns) to ensure we capture AP even with column shifts
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:AQ?key=${googleApiKey}`,
      );
      const data = await response.json();
      const headers: string[] = data.values?.[0] || [];
      const rows: string[][] = data.values?.slice(1) || [];

      // Find photo column index dynamically - search for common header names
      // Default to column AP (index 41) if not found by header
      const photoHeaderPatterns = [
        /foto/i,
        /photo/i,
        /imagen/i,
        /image/i,
        /picture/i,
      ];
      let photoColumnIndex = 41; // Default: column AP

      for (let i = 0; i < headers.length; i++) {
        if (
          photoHeaderPatterns.some((pattern) => pattern.test(headers[i] || ""))
        ) {
          photoColumnIndex = i;
          break;
        }
      }

      const sales: Sale[] = rows.map((row: string[]) => {
        const products: Record<string, number> = {};
        for (let i = 8; i <= 30; i++) {
          if (row[i] && row[i] !== "0") {
            products[headers[i]] = parseInt(row[i], 10);
          }
        }
        for (let i = 34; i <= 36; i++) {
          if (row[i] && row[i] !== "0") {
            products[headers[i]] = parseInt(row[i], 10);
          }
        }

        // Try to find photo URLs from the detected column or by scanning the row
        let photoUrls: string[] = [];

        // First try the detected/default photo column
        if (row[photoColumnIndex]) {
          photoUrls = normalizePhotoUrls(row[photoColumnIndex]);
        }

        // If no photos found, scan nearby columns (in case of column shift)
        // and also check if any cell contains JSON array of URLs
        if (photoUrls.length === 0) {
          // Check columns 39-42 (AN through AQ) for photo data
          for (let i = 39; i <= Math.min(42, row.length - 1); i++) {
            if (i === photoColumnIndex) continue; // Already checked
            const cellValue = row[i];
            if (
              cellValue &&
              (cellValue.includes("drive.google.com") ||
                cellValue.includes("googleusercontent.com") ||
                cellValue.startsWith("["))
            ) {
              const parsed = normalizePhotoUrls(cellValue);
              if (parsed.length > 0) {
                photoUrls = parsed;
                break;
              }
            }
          }
        }

        return {
          clientName: row[0] || "Unknown",
          venta: parseFloat(row[33]) || 0,
          codigo: row[31] || "",
          fechaSinHora: row[32] || "",
          email: row[7] || "",
          submissionTime: row[4] || "",
          products,
          photoUrls,
        };
      });
      setSalesData(sales);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get filtered sales for the selected period and optional week/day/seller
  const filteredSales = useMemo(() => {
    if (!selectedPeriod || salesData.length === 0) return [];

    const { periodStartDate, periodEndDate } =
      getPeriodDateRange(selectedPeriod);

    return salesData.filter((sale) => {
      const saleDate = new Date(sale.fechaSinHora);

      // Filter by period
      if (!isDateInPeriod(saleDate, periodStartDate, periodEndDate))
        return false;

      // Filter by seller if selected
      if (selectedSeller && sale.email !== selectedSeller) return false;

      // Filter by week if selected (and no specific day selected)
      if (selectedWeek && !selectedDay) {
        const week = periodWeeks[selectedWeek - 1];
        if (week && !isDateInPeriod(saleDate, week.weekStart, week.weekEnd))
          return false;
      }

      // Filter by day if selected
      if (selectedDay) {
        const saleDateStr = saleDate.toISOString().split("T")[0];
        if (saleDateStr !== selectedDay) return false;
      }

      return true;
    });
  }, [
    selectedPeriod,
    salesData,
    selectedSeller,
    selectedWeek,
    selectedDay,
    periodWeeks,
  ]);

  // Calculate seller stats for selected period
  const sellerStats = useMemo((): SellerStats[] => {
    if (!selectedPeriod || salesData.length === 0) return [];

    const { periodStartDate, periodEndDate } =
      getPeriodDateRange(selectedPeriod);
    const weeks = getPeriodWeeks(selectedPeriod);
    const sellers = getSellersWithGoals();

    return sellers
      .map((email) => {
        const sellerSales = salesData.filter((sale) => {
          if (sale.email !== email) return false;
          const saleDate = new Date(sale.fechaSinHora);
          return isDateInPeriod(saleDate, periodStartDate, periodEndDate);
        });

        const totalSales = sellerSales.reduce(
          (sum, sale) => sum + sale.venta,
          0,
        );
        const goal = getSellerGoal(email, selectedPeriod as GoalPeriod);
        const progress = goal > 0 ? (totalSales / goal) * 100 : 0;

        const weeklyBreakdown = weeks.map((week) => {
          return sellerSales
            .filter((sale) => {
              const saleDate = new Date(sale.fechaSinHora);
              return isDateInPeriod(saleDate, week.weekStart, week.weekEnd);
            })
            .reduce((sum, sale) => sum + sale.venta, 0);
        });

        const efectivoSales = sellerSales
          .filter((sale) => sale.codigo === "EFT")
          .reduce((sum, sale) => sum + sale.venta, 0);

        return {
          email,
          name: EMAIL_TO_VENDOR_LABELS[email] || email.split("@")[0],
          totalSales,
          goal,
          progress,
          weeklyBreakdown,
          visitsCount: sellerSales.length,
          salesCount: sellerSales.filter((sale) => sale.venta > 0).length,
          efectivoSales,
        };
      })
      .sort((a, b) => b.totalSales - a.totalSales);
  }, [selectedPeriod, salesData]);

  const visibleSellerStats = useMemo(() => {
    return sellerStats.filter((s) => !hiddenSellers.has(s.email));
  }, [sellerStats, hiddenSellers]);

  // Sales by code for filtered data
  const salesByCode = useMemo(() => {
    const byCode: Record<string, { total: number; count: number }> = {};
    filteredSales.forEach((sale) => {
      const code = sale.codigo || "SIN CODIGO";
      if (!byCode[code]) {
        byCode[code] = { total: 0, count: 0 };
      }
      byCode[code].total += sale.venta;
      byCode[code].count += 1;
    });
    return Object.entries(byCode)
      .map(([code, data]) => ({ code, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [filteredSales]);

  // Period-filtered sales (for overview mode products) - separate from filteredSales to avoid recalculation
  const periodSales = useMemo(() => {
    if (!selectedPeriod || salesData.length === 0) return [];
    const { periodStartDate, periodEndDate } =
      getPeriodDateRange(selectedPeriod);
    return salesData.filter((sale) => {
      const saleDate = new Date(sale.fechaSinHora);
      return isDateInPeriod(saleDate, periodStartDate, periodEndDate);
    });
  }, [selectedPeriod, salesData]);

  // Products sold aggregation
  const productsSold = useMemo(() => {
    const byProduct: Record<string, number> = {};
    // Use filteredSales when seller is selected (respects week/day filters), otherwise use periodSales
    const salesToUse = selectedSeller ? filteredSales : periodSales;

    for (const sale of salesToUse) {
      if (sale.products) {
        for (const [product, quantity] of Object.entries(sale.products)) {
          byProduct[product] = (byProduct[product] || 0) + quantity;
        }
      }
    }

    return Object.entries(byProduct)
      .map(([product, quantity]) => ({ product, quantity }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [selectedSeller, filteredSales, periodSales]);

  // Pre-calculate total products for percentage calculations
  const totalProductsCount = useMemo(() => {
    return productsSold.reduce((sum, p) => sum + p.quantity, 0);
  }, [productsSold]);

  // Pre-calculate filtered sales count (sales with venta > 0)
  const filteredSalesCount = useMemo(() => {
    return filteredSales.filter((s) => s.venta > 0).length;
  }, [filteredSales]);

  // Daily sales chart data
  const dailySalesChartData = useMemo(() => {
    if (!selectedPeriod) return [];

    const salesByDate: Record<string, number> = {};
    filteredSales.forEach((sale) => {
      const dateStr = new Date(sale.fechaSinHora).toISOString().split("T")[0];
      salesByDate[dateStr] = (salesByDate[dateStr] || 0) + sale.venta;
    });

    // Use days from selected week if week is selected, otherwise all period days
    const daysToShow = selectedWeek ? daysInSelectedWeek : periodDays;

    return daysToShow.map((day) => ({
      date: day.label,
      dateStr: day.dateStr,
      venta: salesByDate[day.dateStr] || 0,
    }));
  }, [
    filteredSales,
    periodDays,
    selectedPeriod,
    selectedWeek,
    daysInSelectedWeek,
  ]);

  // Summary stats
  const summaryStats = useMemo(() => {
    if (visibleSellerStats.length === 0) return null;

    const totalTeamSales = visibleSellerStats.reduce(
      (sum, s) => sum + s.totalSales,
      0,
    );
    const totalTeamGoal = visibleSellerStats.reduce(
      (sum, s) => sum + s.goal,
      0,
    );
    const avgProgress =
      visibleSellerStats.length > 0
        ? visibleSellerStats.reduce((sum, s) => sum + s.progress, 0) /
          visibleSellerStats.length
        : 0;
    const sellersOnTrack = visibleSellerStats.filter(
      (s) => s.progress >= 100,
    ).length;
    const bestPerformer = visibleSellerStats[0];

    return {
      totalTeamSales,
      totalTeamGoal,
      avgProgress,
      sellersOnTrack,
      bestPerformer,
    };
  }, [visibleSellerStats]);

  // Current seller stats (when viewing seller detail)
  const currentSellerStats = useMemo(() => {
    if (!selectedSeller) return null;
    return sellerStats.find((s) => s.email === selectedSeller) || null;
  }, [selectedSeller, sellerStats]);

  const selectedPeriodInfo = useMemo(() => {
    if (!selectedPeriod) return null;
    return getPeriodDateRange(selectedPeriod);
  }, [selectedPeriod]);

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return "text-green-600 bg-green-50";
    if (progress >= 75) return "text-blue-600 bg-blue-50";
    if (progress >= 50) return "text-amber-600 bg-amber-50";
    return "text-red-600 bg-red-50";
  };

  const getProgressBarColor = (progress: number) => {
    if (progress >= 100) return "bg-green-500";
    if (progress >= 75) return "bg-blue-500";
    if (progress >= 50) return "bg-amber-500";
    return "bg-red-500";
  };

  const handleSelectSeller = (email: string) => {
    setSelectedSeller(email);
    setViewMode("seller-detail");
    setIsSellerDropdownOpen(false);
  };

  const handleBackToOverview = () => {
    setViewMode("overview");
    setSelectedSeller(null);
    setSelectedWeek(null);
    setSelectedDay(null);
  };

  const toggleSellerVisibility = (email: string) => {
    setHiddenSellers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(email)) {
        newSet.delete(email);
      } else {
        newSet.add(email);
      }
      return newSet;
    });
  };

  // Mark sale as reviewed
  const handleMarkReviewed = async (note?: string) => {
    if (!selectedSale || !session?.user?.email) return;

    setIsSubmittingReview(true);
    try {
      const saleId = getSaleId(selectedSale);
      const response = await fetch("/api/feed-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId,
          reviewedBy: session.user.email,
          note: note || "",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setReviews((prev) => {
          const newMap = new Map(prev);
          newMap.set(saleId, data.review);
          return newMap;
        });
        setShowNoteInput(false);
        setNoteText("");
      }
    } catch (error) {
      console.error("Error saving review:", error);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Get current sale's review
  const currentSaleReview = selectedSale
    ? reviews.get(getSaleId(selectedSale))
    : null;

  // Loading state
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  // Not authenticated
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 text-center max-w-md">
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            Acceso Restringido
          </h1>
          <p className="text-gray-600 mb-4">
            Debes iniciar sesion para acceder a esta pagina.
          </p>
          <Link href="/" className="text-blue-600 hover:underline">
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 text-center max-w-md">
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            Acceso Restringido
          </h1>
          <p className="text-gray-600 mb-4">
            Solo los administradores pueden acceder al Inspector de Periodos.
          </p>
          <Link href="/" className="text-blue-600 hover:underline">
            Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const currentPeriodData = availablePeriods.find(
    (p) => p.periodNumber === selectedPeriod,
  );
  const totalFilteredSales = filteredSales.reduce((sum, s) => sum + s.venta, 0);
  const visitsCount = filteredSales.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-[85rem] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {viewMode === "seller-detail" ? (
              <button
                onClick={handleBackToOverview}
                className="text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <Link href="/" className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            )}
            <BlurIn
              word={
                viewMode === "seller-detail"
                  ? `Detalle: ${EMAIL_TO_VENDOR_LABELS[selectedSeller || ""] || selectedSeller}`
                  : "Inspector de Periodos"
              }
              className="text-lg font-bold text-gray-800"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>{session.user?.email}</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-t border-gray-100 px-4">
          <div className="max-w-[85rem] mx-auto flex gap-1">
            <button
              onClick={() => setActiveTab("inspector")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "inspector"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Inspector</span>
            </button>
            <button
              onClick={() => setActiveTab("feed")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "feed"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Feed</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[85rem] mx-auto px-4 py-6">
        {activeTab === "feed" ? (
          <FeedTab
            salesData={salesData}
            getDisplayableImageUrl={getDisplayableImageUrl}
            formatCurrency={formatCurrency}
            isLoading={isLoading}
          />
        ) : (
          <>
            {/* Controls Section */}
            <div className="bg-white rounded-xl p-4 mb-6 border border-gray-200">
              <div className="flex flex-col gap-4">
                {/* Row 1: Period and Seller selectors */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Period Selector */}
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">
                      Periodo
                    </label>
                    <div className="relative">
                      <button
                        onClick={() =>
                          setIsPeriodDropdownOpen(!isPeriodDropdownOpen)
                        }
                        className="flex items-center justify-between gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg w-full text-sm font-medium"
                      >
                        <span>
                          {currentPeriodData ? (
                            <>
                              Periodo {selectedPeriod}
                              {currentPeriodData.isCurrent && " (Actual)"}
                            </>
                          ) : (
                            "Seleccionar..."
                          )}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${isPeriodDropdownOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {isPeriodDropdownOpen && (
                        <div className="absolute left-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-20 max-h-80 overflow-y-auto">
                          {availablePeriods.map((period) => (
                            <button
                              key={period.periodNumber}
                              onClick={() => {
                                setSelectedPeriod(period.periodNumber);
                                setIsPeriodDropdownOpen(false);
                              }}
                              className={`w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                                selectedPeriod === period.periodNumber
                                  ? "bg-blue-50"
                                  : ""
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-800">
                                  Periodo {period.periodNumber}
                                </span>
                                {period.isCurrent ? (
                                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> Actual
                                  </span>
                                ) : period.isCompleted ? (
                                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />{" "}
                                    Completado
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {period.label}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Seller Selector */}
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">
                      Vendedor
                    </label>
                    <div className="relative">
                      <button
                        onClick={() =>
                          setIsSellerDropdownOpen(!isSellerDropdownOpen)
                        }
                        className={`flex items-center justify-between gap-2 px-4 py-2 rounded-lg w-full text-sm font-medium border ${
                          selectedSeller
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                            : "bg-gray-50 border-gray-200 text-gray-700"
                        }`}
                      >
                        <span>
                          {selectedSeller
                            ? EMAIL_TO_VENDOR_LABELS[selectedSeller] ||
                              selectedSeller
                            : "Todos los vendedores"}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${isSellerDropdownOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {isSellerDropdownOpen && (
                        <div className="absolute left-0 mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-20 max-h-80 overflow-y-auto">
                          <button
                            onClick={() => {
                              setSelectedSeller(null);
                              setViewMode("overview");
                              setIsSellerDropdownOpen(false);
                            }}
                            className={`w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 ${
                              !selectedSeller ? "bg-blue-50" : ""
                            }`}
                          >
                            <span className="font-medium text-gray-800">
                              Todos los vendedores
                            </span>
                          </button>
                          {sellerStats.map((seller) => (
                            <button
                              key={seller.email}
                              onClick={() => handleSelectSeller(seller.email)}
                              className={`w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                                selectedSeller === seller.email
                                  ? "bg-blue-50"
                                  : ""
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-800">
                                  {seller.name}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatCurrency(seller.totalSales)}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">
                                {seller.visitsCount} visitas
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 2: Week and Day filter (only when seller is selected) */}
                {selectedSeller && (
                  <div className="space-y-3">
                    {/* Week filter */}
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">
                        Filtrar por semana
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            setSelectedWeek(null);
                            setSelectedDay(null);
                          }}
                          className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                            !selectedWeek && !selectedDay
                              ? "bg-blue-500 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          Todo el periodo
                        </button>
                        {periodWeeks.map((week) => {
                          const isCurrentWeek =
                            currentWeekNumber === week.weekNumber;
                          return (
                            <button
                              key={week.weekNumber}
                              onClick={() => setSelectedWeek(week.weekNumber)}
                              className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors relative ${
                                selectedWeek === week.weekNumber
                                  ? "bg-indigo-500 text-white"
                                  : isCurrentWeek
                                    ? "bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300 hover:bg-indigo-200"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}
                            >
                              <span className="font-semibold">
                                S{week.weekNumber}
                              </span>
                              {isCurrentWeek &&
                                selectedWeek !== week.weekNumber && (
                                  <span className="ml-1 text-[9px] font-normal">
                                    (hoy)
                                  </span>
                                )}
                              <span className="hidden sm:inline text-[10px] ml-1 opacity-80">
                                (
                                {week.weekStart.toLocaleDateString("es-ES", {
                                  day: "numeric",
                                  month: "short",
                                })}{" "}
                                -{" "}
                                {week.weekEnd.toLocaleDateString("es-ES", {
                                  day: "numeric",
                                  month: "short",
                                })}
                                )
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Day filter (only when week is selected) */}
                    {selectedWeek && (
                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">
                          Filtrar por dia (Semana {selectedWeek})
                        </label>
                        <div className="flex flex-wrap gap-1">
                          <button
                            onClick={() => setSelectedDay(null)}
                            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                              !selectedDay
                                ? "bg-indigo-500 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            Toda la semana
                          </button>
                          {daysInSelectedWeek.map((day) => {
                            const isToday = day.dateStr === todayDateStr;
                            return (
                              <button
                                key={day.dateStr}
                                onClick={() => setSelectedDay(day.dateStr)}
                                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                                  selectedDay === day.dateStr
                                    ? "bg-blue-500 text-white"
                                    : isToday
                                      ? "bg-blue-100 text-blue-700 ring-2 ring-blue-300 hover:bg-blue-200"
                                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                              >
                                {day.label}
                                {isToday && selectedDay !== day.dateStr && (
                                  <span className="ml-1 text-[9px] font-medium">
                                    (hoy)
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Period date range info */}
                {selectedPeriodInfo && (
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {selectedPeriodInfo.periodStartDate.toLocaleDateString(
                          "es-ES",
                          {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          },
                        )}
                        {" - "}
                        {selectedPeriodInfo.periodEndDate.toLocaleDateString(
                          "es-ES",
                          {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          },
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-500">Cargando datos...</div>
              </div>
            ) : viewMode === "seller-detail" && currentSellerStats ? (
              /* ========== SELLER DETAIL VIEW ========== */
              <>
                {/* Seller Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">
                        {selectedDay
                          ? "Ventas del dia"
                          : selectedWeek
                            ? `Ventas S${selectedWeek}`
                            : "Ventas del periodo"}
                      </span>
                    </div>
                    <p className="text-xl font-bold text-gray-800">
                      {formatCurrency(totalFilteredSales)}
                    </p>
                    {!selectedDay && !selectedWeek && (
                      <p className="text-xs text-gray-500 mt-1">
                        Meta: {formatCurrency(currentSellerStats.goal)}
                      </p>
                    )}
                  </div>

                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 bg-green-50 rounded-lg">
                        <Target className="w-4 h-4 text-green-600" />
                      </div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">
                        Progreso
                      </span>
                    </div>
                    <p className="text-xl font-bold text-gray-800">
                      {currentSellerStats.progress.toFixed(2)}%
                    </p>
                    <div className="w-full h-2 bg-gray-100 rounded-full mt-2">
                      <div
                        className={`h-full rounded-full ${getProgressBarColor(currentSellerStats.progress)}`}
                        style={{
                          width: `${Math.min(currentSellerStats.progress, 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 bg-amber-50 rounded-lg">
                        <Eye className="w-4 h-4 text-amber-600" />
                      </div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">
                        Visitas
                      </span>
                    </div>
                    <p className="text-xl font-bold text-gray-800">
                      {visitsCount}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedDay
                        ? "En este dia"
                        : selectedWeek
                          ? `En semana ${selectedWeek}`
                          : "En el periodo"}
                    </p>
                  </div>

                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 bg-cyan-50 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 text-cyan-600" />
                      </div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">
                        # Ventas
                      </span>
                    </div>
                    <p className="text-xl font-bold text-gray-800">
                      {filteredSalesCount}
                    </p>
                  </div>

                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 bg-purple-50 rounded-lg">
                        <ShoppingBag className="w-4 h-4 text-purple-600" />
                      </div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">
                        Promedio/Venta
                      </span>
                    </div>
                    <p className="text-xl font-bold text-gray-800">
                      {formatCurrency(
                        visitsCount > 0 ? totalFilteredSales / visitsCount : 0,
                      )}
                    </p>
                  </div>
                </div>

                {/* Sales Chart */}
                {!selectedDay && (
                  <div className="bg-white rounded-xl p-4 mb-6 border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">
                      {selectedWeek
                        ? `Ventas Semana ${selectedWeek}`
                        : "Ventas por Dia"}
                    </h3>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={dailySalesChartData}
                          margin={{
                            top: 10,
                            right: 10,
                            left: -20,
                            bottom: 0,
                          }}
                        >
                          <defs>
                            <linearGradient
                              id="colorVenta"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#3b82f6"
                                stopOpacity={0.3}
                              />
                              <stop
                                offset="95%"
                                stopColor="#3b82f6"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="date"
                            tick={{
                              fontSize: 9,
                              fill: "#6b7280",
                            }}
                            interval="preserveStartEnd"
                          />
                          <YAxis
                            tick={{
                              fontSize: 10,
                              fill: "#6b7280",
                            }}
                            tickFormatter={(value) =>
                              `$${(value / 1000).toFixed(0)}k`
                            }
                          />
                          <Tooltip
                            formatter={(value: number) => [
                              formatCurrency(value),
                              "Venta",
                            ]}
                            contentStyle={{
                              borderRadius: "8px",
                              border: "none",
                              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="venta"
                            stroke="#3b82f6"
                            fillOpacity={1}
                            fill="url(#colorVenta)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Ventas por Codigo */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">
                      Ventas por Codigo
                    </h3>
                    <div className="space-y-3">
                      {salesByCode.length > 0 ? (
                        salesByCode.map((item) => (
                          <div
                            key={item.code}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{
                                  backgroundColor:
                                    CODE_COLORS[item.code] || "#6b7280",
                                }}
                              />
                              <span className="text-sm text-gray-700">
                                {item.code}
                              </span>
                              <span className="text-xs text-gray-400">
                                ({item.count})
                              </span>
                            </div>
                            <span className="text-sm font-medium text-gray-800">
                              {formatCurrency(item.total)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">
                          No hay ventas en este periodo
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Weekly Breakdown */}
                  {!selectedDay && (
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-700 mb-4">
                        Desglose Semanal
                      </h3>
                      <div className="space-y-3">
                        {currentSellerStats.weeklyBreakdown.map(
                          (weekSales, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                            >
                              <span className="text-sm text-gray-600">
                                Semana {i + 1}
                              </span>
                              <span className="text-sm font-medium text-gray-800">
                                {formatCurrency(weekSales)}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* All Sales Entries */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <List className="w-4 h-4" />
                      Todas las Ventas ({filteredSales.length})
                    </h3>
                    {filteredSales.length > 10 && (
                      <button
                        onClick={() => setShowAllSales(!showAllSales)}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        {showAllSales ? "Ver menos" : "Ver todas"}
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-4 font-medium text-gray-600">
                            Fecha
                          </th>
                          <th className="text-left py-2 px-4 font-medium text-gray-600">
                            Cliente
                          </th>
                          <th className="text-left py-2 px-4 font-medium text-gray-600">
                            Codigo
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-gray-600">
                            Venta
                          </th>
                          <th className="text-left py-2 px-4 font-medium text-gray-600 hidden lg:table-cell">
                            Productos
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(showAllSales
                          ? filteredSales
                          : filteredSales.slice(0, 10)
                        )
                          .sort(
                            (a, b) =>
                              new Date(b.fechaSinHora).getTime() -
                              new Date(a.fechaSinHora).getTime(),
                          )
                          .map((sale, i) => (
                            <tr
                              key={i}
                              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer active:bg-gray-100"
                              onClick={() => setSelectedSale(sale)}
                            >
                              <td className="py-2 px-4 text-gray-600">
                                {new Date(sale.fechaSinHora).toLocaleDateString(
                                  "es-ES",
                                  {
                                    day: "numeric",
                                    month: "short",
                                  },
                                )}
                                {sale.submissionTime && (
                                  <span className="text-xs text-gray-400 ml-1">
                                    {sale.submissionTime
                                      .split(" ")[1]
                                      ?.slice(0, 5)}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-4 font-medium text-gray-800">
                                {sale.clientName}
                              </td>
                              <td className="py-2 px-4">
                                <span
                                  className="text-xs px-2 py-0.5 rounded-full"
                                  style={{
                                    backgroundColor: `${CODE_COLORS[sale.codigo] || "#6b7280"}20`,
                                    color:
                                      CODE_COLORS[sale.codigo] || "#6b7280",
                                  }}
                                >
                                  {sale.codigo || "N/A"}
                                </span>
                              </td>
                              <td className="text-right py-2 px-4 font-medium text-gray-800">
                                {formatCurrency(sale.venta)}
                              </td>
                              <td className="py-2 px-4 text-gray-500 text-xs hidden lg:table-cell">
                                {Object.entries(sale.products)
                                  .slice(0, 3)
                                  .map(([name, qty]) => (
                                    <span key={name} className="mr-2">
                                      {name}: {qty}
                                    </span>
                                  ))}
                                {Object.keys(sale.products).length > 3 && (
                                  <span className="text-gray-400">
                                    +{Object.keys(sale.products).length - 3} mas
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {filteredSales.length === 0 && (
                      <div className="py-8 text-center text-gray-500">
                        No hay ventas para mostrar
                      </div>
                    )}
                  </div>
                </div>

                {/* Detalle de Productos - Seller View */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-6">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4" />
                      Detalle de Productos
                    </h3>
                    <p className="text-xs text-gray-500">
                      Productos vendidos{" "}
                      {selectedDay
                        ? "en este día"
                        : selectedWeek
                          ? `en semana ${selectedWeek}`
                          : "en el periodo"}
                    </p>
                  </div>
                  {productsSold.length > 0 ? (
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-4 font-medium text-gray-600">
                              Producto
                            </th>
                            <th className="text-right py-2 px-4 font-medium text-gray-600">
                              Cantidad
                            </th>
                            <th className="text-right py-2 px-4 font-medium text-gray-600">
                              % del Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {productsSold.map(({ product, quantity }) => {
                            const percentage =
                              totalProductsCount > 0
                                ? (quantity / totalProductsCount) * 100
                                : 0;
                            return (
                              <tr
                                key={product}
                                className="border-b border-gray-100 hover:bg-gray-50"
                              >
                                <td className="py-2 px-4 font-medium text-gray-800">
                                  {product}
                                </td>
                                <td className="text-right py-2 px-4 text-gray-600">
                                  {quantity.toLocaleString()}
                                </td>
                                <td className="text-right py-2 px-4">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-blue-500 rounded-full"
                                        style={{
                                          width: `${Math.min(percentage, 100)}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs text-gray-500 w-12 text-right">
                                      {percentage.toFixed(1)}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50 font-medium">
                            <td className="py-2 px-4 text-gray-800">Total</td>
                            <td className="text-right py-2 px-4 text-gray-800">
                              {totalProductsCount.toLocaleString()}
                            </td>
                            <td className="text-right py-2 px-4 text-gray-500 text-xs">
                              100%
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-gray-500">
                      No hay productos vendidos en este periodo
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* ========== OVERVIEW MODE ========== */
              <>
                {/* Summary Cards */}
                {summaryStats && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <TrendingUp className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="text-xs text-gray-500 uppercase tracking-wide">
                          Ventas Totales
                        </span>
                      </div>
                      <p className="text-xl font-bold text-gray-800">
                        {formatCurrency(summaryStats.totalTeamSales)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        de {formatCurrency(summaryStats.totalTeamGoal)} meta
                      </p>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-green-50 rounded-lg">
                          <Target className="w-4 h-4 text-green-600" />
                        </div>
                        <span className="text-xs text-gray-500 uppercase tracking-wide">
                          Progreso Promedio
                        </span>
                      </div>
                      <p className="text-xl font-bold text-gray-800">
                        {summaryStats.avgProgress.toFixed(2)}%
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {summaryStats.sellersOnTrack} de{" "}
                        {visibleSellerStats.length} en meta
                      </p>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-amber-50 rounded-lg">
                          <Users className="w-4 h-4 text-amber-600" />
                        </div>
                        <span className="text-xs text-gray-500 uppercase tracking-wide">
                          Mejor Vendedor
                        </span>
                      </div>
                      <p className="text-xl font-bold text-gray-800">
                        {summaryStats.bestPerformer?.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatCurrency(
                          summaryStats.bestPerformer?.totalSales || 0,
                        )}
                      </p>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-purple-50 rounded-lg">
                          <CheckCircle2 className="w-4 h-4 text-purple-600" />
                        </div>
                        <span className="text-xs text-gray-500 uppercase tracking-wide">
                          Estado
                        </span>
                      </div>
                      <p className="text-xl font-bold text-gray-800">
                        {currentPeriodData?.isCompleted
                          ? "Completado"
                          : "En Curso"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Periodo {selectedPeriod}
                      </p>
                    </div>
                  </div>
                )}

                {/* Seller Comparison Chart */}
                <div className="bg-white rounded-xl p-4 mb-6 border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">
                    Comparativa de Vendedores
                  </h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={visibleSellerStats}
                        layout="vertical"
                        margin={{
                          left: 80,
                          right: 20,
                          top: 10,
                          bottom: 10,
                        }}
                      >
                        <XAxis
                          type="number"
                          tickFormatter={(value) =>
                            `$${(value / 1000).toFixed(0)}k`
                          }
                          tick={{
                            fontSize: 10,
                            fill: "#6b7280",
                          }}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{
                            fontSize: 11,
                            fill: "#374151",
                          }}
                          width={70}
                        />
                        <Tooltip
                          formatter={(value: number) => [
                            formatCurrency(value),
                            "Ventas",
                          ]}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "none",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          }}
                        />
                        <Bar dataKey="totalSales" radius={[0, 4, 4, 0]}>
                          {visibleSellerStats.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Seller Details Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
                  <div className="px-4 py-3 border-b border-gray-200 flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700">
                        Detalle por Vendedor
                      </h3>
                      <p className="text-xs text-gray-500">
                        Haz clic en un vendedor para ver su detalle completo
                      </p>
                      {isHideModeEnabled && hiddenSellers.size > 0 && (
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs text-gray-400">
                            Ocultos:
                          </span>
                          {sellerStats
                            .filter((s) => hiddenSellers.has(s.email))
                            .map((seller) => (
                              <button
                                key={seller.email}
                                onClick={() =>
                                  toggleSellerVisibility(seller.email)
                                }
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full hover:bg-blue-100 hover:text-blue-600 transition-colors"
                                title="Mostrar vendedor"
                              >
                                <Eye className="w-3 h-3" />
                                {seller.name}
                              </button>
                            ))}
                          <button
                            onClick={() => setHiddenSellers(new Set())}
                            className="text-xs text-blue-600 hover:text-blue-700 ml-1"
                          >
                            Mostrar todos
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setIsHideModeEnabled(!isHideModeEnabled)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isHideModeEnabled
                          ? "bg-blue-100 text-blue-600"
                          : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                      }`}
                      title={
                        isHideModeEnabled
                          ? "Desactivar modo ocultar"
                          : "Activar modo ocultar vendedores"
                      }
                    >
                      {isHideModeEnabled ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-medium text-gray-600">
                            Vendedor
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-gray-600">
                            Ventas
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-gray-600">
                            Meta
                          </th>
                          <th className="text-center py-3 px-4 font-medium text-gray-600">
                            Progreso
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-gray-600">
                            Efectivo
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-gray-600">
                            Meta EFT
                          </th>
                          <th className="text-center py-3 px-4 font-medium text-gray-600">
                            % EFT
                          </th>
                          <th className="text-center py-3 px-4 font-medium text-gray-600">
                            Visitas
                          </th>
                          <th className="text-center py-3 px-4 font-medium text-gray-600">
                            # Ventas
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-gray-600 hidden sm:table-cell">
                            S1
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-gray-600 hidden sm:table-cell">
                            S2
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-gray-600 hidden sm:table-cell">
                            S3
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-gray-600 hidden sm:table-cell">
                            S4
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleSellerStats.map((seller, index) => (
                          <tr
                            key={seller.email}
                            className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleSelectSeller(seller.email)}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{
                                    backgroundColor:
                                      COLORS[index % COLORS.length],
                                  }}
                                />
                                <span className="font-medium text-gray-800">
                                  {seller.name}
                                </span>
                                {isHideModeEnabled && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleSellerVisibility(seller.email);
                                    }}
                                    className="p-0.5 text-gray-400 hover:text-red-500 transition-colors"
                                    title="Ocultar vendedor"
                                  >
                                    <EyeOff className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="text-right py-3 px-4 font-medium text-gray-800">
                              ${(seller.totalSales / 1000).toFixed(1)}k
                            </td>
                            <td className="text-right py-3 px-4 text-gray-600">
                              ${(seller.goal / 1000).toFixed(1)}k
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${getProgressBarColor(seller.progress)}`}
                                    style={{
                                      width: `${Math.min(seller.progress, 100)}%`,
                                    }}
                                  />
                                </div>
                                <span
                                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${getProgressColor(seller.progress)}`}
                                >
                                  {seller.progress.toFixed(2)}%
                                </span>
                              </div>
                            </td>
                            <td className="text-right py-3 px-4 text-gray-600">
                              ${(seller.efectivoSales / 1000).toFixed(1)}k
                            </td>
                            <td className="text-right py-3 px-4 text-gray-600">
                              {EFECTIVO_GOALS[seller.name] ? (
                                `$${(EFECTIVO_GOALS[seller.name] / 1000).toFixed(1)}k`
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                            <td className="text-center py-3 px-4">
                              {EFECTIVO_GOALS[seller.name] ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${getProgressBarColor((seller.efectivoSales / EFECTIVO_GOALS[seller.name]) * 100)}`}
                                      style={{
                                        width: `${Math.min((seller.efectivoSales / EFECTIVO_GOALS[seller.name]) * 100, 100)}%`,
                                      }}
                                    />
                                  </div>
                                  <span
                                    className={`text-xs font-medium ${getProgressColor((seller.efectivoSales / EFECTIVO_GOALS[seller.name]) * 100).split(" ")[0]}`}
                                  >
                                    {(
                                      (seller.efectivoSales /
                                        EFECTIVO_GOALS[seller.name]) *
                                      100
                                    ).toFixed(2)}
                                    %
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                            <td className="text-center py-3 px-4 text-gray-600">
                              {seller.visitsCount}
                            </td>
                            <td className="text-center py-3 px-4 text-gray-600">
                              {seller.salesCount}
                            </td>
                            {seller.weeklyBreakdown.map((weekSales, i) => (
                              <td
                                key={i}
                                className="text-right py-3 px-4 text-gray-600 hidden sm:table-cell"
                              >
                                ${(weekSales / 1000).toFixed(1)}k
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 font-medium">
                          <td className="py-3 px-4 text-gray-800">Total</td>
                          <td className="text-right py-3 px-4 text-gray-800">
                            $
                            {(
                              visibleSellerStats.reduce(
                                (sum, s) => sum + s.totalSales,
                                0,
                              ) / 1000
                            ).toFixed(1)}
                            k
                          </td>
                          <td className="text-right py-3 px-4 text-gray-600">
                            $
                            {(
                              visibleSellerStats.reduce(
                                (sum, s) => sum + s.goal,
                                0,
                              ) / 1000
                            ).toFixed(1)}
                            k
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-full ${getProgressColor(
                                visibleSellerStats.length > 0
                                  ? visibleSellerStats.reduce(
                                      (sum, s) => sum + s.progress,
                                      0,
                                    ) / visibleSellerStats.length
                                  : 0,
                              )}`}
                            >
                              {(visibleSellerStats.length > 0
                                ? visibleSellerStats.reduce(
                                    (sum, s) => sum + s.progress,
                                    0,
                                  ) / visibleSellerStats.length
                                : 0
                              ).toFixed(2)}
                              % prom
                            </span>
                          </td>
                          <td className="text-right py-3 px-4 text-gray-600">
                            $
                            {(
                              visibleSellerStats.reduce(
                                (sum, s) => sum + s.efectivoSales,
                                0,
                              ) / 1000
                            ).toFixed(1)}
                            k
                          </td>
                          <td className="text-right py-3 px-4 text-gray-600">
                            $
                            {(
                              visibleSellerStats.reduce(
                                (sum, s) => sum + (EFECTIVO_GOALS[s.name] || 0),
                                0,
                              ) / 1000
                            ).toFixed(1)}
                            k
                          </td>
                          <td className="text-center py-3 px-4 text-gray-400">
                            -
                          </td>
                          <td className="text-center py-3 px-4 text-gray-600">
                            {visibleSellerStats.reduce(
                              (sum, s) => sum + s.visitsCount,
                              0,
                            )}
                          </td>
                          <td className="text-center py-3 px-4 text-gray-600">
                            {visibleSellerStats.reduce(
                              (sum, s) => sum + s.salesCount,
                              0,
                            )}
                          </td>
                          {[0, 1, 2, 3].map((i) => (
                            <td
                              key={i}
                              className="text-right py-3 px-4 text-gray-600 hidden sm:table-cell"
                            >
                              $
                              {(
                                visibleSellerStats.reduce(
                                  (sum, s) => sum + s.weeklyBreakdown[i],
                                  0,
                                ) / 1000
                              ).toFixed(1)}
                              k
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Detalle de Productos */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4" />
                      Detalle de Productos
                    </h3>
                    <p className="text-xs text-gray-500">
                      Distribucion de productos vendidos en el periodo
                    </p>
                  </div>
                  {productsSold.length > 0 ? (
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-4 font-medium text-gray-600">
                              Producto
                            </th>
                            <th className="text-right py-2 px-4 font-medium text-gray-600">
                              Cantidad
                            </th>
                            <th className="text-right py-2 px-4 font-medium text-gray-600">
                              % del Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {productsSold.map(({ product, quantity }) => {
                            const percentage =
                              totalProductsCount > 0
                                ? (quantity / totalProductsCount) * 100
                                : 0;
                            return (
                              <tr
                                key={product}
                                className="border-b border-gray-100 hover:bg-gray-50"
                              >
                                <td className="py-2 px-4 font-medium text-gray-800">
                                  {product}
                                </td>
                                <td className="text-right py-2 px-4 text-gray-600">
                                  {quantity.toLocaleString()}
                                </td>
                                <td className="text-right py-2 px-4">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-blue-500 rounded-full"
                                        style={{
                                          width: `${Math.min(percentage, 100)}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs text-gray-500 w-12 text-right">
                                      {percentage.toFixed(1)}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50 font-medium">
                            <td className="py-2 px-4 text-gray-800">Total</td>
                            <td className="text-right py-2 px-4 text-gray-800">
                              {totalProductsCount.toLocaleString()}
                            </td>
                            <td className="text-right py-2 px-4 text-gray-500 text-xs">
                              100%
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-gray-500">
                      No hay productos vendidos en este periodo
                    </div>
                  )}
                </div>

                {/* Bottom Section: Distribution & Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">
                      Distribucion de Progreso
                    </h3>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              {
                                name: "En meta (100%+)",
                                value: visibleSellerStats.filter(
                                  (s) => s.progress >= 100,
                                ).length,
                              },
                              {
                                name: "Cerca (75-99%)",
                                value: visibleSellerStats.filter(
                                  (s) => s.progress >= 75 && s.progress < 100,
                                ).length,
                              },
                              {
                                name: "Medio (50-74%)",
                                value: visibleSellerStats.filter(
                                  (s) => s.progress >= 50 && s.progress < 75,
                                ).length,
                              },
                              {
                                name: "Bajo (<50%)",
                                value: visibleSellerStats.filter(
                                  (s) => s.progress < 50,
                                ).length,
                              },
                            ].filter((d) => d.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={2}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                            labelLine={{
                              stroke: "#6b7280",
                              strokeWidth: 1,
                            }}
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
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">
                      Resumen del Periodo
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">Periodo</span>
                        <span className="font-medium text-gray-800">
                          #{selectedPeriod}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">
                          Vendedores activos
                        </span>
                        <span className="font-medium text-gray-800">
                          {
                            visibleSellerStats.filter((s) => s.totalSales > 0)
                              .length
                          }
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">
                          Total visitas
                        </span>
                        <span className="font-medium text-gray-800">
                          {visibleSellerStats.reduce(
                            (sum, s) => sum + s.visitsCount,
                            0,
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">
                          Cumplieron meta
                        </span>
                        <span className="font-medium text-green-600">
                          {
                            visibleSellerStats.filter((s) => s.progress >= 100)
                              .length
                          }
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">
                          Diferencia vs Meta
                        </span>
                        <span
                          className={`font-medium ${(summaryStats?.totalTeamSales || 0) >= (summaryStats?.totalTeamGoal || 0) ? "text-green-600" : "text-red-600"}`}
                        >
                          {(summaryStats?.totalTeamSales || 0) >=
                          (summaryStats?.totalTeamGoal || 0)
                            ? "+"
                            : ""}
                          {formatCurrency(
                            (summaryStats?.totalTeamSales || 0) -
                              (summaryStats?.totalTeamGoal || 0),
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Sale Detail Drawer */}
      <Drawer
        open={!!selectedSale}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSale(null);
            setExpandedPhotoUrl(null);
          }
        }}
      >
        <DrawerContent className="max-h-[85vh] mx-auto max-w-5xl">
          <DrawerHeader className="border-b border-gray-100 pb-4">
            <DrawerTitle className="text-left">
              {selectedSale?.clientName}
            </DrawerTitle>
            <DrawerDescription className="text-left">
              {selectedSale && (
                <div className="flex items-center gap-3 mt-1">
                  <span>
                    {new Date(selectedSale.fechaSinHora).toLocaleDateString(
                      "es-ES",
                      {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      },
                    )}
                  </span>
                  {selectedSale.submissionTime && (
                    <span className="text-gray-400">
                      {selectedSale.submissionTime.split(" ")[1]?.slice(0, 5)}
                    </span>
                  )}
                </div>
              )}
            </DrawerDescription>
          </DrawerHeader>

          {selectedSale && (
            <div className="p-4 overflow-y-auto">
              {/* Sale Summary */}
              <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{
                      backgroundColor: `${CODE_COLORS[selectedSale.codigo] || "#6b7280"}20`,
                      color: CODE_COLORS[selectedSale.codigo] || "#6b7280",
                    }}
                  >
                    {selectedSale.codigo || "N/A"}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase">Total Venta</p>
                  <p className="text-xl font-bold text-gray-800">
                    {formatCurrency(selectedSale.venta)}
                  </p>
                </div>
              </div>

              {/* Products List */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  Productos ({Object.keys(selectedSale.products).length})
                </h4>

                {Object.keys(selectedSale.products).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(selectedSale.products)
                      .sort(([, a], [, b]) => b - a)
                      .map(([productName, quantity]) => (
                        <div
                          key={productName}
                          className="flex items-center justify-between py-2 px-3 bg-white border border-gray-100 rounded-lg"
                        >
                          <span className="text-sm text-gray-800 font-medium">
                            {productName}
                          </span>
                          <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            {quantity}
                          </span>
                        </div>
                      ))}

                    {/* Total Products */}
                    <div className="flex items-center justify-between py-2 px-3 bg-gray-100 rounded-lg mt-3">
                      <span className="text-sm text-gray-600 font-medium">
                        Total Productos
                      </span>
                      <span className="text-sm font-bold text-gray-800">
                        {Object.values(selectedSale.products).reduce(
                          (sum, qty) => sum + qty,
                          0,
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No hay productos registrados
                  </p>
                )}
              </div>

              {selectedSale.photoUrls.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Fotos ({selectedSale.photoUrls.length})
                  </h4>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {selectedSale.photoUrls.map((url, index) => (
                      <button
                        key={`${url}-${index}`}
                        type="button"
                        onClick={() => setExpandedPhotoUrl(url)}
                        className="group relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                        aria-label={`Ver foto ${index + 1}`}
                      >
                        <div className="aspect-[4/3] w-full">
                          <img
                            src={getDisplayableImageUrl(url)}
                            alt={`Foto ${index + 1}`}
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                            loading="lazy"
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Review Section */}
              <div className="mt-6 pt-4 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Revision
                </h4>

                {currentSaleReview ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm font-medium">Revisado</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(
                        currentSaleReview.reviewedAt,
                      ).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {currentSaleReview.note && (
                      <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                        {currentSaleReview.note}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {showNoteInput ? (
                      <div className="space-y-2">
                        <textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Agregar nota (opcional)..."
                          className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setShowNoteInput(false);
                              setNoteText("");
                            }}
                            className="flex-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleMarkReviewed(noteText)}
                            disabled={isSubmittingReview}
                            className="flex-1 px-3 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {isSubmittingReview ? (
                              "Guardando..."
                            ) : (
                              <>
                                <Send className="w-4 h-4" />
                                Guardar
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleMarkReviewed()}
                          disabled={isSubmittingReview}
                          className="flex-1 px-3 py-2.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isSubmittingReview ? (
                            "Guardando..."
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              Marcar revisado
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setShowNoteInput(true)}
                          className="px-3 py-2.5 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                          title="Agregar nota"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      <Dialog
        open={!!expandedPhotoUrl}
        onOpenChange={(open) => !open && setExpandedPhotoUrl(null)}
      >
        <DialogContent className="max-w-4xl p-4">
          <DialogHeader>
            <DialogTitle className="sr-only">Foto de la venta</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center">
            {expandedPhotoUrl && (
              <img
                src={getDisplayableImageUrl(expandedPhotoUrl)}
                alt="Foto ampliada"
                className="max-h-[80vh] w-full object-contain rounded-lg bg-black/5"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
