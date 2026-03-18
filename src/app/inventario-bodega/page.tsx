"use client";

import {
  Minus,
  Package,
  PackagePlus,
  Plus,
  Printer,
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
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import AppHeader from "@/components/AppHeader";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/coss-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { EMAIL_TO_VENDOR_LABELS, isInventarioCarroAdmin } from "@/utils/auth";
import { getBoxBreakdown } from "@/utils/bodegaPrint";
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

type SelectOption = {
  label: string;
  value: string;
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

type HistoryBatch = {
  id: string;
  createdAt: string;
  date: string;
  direction: "Entrada" | "Salida";
  movementType: string;
  sellerEmail: string;
  notes: string;
  productCount: number;
  totalQuantity: number;
  productSummary: string;
  hasLinkedEntries: boolean;
  allLinkedEntries: boolean;
  items: BodegaLedgerRow[];
};

type PrintDisplayMode = "pieces-and-boxes" | "pieces-only";

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

const PRINT_DISPLAY_MODE_ITEMS: readonly SelectOption[] = [
  {
    label: "Piezas + Cajas",
    value: "pieces-and-boxes",
  },
  {
    label: "Solo piezas",
    value: "pieces-only",
  },
];

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

type InventorySelectProps = {
  items: readonly SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  labelId?: string;
  size?: "sm" | "default" | "lg";
  disabled?: boolean;
  wrapperClassName?: string;
};

const InventorySelect = ({
  items,
  value,
  onValueChange,
  placeholder,
  label,
  labelId,
  size = "default",
  disabled = false,
  wrapperClassName,
}: InventorySelectProps) => (
  <div className={cn(label ? "space-y-1" : undefined, wrapperClassName)}>
    {label && labelId ? (
      <span id={labelId} className="text-sm font-medium text-slate-600">
        {label}
      </span>
    ) : null}
    <Select
      disabled={disabled}
      items={items}
      value={value}
      onValueChange={(nextValue) => onValueChange(nextValue ?? "")}
    >
      <SelectTrigger aria-labelledby={labelId} size={size}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectPopup>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  </div>
);

const getHistoryBatchKey = (row: BodegaLedgerRow) => {
  if (!row.createdAt) return `single:${row.id}`;

  return [
    row.createdAt,
    row.date,
    row.direction,
    row.movementType,
    row.sellerEmail,
    row.notes,
    row.linkStatus,
    row.overrideReason,
  ].join("::");
};

const summarizeBatchProducts = (items: BodegaLedgerRow[]) => {
  const uniqueProducts = Array.from(new Set(items.map((item) => item.product)));

  if (uniqueProducts.length <= 3) {
    return uniqueProducts.join(", ");
  }

  return `${uniqueProducts.slice(0, 3).join(", ")} +${uniqueProducts.length - 3}`;
};

const getBatchSortTime = (batch: HistoryBatch) => {
  const createdAtTime = Date.parse(batch.createdAt);
  if (Number.isFinite(createdAtTime)) return createdAtTime;

  const dateTime = Date.parse(`${batch.date}T12:00:00`);
  return Number.isFinite(dateTime) ? dateTime : 0;
};

const formatTimestampLabel = (value: string) => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "";

  return new Date(parsed).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const getBatchReferenceLabel = (notes: string) => {
  const trimmed = notes.trim();
  return trimmed || "Movimiento sin referencia";
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
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [batchToPrint, setBatchToPrint] = useState<HistoryBatch | null>(null);
  const [printHeader, setPrintHeader] = useState("");
  const [printDisplayMode, setPrintDisplayMode] =
    useState<PrintDisplayMode>("pieces-and-boxes");
  const [isPrintPending, setIsPrintPending] = useState(false);
  const [printContainer, setPrintContainer] = useState<HTMLDivElement | null>(
    null,
  );

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
  const [manualMovementType, setManualMovementType] =
    useState<(typeof BODEGA_MOVEMENT_TYPES)[number]>("Ajuste");
  const [manualItems, setManualItems] = useState<FormItem[]>([createItem()]);
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
    const names = new Set<string>(PRODUCT_NAMES);
    rows.forEach((row) => {
      if (row.product) names.add(row.product);
    });
    return Array.from(names);
  }, [rows]);
  const periodSelectItems = useMemo<SelectOption[]>(
    () =>
      availablePeriods.map((period) => ({
        label: `P${period.periodNumber} (${period.label})`,
        value: String(period.periodNumber),
      })),
    [availablePeriods],
  );
  const weekSelectItems = useMemo<SelectOption[]>(
    () =>
      periodWeeks.map((week) => ({
        label: week.label,
        value: String(week.weekNumber),
      })),
    [periodWeeks],
  );
  const sellerSelectItems = useMemo<SelectOption[]>(
    () => [
      { label: "Selecciona vendedor", value: "" },
      ...sellerOptions.map(([email, label]) => ({ label, value: email })),
    ],
    [sellerOptions],
  );
  const productSelectItems = useMemo<SelectOption[]>(
    () => [
      { label: "Producto", value: "" },
      ...productOptions.map((product) => ({ label: product, value: product })),
    ],
    [productOptions],
  );
  const editProductSelectItems = useMemo<SelectOption[]>(
    () =>
      productOptions.map((product) => ({
        label: product,
        value: product,
      })),
    [productOptions],
  );
  const manualDirectionSelectItems = useMemo<SelectOption[]>(
    () =>
      MANUAL_DIRECTION_OPTIONS.map((option) => ({
        label: option.label,
        value: option.value,
      })),
    [],
  );
  const manualMovementTypeSelectItems = useMemo<SelectOption[]>(
    () =>
      BODEGA_MOVEMENT_TYPES.map((type) => ({
        label: type,
        value: type,
      })),
    [],
  );

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

  useEffect(() => {
    const container = document.createElement("div");
    container.className = "print-root";
    document.body.appendChild(container);
    setPrintContainer(container);

    return () => {
      document.body.removeChild(container);
    };
  }, []);

  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove("print-mode");
      setIsPrintDialogOpen(false);
      setIsPrintPending(false);
      setBatchToPrint(null);
      setPrintHeader("");
      setPrintDisplayMode("pieces-and-boxes");
    };

    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  useEffect(() => {
    if (!batchToPrint || !isPrintPending || !printContainer) return;

    document.body.classList.add("print-mode");
    const timeoutId = window.setTimeout(() => window.print(), 0);

    return () => window.clearTimeout(timeoutId);
  }, [batchToPrint, isPrintPending, printContainer]);

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
      const normalized = buildEntries(manualItems);

      const response = await fetch("/api/inventario-bodega", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: normalized.map((item) => ({
            date: manualDate,
            product: item.product,
            quantity: item.quantity,
            direction: manualDirection,
            movementType: manualMovementType,
            notes: manualNotes,
          })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo registrar movimiento");
      }
      applyWarnings(payload);
      await fetchRows();
      setManualItems([createItem()]);
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

  const historyBatches = useMemo<HistoryBatch[]>(() => {
    const grouped = new Map<string, BodegaLedgerRow[]>();

    rows.forEach((row) => {
      const key = getHistoryBatchKey(row);
      const existing = grouped.get(key);

      if (existing) {
        existing.push(row);
        return;
      }

      grouped.set(key, [row]);
    });

    return Array.from(grouped.entries())
      .map(([id, batchRows]) => {
        const items = [...batchRows].sort((a, b) => a.rowNumber - b.rowNumber);
        const latestRowNumber = Math.max(
          ...items.map((item) => item.rowNumber),
        );
        const firstItem = items[0];
        const hasLinkedEntries = items.some(
          (item) => item.linkStatus === "linked",
        );
        const allLinkedEntries = items.every(
          (item) => item.linkStatus === "linked",
        );

        return {
          id,
          createdAt: firstItem?.createdAt || "",
          date: firstItem?.date || "",
          direction: firstItem?.direction || "Entrada",
          movementType: firstItem?.movementType || "",
          sellerEmail: firstItem?.sellerEmail || "",
          notes: firstItem?.notes || "",
          productCount: items.length,
          totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
          productSummary: summarizeBatchProducts(items),
          hasLinkedEntries,
          allLinkedEntries,
          items,
          latestRowNumber,
        };
      })
      .sort((a, b) => {
        const timeDifference = getBatchSortTime(b) - getBatchSortTime(a);
        if (timeDifference !== 0) return timeDifference;

        return b.latestRowNumber - a.latestRowNumber;
      })
      .map(({ latestRowNumber: _latestRowNumber, ...batch }) => batch);
  }, [rows]);

  const handlePrintBatch = useCallback(
    (batch: HistoryBatch) => {
      if (!printContainer) return;
      setBatchToPrint(batch);
      setPrintHeader(getBatchReferenceLabel(batch.notes));
      setPrintDisplayMode("pieces-and-boxes");
      setIsPrintPending(false);
      setIsPrintDialogOpen(true);
    },
    [printContainer],
  );
  const handlePrintDialogChange = useCallback(
    (open: boolean) => {
      setIsPrintDialogOpen(open);

      if (!open && !isPrintPending) {
        setBatchToPrint(null);
        setPrintHeader("");
        setPrintDisplayMode("pieces-and-boxes");
      }
    },
    [isPrintPending],
  );
  const handleConfirmBatchPrint = useCallback(() => {
    if (!batchToPrint || !printContainer) return;

    setIsPrintDialogOpen(false);
    setIsPrintPending(true);
  }, [batchToPrint, printContainer]);
  const resolvedPrintHeader = batchToPrint
    ? printHeader.trim() || getBatchReferenceLabel(batchToPrint.notes)
    : "";
  const isBoxesColumnVisible = printDisplayMode === "pieces-and-boxes";
  const resolvedPrintModeLabel =
    printDisplayMode === "pieces-and-boxes" ? "Piezas + Cajas" : "Solo piezas";
  const printPortal =
    printContainer && batchToPrint
      ? createPortal(
          <div className="print-page">
            <div style={{ marginBottom: 12 }}>
              <p
                className="print-muted"
                style={{
                  fontSize: 10,
                  margin: 0,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Inventario Bodega
              </p>
              <h1 style={{ fontSize: 16, fontWeight: 700, margin: "4px 0 0" }}>
                Movimiento de Inventario Bodega
              </h1>
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  margin: "6px 0 0",
                }}
              >
                {resolvedPrintHeader}
              </p>
              <p
                className="print-muted"
                style={{ fontSize: 11, margin: "4px 0 0" }}
              >
                {batchToPrint.direction} &middot; {batchToPrint.movementType}{" "}
                &middot; {batchToPrint.date}
              </p>
              {batchToPrint.sellerEmail ? (
                <p
                  className="print-muted"
                  style={{ fontSize: 10, margin: "2px 0 0" }}
                >
                  Vendedor:{" "}
                  {EMAIL_TO_VENDOR_LABELS[batchToPrint.sellerEmail] ||
                    batchToPrint.sellerEmail}
                </p>
              ) : null}
              <p
                className="print-muted"
                style={{ fontSize: 10, margin: "2px 0 0" }}
              >
                Generado:{" "}
                {new Date().toLocaleString("es-MX", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                &middot; {batchToPrint.productCount} producto
                {batchToPrint.productCount === 1 ? "" : "s"} &middot;{" "}
                {batchToPrint.totalQuantity} unidades
              </p>
              {isBoxesColumnVisible ? (
                <p
                  className="print-muted"
                  style={{ fontSize: 10, margin: "2px 0 0" }}
                >
                  Cajas calculadas por producto; los sobrantes se muestran en
                  piezas.
                </p>
              ) : null}
            </div>
            <table className="print-table" style={{ fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Producto</th>
                  <th
                    style={{
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    Piezas
                  </th>
                  {isBoxesColumnVisible ? (
                    <th
                      style={{
                        textAlign: "left",
                        width: "28%",
                      }}
                    >
                      Cajas
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {batchToPrint.items.map((item) => {
                  const boxBreakdown = getBoxBreakdown(
                    item.product,
                    item.quantity,
                  );

                  return (
                    <tr key={item.id} className="print-row">
                      <td>{item.product}</td>
                      <td
                        style={{
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {item.quantity}
                      </td>
                      {isBoxesColumnVisible ? (
                        <td
                          style={{
                            color: boxBreakdown ? "#111827" : "#94a3b8",
                          }}
                        >
                          {boxBreakdown?.display ?? "N/A"}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr
                  className="print-row"
                  style={{
                    fontWeight: 700,
                    borderTop: "2px solid #111827",
                  }}
                >
                  <td>Total</td>
                  <td
                    style={{
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {batchToPrint.totalQuantity}
                  </td>
                  {isBoxesColumnVisible ? <td /> : null}
                </tr>
              </tfoot>
            </table>
          </div>,
          printContainer,
        )
      : null;

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
        <section className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 [text-wrap:balance]">
                Control central de bodega
              </h2>
              <p className="text-xs text-slate-500">
                Semana {selectedWeek} del periodo {selectedPeriod} (
                {selectedWeekCode})
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <m.div whileTap={{ scale: 0.96 }} transition={actionTapSpring}>
                <button
                  type="button"
                  onClick={fetchRows}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200/80 text-sm font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors duration-150"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Actualizar
                </button>
              </m.div>
              <m.div whileTap={{ scale: 0.96 }} transition={actionTapSpring}>
                <button
                  type="button"
                  onClick={() => {
                    setNotice(null);
                    setError(null);
                    setIsProductionOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium shadow-sm shadow-slate-900/20 hover:bg-slate-800 hover:shadow-md hover:shadow-slate-900/25 transition-all duration-150"
                >
                  <PackagePlus className="h-4 w-4" />
                  Producción
                </button>
              </m.div>
              <m.div whileTap={{ scale: 0.96 }} transition={actionTapSpring}>
                <button
                  type="button"
                  onClick={() => {
                    setNotice(null);
                    setError(null);
                    setIsCargaOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium shadow-sm shadow-slate-900/20 hover:bg-slate-800 hover:shadow-md hover:shadow-slate-900/25 transition-all duration-150"
                >
                  <Package className="h-4 w-4" />
                  Salida a Carro
                </button>
              </m.div>
              <m.div whileTap={{ scale: 0.96 }} transition={actionTapSpring}>
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
                <InventorySelect
                  label="Periodo"
                  labelId="bodega-filter-period-label"
                  items={periodSelectItems}
                  value={String(selectedPeriod)}
                  onValueChange={(value) => {
                    const next = Number(value);
                    setSelectedPeriod(next);
                    setSelectedWeek(1);
                  }}
                  size="lg"
                />
              </div>
              <div className="space-y-1">
                <InventorySelect
                  label="Semana"
                  labelId="bodega-filter-week-label"
                  items={weekSelectItems}
                  value={String(selectedWeek)}
                  onValueChange={(value) => setSelectedWeek(Number(value))}
                  size="lg"
                />
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
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {warnings.map((warning) => (
                <div
                  key={`${warning.product}-${warning.resultingStock}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/70 px-2.5 py-1 text-amber-800"
                >
                  <svg
                    className="h-3 w-3 text-amber-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
                  </svg>
                  <span className="font-medium">{warning.product}</span>
                  <span className="tabular-nums text-amber-600">
                    {warning.resultingStock}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-4">
          <div className="rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Stock actual
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-100">
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
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Historial de movimientos
              </h3>
              <p className="text-xs text-slate-500">
                Agrupado por lote para revisar e imprimir entradas o salidas
                completas sin perder el detalle por producto.
              </p>
            </div>
            <div className="overflow-x-auto max-h-[420px] rounded-xl border border-slate-100">
              <table className="min-w-full text-sm">
                <thead className="text-xs text-slate-500">
                  <tr className="text-left border-b border-slate-200">
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Cliente / referencia</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Productos</th>
                    <th className="py-2 pr-3">Cant.</th>
                    <th className="py-2 pr-3">Ligado</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-4 text-center text-slate-400"
                      >
                        Cargando...
                      </td>
                    </tr>
                  )}
                  {!isLoading && historyBatches.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-4 text-center text-slate-400"
                      >
                        Sin movimientos
                      </td>
                    </tr>
                  )}
                  {!isLoading &&
                    historyBatches.map((batch) => {
                      const isExpanded = expandedBatchId === batch.id;

                      return (
                        <Fragment key={batch.id}>
                          <tr className="border-b border-slate-100 align-top">
                            <td className="py-3 pr-3 text-slate-700">
                              <div>{batch.date}</div>
                              {batch.createdAt ? (
                                <div className="text-xs text-slate-400">
                                  {formatTimestampLabel(batch.createdAt)}
                                </div>
                              ) : null}
                            </td>
                            <td className="py-3 pr-3">
                              <div className="font-medium text-slate-900">
                                {getBatchReferenceLabel(batch.notes)}
                              </div>
                              {batch.sellerEmail ? (
                                <div className="text-xs text-slate-500">
                                  {EMAIL_TO_VENDOR_LABELS[batch.sellerEmail] ||
                                    batch.sellerEmail}
                                </div>
                              ) : null}
                            </td>
                            <td className="py-3 pr-3">
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2 py-0.5 text-xs",
                                  batch.direction === "Salida"
                                    ? "bg-rose-50 text-rose-700"
                                    : "bg-emerald-50 text-emerald-700",
                                )}
                              >
                                {batch.direction} · {batch.movementType}
                              </span>
                            </td>
                            <td className="py-3 pr-3">
                              <div className="font-medium text-slate-900">
                                {batch.productCount} producto
                                {batch.productCount === 1 ? "" : "s"}
                              </div>
                              <div className="text-xs text-slate-500">
                                {batch.productSummary}
                              </div>
                            </td>
                            <td className="py-3 pr-3 font-medium tabular-nums text-slate-900">
                              {batch.totalQuantity}
                            </td>
                            <td className="py-3 pr-3">
                              {batch.allLinkedEntries ? (
                                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                                  Si
                                </span>
                              ) : batch.hasLinkedEntries ? (
                                <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                                  Parcial
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                                  No
                                </span>
                              )}
                            </td>
                            <td className="py-3 text-right">
                              <div className="inline-flex flex-wrap items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedBatchId((current) =>
                                      current === batch.id ? null : batch.id,
                                    )
                                  }
                                  className="text-xs text-slate-600 hover:text-slate-900"
                                >
                                  {isExpanded ? "Ocultar" : "Detalle"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePrintBatch(batch)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                  Imprimir lote
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded ? (
                            <tr className="border-b border-slate-100 bg-slate-50/60">
                              <td colSpan={7} className="px-3 py-3">
                                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                  <table className="min-w-full text-sm">
                                    <thead className="text-xs text-slate-500">
                                      <tr className="border-b border-slate-200 text-left">
                                        <th className="py-2 pr-3 pl-3">
                                          Producto
                                        </th>
                                        <th className="py-2 pr-3">Cant.</th>
                                        <th className="py-2 pr-3">Ligado</th>
                                        <th className="py-2 pl-3 pr-3 text-right">
                                          Acciones
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {batch.items.map((row) => (
                                        <tr
                                          key={row.id}
                                          className="border-b border-slate-100 last:border-b-0"
                                        >
                                          <td className="py-2 pr-3 pl-3 text-slate-800">
                                            {row.product}
                                          </td>
                                          <td className="py-2 pr-3 tabular-nums text-slate-700">
                                            {row.quantity}
                                          </td>
                                          <td className="py-2 pr-3">
                                            {row.linkStatus === "linked" ? (
                                              <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                                                Si
                                              </span>
                                            ) : (
                                              <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                                                No
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 pl-3 pr-3 text-right">
                                            <div className="inline-flex items-center gap-2">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleEditOpen(row)
                                                }
                                                className="text-xs text-slate-600 hover:text-slate-900"
                                              >
                                                Editar
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleDelete(row)
                                                }
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
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
      <Dialog open={isPrintDialogOpen} onOpenChange={handlePrintDialogChange}>
        <DialogContent className="w-[92vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>Preparar impresión</DialogTitle>
          </DialogHeader>
          {batchToPrint ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      batchToPrint.direction === "Salida"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-emerald-50 text-emerald-700",
                    )}
                  >
                    {batchToPrint.direction}
                  </span>
                  <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    {batchToPrint.movementType}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {batchToPrint.date}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {batchToPrint.productCount} producto
                  {batchToPrint.productCount === 1 ? "" : "s"} ·{" "}
                  {batchToPrint.totalQuantity} unidades
                </p>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="batch-print-header"
                  className="text-xs font-semibold text-slate-600"
                >
                  Encabezado de impresión
                </label>
                <input
                  id="batch-print-header"
                  type="text"
                  value={printHeader}
                  onChange={(event) => setPrintHeader(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400"
                  placeholder="Ej. Cliente Mostrador - Maria Lopez"
                />
                <p className="text-xs text-slate-500">
                  Se usa como encabezado principal al imprimir este lote.
                </p>
              </div>

              <InventorySelect
                items={PRINT_DISPLAY_MODE_ITEMS}
                value={printDisplayMode}
                onValueChange={(value) =>
                  setPrintDisplayMode(value as PrintDisplayMode)
                }
                label="Formato de impresión"
                labelId="batch-print-display-mode-label"
                placeholder="Selecciona un formato"
                size="sm"
              />
              <p className="-mt-2 text-xs text-slate-500">
                Usa cajas solo en la hoja impresa. El inventario sigue guardando
                piezas como cantidad base.
              </p>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                  Vista rápida
                </p>
                <p className="mt-2 text-sm font-semibold leading-5 text-slate-900 [text-wrap:balance]">
                  {resolvedPrintHeader}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {batchToPrint.direction} · {batchToPrint.movementType} ·{" "}
                  {batchToPrint.date}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Formato: {resolvedPrintModeLabel}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintDialogChange(false)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBatchPrint}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 active:scale-[0.98]"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir lote
                </button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      {printPortal}
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
                        <InventorySelect
                          items={productSelectItems}
                          value={item.product}
                          onValueChange={(value) =>
                            updateListItem(
                              productionItems,
                              setProductionItems,
                              item.id,
                              "product",
                              value,
                            )
                          }
                          placeholder="Producto"
                          size="sm"
                          wrapperClassName="flex-1"
                        />
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
                  <InventorySelect
                    label="Vendedor"
                    labelId="carga-seller-label"
                    items={sellerSelectItems}
                    value={cargaSeller}
                    onValueChange={setCargaSeller}
                    placeholder="Selecciona vendedor"
                  />
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
                        <InventorySelect
                          items={productSelectItems}
                          value={item.product}
                          onValueChange={(value) =>
                            updateListItem(
                              cargaItems,
                              setCargaItems,
                              item.id,
                              "product",
                              value,
                            )
                          }
                          placeholder="Producto"
                          size="sm"
                          wrapperClassName="flex-1"
                        />
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
                  className="space-y-2"
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                >
                  <p className="text-xs font-semibold text-slate-600">
                    Productos
                  </p>
                  <AnimatePresence initial={false}>
                    {manualItems.map((item) => (
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
                        <InventorySelect
                          items={productSelectItems}
                          value={item.product}
                          onValueChange={(value) =>
                            updateListItem(
                              manualItems,
                              setManualItems,
                              item.id,
                              "product",
                              value,
                            )
                          }
                          placeholder="Producto"
                          size="sm"
                          wrapperClassName="flex-1"
                        />
                        <div className="sm:w-36">
                          <QuantityStepper
                            value={item.quantity}
                            onChange={(value) =>
                              updateListItem(
                                manualItems,
                                setManualItems,
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
                            removeListItem(manualItems, setManualItems, item.id)
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
                      setManualItems((prev) => [...prev, createItem()])
                    }
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-base font-semibold text-white hover:bg-slate-800"
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar producto
                  </m.button>
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
                  <InventorySelect
                    label="Producto"
                    labelId="edit-bodega-product-label"
                    items={editProductSelectItems}
                    value={editForm.product}
                    onValueChange={(value) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, product: value } : prev,
                      )
                    }
                  />
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
                    <InventorySelect
                      label="Dirección"
                      labelId="edit-bodega-direction-label"
                      items={manualDirectionSelectItems}
                      value={editForm.direction}
                      onValueChange={(value) =>
                        setEditForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                direction: value as "Entrada" | "Salida",
                              }
                            : prev,
                        )
                      }
                      disabled={editForm.linkStatus === "linked"}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <InventorySelect
                    label="Tipo"
                    labelId="edit-bodega-type-label"
                    items={manualMovementTypeSelectItems}
                    value={editForm.movementType}
                    onValueChange={(value) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, movementType: value } : prev,
                      )
                    }
                    disabled={editForm.linkStatus === "linked"}
                  />
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
