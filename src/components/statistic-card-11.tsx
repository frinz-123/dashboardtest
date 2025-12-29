import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface StatisticCard11Props {
  title?: string;
  currentValue: number;
  goalValue: number;
  periodLabel?: string;
  renewsOn?: string;
  formatCurrency?: (value: number) => string;
  onViewDetails?: () => void;
}

export default function StatisticCard11({
  title = "Resumen Personalizado",
  currentValue = 0,
  goalValue = 0,
  periodLabel = "mensual",
  renewsOn,
  formatCurrency = (val) => `$${val.toFixed(2)}`,
  onViewDetails,
}: StatisticCard11Props) {
  const used = currentValue;
  const total = goalValue;
  const remaining = Math.max(0, total - used);
  const percent = total > 0 ? (used / total) * 100 : 0;

  return (
    <Card className="w-full h-full border border-[#E2E4E9]/70 shadow-none">
      <CardHeader className="border-0 min-h-auto p-3 pb-1.5 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-semibold text-gray-700">
          {title}
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          className="font-medium text-xs h-7"
          onClick={onViewDetails}
        >
          Ver detalles
        </Button>
      </CardHeader>
      <CardContent className="p-3 pt-0 flex flex-col space-y-4">
        <div className="grow space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Ventas Actuales:{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(used)}
              </span>
            </span>
            <span className="text-base font-semibold text-foreground">
              {percent.toFixed(1)}%
            </span>
          </div>

          <div>
            <Progress
              value={percent}
              className="bg-muted h-2"
              indicatorClassName="bg-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              {formatCurrency(remaining)} restantes
            </span>
            <span className="text-xs text-muted-foreground">
              de {formatCurrency(total)} meta {periodLabel}
            </span>
          </div>
        </div>

        {renewsOn && (
          <div className="rounded-xl bg-muted/60 px-4 py-2.5 text-xs text-muted-foreground flex items-center justify-between gap-2">
            <span>Cierre de periodo</span>
            <span className="font-medium text-foreground">{renewsOn}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
