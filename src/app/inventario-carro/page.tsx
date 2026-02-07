"use client";

import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Minus,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCcw,
  Settings2,
  Truck,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AppHeader from "@/components/AppHeader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  EMAIL_TO_VENDOR_LABELS,
  getVendorIdentifiers,
  isInventarioCarroAdmin,
  normalizeVendorValue,
} from "@/utils/auth";
import {
  getAllPeriods,
  getCurrentPeriodInfo,
  getPeriodWeeks,
} from "@/utils/dateUtils";
import { PRODUCT_COLUMN_INDEX, PRODUCT_NAMES } from "@/utils/productCatalog";

const EFT_PRICES: Record<string, number> = {
  "Chiltepin Molido 50 g": 48,
  "Chiltepin Molido 20 g": 24,
  "Chiltepin Entero 30 g": 45,
  "Salsa Chiltepin El rey 195 ml": 16,
  "Salsa Especial El Rey 195 ml": 16,
  "Salsa Reina El rey 195 ml": 16,
  "Salsa Habanera El Rey 195 ml": 16,
  "Paquete El Rey": 100,
  "Molinillo El Rey 30 g": 90,
  "Tira Entero": 60,
  "Tira Molido": 55,
  "Salsa chiltepin Litro": 50,
  "Salsa Especial Litro": 50,
  "Salsa Reina Litro": 50,
  "Salsa Habanera Litro": 50,
  "Michela Mix Tamarindo": 30,
  "Michela Mix Mango": 30,
  "Michela Mix Sandia": 30,
  "Michela Mix Fuego": 30,
  "Michela Mix Picafresa": 30,
  "El Rey Mix Original": 60,
  "El Rey Mix Especial": 60,
  "Habanero Molido 50 g": 40,
  "Habanero Molido 20 g": 20,
  "Medio Kilo Chiltepin Entero": 500,
};

const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const spreadsheetId = process.env.NEXT_PUBLIC_SPREADSHEET_ID;
const sheetName = process.env.NEXT_PUBLIC_SHEET_NAME || "Form_Data";
const BASELINE_DATE = "2026-01-31";
const BASELINE_WEEK_KEY = (() => {
  const baselineDate = new Date(`${BASELINE_DATE}T12:00:00`);
  const { periodNumber, weekInPeriod } = getCurrentPeriodInfo(baselineDate);
  return periodNumber * 10 + weekInPeriod;
})();

const MOVEMENT_TYPES = ["InventarioInicial", "Carga", "Ajuste"] as const;

const MOVEMENT_TYPE_CONFIG: Record<
  (typeof MOVEMENT_TYPES)[number],
  { label: string; icon: typeof ClipboardList }
> = {
  InventarioInicial: { label: "Inventario Inicial", icon: ClipboardList },
  Carga: { label: "Carga", icon: Package },
  Ajuste: { label: "Ajuste", icon: Settings2 },
};

