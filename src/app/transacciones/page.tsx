"use client";

import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import AppHeader from "@/components/AppHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getVendorLabel, isMasterAccount } from "@/utils/auth";
import type {
  TransactionRecord,
  TransactionsApiResponse,
} from "@/utils/transacciones";

const PAGE_SIZE = 30;

type HasPhotosFilter = "all" | "with" | "without";
type SelectOptions = {
  codigos: string[];
  vendedores: string[];
  periodos: string[];
};

type FilterState = {
  from: string;
  to: string;
  code: string;
  client: string;
  email: string;
  saleId: string;
  minTotal: string;
  maxTotal: string;
  period: string;
  monthCode: string;
  product: string;
  hasPhotos: HasPhotosFilter;
};

const DEFAULT_FILTERS: FilterState = {
  from: "",
  to: "",
  code: "",
  client: "",
  email: "",
  saleId: "",
  minTotal: "",
  maxTotal: "",
  period: "",
  monthCode: "",
  product: "",
  hasPhotos: "all",
};

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebounced(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [value, delayMs]);

  return debounced;
}

const parseTimeLabel = (submissionTime: string): string => {
  if (!submissionTime) return "-";

  const raw = submissionTime.includes(" ")
    ? submissionTime.split(" ")[1] || ""
    : submissionTime;

  if (!raw) return "-";
  return raw.slice(0, 5);
};

