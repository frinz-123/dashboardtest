"use client";
import {
  BarChart2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Search,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { useSession } from "next-auth/react";
import React, { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  getCurrentPeriodInfo,
  getWeekDates,
  isDateInPeriod,
} from "@/utils/dateUtils";
import { getSellerGoal } from "@/utils/sellerGoals";
import AppHeader from "./AppHeader";
import GoalDetailsDialog from "./goal-details-dialog";
import SaleDetailsPopup from "./SaleDetailsPopup";
import StatisticCard11 from "./statistic-card-11";
import { CountingNumber } from "./ui/counting-number";

const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const spreadsheetId = process.env.NEXT_PUBLIC_SPREADSHEET_ID;
const sheetName = process.env.NEXT_PUBLIC_SHEET_NAME;

type TimePeriod = "Diario" | "Ayer" | "Semanal" | "Mensual";
type Sale = {
  clientName: string;
  venta: number;
  codigo: string;
  fechaSinHora: string;
  email: string;
  products: Record<string, number>; // Add this line
  submissionTime?: string;
};

type Role = "vendedor" | "Bodeguero" | "Supervisor";

type DateRange = {
  startDate: Date;
  endDate: Date;
};

const PERIODS: TimePeriod[] = ["Diario", "Ayer", "Semanal", "Mensual"];
const LIVE_REFRESH_INTERVAL_MS = 15000;
const FULL_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const parseSheetSales = (
  values: string[][],
  options: { includeProducts: boolean },
): Sale[] => {
  if (!Array.isArray(values) || values.length <= 1) {
    return [];
  }

  const headers = values[0] ?? [];
  const rows = values.slice(1);

  return rows.map((row) => {
    const products: Record<string, number> = {};

    if (options.includeProducts) {
      for (let i = 8; i <= 29; i++) {
        if (row[i] && row[i] !== "0") {
          products[headers[i]] = Number.parseInt(row[i], 10);
        }
      }

      for (let i = 34; i <= 36; i++) {
        if (row[i] && row[i] !== "0") {
          products[headers[i]] = Number.parseInt(row[i], 10);
        }
      }
    }

    const parsedVenta = Number.parseFloat(row[33] ?? "0");

    return {
      clientName: row[0] || "Unknown",
      venta: Number.isFinite(parsedVenta) ? parsedVenta : 0,
      codigo: row[31] || "",
      fechaSinHora: row[32] || "",
      email: row[7] || "",
      products,
      submissionTime: row[4] && row[4].trim() !== "" ? row[4] : undefined,
    };
  });
};

const getSaleTimestamp = (sale: Sale): number => {
  const date = new Date(sale.fechaSinHora);
  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  if (sale.submissionTime) {
    const [hours, minutes, seconds = "0"] = sale.submissionTime.split(":");
    const h = Number.parseInt(hours ?? "", 10);
    const m = Number.parseInt(minutes ?? "", 10);
    const s = Number.parseInt(seconds ?? "", 10);

    if (
      Number.isFinite(h) &&
      Number.isFinite(m) &&
      Number.isFinite(s) &&
      h >= 0 &&
      h <= 23 &&
      m >= 0 &&
      m <= 59 &&
      s >= 0 &&
      s <= 59
    ) {
      date.setHours(h, m, s, 0);
    }
  }

  return date.getTime();
};

const getTimeDifference = (period: TimePeriod) => {
  switch (period) {
    case "Diario":
      return 24 * 60 * 60 * 1000; // 1 day in milliseconds
    case "Ayer":
      return 24 * 60 * 60 * 1000; // 1 day in milliseconds
    case "Semanal":
      return 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    case "Mensual":
      return 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds (approximate)
  }

  return 0;
};

const getPeriodRange = (period: TimePeriod, referenceDate: Date): DateRange => {
  const currentDate = new Date(referenceDate);
  let startDate: Date;
  let endDate: Date;

  if (period === "Diario") {
    startDate = new Date(currentDate.setHours(0, 0, 0, 0));
    endDate = new Date(currentDate.setHours(23, 59, 59, 999));
  } else if (period === "Ayer") {
    const yesterday = new Date(currentDate);
    yesterday.setDate(yesterday.getDate() - 1);
    startDate = new Date(yesterday.setHours(0, 0, 0, 0));
    endDate = new Date(yesterday.setHours(23, 59, 59, 999));
  } else if (period === "Semanal") {
    const { weekStart, weekEnd } = getWeekDates(currentDate);
    startDate = weekStart;
    endDate = weekEnd;
  } else {
    const { periodStartDate, periodEndDate } =
      getCurrentPeriodInfo(currentDate);
    startDate = periodStartDate;
    endDate = periodEndDate;
  }

  return { startDate, endDate };
};

const getPreviousPeriodRange = (
  period: TimePeriod,
  referenceDate: Date,
): DateRange => {
  const reference = new Date(referenceDate);
  let startDate: Date;
  let endDate: Date;

  if (period === "Diario") {
    startDate = new Date(reference.setDate(reference.getDate() - 1));
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);
  } else if (period === "Ayer") {
    startDate = new Date(reference.setDate(reference.getDate() - 2));
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);
  } else {
    startDate = new Date(reference.getTime() - getTimeDifference(period) * 2);
    endDate = new Date(reference.getTime() - getTimeDifference(period));
  }

  return { startDate, endDate };
};

const isSaleInRange = (sale: Sale, range: DateRange) => {
  const saleDate = new Date(sale.fechaSinHora);
  return isDateInPeriod(saleDate, range.startDate, range.endDate);
};