type LedgerRow = {
  rowNumber: number;
  id: string;
  date: string;
  periodCode: string;
  weekCode: string;
  sellerEmail: string;
  product: string;
  quantity: number;
  movementType: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type SalesRow = {
  sellerEmail: string;
  weekCode: string;
  date: string;
  products: Record<string, number>;
};

type ProductTraceRow = {
  id: string;
  date: string;
  kind: "Entrada" | "Salida";
  movementType: string;
  quantity: number;
  notes: string;
  weekCode: string;
  ledgerRow?: LedgerRow;
};

type LedgerFormState = {
  rowNumber?: number;
  id?: string;
  date: string;
  sellerEmail: string;
  product: string;
  quantity: string;
  movementType: string;
  notes: string;
  createdBy?: string;
  createdAt?: string;
};

type LedgerFormItem = {
  id: string;
  product: string;
  quantity: string;
};

type AddLedgerFormState = {
  date: string;
  movementType: string;
  notes: string;
  items: LedgerFormItem[];
};

const parseWeekCode = (code: string) => {
  const match = code.match(/P(\d+)S(\d+)/i);
  if (!match) return null;
  return { period: Number(match[1]), week: Number(match[2]) };
};

const getWeekKey = (code: string) => {
  const parsed = parseWeekCode(code);
  if (!parsed) return null;
  return parsed.period * 10 + parsed.week;
};

const isOnOrAfterBaselineWeek = (code: string) => {
  const key = getWeekKey(code);
  return key !== null && key >= BASELINE_WEEK_KEY;
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("es-MX").format(value);

const getDefaultDate = () => new Date().toISOString().split("T")[0] || "";

const createEmptyItem = (): LedgerFormItem => ({
  id: crypto.randomUUID(),
  product: "",
  quantity: "",
});

type ProductComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  inputId?: string;
};

const ProductCombobox = ({
  value,
  onChange,
  options,
  placeholder = "Buscar producto...",
  inputId,
}: ProductComboboxProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const lowerQuery = query.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(lowerQuery));
  }, [options, query]);

  const handleSelect = useCallback(
    (selectedValue: string) => {
      onChange(selectedValue);
      setQuery("");
      setIsOpen(false);
      setHighlightedIndex(0);
    },
    [onChange],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setQuery("");
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedEl = listRef.current.children[
        highlightedIndex
      ] as HTMLElement;
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={query || (isOpen ? "" : value)}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={value || placeholder}
          className={cn(
            "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-base outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400",
            !value && !query && "text-slate-400",
          )}
          autoComplete="off"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setIsOpen(!isOpen);
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {isOpen && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-2 text-base text-slate-500">
              Sin resultados
            </li>
          ) : (
            filteredOptions.map((option, index) => (
              <li
                key={option}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(option);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 px-3 py-2 text-base",
                  index === highlightedIndex && "bg-slate-100",
                  value === option && "font-medium text-slate-900",
                )}
              >
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0",
                    value === option ? "opacity-100" : "opacity-0",
                  )}
                />
                {option}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

type DatePickerProps = {
  value: string; // YYYY-MM-DD format
  onChange: (value: string) => void;
  id?: string;
};