const formatDateLabel = (dateRaw: string): string => {
  if (!dateRaw) return "Sin fecha";

  const parsed = new Date(dateRaw);
  if (Number.isNaN(parsed.getTime())) {
    return dateRaw;
  }

  return parsed.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTimeLabel = (isoDate: string): string => {
  if (!isoDate) return "";

  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const inputClassName =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

export default function TransaccionesPage() {
  const { data: session, status } = useSession();
  const sessionEmail = session?.user?.email || "";
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [rows, setRows] = useState<TransactionRecord[]>([]);
  const [selectOptions, setSelectOptions] = useState<SelectOptions>({
    codigos: [],
    vendedores: [],
    periodos: [],
  });
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");
  const [isPending, startTransition] = useTransition();

  const requestControllerRef = useRef<AbortController | null>(null);

  const isMaster = useMemo(() => isMasterAccount(sessionEmail), [sessionEmail]);

  const debouncedClient = useDebouncedValue(filters.client, 250);
  const debouncedSaleId = useDebouncedValue(filters.saleId, 250);
  const debouncedProduct = useDebouncedValue(filters.product, 250);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));

    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.code.trim()) params.set("code", filters.code.trim());
    if (debouncedClient.trim()) params.set("client", debouncedClient.trim());
    if (filters.email.trim()) params.set("email", filters.email.trim());
    if (debouncedSaleId.trim()) params.set("saleId", debouncedSaleId.trim());
    if (filters.minTotal.trim())
      params.set("minTotal", filters.minTotal.trim());
    if (filters.maxTotal.trim())
      params.set("maxTotal", filters.maxTotal.trim());
    if (filters.period.trim()) params.set("period", filters.period.trim());
    if (filters.monthCode.trim())
      params.set("monthCode", filters.monthCode.trim());
    if (debouncedProduct.trim()) params.set("product", debouncedProduct.trim());

    if (filters.hasPhotos === "with") {
      params.set("hasPhotos", "true");
    } else if (filters.hasPhotos === "without") {
      params.set("hasPhotos", "false");
    }

    return params;
  }, [
    debouncedClient,
    debouncedProduct,
    debouncedSaleId,
    filters.code,
    filters.email,
    filters.from,
    filters.hasPhotos,
    filters.maxTotal,
    filters.minTotal,
    filters.monthCode,
    filters.period,
    filters.to,
  ]);

  const fetchTransactions = useCallback(
    async (nextOffset: number, mode: "reset" | "append") => {
      if (mode === "append") {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      setError("");

      requestControllerRef.current?.abort();
      const controller = new AbortController();
      requestControllerRef.current = controller;

      const params = new URLSearchParams(queryParams);
      params.set("offset", String(nextOffset));

      try {
        const response = await fetch(
          `/api/transacciones?${params.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Tu sesión expiró. Inicia sesión de nuevo.");
          }

          if (response.status === 403) {
            throw new Error("Solo cuentas master pueden ver transacciones.");
          }

          throw new Error("No fue posible obtener transacciones.");
        }

        const data = (await response.json()) as TransactionsApiResponse;

        setRows((prev) =>
          mode === "append" ? [...prev, ...data.items] : data.items,
        );
        if (mode === "reset") {
          setSelectOptions({
            codigos: data.filterOptions?.codigos || [],
            vendedores: data.filterOptions?.vendedores || [],
            periodos: data.filterOptions?.periodos || [],
          });
        }
        setOffset(nextOffset);
        setTotal(data.total);
        setHasMore(data.hasMore);
        setLastUpdatedAt(new Date().toISOString());

        if (mode === "reset") {
          setExpandedRows(new Set());
        }
      } catch (fetchError) {
        if ((fetchError as Error).name === "AbortError") {
          return;
        }

        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Error inesperado cargando transacciones.";

        setError(message);

        if (mode === "reset") {
          setRows([]);
          setSelectOptions({ codigos: [], vendedores: [], periodos: [] });
          setTotal(0);
          setHasMore(false);
        }
      } finally {
        if (mode === "append") {
          setIsLoadingMore(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [queryParams],
  );

  useEffect(() => {
    if (!sessionEmail || !isMaster) return;
    fetchTransactions(0, "reset");

    return () => {
      requestControllerRef.current?.abort();
    };
  }, [fetchTransactions, isMaster, sessionEmail]);

  const updateFilter = useCallback((key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleResetFilters = useCallback(() => {
    startTransition(() => {
      setFilters({ ...DEFAULT_FILTERS });
    });
  }, []);

  const handleToggleExpanded = useCallback((rowKey: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoading || isLoadingMore) return;
    fetchTransactions(offset + PAGE_SIZE, "append");
  }, [fetchTransactions, hasMore, isLoading, isLoadingMore, offset]);

  const handleRefresh = useCallback(() => {
    fetchTransactions(0, "reset");
  }, [fetchTransactions]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 text-center max-w-md">
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            Acceso Restringido
          </h1>
          <p className="text-gray-600 mb-4">
            Debes iniciar sesion para acceder a esta pagina.
          </p>
          <Link href="/" className="text-blue-600 hover:underline">
            Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!isMaster) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 text-center max-w-md">
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            Acceso Restringido
          </h1>
          <p className="text-gray-600 mb-4">
            Solo los administradores master pueden acceder a Transacciones.
          </p>
          <Link href="/" className="text-blue-600 hover:underline">
            Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <AppHeader
        title="Transacciones"
        subtitle="Movimientos capturados desde Form_Data"
      />

      <main className="px-4 py-4 max-w-[95rem] mx-auto space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Filtros</h2>
              <p className="text-xs text-slate-500">
                Mostrando por defecto las ultimas {PAGE_SIZE} transacciones.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Limpiar filtros
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isLoading || isLoadingMore}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
                />
                Refrescar
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">
                Fecha desde
              </span>
              <input
                type="date"
                className={inputClassName}
                value={filters.from}
                onChange={(event) => updateFilter("from", event.target.value)}
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">
                Fecha hasta
              </span>
              <input
                type="date"
                className={inputClassName}
                value={filters.to}
                onChange={(event) => updateFilter("to", event.target.value)}
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">Codigo</span>
              <select
                className={inputClassName}
                value={filters.code}
                onChange={(event) => updateFilter("code", event.target.value)}
              >
                <option value="">Todos</option>
                {selectOptions.codigos.map((codigo) => (
                  <option key={codigo} value={codigo}>
                    {codigo}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">
                Cliente
              </span>
              <input
                type="text"
                className={inputClassName}
                placeholder="Nombre del cliente"
                value={filters.client}
                onChange={(event) => updateFilter("client", event.target.value)}
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">
                Vendedor (email)
              </span>
              <select
                className={inputClassName}
                value={filters.email}
                onChange={(event) => updateFilter("email", event.target.value)}
              >
                <option value="">Todos</option>
                {selectOptions.vendedores.map((email) => (
                  <option key={email} value={email}>
                    {getVendorLabel(email)} ({email})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">
                Sale ID
              </span>
              <input
                type="text"
                className={inputClassName}
                placeholder="email|fecha|cliente"
                value={filters.saleId}
                onChange={(event) => updateFilter("saleId", event.target.value)}
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">
                Total minimo
              </span>
              <input
                type="number"
                className={inputClassName}
                placeholder="0"
                value={filters.minTotal}
                onChange={(event) =>
                  updateFilter("minTotal", event.target.value)
                }
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">
                Total maximo
              </span>
              <input
                type="number"
                className={inputClassName}
                placeholder="5000"
                value={filters.maxTotal}
                onChange={(event) =>
                  updateFilter("maxTotal", event.target.value)
                }
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">
                Periodo (AL)
              </span>
              <select
                className={inputClassName}
                value={filters.period}
                onChange={(event) => updateFilter("period", event.target.value)}
              >
                <option value="">Todos</option>
                {selectOptions.periodos.map((periodo) => (
                  <option key={periodo} value={periodo}>
                    {periodo}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">
                Mes codigo (AO)
              </span>
              <input
                type="text"
                className={inputClassName}
                placeholder="NOV_25"
                value={filters.monthCode}
                onChange={(event) =>
                  updateFilter("monthCode", event.target.value)
                }
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">
                Producto
              </span>
              <input
                type="text"
                className={inputClassName}
                placeholder="Michela, Habanero, Chiltepin..."
                value={filters.product}
                onChange={(event) =>
                  updateFilter("product", event.target.value)
                }
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">Fotos</span>
              <select
                className={inputClassName}
                value={filters.hasPhotos}
                onChange={(event) =>
                  updateFilter(
                    "hasPhotos",
                    event.target.value as HasPhotosFilter,
                  )
                }
              >
                <option value="all">Todas</option>
                <option value="with">Con fotos</option>
                <option value="without">Sin fotos</option>
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-600">
              Mostrando <span className="font-semibold">{rows.length}</span> de{" "}
              <span className="font-semibold">{total}</span> transacciones
            </p>
            <div className="text-xs text-slate-500">
              {lastUpdatedAt
                ? `Actualizado: ${formatDateTimeLabel(lastUpdatedAt)}`
                : "Sin datos cargados"}
              {isPending ? " · actualizando filtros..." : ""}
            </div>
          </div>

          {error ? (
            <div className="px-4 py-5 text-sm text-red-700 bg-red-50 border-b border-red-100">
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <div className="px-4 py-8 text-sm text-slate-500 text-center">
              Cargando transacciones...
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-500 text-center">
              No se encontraron transacciones para los filtros seleccionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1300px]">
                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-[70px]">Detalle</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Sale ID</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Codigo</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Productos</TableHead>
                    <TableHead>Fotos</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead>Mes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const rowKey = `${row.saleId}-${row.sheetRowNumber}`;
                    const isExpanded = expandedRows.has(rowKey);

                    return (
                      <Fragment key={rowKey}>
                        <TableRow>
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => handleToggleExpanded(rowKey)}
                              className="inline-flex items-center rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell>
                            {formatDateLabel(row.fechaSinHora)}
                          </TableCell>
                          <TableCell>
                            {parseTimeLabel(row.submissionTime)}
                          </TableCell>
                          <TableCell className="font-mono text-[11px] text-slate-700">
                            {row.saleId}
                          </TableCell>
                          <TableCell className="font-medium text-slate-900">
                            {row.clientName || "-"}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                              {row.codigo || "N/A"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {getVendorLabel(row.email) || row.email}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-slate-900">
                            {currencyFormatter.format(row.venta || 0)}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-slate-700">
                              {row.productCount} productos · {row.productUnits}{" "}
                              uds
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {row.productEntries
                                .slice(0, 2)
                                .map(
                                  (entry) =>
                                    `${entry.name} (${entry.quantity})`,
                                )
                                .join(" · ") || "Sin productos"}
                            </div>
                          </TableCell>
                          <TableCell>{row.photoUrls.length}</TableCell>
                          <TableCell>{row.periodWeekCode || "-"}</TableCell>
                          <TableCell>{row.monthYearCode || "-"}</TableCell>
                        </TableRow>

                        {isExpanded ? (
                          <TableRow>
                            <TableCell colSpan={12} className="bg-slate-50/70">
                              <div className="grid gap-4 lg:grid-cols-2">
                                <div className="space-y-2 text-xs text-slate-700">
                                  <p>
                                    <span className="font-semibold text-slate-900">
                                      submissionId:
                                    </span>{" "}
                                    <span className="font-mono">
                                      {row.submissionId || "-"}
                                    </span>
                                  </p>
                                  <p>
                                    <span className="font-semibold text-slate-900">
                                      Lat/Lng cliente:
                                    </span>{" "}
                                    {row.clientLat || "-"},{" "}
                                    {row.clientLng || "-"}
                                  </p>
                                  <p>
                                    <span className="font-semibold text-slate-900">
                                      Lat/Lng captura:
                                    </span>{" "}
                                    {row.currentLat || "-"},{" "}
                                    {row.currentLng || "-"}
                                  </p>
                                  <p>
                                    <span className="font-semibold text-slate-900">
                                      CLEY flag (AM):
                                    </span>{" "}
                                    {row.cleyOrderValue || "-"}
                                  </p>
                                  <p>
                                    <span className="font-semibold text-slate-900">
                                      Columna D / AN:
                                    </span>{" "}
                                    {row.reservedD || "-"} /{" "}
                                    {row.reservedAN || "-"}
                                  </p>
                                  <p>
                                    <span className="font-semibold text-slate-900">
                                      Row Sheet:
                                    </span>{" "}
                                    {row.sheetRowNumber}
                                  </p>
                                </div>

                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-slate-900">
                                    Productos ({row.productEntries.length})
                                  </p>
                                  {row.productEntries.length > 0 ? (
                                    <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                                      {row.productEntries.map((entry) => (
                                        <div
                                          key={`${rowKey}-${entry.name}`}
                                          className="flex items-center justify-between py-1 text-xs text-slate-700"
                                        >
                                          <span>{entry.name}</span>
                                          <span className="font-semibold">
                                            {entry.quantity}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-500">
                                      Sin productos registrados.
                                    </p>
                                  )}

                                  <div>
                                    <p className="text-xs font-semibold text-slate-900 mb-1">
                                      Fotos ({row.photoUrls.length})
                                    </p>
                                    {row.photoUrls.length > 0 ? (
                                      <div className="flex flex-wrap gap-2">
                                        {row.photoUrls.map((url, index) => (
                                          <a
                                            key={`${rowKey}-photo-${index + 1}`}
                                            href={url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-50"
                                          >
                                            Foto {index + 1}
                                          </a>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-slate-500">
                                        Sin fotos
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {hasMore && !isLoading ? (
            <div className="border-t border-slate-100 px-4 py-3 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {isLoadingMore ? "Cargando..." : "Cargar 30 mas"}
              </button>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
