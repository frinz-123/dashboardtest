import React, { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface GoalDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentSales: number;
  goal: number;
  periodInfo: {
    periodStartDate: Date;
    periodEndDate: Date;
    periodNumber: number;
  };
  salesData: any[]; // Using any[] for simplicity, but should match Sale type
  formatCurrency: (value: number) => string;
}

export default function GoalDetailsDialog({
  isOpen,
  onClose,
  currentSales,
  goal,
  periodInfo,
  salesData,
  formatCurrency,
}: GoalDetailsDialogProps) {
  const chartData = useMemo(() => {
    if (!periodInfo || !goal) return [];

    const { periodStartDate, periodEndDate } = periodInfo;
    const totalDays =
      Math.ceil(
        (periodEndDate.getTime() - periodStartDate.getTime()) /
          (1000 * 60 * 60 * 24),
      ) + 1;
    const dailyGoal = goal / totalDays;

    const data = [];
    let cumulativeSales = 0;
    let cumulativeGoal = 0;

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Create a map of sales by date
    const salesByDate = salesData.reduce(
      (acc, sale) => {
        const dateStr = sale.fechaSinHora; // Assuming YYYY-MM-DD format or similar
        // Normalize date string to comparable format if needed, but assuming standard format for now
        // If fechaSinHora is YYYY-MM-DD
        const dateKey = new Date(dateStr).toISOString().split("T")[0];
        acc[dateKey] = (acc[dateKey] || 0) + sale.venta;
        return acc;
      },
      {} as Record<string, number>,
    );

    for (let i = 0; i < totalDays; i++) {
      const currentDate = new Date(periodStartDate);
      currentDate.setDate(currentDate.getDate() + i);

      const dateKey = currentDate.toISOString().split("T")[0];
      const daySales = salesByDate[dateKey] || 0;

      cumulativeGoal += dailyGoal;

      const isPastOrToday = currentDate <= today;

      if (isPastOrToday) {
        cumulativeSales += daySales;
      }

      data.push({
        date: currentDate.toLocaleDateString("es-ES", {
          day: "numeric",
          month: "short",
        }),
        fullDate: dateKey,
        ideal: cumulativeGoal,
        actual: isPastOrToday ? cumulativeSales : null,
        sales: daySales,
      });
    }

    return data;
  }, [periodInfo, goal, salesData]);

  const projection = useMemo(() => {
    if (!chartData.length) return 0;
    const lastActual = chartData.filter((d) => d.actual !== null).pop();
    if (!lastActual || lastActual.actual === null) return 0;

    // Simple linear projection based on current completion % vs time elapsed %
    // Or just use the last actual value + remaining days * daily average
    // Let's use the daily average so far
    const daysElapsed = chartData.filter((d) => d.actual !== null).length;
    const currentTotal = lastActual.actual;
    const dailyAverage = daysElapsed > 0 ? currentTotal / daysElapsed : 0;
    const remainingDays = chartData.length - daysElapsed;

    return currentTotal + dailyAverage * remainingDays;
  }, [chartData]);

  const statusColor = useMemo(() => {
    if (projection >= goal) return "text-green-600";
    if (projection >= goal * 0.9) return "text-yellow-600";
    return "text-red-600";
  }, [projection, goal]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Análisis de Meta</DialogTitle>
          <DialogDescription>
            Seguimiento detallado del progreso hacia la meta del periodo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-lg border bg-card p-3 shadow-sm">
              <div className="text-[10px] uppercase text-muted-foreground font-medium">
                Meta Total
              </div>
              <div className="text-lg font-bold">{formatCurrency(goal)}</div>
            </div>
            <div className="rounded-lg border bg-card p-3 shadow-sm">
              <div className="text-[10px] uppercase text-muted-foreground font-medium">
                Actual
              </div>
              <div className="text-lg font-bold text-blue-600">
                {formatCurrency(currentSales)}
              </div>
            </div>
            <div className="rounded-lg border bg-card p-3 shadow-sm">
              <div className="text-[10px] uppercase text-muted-foreground font-medium">
                Proyección
              </div>
              <div className={`text-lg font-bold ${statusColor}`}>
                {formatCurrency(projection)}
              </div>
            </div>
          </div>

          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E2E4E9"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === "ideal" ? "Meta Ideal" : "Venta Acumulada",
                  ]}
                  labelStyle={{
                    color: "#374151",
                    fontWeight: "bold",
                    marginBottom: "4px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="ideal"
                  stroke="#9ca3af"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                  name="Meta Ideal"
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorActual)"
                  name="Actual"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="text-xs text-gray-500 text-center mt-2">
            {projection >= goal
              ? "🎉 ¡Excelente! Al ritmo actual, superarás la meta."
              : `⚠️ Necesitas incrementar el ritmo para alcanzar la meta.`}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
