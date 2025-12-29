import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  MapPin,
  Clock,
  Award,
} from "lucide-react";

type RouteMetrics = {
  userEmail: string;
  routeDay: string;
  monthYear: string;
  weekNumber: number;
  completed: number;
  skipped: number;
  postponed: number;
  timestamp: string;
};

type PerformanceData = {
  weeklyCompletion: number;
  monthlyCompletion: number;
  averageVisitsPerDay: number;
  totalClients: number;
  completionTrend: "up" | "down" | "stable";
};

interface RouteAnalyticsProps {
  className?: string;
}

export default function RouteAnalytics({
  className = "",
}: RouteAnalyticsProps) {
  const { data: session } = useSession();
  const [metrics, setMetrics] = useState<RouteMetrics[]>([]);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.email) {
      fetchRouteMetrics();
    }
  }, [session]);

  const fetchRouteMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/recorridos?email=${encodeURIComponent(session?.user?.email || "")}&sheet=metricas`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch metrics");
      }

      const data = await response.json();
      setMetrics(data.data || []);
      calculatePerformance(data.data || []);
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePerformance = (metricsData: RouteMetrics[]) => {
    if (!metricsData.length) {
      setPerformance(null);
      return;
    }

    const currentDate = new Date();
    const currentWeek = getWeekNumber(currentDate);
    const currentMonth = currentDate.toISOString().slice(0, 7);

    // Weekly completion rate
    const thisWeekMetrics = metricsData.filter(
      (m) => m.weekNumber === currentWeek && m.monthYear === currentMonth,
    );

    const weeklyCompleted = thisWeekMetrics.reduce(
      (sum, m) => sum + (m.completed || 0),
      0,
    );
    const weeklyTotal = thisWeekMetrics.reduce(
      (sum, m) =>
        sum + (m.completed || 0) + (m.skipped || 0) + (m.postponed || 0),
      0,
    );
    const weeklyCompletion =
      weeklyTotal > 0 ? (weeklyCompleted / weeklyTotal) * 100 : 0;

    // Monthly completion rate
    const thisMonthMetrics = metricsData.filter(
      (m) => m.monthYear === currentMonth,
    );
    const monthlyCompleted = thisMonthMetrics.reduce(
      (sum, m) => sum + (m.completed || 0),
      0,
    );
    const monthlyTotal = thisMonthMetrics.reduce(
      (sum, m) =>
        sum + (m.completed || 0) + (m.skipped || 0) + (m.postponed || 0),
      0,
    );
    const monthlyCompletion =
      monthlyTotal > 0 ? (monthlyCompleted / monthlyTotal) * 100 : 0;

    // Average visits per day
    const daysWithData = new Set(
      thisMonthMetrics.map((m) => m.timestamp.split("T")[0]),
    ).size;
    const averageVisitsPerDay =
      daysWithData > 0 ? monthlyCompleted / daysWithData : 0;

    // Completion trend (compare this week with last week)
    const lastWeek = currentWeek - 1;
    const lastWeekMetrics = metricsData.filter(
      (m) => m.weekNumber === lastWeek && m.monthYear === currentMonth,
    );

    const lastWeekCompleted = lastWeekMetrics.reduce(
      (sum, m) => sum + (m.completed || 0),
      0,
    );
    const lastWeekTotal = lastWeekMetrics.reduce(
      (sum, m) =>
        sum + (m.completed || 0) + (m.skipped || 0) + (m.postponed || 0),
      0,
    );
    const lastWeekCompletion =
      lastWeekTotal > 0 ? (lastWeekCompleted / lastWeekTotal) * 100 : 0;

    let completionTrend: "up" | "down" | "stable" = "stable";
    if (weeklyCompletion > lastWeekCompletion + 5) completionTrend = "up";
    else if (weeklyCompletion < lastWeekCompletion - 5)
      completionTrend = "down";

    setPerformance({
      weeklyCompletion,
      monthlyCompletion,
      averageVisitsPerDay,
      totalClients: monthlyTotal,
      completionTrend,
    });
  };

  const getWeekNumber = (date: Date): number => {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - startOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
  };

  const getTrendIcon = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <div className="h-4 w-4" />;
    }
  };

  const getTrendColor = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up":
        return "text-green-600";
      case "down":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  if (loading) {
    return (
      <div
        className={`bg-white rounded-lg border border-[#E2E4E9] p-4 ${className}`}
      >
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!performance) {
    return (
      <div
        className={`bg-white rounded-lg border border-[#E2E4E9] p-4 ${className}`}
      >
        <div className="text-center py-4">
          <Award className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">
            No hay datos de rendimiento disponibles
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-lg border border-[#E2E4E9] p-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Rendimiento de Rutas
        </h3>
        <div className="flex items-center gap-1">
          {getTrendIcon(performance.completionTrend)}
          <span
            className={`text-sm font-medium ${getTrendColor(performance.completionTrend)}`}
          >
            {performance.completionTrend === "up"
              ? "Mejorando"
              : performance.completionTrend === "down"
                ? "Declinando"
                : "Estable"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-gray-600">Esta Semana</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {performance.weeklyCompletion.toFixed(0)}%
              </span>
              <span className="text-xs text-gray-500">completado</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${performance.weeklyCompletion}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="h-4 w-4 text-green-500" />
              <span className="text-sm text-gray-600">Promedio Diario</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {performance.averageVisitsPerDay.toFixed(1)}
              </span>
              <span className="text-xs text-gray-500">visitas</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-gray-600">Este Mes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {performance.monthlyCompletion.toFixed(0)}%
              </span>
              <span className="text-xs text-gray-500">completado</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${performance.monthlyCompletion}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-gray-600">Total Clientes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {performance.totalClients}
              </span>
              <span className="text-xs text-gray-500">este mes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick insights */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="grid grid-cols-1 gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Eficiencia semanal:</span>
            <span
              className={`font-medium ${
                performance.weeklyCompletion >= 80
                  ? "text-green-600"
                  : performance.weeklyCompletion >= 60
                    ? "text-yellow-600"
                    : "text-red-600"
              }`}
            >
              {performance.weeklyCompletion >= 80
                ? "Excelente"
                : performance.weeklyCompletion >= 60
                  ? "Bueno"
                  : "Necesita mejorar"}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Tendencia:</span>
            <span
              className={`font-medium ${getTrendColor(performance.completionTrend)}`}
            >
              {performance.completionTrend === "up"
                ? "↗ Mejorando"
                : performance.completionTrend === "down"
                  ? "↘ Declinando"
                  : "→ Estable"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
