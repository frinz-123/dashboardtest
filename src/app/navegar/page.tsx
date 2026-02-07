"use client";

import debounce from "lodash.debounce";
import { MapPin, Navigation, X } from "lucide-react";
import dynamic from "next/dynamic";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import SearchInput from "@/components/ui/SearchInput";
import type { Client as NavegarClient, RouteInfo } from "./NavegarMap";

const NavegarMap = dynamic(() => import("./NavegarMap"), { ssr: false });

const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const spreadsheetId = process.env.NEXT_PUBLIC_SPREADSHEET_ID;
const sheetName = process.env.NEXT_PUBLIC_SHEET_NAME;
const DEBUG_FILTER_INTERACTIONS = process.env.NODE_ENV !== "production";

const DAYS_WITHOUT_VISIT = 30;
const DEFAULT_VISIT_DATE = "1/1/2024";

export default function NavegarPage() {
  const [clientNames, setClientNames] = useState<string[]>([]);
  const [clientLocations, setClientLocations] = useState<
    Record<string, { lat: number; lng: number }>
  >({});
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const debouncedSetSearchTerm = useMemo(
    () => debounce(setDebouncedSearchTerm, 300),
    [],
  );
  const [_filteredClients, setFilteredClients] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [_isLoading, setIsLoading] = useState(true);
  const mapRef = useRef<any>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routeMode, setRouteMode] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingRouteClient, setPendingRouteClient] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [selectedClientCode, setSelectedClientCode] = useState<string | null>(
    null,
  );
  const [codigoFilter, setCodigoFilter] = useState<string | null>(null);
  const [codigoDropdownOpen, setCodigoDropdownOpen] = useState(false);
  const codigoChipRef = useRef<HTMLButtonElement>(null);
  const [vendedorFilter, setVendedorFilter] = useState<string | null>(null);
  const [vendedorDropdownOpen, setVendedorDropdownOpen] = useState(false);
  const vendedorChipRef = useRef<HTMLButtonElement>(null);
  const [sinVisitarFilter, setSinVisitarFilter] = useState(false);
  const [sheetRows, setSheetRows] = useState<any[]>([]);
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [_fetchError, setFetchError] = useState<string | null>(null);
  const [_isSheetLoading, setIsSheetLoading] = useState(true);

  // Date filter state
  const [dateFilter, setDateFilter] = useState<{
    type: "single" | "range";
    date?: string; // ISO format YYYY-MM-DD for single
    startDate?: string; // ISO format for range start
    endDate?: string; // ISO format for range end
  } | null>(null);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const dateChipRef = useRef<HTMLButtonElement>(null);
  const [_dateFilterMode, _setDateFilterMode] = useState<"single" | "range">(
    "single",
  );

  // Email filter state
  const [emailFilter, setEmailFilter] = useState<string | null>(null);
  const [emailDropdownOpen, setEmailDropdownOpen] = useState(false);
  const emailChipRef = useRef<HTMLButtonElement>(null);

  // Add filtering state
  const [isFiltering, setIsFiltering] = useState(false);

  // Batch fetch all data from Google Sheets once
  useEffect(() => {
    const fetchAllData = async () => {
      setIsSheetLoading(true);
      setFetchError(null);
      try {
        const response = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:AN?key=${googleApiKey}`,
        );
        if (!response.ok) throw new Error("Failed to fetch client data");
        const data = await response.json();
        setSheetHeaders(data.values[0]);
        setSheetRows(data.values.slice(1));
      } catch (_e) {
        setFetchError("Error al cargar los datos de Google Sheets");
        setSheetRows([]);
      } finally {
        setIsSheetLoading(false);
      }
    };
    fetchAllData();
  }, []);

  // Memoized maps and unique values
  const allClientCodes = useMemo(() => {
    const codigoIndex = sheetHeaders.findIndex(
      (h) => h.toLowerCase() === "codigo",
    );
    return sheetRows
      .map((row) => ({ name: row[0], code: row[codigoIndex] || "" }))
      .filter(
        (row) =>
          row.name && row.code && !row.name.includes("**ARCHIVADO NO USAR**"),
      );
  }, [sheetRows, sheetHeaders]);

  const clientLastEmailMap = useMemo(() => {
    const emailIndex = sheetHeaders.findIndex(
      (h) => h.toLowerCase() === "email",
    );
    const lastEmailMap: Record<string, string> = {};
    for (let i = sheetRows.length - 1; i >= 0; i--) {
      const row = sheetRows[i];
      const name = row[0] || "";
      const email = row[emailIndex] || "";
      if (
        name &&
        email &&
        !lastEmailMap[name] &&
        !name.includes("**ARCHIVADO NO USAR**")
      ) {
        lastEmailMap[name] = email;
      }
    }
    return lastEmailMap;
  }, [sheetRows, sheetHeaders]);

  const clientLastVisitMap = useMemo(() => {
    const fechaIndex = sheetHeaders.findIndex(
      (h) => h.toLowerCase() === "fechasinhora",
    );
    const lastVisitMap: Record<string, string> = {};
    for (let i = sheetRows.length - 1; i >= 0; i--) {
      const row = sheetRows[i];
      const name = row[0] || "";
      const fecha = row[fechaIndex] || "";
      if (
        name &&
        fecha &&
        !lastVisitMap[name] &&
        !name.includes("**ARCHIVADO NO USAR**")
      ) {
        lastVisitMap[name] = fecha;
      }
    }
    return lastVisitMap;
  }, [sheetRows, sheetHeaders]);

  const clientVendedorMapping = useMemo(() => {
    // Column AN is the 40th column (A=1, B=2, ..., AN=40), so index 39
    const vendedorIndex = 39;
    const vendedorMap: Record<string, string> = {};
    for (let i = sheetRows.length - 1; i >= 0; i--) {
      const row = sheetRows[i];
      const name = row[0] || "";
      const vendedor = row[vendedorIndex] || "";
      if (
        name &&
        vendedor &&
        !vendedorMap[name] &&
        !name.includes("**ARCHIVADO NO USAR**")
      ) {
        vendedorMap[name] = vendedor;
      }
    }
    return vendedorMap;
  }, [sheetRows]);

  const uniqueCodes = useMemo(
    () => Array.from(new Set(allClientCodes.map((c) => c.code))),
    [allClientCodes],
  );
  const uniqueVendedorNames = useMemo(() => {
    const uniqueVendedores = Array.from(
      new Set(Object.values(clientVendedorMapping).filter(Boolean)),
    );
    return uniqueVendedores;
  }, [clientVendedorMapping]);

  // Unique emails for filter dropdown
  const uniqueEmails = useMemo(() => {
    const emails = Array.from(
      new Set(Object.values(clientLastEmailMap).filter(Boolean)),
    );
    return emails.sort();
  }, [clientLastEmailMap]);

  // Helper: convert sheet date (MM/DD/YYYY) to ISO (YYYY-MM-DD)
  const sheetDateToISO = (sheetDate: string): string | null => {
    if (!sheetDate) return null;
    const [month, day, year] = sheetDate.split("/").map(Number);
    if (!month || !day || !year) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  // Helper: convert ISO date (YYYY-MM-DD) to Date object at midnight
  const isoToDate = (isoDate: string): Date | null => {
    if (!isoDate) return null;
    const [year, month, day] = isoDate.split("-").map(Number);
    if (!year || !month || !day) return null;
    const d = new Date(year, month - 1, day);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Debounced search
  useEffect(() => {
    debouncedSetSearchTerm(searchTerm);
  }, [searchTerm, debouncedSetSearchTerm]);

  // Filtered clients by search
  const filteredClientsBySearch = useMemo(() => {
    if (!debouncedSearchTerm) return [];
    const searchLower = debouncedSearchTerm.toLowerCase();
    const MAX_RESULTS = 20;
    const results = clientNames
      .filter(
        (name) =>
          name?.toLowerCase().includes(searchLower) &&
          !name.includes("**ARCHIVADO NO USAR**"),
      )
      .slice(0, MAX_RESULTS);
    // Deduplicate search results
    return Array.from(new Set(results));
  }, [debouncedSearchTerm, clientNames]);

  // Utility: get last visit date for a client
  const getLastVisitDate = (name: string) => clientLastVisitMap[name] || null;

  // Utility: check if client is 'sin visitar'
  const isSinVisitar = (name: string) => {
    const fecha = getLastVisitDate(name);
    if (!fecha || fecha === DEFAULT_VISIT_DATE) return true;
    const [month, day, year] = fecha.split("/").map(Number);
    if (!day || !month || !year) return false;
    const lastDate = new Date(year, month - 1, day);
    const now = new Date();
    // Set both dates to midnight to ignore time portion
    lastDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diffDays =
      (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > DAYS_WITHOUT_VISIT;
  };

  // Fetch all client names on load
  useEffect(() => {
    const fetchClientNames = async () => {
      try {
        const response = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:C?key=${googleApiKey}`,
        );
        if (!response.ok) throw new Error("Failed to fetch client data");
        const data = await response.json();
        const clients: Record<string, { lat: number; lng: number }> = {};
        const names = (data.values?.slice(1) || [])
          .map((row: any[]) => {
            const name = row[0];
            if (
              name &&
              row[1] &&
              row[2] &&
              !name.includes("**ARCHIVADO NO USAR**")
            ) {
              clients[name] = {
                lat: parseFloat(row[1]),
                lng: parseFloat(row[2]),
              };
            }
            return name;
          })
          .filter(
            (name: string) => name && !name.includes("**ARCHIVADO NO USAR**"),
          );
        // Double-check deduplication and clean up the client names
        const cleanNames = Array.from(new Set(names.filter(Boolean)));
        setClientNames(cleanNames as string[]);
        setClientLocations(clients);
      } catch (_error) {
        // TODO: handle error UI
        setClientNames([]);
        setClientLocations({});
      } finally {
        setIsLoading(false);
      }
    };
    fetchClientNames();
  }, []);

  // Update selectedClientCode from cached allClientCodes (avoids redundant API call)
  useEffect(() => {
    if (!selectedClient) {
      setSelectedClientCode(null);
      return;
    }
    const clientCode = allClientCodes.find(
      (c) => c.name === selectedClient,
    )?.code;
    setSelectedClientCode(clientCode || null);
  }, [selectedClient, allClientCodes]);

  // Single-pass filtering with Set operations (optimized)
  const filteredNames = useMemo(() => {
    if (
      !codigoFilter &&
      !vendedorFilter &&
      !sinVisitarFilter &&
      !dateFilter &&
      !emailFilter
    ) {
      return null;
    }

    const filteredSet = new Set<string>();

    for (const name of clientNames) {
      if (name.includes("**ARCHIVADO NO USAR**")) continue;

      let matches = true;

      if (codigoFilter) {
        const clientCode = allClientCodes.find((c) => c.name === name)?.code;
        if (clientCode !== codigoFilter) matches = false;
      }

      if (matches && vendedorFilter) {
        if (clientVendedorMapping[name] !== vendedorFilter) matches = false;
      }

      if (matches && sinVisitarFilter) {
        const fecha = clientLastVisitMap[name];
        if (fecha && fecha !== DEFAULT_VISIT_DATE) {
          const [month, day, year] = fecha.split("/").map(Number);
          if (day && month && year) {
            const lastDate = new Date(year, month - 1, day);
            const now = new Date();
            lastDate.setHours(0, 0, 0, 0);
            now.setHours(0, 0, 0, 0);
            const diffDays =
              (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays <= DAYS_WITHOUT_VISIT) matches = false;
          } else {
            matches = false;
          }
        } else {
          matches = false;
        }
      }

      if (matches && dateFilter) {
        const fecha = clientLastVisitMap[name];
        if (!fecha || fecha === DEFAULT_VISIT_DATE) {
          matches = false;
        } else {
          const clientDateISO = sheetDateToISO(fecha);
          if (!clientDateISO) {
            matches = false;
          } else {
            const clientDate = isoToDate(clientDateISO);
            if (!clientDate) {
              matches = false;
            } else if (dateFilter.type === "single" && dateFilter.date) {
              const filterDate = isoToDate(dateFilter.date);
              if (
                !filterDate ||
                clientDate.getTime() !== filterDate.getTime()
              ) {
                matches = false;
              }
            } else if (dateFilter.type === "range") {
              const startDate = dateFilter.startDate
                ? isoToDate(dateFilter.startDate)
                : null;
              const endDate = dateFilter.endDate
                ? isoToDate(dateFilter.endDate)
                : null;
              if (
                (startDate && clientDate < startDate) ||
                (endDate && clientDate > endDate)
              ) {
                matches = false;
              }
            }
          }
        }
      }

      if (matches && emailFilter) {
        if (clientLastEmailMap[name] !== emailFilter) matches = false;
      }

      if (matches) {
        filteredSet.add(name);
      }
    }

    return filteredSet.size > 0 ? Array.from(filteredSet) : null;
  }, [
    codigoFilter,
    vendedorFilter,
    sinVisitarFilter,
    dateFilter,
    emailFilter,
    clientNames,
    allClientCodes,
    clientVendedorMapping,
    clientLastVisitMap,
    clientLastEmailMap,
    isoToDate,
    sheetDateToISO,
  ]);

  // Client counts for filter chips (calculated after filteredNames)
  const codigoClientCount =
    codigoFilter && filteredNames ? filteredNames.length : 0;
  const vendedorClientCount =
    vendedorFilter && filteredNames ? filteredNames.length : 0;
  const sinVisitarClientCount =
    sinVisitarFilter && filteredNames ? filteredNames.length : 0;
  const dateClientCount =
    dateFilter && filteredNames ? filteredNames.length : 0;
  const emailClientCount =
    emailFilter && filteredNames ? filteredNames.length : 0;

  // Debounce filtering state to avoid flashing unfiltered results
  useEffect(() => {
    setIsFiltering(true);
    const handler = setTimeout(() => setIsFiltering(false), 350);
    return () => clearTimeout(handler);
  }, []);

  // Check if any filters are active
  const hasActiveFilters = Boolean(
    codigoFilter ||
      vendedorFilter ||
      sinVisitarFilter ||
      dateFilter ||
      emailFilter,
  );

  // Get the final filtered client list with visit dates
  const filteredClientsWithDates = useMemo(() => {
    if (!hasActiveFilters) return [];

    const clients = filteredNames || [];
    const result = clients
      .map((name) => ({
        name,
        lastVisitDate: getLastVisitDate(name),
        isSinVisitar: isSinVisitar(name),
      }))
      .sort((a, b) => {
        // Sort by visit date, with no visits first, then by date descending
        if (!a.lastVisitDate && !b.lastVisitDate)
          return a.name.localeCompare(b.name);
        if (!a.lastVisitDate) return -1;
        if (!b.lastVisitDate) return 1;
        return (
          new Date(b.lastVisitDate).getTime() -
          new Date(a.lastVisitDate).getTime()
        );
      });

    return result;
  }, [filteredNames, hasActiveFilters, getLastVisitDate, isSinVisitar]);

  // Format date for display
  const formatVisitDate = (dateStr: string | null) => {
    if (!dateStr || dateStr === DEFAULT_VISIT_DATE) return "Sin visitas";

    try {
      // Parse as MM/DD/YYYY format (month/day/year)
      const [month, day, year] = dateStr.split("/").map(Number);
      const _date = new Date(year, month - 1, day);

      // Format as "15 Mar 2024"
      const monthNames = [
        "Ene",
        "Feb",
        "Mar",
        "Abr",
        "May",
        "Jun",
        "Jul",
        "Ago",
        "Sep",
        "Oct",
        "Nov",
        "Dic",
      ];

      return `${day} ${monthNames[month - 1]} ${year}`;
    } catch {
      return "Fecha inválida";
    }
  };

  // Prepare client list for map (memoized to avoid remapping on every render)
  const clientList: NavegarClient[] = useMemo(() => {
    const names =
      filteredNames || (searchTerm ? filteredClientsBySearch : clientNames);
    return names
      .map((name) => {
        const clientCode = allClientCodes.find((c) => c.name === name)?.code;
        return {
          name,
          lat: clientLocations[name]?.lat,
          lng: clientLocations[name]?.lng,
          codigo: clientCode,
        };
      })
      .filter((c) => c.lat && c.lng);
  }, [
    filteredNames,
    searchTerm,
    filteredClientsBySearch,
    clientNames,
    allClientCodes,
    clientLocations,
  ]);

  // Only show selected client if it is in the filtered list
  const selectedClientLocation =
    selectedClient &&
    clientLocations[selectedClient] &&
    (!filteredNames || filteredNames.includes(selectedClient))
      ? clientLocations[selectedClient]
      : null;

  // Handle refresh location
  const _handleRefreshLocation = async () => {
    if (mapRef.current?.refreshLocation) {
      setIsLocating(true);
      await mapRef.current.refreshLocation();
      setIsLocating(false);
    }
  };

  // Listen for user location updates from map
  const handleUserLocationChange = (
    loc: { lat: number; lng: number } | null,
  ) => {
    setUserLocation(loc);
  };

  // Handle Navegar button click
  const handleNavigate = async () => {
    if (mapRef.current && selectedClientLocation) {
      setIsLocating(true);
      // Get a fresh, accurate location
      const loc = await mapRef.current.getAccurateLocation();
      setUserLocation(loc);
      setIsLocating(false);
      setShowConfirm(true);
      setPendingRouteClient(selectedClientLocation);
    }
  };

  // Confirm and start route
  const handleConfirmRoute = async () => {
    if (mapRef.current && pendingRouteClient && userLocation) {
      const info = await mapRef.current.fetchRoute(pendingRouteClient);
      setRouteInfo(info);
      setRouteMode(true);
      setShowConfirm(false);
      setPendingRouteClient(null);
    }
  };

  // Cancel route confirmation
  const handleCancelConfirm = () => {
    setShowConfirm(false);
    setPendingRouteClient(null);
  };

  // Handle close route
  const handleCloseRoute = () => {
    setRouteInfo(null);
    setRouteMode(false);
    if (mapRef.current?.clearRoute) {
      mapRef.current.clearRoute();
    }
  };

  // Only show selected client in route mode if it is in the filtered list
  const mapClients =
    routeMode && selectedClient && selectedClientLocation
      ? [
          {
            name: selectedClient,
            lat: selectedClientLocation.lat,
            lng: selectedClientLocation.lng,
            codigo: allClientCodes.find((c) => c.name === selectedClient)?.code,
          },
        ]
      : clientList;

  return (
    <div
      className="relative min-h-screen w-full"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      {/* Fullscreen Map */}
      <div className="fixed inset-0 z-0">
        <NavegarMap
          ref={mapRef}
          clients={mapClients}
          selectedClient={selectedClient}
          onSelectClient={routeMode ? undefined : setSelectedClient}
          onRouteInfo={setRouteInfo}
          onUserLocationChange={handleUserLocationChange}
        />
      </div>
      {/* Bottom sheet */}
      <div className="fixed left-0 right-0 bottom-0 z-10 flex flex-col items-center pointer-events-none">
        {/* Handle */}
        <div className="w-16 h-1.5 bg-gray-300 rounded-full mt-2 mb-3 pointer-events-auto" />
        {/* Filter bar */}
        <div className="w-full max-w-md mx-auto px-4 mb-3 pointer-events-auto">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Codigo filter */}
            <FilterChip
              ref={codigoChipRef}
              label="Código"
              value={codigoFilter}
              count={codigoClientCount}
              isOpen={codigoDropdownOpen}
              onToggle={() => setCodigoDropdownOpen((open) => !open)}
              onClear={() => {
                setCodigoFilter(null);
                setCodigoDropdownOpen(false);
              }}
              icon={<Hash className="w-3.5 h-3.5" />}
            />
            {/* Vendedor filter */}
            <FilterChip
              ref={vendedorChipRef}
              label="Vendedor"
              value={vendedorFilter}
              count={vendedorClientCount}
              isOpen={vendedorDropdownOpen}
              onToggle={() => setVendedorDropdownOpen((open) => !open)}
              onClear={() => {
                setVendedorFilter(null);
                setVendedorDropdownOpen(false);
              }}
              icon={<User className="w-3.5 h-3.5" />}
            />
            {/* Sin Visitar filter */}
            <FilterChip
              label="Sin visitar"
              value={
                sinVisitarFilter ? `${sinVisitarClientCount} clientes` : null
              }
              count={sinVisitarClientCount}
              isOpen={false}
              onToggle={() => setSinVisitarFilter((f) => !f)}
              onClear={() => setSinVisitarFilter(false)}
              icon={<Clock className="w-3.5 h-3.5" />}
            />
            {/* Date filter */}
            <FilterChip
              ref={dateChipRef}
              label="Fecha"
              value={dateFilter ? formatDateFilterValue(dateFilter) : null}
              count={dateClientCount}
              isOpen={dateDropdownOpen}
              onToggle={() => setDateDropdownOpen((open) => !open)}
              onClear={() => {
                setDateFilter(null);
                setDateDropdownOpen(false);
              }}
              icon={<Calendar className="w-3.5 h-3.5" />}
            />
            {/* Email filter */}
            <FilterChip
              ref={emailChipRef}
              label="Email"
              value={emailFilter}
              count={emailClientCount}
              isOpen={emailDropdownOpen}
              onToggle={() => setEmailDropdownOpen((open) => !open)}
              onClear={() => {
                setEmailFilter(null);
                setEmailDropdownOpen(false);
              }}
              icon={<Mail className="w-3.5 h-3.5" />}
            />
          </div>
        </div>
        {/* Dropdowns */}
        {codigoDropdownOpen && (
          <Dropdown
            anchorRef={codigoChipRef}
            onClose={() => setCodigoDropdownOpen(false)}
            align="left"
            debugName="codigo"
          >
            <div className="py-1">
              {uniqueCodes.length > 0 ? (
                uniqueCodes.map((code) => (
                  <button
                    key={code}
                    onClick={() => {
                      setCodigoFilter(code);
                      setCodigoDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between transition-colors ${
                      codigoFilter === code
                        ? "bg-blue-50 text-blue-700"
                        : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <span>{code}</span>
                    {codigoFilter === code && <Check className="w-4 h-4" />}
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-sm text-gray-400 text-center">
                  No hay códigos disponibles
                </div>
              )}
            </div>
          </Dropdown>
        )}
        {vendedorDropdownOpen && (
          <Dropdown
            anchorRef={vendedorChipRef}
            onClose={() => setVendedorDropdownOpen(false)}
            align="left"
            debugName="vendedor"
          >
            <div className="py-1">
              {uniqueVendedorNames.length > 0 ? (
                uniqueVendedorNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => {
                      setVendedorFilter(name);
                      setVendedorDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between transition-colors ${
                      vendedorFilter === name
                        ? "bg-blue-50 text-blue-700"
                        : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <span className="truncate">{name}</span>
                    {vendedorFilter === name && (
                      <Check className="w-4 h-4 flex-shrink-0" />
                    )}
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-sm text-gray-400 text-center">
                  No hay vendedores disponibles
                </div>
              )}
            </div>
          </Dropdown>
        )}
        {dateDropdownOpen && (
          <Dropdown
            anchorRef={dateChipRef}
            onClose={() => setDateDropdownOpen(false)}
            align="left"
            debugName="fecha"
          >
            <div className="p-3 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">
                  Rango de fecha
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    value={dateFilter?.startDate || ""}
                    onChange={(e) => {
                      setDateFilter((prev) => ({
                        type: "range",
                        startDate: e.target.value || undefined,
                        endDate: prev?.endDate,
                      }));
                    }}
                  />
                  <span className="text-gray-400 self-center">→</span>
                  <input
                    type="date"
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    value={dateFilter?.endDate || ""}
                    onChange={(e) => {
                      setDateFilter((prev) => ({
                        type: "range",
                        startDate: prev?.startDate,
                        endDate: e.target.value || undefined,
                      }));
                    }}
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  setDateFilter(null);
                  setDateDropdownOpen(false);
                }}
                className="w-full px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
              >
                Limpiar filtro
              </button>
            </div>
          </Dropdown>
        )}
        {emailDropdownOpen && (
          <Dropdown
            anchorRef={emailChipRef}
            onClose={() => setEmailDropdownOpen(false)}
            align="right"
            debugName="email"
          >
            <div className="py-1">
              {uniqueEmails.length > 0 ? (
                uniqueEmails.map((email) => (
                  <button
                    key={email}
                    onClick={() => {
                      setEmailFilter(email);
                      setEmailDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between transition-colors ${
                      emailFilter === email
                        ? "bg-blue-50 text-blue-700"
                        : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <span className="truncate">{email}</span>
                    {emailFilter === email && (
                      <Check className="w-4 h-4 flex-shrink-0" />
                    )}
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-sm text-gray-400 text-center">
                  No hay emails disponibles
                </div>
              )}
            </div>
          </Dropdown>
        )}
        {/* Main content card */}
        <div className="bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] w-full max-w-md mx-auto p-4 border-t border-gray-100 pointer-events-auto">
          {/* Route Mode UI */}
          {routeMode &&
          selectedClient &&
          selectedClientLocation &&
          routeInfo ? (
            <div className="flex flex-col items-center py-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Navigation className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">En ruta</div>
                  <div className="text-sm text-gray-500">{selectedClient}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>{(routeInfo.distance / 1000).toFixed(1)} km</span>
                </div>
                <div className="flex items-center gap-1 text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>{Math.round(routeInfo.duration / 60)} min</span>
                </div>
              </div>
              <button
                onClick={handleCloseRoute}
                className="mt-4 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cerrar ruta
              </button>
            </div>
          ) : showConfirm && userLocation && pendingRouteClient ? (
            <div className="flex flex-col items-center py-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-green-100 rounded-full">
                  <MapPin className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-sm">
                  <div className="font-medium text-gray-900">
                    Confirmar ubicación
                  </div>
                  <div className="text-gray-500">
                    {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={handleCancelConfirm}
                  className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmRoute}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </div>
          ) : (
            <>
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                onClear={() => {
                  setSearchTerm("");
                  setSelectedClient("");
                  setFilteredClients([]);
                  setRouteInfo(null);
                  setRouteMode(false);
                }}
                placeholder="Buscar cliente..."
                showSparkles={!searchTerm}
              />
              {/* Active filters summary */}
              {hasActiveFilters && (
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500">
                      {filteredClientsWithDates.length} resultado
                      {filteredClientsWithDates.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setCodigoFilter(null);
                      setVendedorFilter(null);
                      setSinVisitarFilter(false);
                      setDateFilter(null);
                      setEmailFilter(null);
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Limpiar todo
                  </button>
                </div>
              )}
              {/* Filtered clients */}
              {hasActiveFilters && (
                <div className="mt-2 border-t border-gray-100 pt-2">
                  <div className="max-h-48 overflow-y-auto -mx-2 px-2">
                    {filteredClientsWithDates.length > 0 ? (
                      filteredClientsWithDates.map((client) => (
                        <button
                          key={client.name}
                          onClick={() => {
                            setSelectedClient(client.name);
                            setRouteInfo(null);
                            setRouteMode(false);
                          }}
                          className={`w-full px-3 py-2.5 text-left rounded-lg transition-all ${
                            selectedClient === client.name
                              ? "bg-gray-900 text-white"
                              : "hover:bg-gray-50 text-gray-900"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium truncate pr-2">
                              {client.name}
                            </span>
                            <span
                              className={`text-xs flex-shrink-0 ${
                                selectedClient === client.name
                                  ? "text-gray-400"
                                  : client.isSinVisitar
                                    ? "text-amber-500"
                                    : "text-gray-400"
                              }`}
                            >
                              {formatVisitDate(client.lastVisitDate)}
                            </span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="py-8 text-center">
                        <SearchX className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                        <p className="text-sm text-gray-500">
                          No se encontraron clientes
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Intenta ajustar los filtros
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* Search results */}
              {!hasActiveFilters && (
                <div className="mt-2">
                  {isFiltering ? (
                    <div className="flex items-center justify-center py-8 gap-2">
                      <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                      <span className="text-sm text-gray-500">Buscando...</span>
                    </div>
                  ) : filteredClientsBySearch.length > 0 ? (
                    <div className="max-h-56 overflow-y-auto -mx-2 px-2">
                      {filteredClientsBySearch.map((name) => (
                        <button
                          key={name}
                          onClick={() => {
                            setSelectedClient(name);
                            setRouteInfo(null);
                            setRouteMode(false);
                          }}
                          className={`w-full px-3 py-2.5 text-left rounded-lg transition-all ${
                            selectedClient === name
                              ? "bg-gray-900 text-white"
                              : "hover:bg-gray-50 text-gray-900"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium truncate pr-2">
                              {name}
                            </span>
                            <span
                              className={`text-xs flex-shrink-0 ${
                                selectedClient === name
                                  ? "text-gray-400"
                                  : isSinVisitar(name)
                                    ? "text-amber-500"
                                    : "text-gray-400"
                              }`}
                            >
                              {formatVisitDate(getLastVisitDate(name))}
                            </span>
                          </div>
                        </button>
                      ))}
                      {searchTerm && filteredClientsBySearch.length >= 20 && (
                        <div className="px-3 py-2 text-xs text-gray-400 text-center">
                          Continúa escribiendo para refinar
                        </div>
                      )}
                    </div>
                  ) : searchTerm ? (
                    <div className="py-8 text-center">
                      <SearchX className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">Sin resultados</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Verifica la ortografía
                      </p>
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <MapPin className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">Busca un cliente</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Selecciona uno para ver opciones
                      </p>
                    </div>
                  )}
                </div>
              )}
              {/* Selected client card */}
              {selectedClient && selectedClientLocation && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <div className="bg-gray-50 rounded-xl p-3 relative">
                    <button
                      onClick={() => {
                        setSelectedClient("");
                        setRouteInfo(null);
                        setRouteMode(false);
                      }}
                      className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-start gap-3 pr-8">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <MapPin className="w-5 h-5 text-gray-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {selectedClient}
                        </div>
                        {selectedClientCode && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            Código: {selectedClientCode}
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-0.5">
                          {selectedClientLocation.lat.toFixed(5)},{" "}
                          {selectedClientLocation.lng.toFixed(5)}
                        </div>
                      </div>
                    </div>
                    {routeInfo && (
                      <div className="mt-3 flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1 text-gray-600">
                          <ArrowRight className="w-4 h-4" />
                          <span>
                            {(routeInfo.distance / 1000).toFixed(1)} km
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span>{Math.round(routeInfo.duration / 60)} min</span>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={handleNavigate}
                        disabled={!selectedClientLocation || isLocating}
                        className="flex-1 py-2.5 px-3 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        {isLocating ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Obteniendo...</span>
                          </>
                        ) : (
                          <>
                            <Navigation className="w-4 h-4" />
                            <span>Navegar</span>
                          </>
                        )}
                      </button>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${selectedClientLocation.lat},${selectedClientLocation.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span className="hidden sm:inline">Maps</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper components for cleaner code
function FilterChip({
  label,
  value,
  count,
  isOpen,
  onToggle,
  onClear,
  icon,
  ref,
}: {
  label: string;
  value: string | null;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  onClear: () => void;
  icon: React.ReactNode;
  ref?: React.RefObject<HTMLButtonElement>;
}) {
  const hasValue = Boolean(value || count > 0);

  return (
    <button
      ref={ref}
      onClick={onToggle}
      type="button"
      className={`
        flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium
        transition-all duration-200 whitespace-nowrap flex-shrink-0
        ${
          hasValue
            ? "bg-gray-900 text-white"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        }
        ${isOpen ? "ring-2 ring-offset-1 ring-gray-300" : ""}
      `}
    >
      <span className={hasValue ? "text-white/80" : "text-gray-500"}>
        {icon}
      </span>
      <span className="truncate max-w-[80px]">{label}</span>
      {count > 0 && (
        <span
          className={`text-xs ${hasValue ? "text-white/70" : "text-gray-400"}`}
        >
          ({count})
        </span>
      )}
      {hasValue && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="ml-0.5 p-0.5 rounded-full hover:bg-white/20 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </button>
  );
}

// Helper: format ISO date for display
function formatISODate(isoDate: string): string {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-").map(Number);
  const monthNames = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  return `${day} ${monthNames[month - 1]} ${year}`;
}

function Dropdown({
  children,
  anchorRef,
  onClose,
  align = "left",
  debugName = "unknown",
}: {
  children: React.ReactNode;
  anchorRef: React.RefObject<HTMLElement>;
  onClose: () => void;
  align?: "left" | "right";
  debugName?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isAnchorClick = anchorRef.current?.contains(target) ?? false;
      const isDropdownClick = panelRef.current?.contains(target) ?? false;
      if (!isAnchorClick && !isDropdownClick) {
        if (DEBUG_FILTER_INTERACTIONS) {
          console.debug(
            `[navegar][filters] dropdown ${debugName} closing from true outside click`,
          );
        }
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [anchorRef, debugName, onClose]);

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full mb-2 z-30 pointer-events-auto"
    >
      <div
        className={`
        bg-white rounded-xl shadow-lg border border-gray-100
        min-w-[200px] max-h-[280px] overflow-y-auto
        animate-in slide-in-from-bottom-2 fade-in duration-200
        ${align === "right" ? "right-0" : "left-0"}
      `}
      >
        {children}
      </div>
    </div>
  );
}

function formatDateFilterValue(
  dateFilter: NonNullable<typeof dateFilter>,
): string {
  if (dateFilter.type === "single" && dateFilter.date) {
    return formatISODate(dateFilter.date);
  }
  if (dateFilter.type === "range") {
    const start = dateFilter.startDate
      ? formatISODate(dateFilter.startDate)
      : "...";
    const end = dateFilter.endDate ? formatISODate(dateFilter.endDate) : "...";
    return `${start} → ${end}`;
  }
  return "";
}

// Icon imports
import {
  ArrowRight,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  Filter,
  Hash,
  Mail,
  SearchX,
  User,
} from "lucide-react";
