"use client";

import {
  Calendar,
  Camera,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Hash,
  Mail,
  Package,
  Tag,
  User,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AppHeader from "@/components/AppHeader";
import {
  DataTableFilter,
  useDataTableFilters,
} from "@/components/data-table-filter";
import { createColumnConfigHelper } from "@/components/data-table-filter/core/filters";
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

type SelectOptions = {
  codigos: string[];
  vendedores: string[];
  periodos: string[];
};

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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

const sortUniqueValues = (values: string[]): string[] => {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "es", { sensitivity: "base" }),
  );
};

const mergeSelectOptions = (
  primary: string[],
  fallback: string[],
): string[] => {
  return sortUniqueValues([...primary, ...fallback]);
};

const dtf = createColumnConfigHelper<TransactionRecord>();

export default function TransaccionesPage() {
  const { data: session, status } = useSession();
  const sessionEmail = session?.user?.email || "";
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

  const requestControllerRef = useRef<AbortController | null>(null);

  const isMaster = useMemo(() => isMasterAccount(sessionEmail), [sessionEmail]);

  const fallbackSelectOptions = useMemo(
    () => ({
      codigos: sortUniqueValues(rows.map((row) => row.codigo)),
      vendedores: sortUniqueValues(rows.map((row) => row.email)),
      periodos: sortUniqueValues(rows.map((row) => row.periodWeekCode)),
    }),
    [rows],
  );

  const resolvedSelectOptions = useMemo(
    () => ({
      codigos: mergeSelectOptions(
        selectOptions.codigos,
        fallbackSelectOptions.codigos,
      ),
      vendedores: mergeSelectOptions(
        selectOptions.vendedores,
        fallbackSelectOptions.vendedores,
      ),
      periodos: mergeSelectOptions(
        selectOptions.periodos,
        fallbackSelectOptions.periodos,
      ),
    }),
    [fallbackSelectOptions, selectOptions],
  );

  // Build column config with options baked in directly — avoids the options-prop merging layer
  const columnsConfig = useMemo(
    () => [
      dtf
        .date()
        .id("fechaSinHora")
        .accessor((r) => new Date(r.fechaSinHora || Date.now()))
        .displayName("Fecha")
        .icon(Calendar)
        .build(),
      dtf
        .option()
        .id("codigo")
        .accessor((r) => r.codigo)
        .displayName("Codigo")
        .icon(Tag)
        .options(resolvedSelectOptions.codigos.map((c) => ({ label: c, value: c })))
        .build(),
      dtf
        .text()
        .id("clientName")
        .accessor((r) => r.clientName)
        .displayName("Cliente")
        .icon(User)
        .build(),
      dtf
        .option()
        .id("email")
        .accessor((r) => r.email)
        .displayName("Vendedor")
        .icon(Mail)
        .options(
          resolvedSelectOptions.vendedores.map((e) => ({
            label: getVendorLabel(e) ? `${getVendorLabel(e)} (${e})` : e,
            value: e,
          })),
        )
        .build(),
      dtf
        .text()
        .id("saleId")
        .accessor((r) => r.saleId)
        .displayName("Sale ID")
        .icon(Hash)
        .build(),
      dtf
        .number()
        .id("venta")
        .accessor((r) => r.venta)
        .displayName("Total")
        .icon(DollarSign)
        .min(0)
        .max(100000)
        .build(),
      dtf
        .option()
        .id("periodWeekCode")
        .accessor((r) => r.periodWeekCode)
        .displayName("Periodo")
        .icon(Calendar)
        .options(resolvedSelectOptions.periodos.map((p) => ({ label: p, value: p })))
        .build(),
      dtf
        .text()
        .id("monthYearCode")
        .accessor((r) => r.monthYearCode)
        .displayName("Mes")
        .icon(Calendar)
        .build(),
      dtf
        .option()
        .id("hasPhotos")
        .accessor((r) => String(r.hasPhotos))
        .displayName("Fotos")
        .icon(Camera)
        .options([
          { label: "Con fotos", value: "true" },
          { label: "Sin fotos", value: "false" },
        ])
        .build(),
      dtf
        .text()
        .id("product")
        .accessor((r) => r.productEntries.map((e) => e.name).join(" "))
        .displayName("Producto")
        .icon(Package)
        .build(),
    ],
    [resolvedSelectOptions],
  );

  // Faceted min/max for number column derived from current page data
  const dtfFaceted = useMemo(() => {
    const ventas = rows.map((r) => r.venta || 0);
    const maxVenta =
      ventas.length > 0 ? Math.ceil(Math.max(...ventas)) : 100000;
    return { venta: [0, Math.max(maxVenta, 1000)] as [number, number] };
  }, [rows]);

  const {
    columns,
    filters: dtFilters,
    actions,
    strategy,
  } = useDataTableFilters({
    strategy: "server",
    data: rows,
    columnsConfig,
    faceted: dtfFaceted,
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));

    for (const f of dtFilters) {
      switch (f.columnId) {
        case "fechaSinHora": {
          const vals = f.values as Date[];
          if (vals[0]) params.set("from", vals[0].toISOString().split("T")[0]);
          if (vals[1]) params.set("to", vals[1].toISOString().split("T")[0]);
          else if (vals[0])
            params.set("to", vals[0].toISOString().split("T")[0]);
          break;
        }
        case "codigo":
          {
            const values = (f.values as string[]).filter(Boolean);
            if (values.length > 0) {
              params.set("code", values.join(","));
            }
          }
          break;
        case "clientName": {
          const v = (f.values as string[])[0]?.trim();
          if (v) params.set("client", v);
          break;
        }
        case "email":
          {
            const values = (f.values as string[]).filter(Boolean);
            if (values.length > 0) {
              params.set("email", values.join(","));
            }
          }
          break;
        case "saleId": {
          const v = (f.values as string[])[0]?.trim();
          if (v) params.set("saleId", v);
          break;
        }
        case "venta": {
          const [min, max] = f.values as number[];
          if (min != null) params.set("minTotal", String(min));
          if (max != null) params.set("maxTotal", String(max));
          break;
        }
        case "periodWeekCode":
          {
            const values = (f.values as string[]).filter(Boolean);
            if (values.length > 0) {
              params.set("period", values.join(","));
            }
          }
          break;
        case "monthYearCode": {
          const v = (f.values as string[])[0]?.trim();
          if (v) params.set("monthCode", v);
          break;
        }
        case "hasPhotos": {
          const v = (f.values as string[])[0];
          if (v === "true") params.set("hasPhotos", "true");
          else if (v === "false") params.set("hasPhotos", "false");
          break;
        }
        case "product": {
          const v = (f.values as string[])[0]?.trim();
          if (v) params.set("product", v);
          break;
        }
      }
    }

    return params;
  }, [dtFilters]);

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
        const optionCounts = {
          codigos: data.filterOptions?.codigos?.length || 0,
          vendedores: data.filterOptions?.vendedores?.length || 0,
          periodos: data.filterOptions?.periodos?.length || 0,
        };

        if (mode === "reset") {
          console.log("📊 Transacciones filtros recibidos:", {
            fetchedItems: data.items.length,
            total: data.total,
            optionCounts,
          });
        }

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
        <section className="py-2">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900">Filtros</h2>
            <p className="text-xs text-slate-500">
              Mostrando por defecto las ultimas {PAGE_SIZE} transacciones.
            </p>
          </div>

          {lastUpdatedAt ? (
            <DataTableFilter
              columns={columns}
              filters={dtFilters}
              actions={actions}
              strategy={strategy}
            />
          ) : (
            <div className="h-7 w-32 rounded-md bg-slate-100 animate-pulse" />
          )}
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