const emailLabels: Record<string, { label: string; role: Role }> = {
  "ventas1productoselrey@gmail.com": { label: "Christian", role: "vendedor" },
  "ventas2productoselrey@gmail.com": { label: "Roel", role: "Supervisor" },
  "jesus.chiltepinelrey@gmail.com": { label: "Jesus", role: "Supervisor" },
  "ventas3productoselrey@gmail.com": { label: "Lidia", role: "vendedor" },
  "ventasmztproductoselrey.com@gmail.com": {
    label: "Mazatlan",
    role: "vendedor",
  },
  "ventasmochisproductoselrey@gmail.com": { label: "Mochis", role: "vendedor" },
  "franzcharbell@gmail.com": { label: "Franz", role: "Supervisor" },
  "cesar.reyes.ochoa@gmail.com": { label: "Cesar", role: "Supervisor" },
  "arturo.elreychiltepin@gmail.com": { label: "Arturo Mty", role: "vendedor" },
  "alopezelrey@gmail.com": { label: "Arlyn", role: "Supervisor" },
  "promotoriaelrey@gmail.com": { label: "Karla", role: "vendedor" },
  "ventas4productoselrey@gmail.com": { label: "Reyna", role: "vendedor" },
  "bodegaelrey034@gmail.com": { label: "Bodega", role: "Bodeguero" },
};

