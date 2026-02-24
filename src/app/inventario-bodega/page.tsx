"use client";

import {
  Minus,
  Package,
  PackagePlus,
  Plus,
  RefreshCcw,
  Save,
  Settings2,
  Trash2,
  Warehouse,
} from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import AppHeader from "@/components/AppHeader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { EMAIL_TO_VENDOR_LABELS, isInventarioCarroAdmin } from "@/utils/auth";
import {
  getAllPeriods,
  getCurrentPeriodInfo,
  getPeriodWeeks,
} from "@/utils/dateUtils";
import { PRODUCT_NAMES } from "@/utils/productCatalog";

type InventoryWarning = {
  code: "NEGATIVE_STOCK";
  product: string;
  resultingStock: number;
};

type BodegaLedgerRow = {
  rowNumber: number;
  id: string;
  date: string;
  periodCode: string;
  weekCode: string;
  product: string;
  quantity: number;
  direction: "Entrada" | "Salida";
  movementType: string;
  sellerEmail: string;
  notes: string;
  linkedEntryId: string;
  linkStatus: "" | "linked" | "override";
  overrideReason: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type FormItem = {
  id: string;
  product: string;
  quantity: string;
};

type EditForm = {
  rowNumber: number;
  id: string;
  date: string;
  product: string;
  quantity: string;
  direction: "Entrada" | "Salida";
  movementType: string;
  sellerEmail: string;
  notes: string;
  linkedEntryId: string;
  linkStatus: "" | "linked" | "override";
  overrideReason: string;
  createdBy: string;
  createdAt: string;
};

const BODEGA_MOVEMENT_TYPES = [
  "InventarioInicial",
  "Produccion",
  "SalidaCarro",
  "SalidaManual",
  "Retorno",
  "Ajuste",
] as const;

const MANUAL_DIRECTION_OPTIONS = [
  { value: "Entrada" as const, label: "Entrada", icon: Plus },
  { value: "Salida" as const, label: "Salida", icon: Minus },
] as const;

const MANUAL_MOVEMENT_ICON: Record<
  (typeof BODEGA_MOVEMENT_TYPES)[number],
  typeof Settings2
> = {
  InventarioInicial: Warehouse,
  Produccion: PackagePlus,
  SalidaCarro: Package,
  SalidaManual: Minus,
  Retorno: Plus,
  Ajuste: Settings2,
};

const createItem = (): FormItem => ({
  id: crypto.randomUUID(),
  product: "",
  quantity: "",
});

type QuantityStepperProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  min?: number;
  allowNegative?: boolean;
};