const DAYS_ES = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];
const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const DatePicker = ({ value, onChange, id }: DatePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse value or default to today
  const selectedDate = value ? new Date(`${value}T12:00:00`) : new Date();
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(`${dateStr}T12:00:00`);
    return date.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const newDate = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onChange(newDate);
    setIsOpen(false);
  };

  const isSelectedDay = (day: number) => {
    if (!value) return false;
    const selected = new Date(`${value}T12:00:00`);
    return (
      selected.getDate() === day &&
      selected.getMonth() === viewMonth &&
      selected.getFullYear() === viewYear
    );
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === viewMonth &&
      today.getFullYear() === viewYear
    );
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset view to selected date when opening
  useEffect(() => {
    if (isOpen && value) {
      const date = new Date(`${value}T12:00:00`);
      setViewMonth(date.getMonth());
      setViewYear(date.getFullYear());
    }
  }, [isOpen, value]);

  const daysInMonth = getDaysInMonth(viewMonth, viewYear);
  const firstDay = getFirstDayOfMonth(viewMonth, viewYear);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        id={id}
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-left"
      >
        <span className={value ? "text-slate-900" : "text-slate-400"}>
          {value ? formatDisplayDate(value) : "Seleccionar fecha"}
        </span>
        <Calendar className="h-4 w-4 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          {/* Header */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="rounded p-1 hover:bg-slate-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold">
              {MONTHS_ES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="rounded p-1 hover:bg-slate-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Day headers */}
          <div className="mb-1 grid grid-cols-7 gap-1">
            {DAYS_ES.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-slate-500"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {emptyDays.map((i) => (
              <div key={`empty-${i}`} />
            ))}
            {days.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => handleSelectDay(day)}
                className={cn(
                  "flex h-9 w-full items-center justify-center rounded text-sm",
                  isSelectedDay(day)
                    ? "bg-slate-900 text-white"
                    : isToday(day)
                      ? "bg-slate-100 font-semibold"
                      : "hover:bg-slate-100",
                )}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

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
  const numValue = parseInt(value, 10) || 0;
  const effectiveMin = allowNegative ? -Infinity : min;

  const handleDecrement = () => {
    const newValue = Math.max(effectiveMin, numValue - 1);
    onChange(String(newValue));
  };

  const handleIncrement = () => {
    onChange(String(numValue + 1));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (allowNegative) {
      if (
        inputValue === "" ||
        inputValue === "-" ||
        /^-?\d+$/.test(inputValue)
      ) {
        onChange(inputValue);
      }
    } else {
      if (inputValue === "" || /^\d+$/.test(inputValue)) {
        onChange(inputValue);
      }
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

export default function InventarioCarroPage() {
  const { data: session, status } = useSession();
  const isAdmin = useMemo(
    () => isInventarioCarroAdmin(session?.user?.email),
    [session],
  );
  const currentPeriodInfo = useMemo(() => getCurrentPeriodInfo(), []);
  const availablePeriods = useMemo(() => getAllPeriods().reverse(), []);

  const [selectedPeriod, setSelectedPeriod] = useState<number>(
    currentPeriodInfo.periodNumber,
  );
  const [selectedWeek, setSelectedWeek] = useState<number>(
    currentPeriodInfo.weekInPeriod,
  );
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null);

  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
  const [salesRows, setSalesRows] = useState<SalesRow[]>([]);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);
  const [isSalesLoading, setIsSalesLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [traceProduct, setTraceProduct] = useState<string | null>(null);

  const [printContainer, setPrintContainer] = useState<HTMLDivElement | null>(
    null,
  );

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
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  const handlePrint = () => {
    document.body.classList.add("print-mode");
    setTimeout(() => window.print(), 0);
  };

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddLedgerFormState>({
    date: getDefaultDate(),
    movementType: "Carga",
    notes: "",
    items: [createEmptyItem()],
  });
  const [editForm, setEditForm] = useState<LedgerFormState | null>(null);

  const periodWeeks = useMemo(
    () => getPeriodWeeks(selectedPeriod),
    [selectedPeriod],
  );

  const selectedWeekCode = `P${selectedPeriod}S${selectedWeek}`;
  const selectedWeekKey = selectedPeriod * 10 + selectedWeek;

  const vendorOptions = useMemo(
    () => Object.entries(EMAIL_TO_VENDOR_LABELS),
    [],
  );

  useEffect(() => {
    if (selectedSeller) return;
    const firstSeller = vendorOptions[0]?.[0] || "";
    if (firstSeller) {
      setSelectedSeller(firstSeller);
    }
  }, [selectedSeller, vendorOptions]);

  useEffect(() => {
    if (status !== "authenticated" || !isAdmin) return;
    fetchLedger();
    fetchSales();
  }, [status, isAdmin]);

  const fetchLedger = async () => {
    setIsLedgerLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/inventario-carros");
      if (!response.ok) {
        throw new Error("No se pudo cargar Inventario Carro");
      }
      const data = await response.json();
      setLedgerRows(data.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLedgerLoading(false);
    }
  };

  const fetchSales = async () => {
    if (!googleApiKey || !spreadsheetId) {
      setError("Falta configurar Google Sheets en el entorno");
      return;
    }
    setIsSalesLoading(true);
    try {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:AP?key=${googleApiKey}`,
      );
      const data = await response.json();
      const rows = data.values?.slice(1) || [];
      const parsed: SalesRow[] = rows.map((row: string[]) => {
        const products: Record<string, number> = {};
        PRODUCT_NAMES.forEach((product) => {
          const columnIndex = PRODUCT_COLUMN_INDEX[product];
          const value = row?.[columnIndex];
          const quantity = Number.parseInt(value || "0", 10) || 0;
          if (quantity > 0) {
            products[product] = quantity;
          }
        });
        return {
          sellerEmail: row?.[7] || "",
          weekCode: row?.[37] || "",
          date: row?.[32] || "",
          products,
        };
      });
      setSalesRows(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar ventas");
    } finally {
      setIsSalesLoading(false);
    }
  };

  const handleRefresh = async () => {
    setNotice(null);
    await Promise.all([fetchLedger(), fetchSales()]);
  };

  const handleOpenAdd = () => {
    setNotice(null);
    setAddForm((prev) => ({
      ...prev,
      date: getDefaultDate(),
      movementType: "Carga",
      items: prev.items.length > 0 ? prev.items : [createEmptyItem()],
    }));
    setIsAddOpen(true);
  };

  const handleAddItem = () => {
    setAddForm((prev) => ({
      ...prev,
      items: [...prev.items, createEmptyItem()],
    }));
  };

  const handleRemoveItem = (id: string) => {
    setAddForm((prev) => {
      if (prev.items.length <= 1) {
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.id === id ? { ...item, product: "", quantity: "" } : item,
          ),
        };
      }
      return {
        ...prev,
        items: prev.items.filter((item) => item.id !== id),
      };
    });
  };

  const handleItemChange = (
    id: string,
    field: "product" | "quantity",
    value: string,
  ) => {
    setAddForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const handleAddSubmit = async () => {
    if (!selectedSeller) return;
    const incompleteItem = addForm.items.find(
      (item) =>
        (item.product.trim() && !item.quantity.trim()) ||
        (!item.product.trim() && item.quantity.trim()),
    );
    if (incompleteItem) {
      setNotice("Cada producto debe incluir cantidad");
      return;
    }

    const normalizedItems = addForm.items.filter(
      (item) => item.product.trim() && item.quantity.trim(),
    );

    if (normalizedItems.length === 0) {
      setNotice("Agrega al menos un producto");
      return;
    }

    const invalidQuantity = normalizedItems.find((item) =>
      isNaN(Number(item.quantity)),
    );
    if (invalidQuantity) {
      setNotice("Cantidad inválida");
      return;
    }
    setIsSaving(true);
    setNotice(null);
    try {
      const payload = {
        entries: normalizedItems.map((item) => ({
          date: addForm.date,
          sellerEmail: selectedSeller,
          product: item.product.trim(),
          quantity: Number(item.quantity),
          movementType: addForm.movementType,
          notes: addForm.notes,
        })),
      };
      const response = await fetch("/api/inventario-carros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("No se pudo guardar la carga");
      }
      await fetchLedger();
      setIsAddOpen(false);
      setAddForm({
        date: getDefaultDate(),
        movementType: "Carga",
        notes: "",
        items: [createEmptyItem()],
      });
      setNotice("Carga guardada");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditOpen = (row: LedgerRow) => {
    setNotice(null);
    setEditForm({
      rowNumber: row.rowNumber,
      id: row.id,
      date: row.date,
      sellerEmail: row.sellerEmail,
      product: row.product,
      quantity: String(row.quantity),
      movementType: row.movementType,
      notes: row.notes,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editForm?.rowNumber) return;
    if (!editForm.product || !editForm.quantity) {
      setNotice("Producto y cantidad son requeridos");
      return;
    }
    setIsSaving(true);
    setNotice(null);
    try {
      const payload = {
        rowNumber: editForm.rowNumber,
        entry: {
          id: editForm.id,
          date: editForm.date,
          sellerEmail: editForm.sellerEmail,
          product: editForm.product,
          quantity: Number(editForm.quantity),
          movementType: editForm.movementType,
          notes: editForm.notes,
          createdBy: editForm.createdBy,
          createdAt: editForm.createdAt,
        },
      };
      const response = await fetch("/api/inventario-carros", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("No se pudo actualizar la carga");
      }
      await fetchLedger();
      setIsEditOpen(false);
      setEditForm(null);
      setNotice("Carga actualizada");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeed = async () => {
    if (
      !window.confirm("Esto cargara datos demo en InventarioCarros. Continuar?")
    ) {
      return;
    }
    setIsSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/inventario-carros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || "No se pudo cargar seed");
      }
      await fetchLedger();
      setNotice("Seed listo");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Error al cargar seed");
    } finally {
      setIsSaving(false);
    }
  };

  const productList = useMemo(() => {
    const set = new Set<string>(PRODUCT_NAMES);
    ledgerRows.forEach((row) => {
      if (row.product) set.add(row.product);
    });
    return Array.from(set);
  }, [ledgerRows]);

  const sellerIdentifiers = useMemo(() => {
    if (!selectedSeller) return new Set<string>();
    return getVendorIdentifiers(selectedSeller);
  }, [selectedSeller]);

  const matchesSeller = (value: string) => {
    if (!selectedSeller) return true;
    return sellerIdentifiers.has(normalizeVendorValue(value));
  };

  const ledgerForSeller = useMemo(
    () => ledgerRows.filter((row) => matchesSeller(row.sellerEmail)),
    [ledgerRows, sellerIdentifiers, selectedSeller],
  );

  const salesForSeller = useMemo(
    () => salesRows.filter((row) => matchesSeller(row.sellerEmail)),
    [salesRows, sellerIdentifiers, selectedSeller],
  );

  const ledgerBefore = useMemo(
    () =>
      ledgerForSeller.filter((row) => {
        const key = getWeekKey(row.weekCode);
        return (
          key !== null && key < selectedWeekKey && key >= BASELINE_WEEK_KEY
        );
      }),
    [ledgerForSeller, selectedWeekKey],
  );

  const ledgerInWeek = useMemo(
    () =>
      ledgerForSeller.filter(
        (row) =>
          row.weekCode === selectedWeekCode &&
          isOnOrAfterBaselineWeek(row.weekCode),
      ),
    [ledgerForSeller, selectedWeekCode],
  );

  const salesBefore = useMemo(
    () =>
      salesForSeller.filter((row) => {
        const key = getWeekKey(row.weekCode);
        return (
          key !== null && key < selectedWeekKey && key >= BASELINE_WEEK_KEY
        );
      }),
    [salesForSeller, selectedWeekKey],
  );

  const salesInWeek = useMemo(
    () =>
      salesForSeller.filter(
        (row) =>
          row.weekCode === selectedWeekCode &&
          isOnOrAfterBaselineWeek(row.weekCode),
      ),
    [salesForSeller, selectedWeekCode],
  );

  const createTotals = () =>
    productList.reduce(
      (acc, product) => ({
        ...acc,
        [product]: 0,
      }),
      {} as Record<string, number>,
    );

  const sumLedgerTotals = (rows: LedgerRow[]) => {
    const totals = createTotals();
    rows.forEach((row) => {
      if (!totals[row.product]) {
        totals[row.product] = 0;
      }
      totals[row.product] += row.quantity || 0;
    });
    return totals;
  };

  const sumSalesTotals = (rows: SalesRow[]) => {
    const totals = createTotals();
    rows.forEach((row) => {
      Object.entries(row.products).forEach(([product, quantity]) => {
        if (!totals[product]) {
          totals[product] = 0;
        }
        totals[product] += quantity || 0;
      });
    });
    return totals;
  };

  const ledgerBeforeTotals = useMemo(
    () => sumLedgerTotals(ledgerBefore),
    [ledgerBefore, productList],
  );
  const ledgerWeekTotals = useMemo(
    () => sumLedgerTotals(ledgerInWeek),
    [ledgerInWeek, productList],
  );
  const salesBeforeTotals = useMemo(
    () => sumSalesTotals(salesBefore),
    [salesBefore, productList],
  );
  const salesWeekTotals = useMemo(
    () => sumSalesTotals(salesInWeek),
    [salesInWeek, productList],
  );

  const saldoInicial = useMemo(() => {
    const totals = createTotals();
    productList.forEach((product) => {
      totals[product] =
        (ledgerBeforeTotals[product] || 0) - (salesBeforeTotals[product] || 0);
    });
    return totals;
  }, [ledgerBeforeTotals, salesBeforeTotals, productList]);

  const saldoFinal = useMemo(() => {
    const totals = createTotals();
    productList.forEach((product) => {
      totals[product] =
        (saldoInicial[product] || 0) +
        (ledgerWeekTotals[product] || 0) -
        (salesWeekTotals[product] || 0);
    });
    return totals;
  }, [saldoInicial, ledgerWeekTotals, salesWeekTotals, productList]);

  const totalInicial = Object.values(saldoInicial).reduce(
    (sum, value) => sum + value,
    0,
  );
  const totalEntradas = Object.values(ledgerWeekTotals).reduce(
    (sum, value) => sum + value,
    0,
  );
  const totalSalidas = Object.values(salesWeekTotals).reduce(
    (sum, value) => sum + value,
    0,
  );
  const totalFinal = Object.values(saldoFinal).reduce(
    (sum, value) => sum + value,
    0,
  );

  const valorInventario = useMemo(() => {
    return Object.entries(saldoFinal).reduce((total, [product, quantity]) => {
      const price = EFT_PRICES[product] || 0;
      return total + quantity * price;
    }, 0);
  }, [saldoFinal]);

  const historyRows = useMemo(() => {
    return [...ledgerForSeller].sort((a, b) => b.date.localeCompare(a.date));
  }, [ledgerForSeller]);

  const visibleHistoryRows = useMemo(
    () => (showAllHistory ? historyRows : historyRows.slice(0, 30)),
    [historyRows, showAllHistory],
  );

  const productTraceRows = useMemo(() => {
    if (!traceProduct) return [];
    const ledgerEntries: ProductTraceRow[] = ledgerForSeller
      .filter((row) => row.product === traceProduct)
      .map((row) => ({
        id: `ledger-${row.rowNumber}`,
        date: row.date,
        kind: "Entrada",
        movementType:
          MOVEMENT_TYPE_CONFIG[
            row.movementType as (typeof MOVEMENT_TYPES)[number]
          ]?.label || row.movementType,
        quantity: row.quantity,
        notes: row.notes || "-",
        weekCode: row.weekCode,
        ledgerRow: row,
      }));

    const totalSales = salesWeekTotals[traceProduct] || 0;

    const salesEntries: ProductTraceRow[] = totalSales
      ? [
          {
            id: "sales-total",
            date: "Total",
            kind: "Salida",
            movementType: "Total salidas",
            quantity: totalSales,
            notes: "Solo lectura",
            weekCode: "-",
          },
        ]
      : [];

    return [...ledgerEntries, ...salesEntries].sort((a, b) => {
      const aKey = a.date === "Total" ? "0000-00-00" : a.date;
      const bKey = b.date === "Total" ? "0000-00-00" : b.date;
      return bKey.localeCompare(aKey);
    });
  }, [ledgerForSeller, salesWeekTotals, traceProduct]);

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
      <AppHeader title="Inventario Carro" icon={Truck} />
      <main className="px-4 py-5 max-w-5xl mx-auto space-y-4">
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Inventario semanal por vendedor
              </h2>
              <p className="text-xs text-slate-500">
                Semana {selectedWeek} del periodo {selectedPeriod} · Baseline{" "}
                {BASELINE_DATE}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-100"
              >
                <RefreshCcw className="h-4 w-4" />
                Actualizar
              </button>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-800"
              >
                <PackagePlus className="h-4 w-4" />
                Agregar carga
              </button>
              {ledgerRows.length === 0 && (
                <button
                  type="button"
                  onClick={handleSeed}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Seed demo
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="filter-seller"
                className="text-xs font-semibold text-slate-600"
              >
                Vendedor
              </label>
              <select
                id="filter-seller"
                value={selectedSeller || ""}
                onChange={(event) => setSelectedSeller(event.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                {vendorOptions.map(([email, label]) => (
                  <option key={email} value={email}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="filter-period"
                className="text-xs font-semibold text-slate-600"
              >
                Periodo
              </label>
              <select
                id="filter-period"
                value={selectedPeriod}
                onChange={(event) =>
                  setSelectedPeriod(Number(event.target.value))
                }
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                {availablePeriods.map((period) => (
                  <option key={period.periodNumber} value={period.periodNumber}>
                    P{period.periodNumber} ({period.label})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="filter-week"
                className="text-xs font-semibold text-slate-600"
              >
                Semana
              </label>
              <select
                id="filter-week"
                value={selectedWeek}
                onChange={(event) =>
                  setSelectedWeek(Number(event.target.value))
                }
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                {periodWeeks.map((week) => (
                  <option key={week.weekNumber} value={week.weekNumber}>
                    {week.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(error || notice) && (
            <div className="text-sm text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
              {error || notice}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500">Valor de inventario</p>
          <p className="text-2xl font-semibold text-slate-900">
            ${formatNumber(valorInventario)}
          </p>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Detalle por producto
              </h3>
              <p className="text-xs text-slate-500">
                Entradas incluyen inventario inicial y ajustes.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(isLedgerLoading || isSalesLoading) && (
                <span className="text-xs text-slate-400">Cargando...</span>
              )}
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Imprimir
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="text-left border-b border-slate-200">
                  <th className="py-2 pr-3">Producto</th>
                  <th className="py-2 pr-3">Saldo inicial</th>
                  <th className="py-2 pr-3">Entradas</th>
                  <th className="py-2 pr-3">Salidas</th>
                  <th className="py-2">Saldo final</th>
                </tr>
              </thead>
              <tbody>
                {productList.map((product) => (
                  <tr
                    key={product}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <td className="py-2 pr-3 text-slate-800">
                      <button
                        type="button"
                        onClick={() => setTraceProduct(product)}
                        className="text-left text-slate-800 hover:text-slate-900 hover:underline"
                      >
                        {product}
                      </button>
                    </td>
                    <td className="py-2 pr-3">
                      {formatNumber(saldoInicial[product] || 0)}
                    </td>
                    <td className="py-2 pr-3">
                      {formatNumber(ledgerWeekTotals[product] || 0)}
                    </td>
                    <td className="py-2 pr-3">
                      {formatNumber(salesWeekTotals[product] || 0)}
                    </td>
                    <td className="py-2 font-semibold text-slate-900">
                      {formatNumber(saldoFinal[product] || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Historial reciente
              </h3>
              <p className="text-xs text-slate-500">
                Últimos movimientos del vendedor seleccionado.
              </p>
            </div>
            {historyRows.length > 30 && (
              <button
                type="button"
                onClick={() => setShowAllHistory((prev) => !prev)}
                className="text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                {showAllHistory ? "Ver menos" : "Ver más"}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="text-left border-b border-slate-200">
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Producto</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Cantidad</th>
                  <th className="py-2 pr-3">Notas</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {historyRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-400">
                      Sin movimientos
                    </td>
                  </tr>
                )}
                {visibleHistoryRows.map((row: LedgerRow) => (
                  <tr
                    key={row.rowNumber}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <td className="py-2 pr-3 text-slate-700">{row.date}</td>
                    <td className="py-2 pr-3 text-slate-800">{row.product}</td>
                    <td className="py-2 pr-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                        {row.movementType}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{formatNumber(row.quantity)}</td>
                    <td className="py-2 pr-3 text-slate-500">
                      {row.notes || "-"}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleEditOpen(row)}
                        className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <Dialog
        open={Boolean(traceProduct)}
        onOpenChange={(open) => {
          if (!open) setTraceProduct(null);
        }}
      >
        <DialogContent className="w-[94vw] max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>
              Trazabilidad de producto {traceProduct ? `· ${traceProduct}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Entradas corresponden a cargas, ajustes o inventario inicial. Las
              salidas se muestran en modo lectura.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs text-slate-500">
                  <tr className="text-left border-b border-slate-200">
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Movimiento</th>
                    <th className="py-2 pr-3">Cantidad</th>
                    <th className="py-2 pr-3">Notas</th>
                    <th className="py-2 pr-3">Semana</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {productTraceRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-4 text-center text-slate-400"
                      >
                        Sin movimientos para este producto
                      </td>
                    </tr>
                  )}
                  {productTraceRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 last:border-b-0"
                    >
                      <td className="py-2 pr-3 text-slate-700">{row.date}</td>
                      <td className="py-2 pr-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                          {row.kind}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-700">
                        {row.movementType}
                      </td>
                      <td className="py-2 pr-3">
                        {formatNumber(row.quantity)}
                      </td>
                      <td className="py-2 pr-3 text-slate-500">{row.notes}</td>
                      <td className="py-2 pr-3 text-slate-500">
                        {row.weekCode}
                      </td>
                      <td className="py-2 text-right">
                        {row.kind === "Entrada" && row.ledgerRow ? (
                          <button
                            type="button"
                            onClick={() => handleEditOpen(row.ledgerRow)}
                            className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[92vw] max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Nueva carga</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="add-date"
                className="text-xs font-semibold text-slate-600"
              >
                Fecha
              </label>
              <DatePicker
                id="add-date"
                value={addForm.date}
                onChange={(date) => setAddForm((prev) => ({ ...prev, date }))}
              />
            </div>
            <motion.div
              layout
              className="space-y-3"
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-slate-600">
                  Productos
                </p>
              </div>

              <motion.div
                layout
                className="space-y-2"
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              >
                <AnimatePresence initial={false}>
                  {addForm.items.map((item, index) => (
                    <motion.div
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
                      <div className="flex-1 space-y-1">
                        <label
                          htmlFor={`add-product-${item.id}`}
                          className={cn(
                            "text-xs font-semibold text-slate-600",
                            index > 0 && "sr-only",
                          )}
                        >
                          Producto
                        </label>
                        <ProductCombobox
                          inputId={`add-product-${item.id}`}
                          value={item.product}
                          onChange={(nextValue) =>
                            handleItemChange(item.id, "product", nextValue)
                          }
                          options={productList}
                        />
                      </div>
                      <div className="sm:w-36 space-y-1">
                        <label
                          htmlFor={`add-quantity-${item.id}`}
                          className={cn(
                            "text-xs font-semibold text-slate-600",
                            index > 0 && "sr-only",
                          )}
                        >
                          Cantidad
                        </label>
                        <QuantityStepper
                          id={`add-quantity-${item.id}`}
                          value={item.quantity}
                          onChange={(val) =>
                            handleItemChange(item.id, "quantity", val)
                          }
                          allowNegative={addForm.movementType === "Ajuste"}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                        aria-label="Quitar producto"
                      >
                        <Minus className="h-5 w-5" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>

              <motion.button
                layout
                type="button"
                onClick={handleAddItem}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-base font-semibold text-white hover:bg-slate-800"
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar producto
              </motion.button>
            </motion.div>

            <motion.div
              layout
              className="space-y-2"
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <p className="text-xs font-semibold text-slate-600">Tipo</p>
              <div className="grid grid-cols-3 gap-2">
                {MOVEMENT_TYPES.map((type) => {
                  const config = MOVEMENT_TYPE_CONFIG[type];
                  const Icon = config.icon;
                  const isSelected = addForm.movementType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        setAddForm((prev) => ({ ...prev, movementType: type }))
                      }
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
                            isSelected ? "text-slate-900" : "text-slate-400",
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
                        {config.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
            <motion.div
              layout
              className="space-y-1"
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <label
                htmlFor="add-notes"
                className="text-xs font-semibold text-slate-600"
              >
                Notas
              </label>
              <textarea
                id="add-notes"
                value={addForm.notes}
                onChange={(event) =>
                  setAddForm((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-base"
              />
            </motion.div>
            <motion.div
              layout
              className="flex justify-end gap-2"
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddSubmit}
                disabled={isSaving}
                className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-60"
              >
                Guardar
              </button>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>

      {printContainer
        ? createPortal(
            <div className="print-page">
              <div style={{ marginBottom: 12 }}>
                <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                  Detalle por producto
                </h1>
                <p
                  className="print-muted"
                  style={{ fontSize: 11, margin: "2px 0 0" }}
                >
                  {selectedSeller
                    ? EMAIL_TO_VENDOR_LABELS[selectedSeller] || selectedSeller
                    : ""}{" "}
                  &middot; Semana {selectedWeek} del periodo {selectedPeriod} (
                  {selectedWeekCode})
                </p>
                <p
                  className="print-muted"
                  style={{ fontSize: 10, margin: "2px 0 0" }}
                >
                  Generado:{" "}
                  {new Date().toLocaleString("es-MX", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  &middot; {productList.length} productos
                </p>
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
                      Saldo inicial
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      Entradas
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      Salidas
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      Saldo final
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {productList.map((product) => (
                    <tr key={product} className="print-row">
                      <td>{product}</td>
                      <td
                        style={{
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatNumber(saldoInicial[product] || 0)}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatNumber(ledgerWeekTotals[product] || 0)}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatNumber(salesWeekTotals[product] || 0)}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatNumber(saldoFinal[product] || 0)}
                      </td>
                    </tr>
                  ))}
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
                      {formatNumber(totalInicial)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatNumber(totalEntradas)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatNumber(totalSalidas)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatNumber(totalFinal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              <p className="print-muted" style={{ fontSize: 10, marginTop: 8 }}>
                Valor de inventario: ${formatNumber(valorInventario)}
              </p>
            </div>,
            printContainer,
          )
        : null}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar carga</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="edit-date"
                  className="text-xs font-semibold text-slate-600"
                >
                  Fecha
                </label>
                <DatePicker
                  id="edit-date"
                  value={editForm.date}
                  onChange={(date) =>
                    setEditForm((prev) => (prev ? { ...prev, date } : prev))
                  }
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="edit-product"
                  className="text-xs font-semibold text-slate-600"
                >
                  Producto
                </label>
                <select
                  id="edit-product"
                  value={editForm.product}
                  onChange={(event) =>
                    setEditForm((prev) =>
                      prev ? { ...prev, product: event.target.value } : prev,
                    )
                  }
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  {productList.map((product) => (
                    <option key={product} value={product}>
                      {product}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="edit-quantity"
                    className="text-xs font-semibold text-slate-600"
                  >
                    Cantidad
                  </label>
                  <input
                    id="edit-quantity"
                    type="number"
                    value={editForm.quantity}
                    onChange={(event) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, quantity: event.target.value } : prev,
                      )
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="edit-type"
                    className="text-xs font-semibold text-slate-600"
                  >
                    Tipo
                  </label>
                  <select
                    id="edit-type"
                    value={editForm.movementType}
                    onChange={(event) =>
                      setEditForm((prev) =>
                        prev
                          ? { ...prev, movementType: event.target.value }
                          : prev,
                      )
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  >
                    {MOVEMENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="edit-notes"
                  className="text-xs font-semibold text-slate-600"
                >
                  Notas
                </label>
                <textarea
                  id="edit-notes"
                  value={editForm.notes}
                  onChange={(event) =>
                    setEditForm((prev) =>
                      prev ? { ...prev, notes: event.target.value } : prev,
                    )
                  }
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