export default function Dashboard() {
  const { data: session } = useSession();
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("Diario");
  const [selectedEmail, setSelectedEmail] = useState<string>("");
  const [salesData, setSalesData] = useState<Sale[]>([]);
  const [liveSalesData, setLiveSalesData] = useState<Sale[]>([]);
  const [isLiveRefreshing, setIsLiveRefreshing] = useState(false);
  const [showAllSales, setShowAllSales] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isGoalDetailsOpen, setIsGoalDetailsOpen] = useState(false);
  const clientHistoryRef = React.useRef<HTMLDivElement | null>(null);
  const isFullRefreshInFlightRef = React.useRef(false);
  const isLiveRefreshInFlightRef = React.useRef(false);

  const _todayKey = new Date().toDateString();
  const periodReferenceDate = React.useMemo(() => new Date(), []);
  const periodInfo = React.useMemo(
    () => getCurrentPeriodInfo(periodReferenceDate),
    [periodReferenceDate],
  );
  const selectedPeriodRange = React.useMemo(
    () => getPeriodRange(selectedPeriod, periodReferenceDate),
    [selectedPeriod, periodReferenceDate],
  );
  const previousPeriodRange = React.useMemo(
    () => getPreviousPeriodRange(selectedPeriod, periodReferenceDate),
    [selectedPeriod, periodReferenceDate],
  );

  const emailSourceData = React.useMemo(
    () => (liveSalesData.length > 0 ? liveSalesData : salesData),
    [liveSalesData, salesData],
  );

  const emails = React.useMemo(() => {
    const uniqueEmails = new Set<string>();
    for (const sale of emailSourceData) {
      if (sale.email) {
        uniqueEmails.add(sale.email);
      }
    }
    return Array.from(uniqueEmails);
  }, [emailSourceData]);

  const emailsSet = React.useMemo(() => new Set(emails), [emails]);

  const clientNames = React.useMemo(() => {
    const uniqueClients = new Set<string>();
    for (const sale of salesData) {
      if (sale.clientName) {
        uniqueClients.add(sale.clientName);
      }
    }
    return Array.from(uniqueClients);
  }, [salesData]);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const filteredClientNames = React.useMemo(() => {
    if (!normalizedSearchTerm) {
      return [];
    }
    return clientNames.filter((name) =>
      name?.toLowerCase().includes(normalizedSearchTerm),
    );
  }, [clientNames, normalizedSearchTerm]);

  const clientSales = React.useMemo(() => {
    if (!selectedClient) {
      return [];
    }
    return salesData.filter((sale) => sale.clientName === selectedClient);
  }, [salesData, selectedClient]);

  const currencyFormatter = React.useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [],
  );

  const formatCurrency = React.useCallback(
    (value: number) => `$${currencyFormatter.format(value)}`,
    [currencyFormatter],
  );

  const fetchSalesFromSheets = React.useCallback(
    async ({
      range,
      includeProducts,
      forceFresh,
      mode,
    }: {
      range: string;
      includeProducts: boolean;
      forceFresh: boolean;
      mode: "full" | "live";
    }): Promise<Sale[]> => {
      if (!googleApiKey || !spreadsheetId || !sheetName) {
        console.error(
          "[Dashboard] Missing Google Sheets config, skipping dashboard refresh",
          {
            hasApiKey: !!googleApiKey,
            hasSpreadsheetId: !!spreadsheetId,
            hasSheetName: !!sheetName,
            mode,
          },
        );
        return [];
      }

      const url = new URL(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
      );
      url.searchParams.set("key", googleApiKey);
      if (forceFresh) {
        url.searchParams.set("_ts", Date.now().toString());
      }

      const startedAt = Date.now();
      console.log("[Dashboard] Fetching sales", { mode, forceFresh, range });

      const response = await fetch(url.toString(), {
        cache: forceFresh ? "no-store" : "default",
      });

      if (!response.ok) {
        throw new Error(`Sheets request failed (${response.status})`);
      }

      const data = (await response.json()) as {
        values?: string[][];
      };
      const values = Array.isArray(data.values) ? data.values : [];
      const sales = parseSheetSales(values, { includeProducts });

      console.log("[Dashboard] Sales refresh complete", {
        mode,
        rows: sales.length,
        elapsedMs: Date.now() - startedAt,
      });

      return sales;
    },
    [],
  );

  const refreshFullSales = React.useCallback(
    async (reason: string) => {
      if (isFullRefreshInFlightRef.current) {
        return;
      }
      isFullRefreshInFlightRef.current = true;

      try {
        const fullSales = await fetchSalesFromSheets({
          range: `${sheetName}!A:AK`,
          includeProducts: true,
          forceFresh: false,
          mode: "full",
        });

        setSalesData(fullSales);
      } catch (error) {
        console.error("[Dashboard] Full refresh failed", {
          reason,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        isFullRefreshInFlightRef.current = false;
      }
    },
    [fetchSalesFromSheets],
  );

  const refreshLiveSales = React.useCallback(
    async (reason: string) => {
      if (isLiveRefreshInFlightRef.current) {
        return;
      }
      isLiveRefreshInFlightRef.current = true;
      setIsLiveRefreshing(true);

      try {
        const liveSales = await fetchSalesFromSheets({
          range: `${sheetName}!A:AH`,
          includeProducts: false,
          forceFresh: true,
          mode: "live",
        });

        setLiveSalesData(liveSales);
      } catch (error) {
        console.error("[Dashboard] Live refresh failed", {
          reason,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setIsLiveRefreshing(false);
        isLiveRefreshInFlightRef.current = false;
      }
    },
    [fetchSalesFromSheets],
  );

  useEffect(() => {
    void refreshFullSales("initial");
  }, [refreshFullSales]);

  useEffect(() => {
    void refreshLiveSales("initial");

    const refreshInterval = window.setInterval(() => {
      void refreshLiveSales("interval");
    }, LIVE_REFRESH_INTERVAL_MS);

    const handleFocus = () => {
      void refreshLiveSales("focus");
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshLiveSales("visible");
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshLiveSales]);

  useEffect(() => {
    const fullRefreshInterval = window.setInterval(() => {
      void refreshFullSales("interval");
    }, FULL_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(fullRefreshInterval);
    };
  }, [refreshFullSales]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const handleServiceWorkerMessage = (
      event: MessageEvent<{ type?: string }>,
    ) => {
      if (event.data?.type === "SUBMISSION_SUCCESS") {
        void refreshLiveSales("submission-success");
      }
    };

    navigator.serviceWorker.addEventListener(
      "message",
      handleServiceWorkerMessage,
    );

    return () => {
      navigator.serviceWorker.removeEventListener(
        "message",
        handleServiceWorkerMessage,
      );
    };
  }, [refreshLiveSales]);

  useEffect(() => {
    if (emails.length === 0) {
      return;
    }
    setSelectedEmail((prevSelectedEmail) => {
      if (prevSelectedEmail && emailsSet.has(prevSelectedEmail)) {
        return prevSelectedEmail;
      }
      const sessionEmail = session?.user?.email;
      if (sessionEmail && emailsSet.has(sessionEmail)) {
        return sessionEmail;
      }
      return emails[0];
    });
  }, [emails, emailsSet, session]);

  useEffect(() => {
    if (!normalizedSearchTerm || filteredClientNames.length === 0) {
      return;
    }
    setSelectedClient((prevSelectedClient) =>
      prevSelectedClient === filteredClientNames[0]
        ? prevSelectedClient
        : filteredClientNames[0],
    );
  }, [filteredClientNames, normalizedSearchTerm]);

  const filteredSales = React.useMemo(() => {
    if (!selectedEmail) {
      return [];
    }
    return salesData.filter((sale) => {
      if (sale.email !== selectedEmail) {
        return false;
      }
      return isSaleInRange(sale, selectedPeriodRange);
    });
  }, [salesData, selectedEmail, selectedPeriodRange]);

  const filteredLiveSales = React.useMemo(() => {
    if (!selectedEmail) {
      return [];
    }
    return liveSalesData.filter((sale) => {
      if (sale.email !== selectedEmail) {
        return false;
      }
      return isSaleInRange(sale, selectedPeriodRange);
    });
  }, [liveSalesData, selectedEmail, selectedPeriodRange]);

  const realtimeSales = React.useMemo(
    () => (filteredLiveSales.length > 0 ? filteredLiveSales : filteredSales),
    [filteredLiveSales, filteredSales],
  );

  const totalSales = React.useMemo(
    () => realtimeSales.reduce((sum, sale) => sum + sale.venta, 0),
    [realtimeSales],
  );

  const salesDataForComparison = React.useMemo(
    () => (liveSalesData.length > 0 ? liveSalesData : salesData),
    [liveSalesData, salesData],
  );

  const previousPeriodTotal = React.useMemo(() => {
    if (!selectedEmail) {
      return 0;
    }
    const { startDate, endDate } = previousPeriodRange;
    let total = 0;
    for (const sale of salesDataForComparison) {
      if (sale.email !== selectedEmail) {
        continue;
      }
      const saleDate = new Date(sale.fechaSinHora);
      if (saleDate >= startDate && saleDate <= endDate) {
        total += sale.venta;
      }
    }
    return total;
  }, [previousPeriodRange, salesDataForComparison, selectedEmail]);

  const recentSales = React.useMemo(() => {
    if (realtimeSales.length === 0) {
      return [];
    }

    return [...realtimeSales].sort(
      (a, b) => getSaleTimestamp(b) - getSaleTimestamp(a),
    );
  }, [realtimeSales]);

  const percentageDifference =
    previousPeriodTotal !== 0
      ? ((totalSales - previousPeriodTotal) / previousPeriodTotal) * 100
      : 0;

  const chartData = React.useMemo(() => {
    if (filteredSales.length === 0) {
      return [];
    }

    if (selectedPeriod === "Diario" || selectedPeriod === "Ayer") {
      const sortedSales = [...filteredSales].sort(
        (a, b) =>
          new Date(a.fechaSinHora).getTime() -
          new Date(b.fechaSinHora).getTime(),
      );
      return sortedSales.map((sale, index) => ({
        x: `${index + 1}`,
        venta: sale.venta,
      }));
    }

    if (selectedPeriod === "Semanal") {
      const groupedData: Record<string, number> = {};
      for (const sale of filteredSales) {
        const date = new Date(sale.fechaSinHora);
        const key = date.toLocaleDateString("es-ES", {
          month: "short",
          day: "numeric",
        });
        groupedData[key] = (groupedData[key] || 0) + sale.venta;
      }

      return Object.entries(groupedData)
        .sort(
          ([dateA], [dateB]) =>
            new Date(dateA).getTime() - new Date(dateB).getTime(),
        )
        .map(([date, venta]) => ({ x: date, venta }));
    }

    const { periodStartDate } = periodInfo;
    const groupedData: Record<string, number> = {};
    for (const sale of filteredSales) {
      const saleDate = new Date(sale.fechaSinHora);
      const weekNumber =
        Math.floor(
          (saleDate.getTime() - periodStartDate.getTime()) /
            (7 * 24 * 60 * 60 * 1000),
        ) + 1;
      const key = `S${weekNumber}`;
      groupedData[key] = (groupedData[key] || 0) + sale.venta;
    }

    return Object.entries(groupedData)
      .sort(([weekA], [weekB]) => weekA.localeCompare(weekB))
      .map(([week, venta]) => ({ x: week, venta }));
  }, [filteredSales, periodInfo, selectedPeriod]);

  const salesByType = React.useMemo(() => {
    const totals: Record<string, number> = {};
    for (const sale of filteredSales) {
      totals[sale.codigo] = (totals[sale.codigo] || 0) + sale.venta;
    }
    return totals;
  }, [filteredSales]);

  const productsSold = React.useMemo(() => {
    const totals: Record<string, number> = {};
    for (const sale of filteredSales) {
      if (!sale.products) {
        continue;
      }
      for (const [product, quantity] of Object.entries(sale.products)) {
        totals[product] = (totals[product] || 0) + quantity;
      }
    }
    return totals;
  }, [filteredSales]);

  const visitsCount = filteredSales.length;
  const maxVisits =
    selectedPeriod === "Diario" ? 30 : selectedPeriod === "Semanal" ? 180 : 720;
  const visitPercentage = (visitsCount / maxVisits) * 100;

  const visitStatus = React.useMemo(() => {
    if (visitPercentage >= 66) {
      return { color: "bg-green-400", text: "Es considerado un numero alto" };
    }
    if (visitPercentage >= 33) {
      return { color: "bg-yellow-400", text: "Es considerado un numero medio" };
    }
    return { color: "bg-red-400", text: "Es considerado un numero bajo" };
  }, [visitPercentage]);

  const currentPeriodNumber = periodInfo.periodNumber;
  const currentPeriodFilteredSales = React.useMemo(() => {
    if (!selectedEmail) {
      return [];
    }
    const { periodStartDate, periodEndDate } = periodInfo;
    return salesData.filter(
      (sale) =>
        sale.email === selectedEmail &&
        isDateInPeriod(
          new Date(sale.fechaSinHora),
          periodStartDate,
          periodEndDate,
        ),
    );
  }, [periodInfo, salesData, selectedEmail]);

  const currentPeriodSales = React.useMemo(
    () => currentPeriodFilteredSales.reduce((sum, sale) => sum + sale.venta, 0),
    [currentPeriodFilteredSales],
  );

  const currentGoal = React.useMemo(() => {
    if (!selectedEmail) {
      return 0;
    }
    return getSellerGoal(selectedEmail, currentPeriodNumber as 11 | 12 | 13);
  }, [currentPeriodNumber, selectedEmail]);

  const periodSalesByEmail = React.useMemo(() => {
    const totals = new Map<string, number>();
    const { startDate, endDate } = selectedPeriodRange;
    for (const sale of salesData) {
      const saleDate = new Date(sale.fechaSinHora);
      if (!isDateInPeriod(saleDate, startDate, endDate)) {
        continue;
      }
      totals.set(sale.email, (totals.get(sale.email) || 0) + sale.venta);
    }
    return totals;
  }, [salesData, selectedPeriodRange]);

  const topPerformers = React.useMemo(() => {
    const ranked: Array<{
      email: string;
      label: string;
      total: number;
      goal: number;
      goalProgress: number;
    }> = [];

    for (const email of emails) {
      const total = periodSalesByEmail.get(email) || 0;
      if (total <= 0) {
        continue;
      }
      const goal = getSellerGoal(
        email,
        currentPeriodNumber as
          | 11
          | 12
          | 13
          | 14
          | 15
          | 16
          | 17
          | 18
          | 19
          | 20
          | 21
          | 22
          | 23
          | 24
          | 25,
      );
      const goalProgress = goal > 0 ? (total / goal) * 100 : 0;
      ranked.push({
        email,
        label: emailLabels[email]?.label || email,
        total,
        goal,
        goalProgress,
      });
    }

    ranked.sort((a, b) => b.total - a.total);
    return ranked.slice(0, 3);
  }, [currentPeriodNumber, emails, periodSalesByEmail]);

  const hasLeaderboard = topPerformers.length > 0;

  const goalPacing = React.useMemo(() => {
    if (!currentGoal || selectedPeriod !== "Mensual") {
      return null;
    }

    const { periodStartDate, periodEndDate, dayInWeek, weekInPeriod } =
      periodInfo;
    const today = new Date();
    const totalDays =
      Math.ceil(
        (periodEndDate.getTime() - periodStartDate.getTime()) /
          (1000 * 60 * 60 * 24),
      ) + 1;
    const elapsedDays = Math.min(
      totalDays,
      Math.max(
        1,
        Math.ceil(
          (today.getTime() - periodStartDate.getTime()) / (1000 * 60 * 60 * 24),
        ) + 1,
      ),
    );

    const achievedDaily = currentPeriodSales / elapsedDays;
    const targetDaily = currentGoal / totalDays;
    const projectedTotal = achievedDaily * totalDays;
    const paceDifference = achievedDaily - targetDaily;

    return {
      totalDays,
      elapsedDays,
      dayInWeek,
      weekInPeriod,
      achievedDaily,
      targetDaily,
      projectedTotal,
      paceDifference,
    };
  }, [currentGoal, currentPeriodSales, periodInfo, selectedPeriod]);

  const goalMilestones = React.useMemo(() => {
    if (!currentGoal || selectedPeriod !== "Mensual") {
      return [];
    }

    const thresholds = [25, 50, 75, 100];
    return thresholds.map((threshold) => {
      const required = (threshold / 100) * currentGoal;
      const achieved = currentPeriodSales >= required;
      const remaining = Math.max(0, required - currentPeriodSales);
      return {
        threshold,
        required,
        achieved,
        remaining,
      };
    });
  }, [currentGoal, currentPeriodSales, selectedPeriod]);

  const clientInsights = React.useMemo(() => {
    const now = new Date();
    const ATTENTION_THRESHOLD_DAYS = 14;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    if (!selectedEmail) {
      return {
        attentionClients: [],
        topGrowth: [],
        topDecline: [],
        attentionThreshold: ATTENTION_THRESHOLD_DAYS,
      };
    }

    const salesByClient: Record<string, Sale[]> = {};
    for (const sale of salesData) {
      if (sale.email !== selectedEmail) {
        continue;
      }
      const clientName = sale.clientName || "";
      if (clientName.toUpperCase().includes("ARCHIVADO NO USAR")) {
        continue;
      }
      if (!salesByClient[clientName]) {
        salesByClient[clientName] = [];
      }
      salesByClient[clientName].push(sale);
    }

    const { startDate, endDate } = selectedPeriodRange;
    const previousPeriodStartDate = new Date(periodInfo.periodStartDate);
    previousPeriodStartDate.setDate(previousPeriodStartDate.getDate() - 28);
    const previousPeriodEndDate = new Date(periodInfo.periodStartDate);
    previousPeriodEndDate.setDate(previousPeriodEndDate.getDate() - 1);

    const clients = Object.entries(salesByClient).map(([client, sales]) => {
      const sortedSales = [...sales].sort(
        (a, b) =>
          new Date(b.fechaSinHora).getTime() -
          new Date(a.fechaSinHora).getTime(),
      );
      const mostRecent = sortedSales[0];
      const lastPositive = sortedSales.find((sale) => sale.venta > 0) || null;
      const previousPositive =
        sortedSales.find((sale) => {
          if (!lastPositive) return false;
          return (
            new Date(sale.fechaSinHora).getTime() <
              new Date(lastPositive.fechaSinHora).getTime() && sale.venta > 0
          );
        }) || null;

      let totalThisPeriod = 0;
      let totalPreviousPeriod = 0;
      for (const sale of sales) {
        const saleDate = new Date(sale.fechaSinHora);
        if (saleDate >= startDate && saleDate <= endDate) {
          totalThisPeriod += sale.venta;
        }
        if (
          saleDate >= previousPeriodStartDate &&
          saleDate <= previousPeriodEndDate
        ) {
          totalPreviousPeriod += sale.venta;
        }
      }

      const mostRecentDate = mostRecent
        ? new Date(mostRecent.fechaSinHora)
        : null;
      const daysSinceLastPurchase = mostRecentDate
        ? Math.floor(
            (now.getTime() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24),
          )
        : Infinity;
      const hasRecentVisit = !!mostRecentDate && mostRecentDate >= sixMonthsAgo;
      const deltaFromPreviousSale =
        lastPositive && previousPositive
          ? lastPositive.venta - previousPositive.venta
          : null;

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
        deltaFromPreviousSale,
      };
    });

    const attentionClients = clients
      .filter(
        (c) =>
          c.hasRecentVisit &&
          c.daysSinceLastPurchase >= ATTENTION_THRESHOLD_DAYS,
      )
      .sort((a, b) => b.daysSinceLastPurchase - a.daysSinceLastPurchase)
      .slice(0, 3);

    const clientsWithDelta = clients.filter(
      (c) => c.deltaFromPreviousSale !== null,
    );

    const topGrowth = clientsWithDelta
      .filter((c) => (c.deltaFromPreviousSale as number) > 0)
      .sort(
        (a, b) =>
          (b.deltaFromPreviousSale as number) -
          (a.deltaFromPreviousSale as number),
      )
      .slice(0, 3);

    const topDecline = clientsWithDelta
      .filter((c) => (c.deltaFromPreviousSale as number) < 0)
      .sort(
        (a, b) =>
          (a.deltaFromPreviousSale as number) -
          (b.deltaFromPreviousSale as number),
      )
      .slice(0, 3);

    return {
      attentionClients,
      topGrowth,
      topDecline,
      attentionThreshold: ATTENTION_THRESHOLD_DAYS,
    };
  }, [periodInfo, salesData, selectedEmail, selectedPeriodRange]);

  const selectableEmails = React.useMemo(() => {
    if (!session?.user?.email) return emails;

    const currentUserEmail = session.user.email;
    const currentUserRole = emailLabels[currentUserEmail]?.role || "vendedor";

    if (currentUserRole === "vendedor") {
      return emails.filter((email) => email === currentUserEmail);
    }

    return emails;
  }, [emails, session]);

  return (
    <div
      className="min-h-screen bg-white font-sans w-full"
      style={{ fontFamily: "Inter, sans-serif", fontSize: "0.82rem" }}
    >
      <AppHeader title="Dashboard" icon={BarChart2}>
        <div className="relative">
          <select
            className="appearance-none text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl pl-3 pr-8 py-2.5 text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-blue-400 transition cursor-pointer"
            value={selectedEmail}
            onChange={(e) => setSelectedEmail(e.target.value)}
          >
            {selectableEmails.map((email) => (
              <option key={email} value={email}>
                {emailLabels[email]?.label || email}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        </div>
      </AppHeader>

      <main className="px-4 py-4 max-w-2xl mx-auto">
        <div className="bg-white rounded-lg mb-3 p-0.5 border border-[#E2E4E9]/70">
          <div className="inline-flex rounded-md w-full relative">
            {PERIODS.map((period) => (
              <button
                key={period}
                type="button"
                className={`relative flex-1 px-3 py-1.5 text-base font-medium rounded-md transition-colors duration-200 ${
                  selectedPeriod === period
                    ? "text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setSelectedPeriod(period)}
              >
                {selectedPeriod === period && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-gray-100 rounded-md"
                    transition={{ type: "spring", duration: 0.2, bounce: 0.15 }}
                  />
                )}
                <span className="relative z-10">{period}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white mb-3 overflow-hidden -mx-4">
          <div className="px-9 pt-5 pb-0">
            <h2 className="text-gray-500 text-sm font-medium mb-0.5">
              Vendido
            </h2>
            <div className="flex items-center">
              <CountingNumber
                from={0}
                to={totalSales}
                duration={1.5}
                className="text-4xl font-bold mr-2"
                format={(value) => `$${value.toFixed(2)}`}
                startOnView={false}
              />
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${percentageDifference >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
              >
                {percentageDifference >= 0 ? "+" : ""}
                {percentageDifference.toFixed(2)}%
              </span>
            </div>
            {selectedPeriod === "Mensual" && (
              <p className="text-xs text-gray-500 mt-1">
                Periodo {periodInfo.periodNumber}, Semana{" "}
                {periodInfo.weekInPeriod}
              </p>
            )}
            {isLiveRefreshing ? (
              <p className="text-[10px] text-gray-400 mt-1">
                Actualizando datos en vivo...
              </p>
            ) : null}
          </div>
          <div className="mt-3 h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorVenta" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  formatter={(value: number) => [
                    `$${value.toFixed(2)}`,
                    "Venta",
                  ]}
                  labelFormatter={(label) => label}
                  contentStyle={{
                    fontSize: "10px",
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

        {goalPacing && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
            <div className="bg-white rounded-xl p-4 border border-[#E2E4E9]/70">
              <h3 className="text-xs font-semibold text-gray-700 mb-1">
                Ritmo del Periodo
              </h3>
              <p className="text-xxs uppercase tracking-wide text-gray-500 mb-3">
                Seguimiento de meta mensual
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">
                    Ventas diarias
                  </p>
                  <p className="text-sm font-semibold text-blue-600">
                    {formatCurrency(goalPacing.achievedDaily || 0)}/día
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">
                    Ritmo objetivo
                  </p>
                  <p className="text-sm font-semibold text-gray-700">
                    {formatCurrency(goalPacing.targetDaily || 0)}/día
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">
                    Días transcurridos
                  </p>
                  <p className="text-sm font-semibold text-gray-700">
                    {goalPacing.elapsedDays} / {goalPacing.totalDays}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">
                    Proyección
                  </p>
                  <p
                    className={`text-sm font-semibold ${goalPacing.projectedTotal >= currentGoal ? "text-green-600" : "text-amber-600"}`}
                  >
                    {formatCurrency(goalPacing.projectedTotal || 0)}
                  </p>
                </div>
              </div>
              <div
                className={`mt-3 border rounded-lg px-3 py-2 text-xs ${goalPacing.paceDifference >= 0 ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}
              >
                {goalPacing.paceDifference >= 0
                  ? `Vas arriba del ritmo por ${formatCurrency(goalPacing.paceDifference)} por día.`
                  : `Debes incrementar ${formatCurrency(Math.abs(goalPacing.paceDifference))} por día para recuperar el objetivo.`}
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-[#E2E4E9]/70">
              <h3 className="text-xs font-semibold text-gray-700 mb-1">
                Hitos de la Meta
              </h3>
              <p className="text-xxs uppercase tracking-wide text-gray-500 mb-3">
                Avance hacia {formatCurrency(currentGoal)}
              </p>
              <div className="space-y-2">
                {goalMilestones.map((milestone) => (
                  <div
                    key={milestone.threshold}
                    className={`flex items-center justify-between border rounded-lg px-3 py-2 text-xs ${milestone.achieved ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-white text-gray-600"}`}
                  >
                    <div>
                      <p className="text-[10px] uppercase tracking-wide">
                        {milestone.threshold}% alcanzado
                      </p>
                      <p className="text-sm font-semibold">
                        {formatCurrency(milestone.required)}
                      </p>
                    </div>
                    {!milestone.achieved && (
                      <span className="text-xxs text-gray-500">
                        Faltan {formatCurrency(milestone.remaining)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-[#E2E4E9]/70">
              <h3 className="text-xs font-semibold text-gray-700 mb-1">
                Semana actual
              </h3>
              <p className="text-xxs uppercase tracking-wide text-gray-500 mb-3">
                Contexto del periodo
              </p>
              <ul className="text-xs text-gray-600 space-y-2">
                <li className="flex justify-between">
                  <span>Semana en el periodo</span>
                  <span className="font-semibold">
                    {goalPacing.weekInPeriod} / 4
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Día de la semana</span>
                  <span className="font-semibold">{goalPacing.dayInWeek}</span>
                </li>
                <li className="flex justify-between">
                  <span>Meta restante</span>
                  <span className="font-semibold">
                    {formatCurrency(
                      Math.max(0, currentGoal - currentPeriodSales),
                    )}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Ventas por lograr/día</span>
                  <span className="font-semibold">
                    {formatCurrency(
                      currentGoal > currentPeriodSales
                        ? (currentGoal - currentPeriodSales) /
                            Math.max(
                              1,
                              goalPacing.totalDays - goalPacing.elapsedDays,
                            )
                        : 0,
                    )}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
          <StatisticCard11
            title="Avance de meta"
            currentValue={currentPeriodSales}
            goalValue={currentGoal}
            periodLabel={selectedPeriod.toLowerCase()}
            renewsOn={periodInfo.periodEndDate.toLocaleDateString("es-ES", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            formatCurrency={formatCurrency}
            onViewDetails={() => setIsGoalDetailsOpen(true)}
          />

          <div className="bg-white rounded-xl p-3 border border-[#E2E4E9]/70">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-gray-700">
                Actividad del Equipo
              </h2>
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
                        ? "from-yellow-50 to-amber-100 border-amber-200"
                        : index === 1
                          ? "from-slate-50 to-slate-100 border-slate-200"
                          : "from-orange-50 to-orange-100 border-orange-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                          index === 0
                            ? "bg-amber-400 text-white"
                            : index === 1
                              ? "bg-gray-400 text-white"
                              : "bg-orange-400 text-white"
                        }`}
                      >
                        #{index + 1}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-gray-700">
                          {performer.label}
                        </p>
                        <p className="text-xxs text-gray-500">
                          {selectedPeriod} •{" "}
                          {periodInfo.periodNumber
                            ? `Periodo ${periodInfo.periodNumber}`
                            : "Tiempo actual"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-gray-700">
                      {performer.goal > 0
                        ? `${performer.goalProgress.toFixed(1)}%`
                        : formatCurrency(performer.total)}
                    </span>
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

        <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
          <h2 className="text-gray-700 font-medium mb-2 flex items-center text-sm">
            <Users className="mr-1.5 h-4 w-4" /> Visitas
          </h2>
          <p className="text-sm">
            Tus Visitas son <strong>{visitsCount}</strong>
          </p>
          <p className="text-xs text-gray-500 mb-1.5">{visitStatus.text}</p>
          <div className="w-full bg-gray-200 h-1.5 rounded-full">
            <div
              className={`${visitStatus.color} h-1.5 rounded-full`}
              style={{ width: `${visitPercentage}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
          <h2 className="text-gray-700 font-medium mb-2 flex items-center text-sm">
            <BarChart2 className="mr-1.5 h-4 w-4" /> Ventas por Código
          </h2>
          {Object.keys(salesByType).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(salesByType)
                .sort(([, a], [, b]) => b - a)
                .map(([codigo, venta]) => {
                  const maxVenta = Math.max(...Object.values(salesByType));
                  const percentage = (venta / maxVenta) * 100;
                  return (
                    <div key={codigo}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-gray-700">
                          {codigo}
                        </p>
                        <p className="text-xs font-semibold text-gray-900">
                          ${venta.toFixed(2)}
                        </p>
                      </div>
                      <div className="w-full bg-gray-200 h-1.5 rounded-full">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              No hay ventas en este periodo.
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
          <h2 className="text-gray-700 font-medium mb-2 flex items-center text-sm">
            <ShoppingBag className="mr-1.5 h-4 w-4" /> Desglose de productos
          </h2>
          {Object.keys(productsSold).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-2">
                      Producto
                    </th>
                    <th scope="col" className="px-3 py-2 text-right">
                      Cantidad
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(productsSold)
                    .sort(([, a], [, b]) => b - a)
                    .map(([product, quantity]) => (
                      <tr
                        key={product}
                        className="bg-white border-b hover:bg-gray-50"
                      >
                        <td className="px-3 py-2 font-medium text-gray-900 whitespace-normal">
                          {product}
                        </td>
                        <td className="px-3 py-2 text-right">{quantity}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              No hay productos vendidos en este periodo.
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg mb-3 border border-[#E2E4E9]">
          <div className="p-3 pb-1.5">
            <h2 className="text-gray-700 font-medium flex items-center text-sm">
              <Clock className="mr-1.5 h-4 w-4" /> Clientes a Visitar
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Señales para decidir tu próxima visita
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span>
                {clientInsights.attentionClients.length} atención (umbral{" "}
                {clientInsights.attentionThreshold} días)
              </span>
              <span>·</span>
              <span>{clientInsights.topGrowth.length} en crecimiento</span>
              <span>·</span>
              <span>{clientInsights.topDecline.length} en riesgo</span>
            </div>
          </div>

          <div className="px-3 pb-3 space-y-3">
            {/* Necesitan Atención */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-xs font-medium text-gray-700">
                  Necesitan Atención
                </h3>
                <span className="text-xs text-gray-500">
                  {clientInsights.attentionClients.length}
                </span>
              </div>
              {clientInsights.attentionClients.length > 0 ? (
                <div>
                  {clientInsights.attentionClients.map((client, idx) => (
                    <button
                      key={client.client}
                      type="button"
                      onClick={() => {
                        setSelectedClient(client.client);
                        clientHistoryRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }}
                      className={`w-full flex items-center justify-between py-2 border-b last:border-b-0 hover:bg-gray-50 text-left transition ${
                        selectedClient === client.client ? "bg-gray-50" : ""
                      }`}
                    >
                      <div>
                        <p className="text-xs font-medium">{client.client}</p>
                        <p className="text-xxs text-gray-500">
                          Sin compra reciente
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">
                          {client.daysSinceLastPurchase}d
                        </span>
                        <ChevronRight className="h-4 w-3 text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 py-3 text-center">
                  Todo bajo control — no hay clientes fuera del umbral
                </p>
              )}
            </div>

            {/* En Crecimiento */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-xs font-medium text-gray-700">
                  En Crecimiento
                </h3>
                <span className="text-xs text-gray-500">
                  {clientInsights.topGrowth.length}
                </span>
              </div>
              {clientInsights.topGrowth.length > 0 ? (
                <div>
                  {clientInsights.topGrowth.map((client, idx) => (
                    <button
                      key={client.client}
                      type="button"
                      onClick={() => {
                        setSelectedClient(client.client);
                        clientHistoryRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }}
                      className={`w-full flex items-center justify-between py-2 border-b last:border-b-0 hover:bg-gray-50 text-left transition ${
                        selectedClient === client.client ? "bg-gray-50" : ""
                      }`}
                    >
                      <div>
                        <p className="text-xs font-medium">{client.client}</p>
                        <p className="text-xxs text-gray-500">
                          Aumentó vs compra anterior
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          +
                          {formatCurrency(
                            client.deltaFromPreviousSale as number,
                          )}
                        </span>
                        <ChevronRight className="h-4 w-3 text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 py-3 text-center">
                  Sin señales de crecimiento
                </p>
              )}
            </div>

            {/* En Riesgo */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-xs font-medium text-gray-700">En Riesgo</h3>
                <span className="text-xs text-gray-500">
                  {clientInsights.topDecline.length}
                </span>
              </div>
              {clientInsights.topDecline.length > 0 ? (
                <div>
                  {clientInsights.topDecline.map((client, idx) => (
                    <button
                      key={client.client}
                      type="button"
                      onClick={() => {
                        setSelectedClient(client.client);
                        clientHistoryRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }}
                      className={`w-full flex items-center justify-between py-2 border-b last:border-b-0 hover:bg-gray-50 text-left transition ${
                        selectedClient === client.client ? "bg-gray-50" : ""
                      }`}
                    >
                      <div>
                        <p className="text-xs font-medium">{client.client}</p>
                        <p className="text-xxs text-gray-500">
                          Cayó vs compra anterior
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {formatCurrency(
                            client.deltaFromPreviousSale as number,
                          )}
                        </span>
                        <ChevronRight className="h-4 w-3 text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 py-3 text-center">
                  Sin caídas significativas
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg mb-3 border border-[#E2E4E9]">
          <div className="p-3 pb-1.5">
            <div className="flex justify-between items-center">
              <h2 className="text-gray-700 font-medium flex items-center text-sm">
                <Clock className="mr-1.5 h-4 w-4" /> Ventas Recientes
              </h2>
              <button
                type="button"
                className="text-blue-600 text-xs"
                onClick={() => setShowAllSales(!showAllSales)}
              >
                {showAllSales ? "Ver Menos" : "Ver Todas"}
              </button>
            </div>
          </div>
          <div className="px-3">
            {recentSales.length > 0 ? (
              recentSales.slice(0, showAllSales ? undefined : 4).map((sale) => (
                <button
                  key={`${sale.codigo}-${sale.fechaSinHora}-${sale.submissionTime ?? ""}-${sale.venta}`}
                  type="button"
                  className="w-full flex items-center justify-between py-2 border-b last:border-b-0 hover:bg-gray-100 text-left"
                  onClick={() => setSelectedSale(sale)}
                >
                  <div>
                    <p className="text-xs font-medium">{sale.clientName}</p>
                    <p className="text-xxs text-gray-500">{sale.codigo}</p>
                  </div>
                  <div className="flex items-center">
                    <div className="text-right mr-1.5">
                      <p className="text-xs font-medium">
                        ${sale.venta.toFixed(2)}
                      </p>
                      <p className="text-xxs text-gray-500">
                        {sale.fechaSinHora}
                        {sale.submissionTime ? ` • ${sale.submissionTime}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-3 text-gray-400" />
                  </div>
                </button>
              ))
            ) : (
              <p className="text-xs text-gray-500 text-center py-4">
                No hay ventas recientes para este periodo.
              </p>
            )}
          </div>
        </div>

        <div
          ref={clientHistoryRef}
          className="bg-white rounded-lg border border-[#E2E4E9]"
        >
          <div className="p-3">
            <div className="mb-2">
              <h2 className="text-gray-700 font-medium flex items-center text-sm">
                <Clock className="mr-1.5 h-4 w-4" /> Historial De Cliente
              </h2>
              {selectedClient && (
                <p className="text-xs text-gray-500 mt-1">
                  Cliente: {selectedClient}
                </p>
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
                  style={{ fontSize: "16px" }} // Ensure minimum font size of 16px
                />
              </div>
              {filteredClientNames.length > 0 && (
                <div className="absolute z-10 mt-1 left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg">
                  {filteredClientNames.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className="w-full px-4 py-2 text-base text-left hover:bg-gray-100"
                      onClick={() => {
                        setSelectedClient(name);
                        setSearchTerm("");
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="max-h-60 overflow-y-auto mt-2">
              {selectedClient && searchTerm === "" ? (
                clientSales.length > 0 ? (
                  clientSales
                    .sort(
                      (a, b) =>
                        new Date(b.fechaSinHora).getTime() -
                        new Date(a.fechaSinHora).getTime(),
                    )
                    .map((sale) => (
                      <button
                        key={`${sale.codigo}-${sale.fechaSinHora}-${sale.submissionTime ?? ""}-${sale.venta}`}
                        type="button"
                        className="w-full flex items-center justify-between py-2 border-b last:border-b-0 hover:bg-gray-100 text-left"
                        onClick={() => setSelectedSale(sale)}
                      >
                        <div className="flex items-center">
                          <div className="text-left">
                            <p className="text-xs font-medium">
                              ${sale.venta.toFixed(2)}
                            </p>
                            <p className="text-xxs text-gray-500">
                              {sale.fechaSinHora}
                              {sale.submissionTime
                                ? ` • ${sale.submissionTime}`
                                : ""}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-3 text-gray-400" />
                      </button>
                    ))
                ) : (
                  <p className="text-xs text-gray-500 text-center py-4">
                    No hay ventas para este cliente.
                  </p>
                )
              ) : (
                <p className="text-xs text-gray-500 text-center py-4">
                  Selecciona un cliente para ver su historial de ventas.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      {selectedSale && (
        <SaleDetailsPopup
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
        />
      )}

      <GoalDetailsDialog
        isOpen={isGoalDetailsOpen}
        onClose={() => setIsGoalDetailsOpen(false)}
        currentSales={currentPeriodSales}
        goal={currentGoal}
        periodInfo={periodInfo}
        salesData={currentPeriodFilteredSales}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}