const QuantityStepper = ({
  value,
  onChange,
  id,
  min = 0,
  allowNegative = false,
}: QuantityStepperProps) => {
  const numValue = Number.parseInt(value, 10) || 0;
  const effectiveMin = allowNegative ? -Infinity : min;

  const handleDecrement = () => {
    const newValue = Math.max(effectiveMin, numValue - 1);
    onChange(String(newValue));
  };

  const handleIncrement = () => {
    onChange(String(numValue + 1));
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    if (allowNegative) {
      if (
        inputValue === "" ||
        inputValue === "-" ||
        /^-?\d+$/.test(inputValue)
      ) {
        onChange(inputValue);
      }
    } else if (inputValue === "" || /^\d+$/.test(inputValue)) {
      onChange(inputValue);
    }
  };

  return (
    <div className="flex h-10 w-full items-center overflow-hidden rounded-lg border border-slate-200">
      <button
        type="button"
        onClick={handleDecrement}
        className="flex h-full w-10 shrink-0 items-center justify-center border-r border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 active:bg-slate-200"
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        id={id}
        type="text"
        inputMode={allowNegative ? "text" : "numeric"}
        pattern={allowNegative ? "-?[0-9]*" : "[0-9]*"}
        value={value}
        onChange={handleInputChange}
        className="h-full w-full min-w-0 flex-1 bg-white px-2 text-center text-base tabular-nums outline-none"
      />
      <button
        type="button"
        onClick={handleIncrement}
        className="flex h-full w-10 shrink-0 items-center justify-center border-l border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 active:bg-slate-200"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
};

const defaultDate = () => new Date().toISOString().split("T")[0] || "";

const parseWarnings = (payload: unknown): InventoryWarning[] => {
  if (!payload || typeof payload !== "object") return [];
  const warningValue = (payload as { warnings?: unknown }).warnings;
  if (!Array.isArray(warningValue)) return [];

  return warningValue.flatMap((warning) => {
    if (!warning || typeof warning !== "object") return [];
    const candidate = warning as {
      code?: unknown;
      product?: unknown;
      resultingStock?: unknown;
    };
    if (
      candidate.code === "NEGATIVE_STOCK" &&
      typeof candidate.product === "string" &&
      typeof candidate.resultingStock === "number"
    ) {
      return [
        {
          code: "NEGATIVE_STOCK" as const,
          product: candidate.product,
          resultingStock: candidate.resultingStock,
        },
      ];
    }
    return [];
  });
};

export default function InventarioBodegaPage() {
  const { data: session, status } = useSession();
  const isAdmin = useMemo(
    () => isInventarioCarroAdmin(session?.user?.email),
    [session?.user?.email],
  );

  const currentPeriodInfo = useMemo(() => getCurrentPeriodInfo(), []);
  const availablePeriods = useMemo(() => getAllPeriods().reverse(), []);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(
    currentPeriodInfo.periodNumber,
  );
  const [selectedWeek, setSelectedWeek] = useState<number>(
    currentPeriodInfo.weekInPeriod,
  );
  const [rows, setRows] = useState<BodegaLedgerRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<InventoryWarning[]>([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isProductionOpen, setIsProductionOpen] = useState(false);
  const [isCargaOpen, setIsCargaOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const [productionDate, setProductionDate] = useState(defaultDate());
  const [productionNotes, setProductionNotes] = useState("");
  const [productionItems, setProductionItems] = useState<FormItem[]>([
    createItem(),
  ]);

  const [cargaDate, setCargaDate] = useState(defaultDate());
  const [cargaNotes, setCargaNotes] = useState("");
  const [cargaSeller, setCargaSeller] = useState("");
  const [cargaItems, setCargaItems] = useState<FormItem[]>([createItem()]);

  const [manualDate, setManualDate] = useState(defaultDate());
  const [manualDirection, setManualDirection] = useState<"Entrada" | "Salida">(
    "Entrada",
  );
  const [manualMovementType, setManualMovementType] = useState("Ajuste");
  const [manualProduct, setManualProduct] = useState("");
  const [manualQuantity, setManualQuantity] = useState("");
  const [manualNotes, setManualNotes] = useState("");

  const periodWeeks = useMemo(
    () => getPeriodWeeks(selectedPeriod),
    [selectedPeriod],
  );
  const selectedWeekCode = `P${selectedPeriod}S${selectedWeek}`;

  const sellerOptions = useMemo(
    () => Object.entries(EMAIL_TO_VENDOR_LABELS),
    [],
  );
  const productOptions = useMemo(() => {
    const names = new Set(PRODUCT_NAMES);
    rows.forEach((row) => {
      if (row.product) names.add(row.product);
    });
    return Array.from(names);
  }, [rows]);

  const fetchRows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/inventario-bodega");
      if (!response.ok) {
        throw new Error("No se pudo cargar inventario bodega");
      }
      const payload = await response.json();
      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      setWarnings(parseWarnings(payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !isAdmin) return;
    void fetchRows();
  }, [status, isAdmin, fetchRows]);

  const applyWarnings = (payload: unknown) => {
    setWarnings(parseWarnings(payload));
  };

  const buildEntries = (items: FormItem[]) => {
    const normalized = items
      .map((item) => ({
        product: item.product.trim(),
        quantity: Number(item.quantity || 0),
      }))
      .filter((item) => item.product && Number.isFinite(item.quantity));

    if (normalized.length === 0) {
      throw new Error("Agrega al menos un producto válido");
    }
    if (normalized.some((item) => item.quantity <= 0)) {
      throw new Error("La cantidad debe ser mayor a cero");
    }

    return normalized;
  };

  const updateListItem = (
    items: FormItem[],
    setItems: (value: FormItem[]) => void,
    id: string,
    field: "product" | "quantity",
    value: string,
  ) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  };

  const removeListItem = (
    items: FormItem[],
    setItems: (value: FormItem[]) => void,
    id: string,
  ) => {
    if (items.length <= 1) {
      setItems(items.map((item) => (item.id === id ? createItem() : item)));
      return;
    }
    setItems(items.filter((item) => item.id !== id));
  };

  const handleProductionSubmit = async () => {
    setError(null);
    setNotice(null);
    setIsSaving(true);
    try {
      const normalized = buildEntries(productionItems);
      const response = await fetch("/api/inventario-bodega", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: normalized.map((item) => ({
            date: productionDate,
            product: item.product,
            quantity: item.quantity,
            direction: "Entrada",
            movementType: "Produccion",
            notes: productionNotes,
          })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo guardar producción");
      }
      applyWarnings(payload);
      await fetchRows();
      setProductionItems([createItem()]);
      setProductionNotes("");
      setNotice("Producción registrada");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleCargaSubmit = async () => {
    setError(null);
    setNotice(null);
    setIsSaving(true);
    try {
      if (!cargaSeller) {
        throw new Error("Selecciona un vendedor");
      }
      const normalized = buildEntries(cargaItems);
      const response = await fetch("/api/inventario-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: cargaDate,
          sellerEmail: cargaSeller,
          movementType: "Carga",
          notes: cargaNotes,
          linkToBodega: true,
          entries: normalized,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload?.error || "No se pudo registrar salida a carro",
        );
      }
      applyWarnings(payload);
      await fetchRows();
      setCargaItems([createItem()]);
      setCargaNotes("");
      setNotice("Salida a carro registrada y ligada con Inventario Carro");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar salida");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSubmit = async () => {
    setError(null);
    setNotice(null);
    setIsSaving(true);
    try {
      const quantity = Number(manualQuantity || 0);
      if (!manualProduct) throw new Error("Selecciona un producto");
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Cantidad inválida");
      }

      const response = await fetch("/api/inventario-bodega", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: [
            {
              date: manualDate,
              product: manualProduct,
              quantity,
              direction: manualDirection,
              movementType: manualMovementType,
              notes: manualNotes,
            },
          ],
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo registrar movimiento");
      }
      applyWarnings(payload);
      await fetchRows();
      setManualQuantity("");
      setManualNotes("");
      setNotice("Movimiento manual registrado");
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al guardar movimiento",
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditOpen = (row: BodegaLedgerRow) => {
    setEditForm({
      rowNumber: row.rowNumber,
      id: row.id,
      date: row.date,
      product: row.product,
      quantity: String(row.quantity),
      direction: row.direction,
      movementType: row.movementType,
      sellerEmail: row.sellerEmail,
      notes: row.notes,
      linkedEntryId: row.linkedEntryId,
      linkStatus: row.linkStatus,
      overrideReason: row.overrideReason,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editForm) return;
    setError(null);
    setNotice(null);
    setIsSaving(true);
    try {
      const quantity = Number(editForm.quantity || 0);
      if (!editForm.product || !Number.isFinite(quantity)) {
        throw new Error("Completa producto y cantidad");
      }
      const response = await fetch("/api/inventario-bodega", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowNumber: editForm.rowNumber,
          entry: {
            id: editForm.id,
            date: editForm.date,
            product: editForm.product,
            quantity,
            direction: editForm.direction,
            movementType: editForm.movementType,
            sellerEmail: editForm.sellerEmail,
            notes: editForm.notes,
            linkedEntryId: editForm.linkedEntryId,
            linkStatus: editForm.linkStatus,
            overrideReason: editForm.overrideReason,
            createdBy: editForm.createdBy,
            createdAt: editForm.createdAt,
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo actualizar movimiento");
      }
      applyWarnings(payload);
      await fetchRows();
      setIsEditOpen(false);
      setEditForm(null);
      setNotice("Movimiento actualizado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (row: BodegaLedgerRow) => {
    if (
      !window.confirm(
        "¿Eliminar movimiento? Si está ligado, se borrará en carro también.",
      )
    ) {
      return;
    }
    setError(null);
    setNotice(null);
    setIsSaving(true);
    try {
      const response = await fetch("/api/inventario-bodega", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowNumber: row.rowNumber }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo eliminar movimiento");
      }
      applyWarnings(payload);
      await fetchRows();
      setNotice("Movimiento eliminado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setIsSaving(false);
    }
  };

  const stockByProduct = useMemo(() => {
    const totals = new Map<string, number>();
    rows.forEach((row) => {
      const current = totals.get(row.product) || 0;
      const delta = row.direction === "Salida" ? -row.quantity : row.quantity;
      totals.set(row.product, current + delta);
    });
    return Array.from(totals.entries())
      .map(([product, stock]) => ({ product, stock }))
      .sort((a, b) => a.product.localeCompare(b.product));
  }, [rows]);

  const weekRows = useMemo(
    () => rows.filter((row) => row.weekCode === selectedWeekCode),
    [rows, selectedWeekCode],
  );
  const weekTotals = useMemo(() => {
    let entradas = 0;
    let salidas = 0;
    weekRows.forEach((row) => {
      if (row.direction === "Salida") {
        salidas += row.quantity;
      } else {
        entradas += row.quantity;
      }
    });
    return { entradas, salidas };
  }, [weekRows]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => b.date.localeCompare(a.date)),
    [rows],
  );
  const actionTapSpring = {
    type: "spring" as const,
    duration: 0.5,
    bounce: 0,
  };
  const dialogBodySpring = {
    type: "spring" as const,
    bounce: 0,
    duration: 0.3,
  };

  if (status === "unauthenticated") {
    redirect("/auth/signin");
  }
  if (status === "authenticated" && !isAdmin) {
    redirect("/");
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <AppHeader title="Inventario Bodega" icon={Warehouse} />
      <main className="px-4 py-5 max-w-6xl mx-auto space-y-4">
        <section className="bg-white rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Control central de bodega
              </h2>
              <p className="text-xs text-slate-500">
                Semana {selectedWeek} del periodo {selectedPeriod} (
                {selectedWeekCode})
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <m.div whileTap={{ scale: 0.8 }} transition={actionTapSpring}>
                <button
                  type="button"
                  onClick={fetchRows}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Actualizar
                </button>
              </m.div>
              <m.div whileTap={{ scale: 0.8 }} transition={actionTapSpring}>
                <button
                  type="button"
                  onClick={() => {
                    setNotice(null);
                    setError(null);
                    setIsProductionOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
                >
                  <PackagePlus className="h-4 w-4" />
                  Producción
                </button>
              </m.div>
              <m.div whileTap={{ scale: 0.8 }} transition={actionTapSpring}>
                <button
                  type="button"
                  onClick={() => {
                    setNotice(null);
                    setError(null);
                    setIsCargaOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
                >
                  <Package className="h-4 w-4" />
                  Salida a Carro
                </button>
              </m.div>
              <m.div whileTap={{ scale: 0.8 }} transition={actionTapSpring}>
                <button
                  type="button"
                  onClick={() => {
                    setNotice(null);
                    setError(null);
                    setIsManualOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-100"
                >
                  <Settings2 className="h-4 w-4" />
                  Movimiento Manual
                </button>
              </m.div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="bodega-filter-period"
                  className="text-xs font-semibold text-slate-600"
                >
                  Periodo
                </label>
                <select
                  id="bodega-filter-period"
                  value={selectedPeriod}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setSelectedPeriod(next);
                    setSelectedWeek(1);
                  }}
                  className="w-full border border-slate-200 rounded-lg pl-3 pr-10 py-2 text-sm"
                >
                  {availablePeriods.map((period) => (
                    <option
                      key={period.periodNumber}
                      value={period.periodNumber}
                    >
                      Periodo {period.periodNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="bodega-filter-week"
                  className="text-xs font-semibold text-slate-600"
                >
                  Semana
                </label>
                <select
                  id="bodega-filter-week"
                  value={selectedWeek}
                  onChange={(event) =>
                    setSelectedWeek(Number(event.target.value))
                  }
                  className="w-full border border-slate-200 rounded-lg pl-3 pr-10 py-2 text-sm"
                >
                  {periodWeeks.map((week) => (
                    <option key={week.weekNumber} value={week.weekNumber}>
                      {week.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg p-3">
                <p className="text-xs text-slate-500">Entradas semana</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {weekTotals.entradas}
                </p>
              </div>
              <div className="rounded-lg p-3">
                <p className="text-xs text-slate-500">Salidas semana</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {weekTotals.salidas}
                </p>
              </div>
            </div>
          </div>

          {notice && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {notice}
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 space-y-1">
              <p className="font-semibold">Advertencia de stock negativo:</p>
              {warnings.map((warning) => (
                <p key={`${warning.product}-${warning.resultingStock}`}>
                  {warning.product}: {warning.resultingStock}
                </p>
              ))}
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Stock actual
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs text-slate-500">
                  <tr className="text-left border-b border-slate-200">
                    <th className="py-2 pr-3">Producto</th>
                    <th className="py-2">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {stockByProduct.map((row) => (
                    <tr
                      key={row.product}
                      className="border-b border-slate-100 last:border-b-0"
                    >
                      <td className="py-2 pr-3">{row.product}</td>
                      <td
                        className={cn(
                          "py-2 font-medium",
                          row.stock < 0 ? "text-red-600" : "text-slate-800",
                        )}
                      >
                        {row.stock}
                      </td>
                    </tr>
                  ))}
                  {stockByProduct.length === 0 && (
                    <tr>
                      <td
                        colSpan={2}
                        className="py-4 text-center text-slate-400"
                      >
                        Sin datos
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Historial de movimientos
            </h3>
            <div className="overflow-x-auto max-h-[420px]">
              <table className="min-w-full text-sm">
                <thead className="text-xs text-slate-500">
                  <tr className="text-left border-b border-slate-200">
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Producto</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Cant.</th>
                    <th className="py-2 pr-3">Ligado</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-4 text-center text-slate-400"
                      >
                        Cargando...
                      </td>
                    </tr>
                  )}
                  {!isLoading &&
                    sortedRows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-slate-100 last:border-b-0"
                      >
                        <td className="py-2 pr-3 text-slate-700">{row.date}</td>
                        <td className="py-2 pr-3">{row.product}</td>
                        <td className="py-2 pr-3">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                            {row.direction} · {row.movementType}
                          </span>
                        </td>
                        <td className="py-2 pr-3">{row.quantity}</td>
                        <td className="py-2 pr-3">
                          {row.linkStatus === "linked" ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700">
                              Sí
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">
                              No
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditOpen(row)}
                              className="text-xs text-slate-600 hover:text-slate-900"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(row)}
                              className="inline-flex items-center text-xs text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      <Dialog open={isProductionOpen} onOpenChange={setIsProductionOpen}>
        <DialogContent className="w-[92vw] max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Registrar producción</DialogTitle>
          </DialogHeader>
          <AnimatePresence mode="popLayout" initial={false}>
            {isProductionOpen ? (
              <m.div
                key="production-dialog-content"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={dialogBodySpring}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <label
                    htmlFor="production-date"
                    className="text-xs font-semibold text-slate-600"
                  >
                    Fecha
                  </label>
                  <input
                    id="production-date"
                    type="date"
                    value={productionDate}
                    onChange={(event) => setProductionDate(event.target.value)}
                    className="w-full border border-slate-200 rounded-lg pl-3 pr-10 py-2 text-sm"
                  />
                </div>
                <m.div
                  layout
                  className="space-y-2"
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                >
                  <AnimatePresence initial={false}>
                    {productionItems.map((item) => (
                      <m.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{
                          duration: 0.25,
                          ease: [0.4, 0, 0.2, 1],
                          layout: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
                        }}
                        className="flex flex-col gap-2 sm:flex-row sm:items-end"
                      >
                        <select
                          value={item.product}
                          onChange={(event) =>
                            updateListItem(
                              productionItems,
                              setProductionItems,
                              item.id,
                              "product",
                              event.target.value,
                            )
                          }
                          className="flex-1 border border-slate-200 rounded-lg pl-3 pr-10 py-2 text-sm"
                        >
                          <option value="">Producto</option>
                          {productOptions.map((product) => (
                            <option key={product} value={product}>
                              {product}
                            </option>
                          ))}
                        </select>
                        <div className="sm:w-36">
                          <QuantityStepper
                            value={item.quantity}
                            onChange={(value) =>
                              updateListItem(
                                productionItems,
                                setProductionItems,
                                item.id,
                                "quantity",
                                value,
                              )
                            }
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            removeListItem(
                              productionItems,
                              setProductionItems,
                              item.id,
                            )
                          }
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                          aria-label="Quitar producto"
                        >
                          <Minus className="h-5 w-5" />
                        </button>
                      </m.div>
                    ))}
                  </AnimatePresence>
                  <m.button
                    layout
                    type="button"
                    onClick={() =>
                      setProductionItems((prev) => [...prev, createItem()])
                    }
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-base font-semibold text-white hover:bg-slate-800"
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar producto
                  </m.button>
                </m.div>
                <div className="space-y-1">
                  <label
                    htmlFor="production-notes"
                    className="text-xs font-semibold text-slate-600"
                  >
                    Notas
                  </label>
                  <textarea
                    id="production-notes"
                    value={productionNotes}
                    onChange={(event) => setProductionNotes(event.target.value)}
                    rows={2}
                    className="w-full border border-slate-200 rounded-lg pl-3 pr-10 py-2 text-sm"
                    placeholder="Notas"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsProductionOpen(false)}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await handleProductionSubmit();
                      if (ok) setIsProductionOpen(false);
                    }}
                    disabled={isSaving}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    Guardar producción
                  </button>
                </div>
              </m.div>
            ) : null}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      <Dialog open={isCargaOpen} onOpenChange={setIsCargaOpen}>
        <DialogContent className="w-[92vw] max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Registrar salida a carro</DialogTitle>
          </DialogHeader>
          <AnimatePresence mode="popLayout" initial={false}>
            {isCargaOpen ? (
              <m.div
                key="carga-dialog-content"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={dialogBodySpring}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <label
                    htmlFor="carga-date"
                    className="text-xs font-semibold text-slate-600"
                  >
                    Fecha
                  </label>
                  <input
                    id="carga-date"
                    type="date"
                    value={cargaDate}
                    onChange={(event) => setCargaDate(event.target.value)}
                    className="w-full border border-slate-200 rounded-lg pl-3 pr-10 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="carga-seller"
                    className="text-xs font-semibold text-slate-600"
                  >
                    Vendedor
                  </label>
                  <select
                    id="carga-seller"
                    value={cargaSeller}
                    onChange={(event) => setCargaSeller(event.target.value)}
                    className="w-full border border-slate-200 rounded-lg pl-3 pr-10 py-2 text-sm"
                  >
                    <option value="">Selecciona vendedor</option>
                    {sellerOptions.map(([email, label]) => (
                      <option key={email} value={email}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <m.div
                  layout
                  className="space-y-2"
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                >
                  <AnimatePresence initial={false}>
                    {cargaItems.map((item) => (
                      <m.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{
                          duration: 0.25,
                          ease: [0.4, 0, 0.2, 1],
                          layout: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
                        }}
                        className="flex flex-col gap-2 sm:flex-row sm:items-end"
                      >
                        <select
                          value={item.product}
                          onChange={(event) =>
                            updateListItem(
                              cargaItems,
                              setCargaItems,
                              item.id,
                              "product",
                              event.target.value,
                            )
                          }
                          className="flex-1 border border-slate-200 rounded-lg pl-3 pr-10 py-2 text-sm"
                        >
                          <option value="">Producto</option>
                          {productOptions.map((product) => (
                            <option key={product} value={product}>
                              {product}
                            </option>
                          ))}
                        </select>
                        <div className="sm:w-36">
                          <QuantityStepper
                            value={item.quantity}
                            onChange={(value) =>
                              updateListItem(
                                cargaItems,
                                setCargaItems,
                                item.id,
                                "quantity",
                                value,
                              )
                            }
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            removeListItem(cargaItems, setCargaItems, item.id)
                          }
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                          aria-label="Quitar producto"
                        >
                          <Minus className="h-5 w-5" />
                        </button>
                      </m.div>
                    ))}
                  </AnimatePresence>
                  <m.button
                    layout
                    type="button"
                    onClick={() =>
                      setCargaItems((prev) => [...prev, createItem()])
                    }
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-base font-semibold text-white hover:bg-slate-800"
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar producto
                  </m.button>
                </m.div>
                <div className="space-y-1">
                  <label
                    htmlFor="carga-notes"
                    className="text-xs font-semibold text-slate-600"
                  >
                    Notas
                  </label>
                  <textarea
                    id="carga-notes"
                    value={cargaNotes}
                    onChange={(event) => setCargaNotes(event.target.value)}
                    rows={2}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="Notas"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCargaOpen(false)}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await handleCargaSubmit();
                      if (ok) setIsCargaOpen(false);
                    }}
                    disabled={isSaving}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    Registrar salida
                  </button>
                </div>
              </m.div>
            ) : null}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      <Dialog open={isManualOpen} onOpenChange={setIsManualOpen}>
        <DialogContent className="w-[92vw] max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Registrar ajuste manual</DialogTitle>
          </DialogHeader>
          <AnimatePresence mode="popLayout" initial={false}>
            {isManualOpen ? (
              <m.div
                key="manual-dialog-content"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={dialogBodySpring}
                className="space-y-4"
              >
                <m.div
                  layout
                  className="space-y-1"
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                >
                  <label
                    htmlFor="manual-date"
                    className="text-xs font-semibold text-slate-600"
                  >
                    Fecha
                  </label>
                  <input
                    id="manual-date"
                    type="date"
                    value={manualDate}
                    onChange={(event) => setManualDate(event.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </m.div>
                <m.div
                  layout
                  className="space-y-2"
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                >
                  <p className="text-xs font-semibold text-slate-600">
                    Dirección
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {MANUAL_DIRECTION_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const isSelected = manualDirection === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setManualDirection(option.value)}
                          className={cn(
                            "relative flex flex-col rounded-lg border p-3 text-left transition-all",
                            isSelected
                              ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                              : "border-slate-200 bg-white hover:border-slate-300",
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <Icon
                              className={cn(
                                "h-5 w-5",
                                isSelected
                                  ? "text-slate-900"
                                  : "text-slate-400",
                              )}
                            />
                            <div
                              className={cn(
                                "flex h-4 w-4 items-center justify-center rounded-full border",
                                isSelected
                                  ? "border-slate-900 bg-slate-900"
                                  : "border-slate-300 bg-white",
                              )}
                            >
                              {isSelected && (
                                <div className="h-1.5 w-1.5 rounded-full bg-white" />
                              )}
                            </div>
                          </div>
                          <span
                            className={cn(
                              "mt-4 text-sm font-medium",
                              isSelected ? "text-slate-900" : "text-slate-600",
                            )}
                          >
                            {option.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </m.div>
                <m.div
                  layout
                  className="space-y-2"
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                >
                  <p className="text-xs font-semibold text-slate-600">Tipo</p>
                  <div className="grid grid-cols-3 gap-2">
                    {BODEGA_MOVEMENT_TYPES.map((type) => {
                      const Icon = MANUAL_MOVEMENT_ICON[type];
                      const isSelected = manualMovementType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setManualMovementType(type)}
                          className={cn(
                            "relative flex flex-col rounded-lg border p-3 text-left transition-all",
                            isSelected
                              ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                              : "border-slate-200 bg-white hover:border-slate-300",
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <Icon
                              className={cn(
                                "h-5 w-5",
                                isSelected
                                  ? "text-slate-900"
                                  : "text-slate-400",
                              )}
                            />
                            <div
                              className={cn(
                                "flex h-4 w-4 items-center justify-center rounded-full border",
                                isSelected
                                  ? "border-slate-900 bg-slate-900"
                                  : "border-slate-300 bg-white",
                              )}
                            >
                              {isSelected && (
                                <div className="h-1.5 w-1.5 rounded-full bg-white" />
                              )}
                            </div>
                          </div>
                          <span
                            className={cn(
                              "mt-4 text-sm font-medium break-words",
                              isSelected ? "text-slate-900" : "text-slate-600",
                            )}
                          >
                            {type}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </m.div>
                <m.div
                  layout
                  className="space-y-3"
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                >
                  <div className="space-y-1">
                    <label
                      htmlFor="manual-product"
                      className="text-xs font-semibold text-slate-600"
                    >
                      Producto
                    </label>
                    <select
                      id="manual-product"
                      value={manualProduct}
                      onChange={(event) => setManualProduct(event.target.value)}
                      className="w-full border border-slate-200 rounded-lg pl-3 pr-10 py-2 text-sm"
                    >
                      <option value="">Producto</option>
                      {productOptions.map((product) => (
                        <option key={product} value={product}>
                          {product}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="manual-quantity"
                      className="text-xs font-semibold text-slate-600"
                    >
                      Cantidad
                    </label>
                    <QuantityStepper
                      id="manual-quantity"
                      value={manualQuantity}
                      onChange={setManualQuantity}
                    />
                  </div>
                </m.div>
                <m.div
                  layout
                  className="space-y-1"
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                >
                  <label
                    htmlFor="manual-notes"
                    className="text-xs font-semibold text-slate-600"
                  >
                    Notas
                  </label>
                  <textarea
                    id="manual-notes"
                    value={manualNotes}
                    onChange={(event) => setManualNotes(event.target.value)}
                    rows={2}
                    className="w-full border border-slate-200 rounded-lg pl-3 pr-10 py-2 text-sm"
                    placeholder="Notas"
                  />
                </m.div>
                <m.div
                  layout
                  className="flex justify-end gap-2"
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                >
                  <button
                    type="button"
                    onClick={() => setIsManualOpen(false)}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await handleManualSubmit();
                      if (ok) setIsManualOpen(false);
                    }}
                    disabled={isSaving}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    Guardar movimiento
                  </button>
                </m.div>
              </m.div>
            ) : null}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar movimiento</DialogTitle>
          </DialogHeader>
          <AnimatePresence mode="popLayout" initial={false}>
            {editForm && isEditOpen ? (
              <m.div
                key={`edit-dialog-content-${editForm.id}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={dialogBodySpring}
                className="space-y-3"
              >
                <div className="space-y-1">
                  <label
                    htmlFor="edit-bodega-date"
                    className="text-xs font-semibold text-slate-600"
                  >
                    Fecha
                  </label>
                  <input
                    id="edit-bodega-date"
                    type="date"
                    value={editForm.date}
                    onChange={(event) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, date: event.target.value } : prev,
                      )
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="edit-bodega-product"
                    className="text-xs font-semibold text-slate-600"
                  >
                    Producto
                  </label>
                  <select
                    id="edit-bodega-product"
                    value={editForm.product}
                    onChange={(event) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, product: event.target.value } : prev,
                      )
                    }
                    className="w-full border border-slate-200 rounded-lg pl-3 pr-10 py-2 text-sm"
                  >
                    {productOptions.map((product) => (
                      <option key={product} value={product}>
                        {product}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="edit-bodega-quantity"
                      className="text-xs font-semibold text-slate-600"
                    >
                      Cantidad
                    </label>
                    <input
                      id="edit-bodega-quantity"
                      type="number"
                      value={editForm.quantity}
                      onChange={(event) =>
                        setEditForm((prev) =>
                          prev
                            ? { ...prev, quantity: event.target.value }
                            : prev,
                        )
                      }
                      className="w-full border border-slate-200 rounded-lg pl-3 pr-10 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="edit-bodega-direction"
                      className="text-xs font-semibold text-slate-600"
                    >
                      Dirección
                    </label>
                    <select
                      id="edit-bodega-direction"
                      value={editForm.direction}
                      onChange={(event) =>
                        setEditForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                direction: event.target.value as
                                  | "Entrada"
                                  | "Salida",
                              }
                            : prev,
                        )
                      }
                      className="w-full border border-slate-200 rounded-lg pl-3 pr-10 py-2 text-sm"
                      disabled={editForm.linkStatus === "linked"}
                    >
                      <option value="Entrada">Entrada</option>
                      <option value="Salida">Salida</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="edit-bodega-type"
                    className="text-xs font-semibold text-slate-600"
                  >
                    Tipo
                  </label>
                  <select
                    id="edit-bodega-type"
                    value={editForm.movementType}
                    onChange={(event) =>
                      setEditForm((prev) =>
                        prev
                          ? { ...prev, movementType: event.target.value }
                          : prev,
                      )
                    }
                    className="w-full border border-slate-200 rounded-lg pl-3 pr-10 py-2 text-sm"
                    disabled={editForm.linkStatus === "linked"}
                  >
                    {BODEGA_MOVEMENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="edit-bodega-notes"
                    className="text-xs font-semibold text-slate-600"
                  >
                    Notas
                  </label>
                  <textarea
                    id="edit-bodega-notes"
                    rows={3}
                    value={editForm.notes}
                    onChange={(event) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, notes: event.target.value } : prev,
                      )
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                {editForm.linkStatus === "linked" && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Este movimiento está ligado a Inventario Carro. Los cambios
                    se sincronizan automáticamente.
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditOpen(false)}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleEditSubmit}
                    disabled={isSaving}
                    className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-60"
                  >
                    Guardar cambios
                  </button>
                </div>
              </m.div>
            ) : null}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  );
}
