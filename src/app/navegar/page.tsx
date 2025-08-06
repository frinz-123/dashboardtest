'use client';

import React, { useEffect, useState, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import SearchInput from "@/components/ui/SearchInput";
import NavegarMap, { Client as NavegarClient, RouteInfo } from "./NavegarMap";
import { XCircle, Navigation, RefreshCw, MapPin, X } from "lucide-react";
import debounce from "lodash.debounce";

const Map = dynamic(() => import("@/components/ui/Map"), { ssr: false });

const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const spreadsheetId = process.env.NEXT_PUBLIC_SPREADSHEET_ID;
const sheetName = process.env.NEXT_PUBLIC_SHEET_NAME;

const DAYS_WITHOUT_VISIT = 30;
const DEFAULT_VISIT_DATE = '1/1/2024';

export default function NavegarPage() {
  const [clientNames, setClientNames] = useState<string[]>([]);
  const [clientLocations, setClientLocations] = useState<Record<string, { lat: number; lng: number }>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const debouncedSetSearchTerm = useMemo(() => debounce(setDebouncedSearchTerm, 300), []);
  const [filteredClients, setFilteredClients] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const mapRef = useRef<any>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routeMode, setRouteMode] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingRouteClient, setPendingRouteClient] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedClientCode, setSelectedClientCode] = useState<string | null>(null);
  const [codigoFilter, setCodigoFilter] = useState<string | null>(null);
  const [codigoDropdownOpen, setCodigoDropdownOpen] = useState(false);
  const codigoChipRef = useRef<HTMLButtonElement>(null);
  const [vendedorFilter, setVendedorFilter] = useState<string | null>(null);
  const [vendedorDropdownOpen, setVendedorDropdownOpen] = useState(false);
  const vendedorChipRef = useRef<HTMLButtonElement>(null);
  const [clientVendedorMap, setClientVendedorMap] = useState<Record<string, string>>({});
  const [sinVisitarFilter, setSinVisitarFilter] = useState(false);
  const [sheetRows, setSheetRows] = useState<any[]>([]);
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSheetLoading, setIsSheetLoading] = useState(true);

  // Add filtering state
  const [isFiltering, setIsFiltering] = useState(false);



  // Batch fetch all data from Google Sheets once
  useEffect(() => {
    const fetchAllData = async () => {
      setIsSheetLoading(true);
      setFetchError(null);
      try {
        const response = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:AN?key=${googleApiKey}`
        );
        if (!response.ok) throw new Error("Failed to fetch client data");
        const data = await response.json();
        setSheetHeaders(data.values[0]);
        setSheetRows(data.values.slice(1));
      } catch (e) {
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
    const codigoIndex = sheetHeaders.findIndex(h => h.toLowerCase() === 'codigo');
    return sheetRows
      .map(row => ({ name: row[0], code: row[codigoIndex] || '' }))
      .filter(row => row.name && row.code && !row.name.includes('**ARCHIVADO NO USAR**'));
  }, [sheetRows, sheetHeaders]);

  const clientLastEmailMap = useMemo(() => {
    const emailIndex = sheetHeaders.findIndex(h => h.toLowerCase() === 'email');
    const lastEmailMap: Record<string, string> = {};
    for (let i = sheetRows.length - 1; i >= 0; i--) {
      const row = sheetRows[i];
      const name = row[0] || '';
      const email = row[emailIndex] || '';
      if (name && email && !lastEmailMap[name] && !name.includes('**ARCHIVADO NO USAR**')) {
        lastEmailMap[name] = email;
      }
    }
    return lastEmailMap;
  }, [sheetRows, sheetHeaders]);

  const clientLastVisitMap = useMemo(() => {
    const fechaIndex = sheetHeaders.findIndex(h => h.toLowerCase() === 'fechasinhora');
    const lastVisitMap: Record<string, string> = {};
    for (let i = sheetRows.length - 1; i >= 0; i--) {
      const row = sheetRows[i];
      const name = row[0] || '';
      const fecha = row[fechaIndex] || '';
      if (name && fecha && !lastVisitMap[name] && !name.includes('**ARCHIVADO NO USAR**')) {
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
      const name = row[0] || '';
      const vendedor = row[vendedorIndex] || '';
      if (name && vendedor && !vendedorMap[name] && !name.includes('**ARCHIVADO NO USAR**')) {
        vendedorMap[name] = vendedor;
      }
    }
    return vendedorMap;
  }, [sheetRows, sheetHeaders]);

  const uniqueCodes = useMemo(() => Array.from(new Set(allClientCodes.map(c => c.code))), [allClientCodes]);
  const uniqueVendedorNames = useMemo(() => {
    const uniqueVendedores = Array.from(new Set(Object.values(clientVendedorMapping).filter(Boolean)));
    return uniqueVendedores;
  }, [clientVendedorMapping]);

  // Debounced search
  useEffect(() => { debouncedSetSearchTerm(searchTerm); }, [searchTerm, debouncedSetSearchTerm]);

  // Filtered clients by search
  const filteredClientsBySearch = useMemo(() => {
    if (!debouncedSearchTerm) return [];
    const searchLower = debouncedSearchTerm.toLowerCase();
    const MAX_RESULTS = 20;
    const results = clientNames
      .filter(name => name && name.toLowerCase().includes(searchLower) && !name.includes('**ARCHIVADO NO USAR**'))
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
    const [month, day, year] = fecha.split('/').map(Number);
    if (!day || !month || !year) return false;
    const lastDate = new Date(year, month - 1, day);
    const now = new Date();
    // Set both dates to midnight to ignore time portion
    lastDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diffDays = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > DAYS_WITHOUT_VISIT;
  };

  // Fetch client code (Codigo, column AG) when a client is selected
  useEffect(() => {
    const fetchCodigo = async () => {
      if (!selectedClient) {
        setSelectedClientCode(null);
        return;
      }
      try {
        // Fetch the row for the selected client from the sheet
        const response = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:AN?key=${googleApiKey}`
        );
        if (!response.ok) throw new Error("Failed to fetch client data");
        const data = await response.json();
        const headers = data.values[0];
        const codigoIndex = headers.findIndex((h: string) => h.toLowerCase() === 'codigo');
        if (codigoIndex === -1) {
          setSelectedClientCode(null);
          return;
        }
        const clientRow = (data.values as string[][]).find(row => row[0] === selectedClient);
        if (clientRow && clientRow[codigoIndex]) {
          setSelectedClientCode(clientRow[codigoIndex]);
        } else {
          setSelectedClientCode(null);
        }
      } catch (e) {
        setSelectedClientCode(null);
      }
    };
    fetchCodigo();
  }, [selectedClient]);

  // Fetch all client names on load
  useEffect(() => {
    const fetchClientNames = async () => {
      try {
        const response = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:C?key=${googleApiKey}`
        );
        if (!response.ok) throw new Error("Failed to fetch client data");
        const data = await response.json();
        const clients: Record<string, { lat: number; lng: number }> = {};
        const names = (data.values?.slice(1) || []).map((row: any[]) => {
          const name = row[0];
          if (name && row[1] && row[2] && !name.includes('**ARCHIVADO NO USAR**')) {
            clients[name] = {
              lat: parseFloat(row[1]),
              lng: parseFloat(row[2]),
            };
          }
          return name;
        }).filter((name: string) => name && !name.includes('**ARCHIVADO NO USAR**'));
        // Double-check deduplication and clean up the client names
        const cleanNames = Array.from(new Set(names.filter(Boolean)));
        setClientNames(cleanNames as string[]);
        setClientLocations(clients);
      } catch (error) {
        // TODO: handle error UI
        setClientNames([]);
        setClientLocations({});
      } finally {
        setIsLoading(false);
      }
    };
    fetchClientNames();
  }, []);

  // This effect is no longer needed since vendedor data is loaded in fetchAllData
  // Keeping for compatibility but simplified
  useEffect(() => {
    setClientVendedorMap(clientVendedorMapping);
  }, [clientVendedorMapping]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (codigoChipRef.current && !codigoChipRef.current.contains(event.target as Node)) {
        setCodigoDropdownOpen(false);
      }
    }
    if (codigoDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [codigoDropdownOpen]);

  // Close Vendedor dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (vendedorChipRef.current && !vendedorChipRef.current.contains(event.target as Node)) {
        setVendedorDropdownOpen(false);
      }
    }
    if (vendedorDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [vendedorDropdownOpen]);

  // Helper function to apply all filters except the specified one
  const getFilteredClientsExcluding = (excludeFilter: 'codigo' | 'vendedor' | 'sinVisitar') => {
    let baseClients = clientNames;
    
    // Apply código filter if active and not excluded
    if (codigoFilter && excludeFilter !== 'codigo') {
      const codeClients = allClientCodes.filter(c => c.code === codigoFilter).map(c => c.name);
      baseClients = baseClients.filter(name => codeClients.includes(name));
    }
    
    // Apply vendedor filter if active and not excluded
    if (vendedorFilter && excludeFilter !== 'vendedor') {
      const vendedorClients = Object.entries(clientVendedorMapping)
        .filter(([name, vendedor]) => vendedor === vendedorFilter)
        .map(([name]) => name);
      baseClients = baseClients.filter(name => vendedorClients.includes(name));
    }
    
    // Apply sin visitar filter if active and not excluded
    if (sinVisitarFilter && excludeFilter !== 'sinVisitar') {
      const sinVisitarClients = Object.entries(clientLastVisitMap)
        .filter(([name, fecha]) => {
          if (!fecha || fecha === DEFAULT_VISIT_DATE) return true;
          const [month, day, year] = fecha.split('/').map(Number);
          if (!day || !month || !year) return false;
          const lastDate = new Date(year, month - 1, day);
          const now = new Date();
          const diffDays = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
          

          
          return diffDays > DAYS_WITHOUT_VISIT;
        })
        .map(([name]) => name);
      baseClients = baseClients.filter(name => sinVisitarClients.includes(name));
    }
    
    return baseClients;
  };

  // Count clients that match the código filter (considering other active filters)
  const codigoClientCount = codigoFilter 
    ? getFilteredClientsExcluding('codigo').filter(name => {
        const clientCode = allClientCodes.find(c => c.name === name)?.code;
        return clientCode === codigoFilter;
      }).length
    : 0;

  // Count clients that match the vendedor filter (considering other active filters)
  const vendedorClientCount = vendedorFilter 
    ? getFilteredClientsExcluding('vendedor').filter(name => {
        return clientVendedorMapping[name] === vendedorFilter;
      }).length
    : 0;

  // Count clients that match the sin visitar filter (considering other active filters)
  const sinVisitarClientCount = sinVisitarFilter 
    ? getFilteredClientsExcluding('sinVisitar').filter(name => {
        const fecha = clientLastVisitMap[name];
        if (!fecha || fecha === DEFAULT_VISIT_DATE) return true;
        const [month, day, year] = fecha.split('/').map(Number);
        if (!day || !month || !year) return false;
        const lastDate = new Date(year, month - 1, day);
        const now = new Date();
        const diffDays = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
        

        
        return diffDays > DAYS_WITHOUT_VISIT;
      }).length
    : 0;

  // Memoize individual filter results for stable references
  const filteredByCode = useMemo(() => {
    if (!codigoFilter) return null;
    const result = allClientCodes.filter(c => c.code === codigoFilter).map(c => c.name);
    // Deduplicate to prevent duplicate keys
    return Array.from(new Set(result));
  }, [codigoFilter, allClientCodes]);

  const filteredByVendedor = useMemo(() => {
    if (!vendedorFilter) return null;
    const result = Object.entries(clientVendedorMapping)
      .filter(([name, vendedor]) => vendedor === vendedorFilter)
      .map(([name]) => name);
    // Deduplicate to prevent duplicate keys
    return Array.from(new Set(result));
  }, [vendedorFilter, clientVendedorMapping]);

  const filteredBySinVisitar = useMemo(() => {
    if (!sinVisitarFilter) return null;
    
    const result = Object.entries(clientLastVisitMap)
      .filter(([name, fecha]) => {
        if (!fecha || fecha === DEFAULT_VISIT_DATE) return true;
        const [month, day, year] = fecha.split('/').map(Number);
        if (!day || !month || !year) return false;
        const lastDate = new Date(year, month - 1, day);
        const now = new Date();
        // Set both dates to midnight to match isSinVisitar logic
        lastDate.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0);
        const diffDays = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays > DAYS_WITHOUT_VISIT;
      })
      .map(([name]) => name);
    
    // Deduplicate to prevent duplicate keys
    return Array.from(new Set(result));
  }, [sinVisitarFilter, clientLastVisitMap]);

  // Memoize the final filtered names to prevent infinite loops
  const filteredNames = useMemo(() => {
    if (!codigoFilter && !vendedorFilter && !sinVisitarFilter) {
      return null;
    }

    let sets: string[][] = [];
    if (codigoFilter && filteredByCode) {
      sets.push(filteredByCode);
    }
    if (vendedorFilter && filteredByVendedor) {
      sets.push(filteredByVendedor);
    }
    if (sinVisitarFilter && filteredBySinVisitar) {
      sets.push(filteredBySinVisitar);
    }

    if (sets.length === 0) return null;

    // Intersect all sets
    let result = sets.reduce((a, b) => a.filter(x => b.includes(x)));
    
    // CRITICAL: Deduplicate the results to prevent React key warnings
    return Array.from(new Set(result));
  }, [codigoFilter, vendedorFilter, sinVisitarFilter, filteredByCode, filteredByVendedor, filteredBySinVisitar]);

  // Debounce filtering state to avoid flashing unfiltered results
  useEffect(() => {
    setIsFiltering(true);
    const handler = setTimeout(() => setIsFiltering(false), 350);
    return () => clearTimeout(handler);
  }, [filteredNames, searchTerm, sinVisitarFilter, codigoFilter, vendedorFilter, clientNames]);

  // Check if any filters are active
  const hasActiveFilters = Boolean(codigoFilter || vendedorFilter || sinVisitarFilter);

  // Get the final filtered client list with visit dates
  const filteredClientsWithDates = useMemo(() => {
    if (!hasActiveFilters) return [];
    
    const clients = filteredNames || [];
    const result = clients.map(name => ({
      name,
      lastVisitDate: getLastVisitDate(name),
      isSinVisitar: isSinVisitar(name)
    })).sort((a, b) => {
      // Sort by visit date, with no visits first, then by date descending
      if (!a.lastVisitDate && !b.lastVisitDate) return a.name.localeCompare(b.name);
      if (!a.lastVisitDate) return -1;
      if (!b.lastVisitDate) return 1;
      return new Date(b.lastVisitDate).getTime() - new Date(a.lastVisitDate).getTime();
    });
    
    return result;
  }, [filteredNames, hasActiveFilters, clientLastVisitMap, clientNames]);

  // Format date for display
  const formatVisitDate = (dateStr: string | null) => {
    if (!dateStr || dateStr === DEFAULT_VISIT_DATE) return 'Sin visitas';
    
    try {
      // Parse as MM/DD/YYYY format (month/day/year)
      const [month, day, year] = dateStr.split('/').map(Number);
      const date = new Date(year, month - 1, day);
      
      // Format as "15 Mar 2024"
      const monthNames = [
        'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
        'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
      ];
      
      return `${day} ${monthNames[month - 1]} ${year}`;
    } catch {
      return 'Fecha inválida';
    }
  };

  // Prepare client list for map
  const clientList: NavegarClient[] = (filteredNames || (searchTerm ? filteredClientsBySearch : clientNames)).map(
    (name) => ({
      name,
      lat: clientLocations[name]?.lat,
      lng: clientLocations[name]?.lng,
    })
  ).filter((c) => c.lat && c.lng);

  // Only show selected client if it is in the filtered list
  const selectedClientLocation = selectedClient && clientLocations[selectedClient] && (!filteredNames || filteredNames.includes(selectedClient))
    ? clientLocations[selectedClient]
    : null;

  // Handle refresh location
  const handleRefreshLocation = async () => {
    if (mapRef.current && mapRef.current.refreshLocation) {
      setIsLocating(true);
      await mapRef.current.refreshLocation();
      setIsLocating(false);
    }
  };

  // Listen for user location updates from map
  const handleUserLocationChange = (loc: { lat: number; lng: number } | null) => {
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
    if (mapRef.current && mapRef.current.clearRoute) {
      mapRef.current.clearRoute();
    }
  };

  // Only show selected client in route mode if it is in the filtered list
  const mapClients = routeMode && selectedClient && selectedClientLocation
    ? [{ name: selectedClient, lat: selectedClientLocation.lat, lng: selectedClientLocation.lng }]
    : clientList;

  return (
    <div className="relative min-h-screen w-full" style={{ fontFamily: 'Inter, sans-serif' }}>
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
      {/* Apple Maps style bottom sheet */}
      <div className="fixed left-0 right-0 bottom-0 z-10 flex flex-col items-center transition-all duration-300">
        <div className="w-16 h-1.5 bg-gray-300 rounded-full mt-2 mb-2" />
        {/* Filter chips */}
        <div className="w-full max-w-md mx-auto flex flex-wrap gap-2 px-4 mb-2 relative">
          {/* Codigo filter chip */}
          <button
            ref={codigoChipRef}
            className={`px-2 py-1 rounded-full text-xs border flex items-center gap-1 ${codigoFilter ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-blue-100'} transition-colors`}
            onClick={() => setCodigoDropdownOpen((open) => !open)}
            type="button"
          >
            Código{codigoFilter ? `: ${codigoFilter} (${codigoClientCount})` : ''}
            {codigoFilter && (
              <span
                className="ml-1 cursor-pointer text-white bg-blue-700 rounded-full px-1.5 py-0.5 text-xs hover:bg-blue-800"
                onClick={e => { e.stopPropagation(); setCodigoFilter(null); setCodigoDropdownOpen(false); }}
                title="Limpiar filtro"
              >
                ×
              </span>
            )}
          </button>
          {codigoDropdownOpen && (
            <div className="absolute left-0 bottom-10 z-20 bg-white border border-gray-200 rounded-lg shadow-lg w-48 max-h-64 overflow-y-auto animate-fade-in">
              {uniqueCodes.map(code => (
                <button
                  key={code}
                  className={`block w-full text-left px-4 py-2 text-xs hover:bg-blue-100 ${codigoFilter === code ? 'bg-blue-600 text-white' : ''}`}
                  onMouseDown={e => {
                    e.preventDefault();
                    setCodigoFilter(code);
                    setCodigoDropdownOpen(false);
                  }}
                >
                  {code}
                </button>
              ))}
              {uniqueCodes.length === 0 && (
                <div className="px-4 py-2 text-xs text-gray-400">Sin códigos</div>
              )}
            </div>
          )}
          {/* Vendedor filter chip */}
          <button
            ref={vendedorChipRef}
            className={`px-2 py-1 rounded-full text-xs border flex items-center gap-1 ${vendedorFilter ? 'bg-green-600 text-white border-green-600' : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-green-100'} transition-colors`}
            onClick={() => setVendedorDropdownOpen((open) => !open)}
            type="button"
          >
            Vendedor{vendedorFilter ? `: ${vendedorFilter} (${vendedorClientCount})` : ''}
            {vendedorFilter && (
              <span
                className="ml-1 cursor-pointer text-white bg-green-700 rounded-full px-1.5 py-0.5 text-xs hover:bg-green-800"
                onClick={e => { e.stopPropagation(); setVendedorFilter(null); setVendedorDropdownOpen(false); }}
                title="Limpiar filtro"
              >
                ×
              </span>
            )}
          </button>
          {vendedorDropdownOpen && (
            <div className="absolute left-32 bottom-10 z-20 bg-white border border-gray-200 rounded-lg shadow-lg w-56 max-h-64 overflow-y-auto animate-fade-in">
              {uniqueVendedorNames.map(name => (
                <button
                  key={name}
                  className={`block w-full text-left px-4 py-2 text-xs hover:bg-green-100 ${vendedorFilter === name ? 'bg-green-600 text-white' : ''}`}
                  onMouseDown={e => {
                    e.preventDefault();
                    setVendedorFilter(name);
                    setVendedorDropdownOpen(false);
                  }}
                >
                  {name}
                </button>
              ))}
              {uniqueVendedorNames.length === 0 && (
                <div className="px-4 py-2 text-xs text-gray-400">Sin vendedores</div>
              )}
            </div>
          )}
          {/* Sin Visitar filter chip */}
          <button
            className={`px-2 py-1 rounded-full text-xs border flex items-center gap-1 ${sinVisitarFilter ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-yellow-100'} transition-colors`}
            onClick={() => setSinVisitarFilter(f => !f)}
            type="button"
          >
            Sin Visitar{sinVisitarFilter ? ` (${sinVisitarClientCount})` : ''}
            {sinVisitarFilter && (
              <span
                className="ml-1 cursor-pointer text-white bg-yellow-700 rounded-full px-1.5 py-0.5 text-xs hover:bg-yellow-800"
                onClick={e => { e.stopPropagation(); setSinVisitarFilter(false); }}
                title="Limpiar filtro"
              >
                ×
              </span>
            )}
          </button>
        </div>
        <div className="w-full max-w-md mx-auto flex justify-end px-4">
          <button
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${isLocating ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'} hover:bg-blue-50 transition-colors`}
            onClick={handleRefreshLocation}
            disabled={isLocating}
            title="Actualizar mi ubicación"
          >
            <RefreshCw className={`h-4 w-4 ${isLocating ? 'animate-spin' : ''}`} />
            {isLocating ? 'Actualizando...' : 'Mi ubicación'}
          </button>
        </div>
        <div className="bg-white rounded-t-2xl shadow-xl w-full max-w-md mx-auto p-4 border-t border-gray-200" style={{ minHeight: 120 }}>
          {/* Route Mode UI */}
          {routeMode && selectedClient && selectedClientLocation && routeInfo ? (
            <div className="flex flex-col items-center animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <Navigation className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-blue-700 text-lg">En ruta a {selectedClient}</span>
              </div>
              <div className="mb-2 text-xs text-blue-700 bg-blue-50 px-3 py-1 rounded-full">
                Distancia: {(routeInfo.distance / 1000).toFixed(2)} km &nbsp;•&nbsp; ETA: {Math.round(routeInfo.duration / 60)} min
              </div>
              <button
                className="flex items-center gap-2 mt-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors"
                onClick={handleCloseRoute}
              >
                <XCircle className="h-4 w-4" />
                Cerrar ruta
              </button>
            </div>
          ) : showConfirm && userLocation && pendingRouteClient ? (
            <div className="flex flex-col items-center animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-green-700 text-lg">¿Usar esta ubicación para iniciar la ruta?</span>
              </div>
              <div className="mb-2 text-xs text-gray-700 bg-gray-50 px-3 py-1 rounded-full">
                Lat: {userLocation.lat.toFixed(5)}, Lng: {userLocation.lng.toFixed(5)}
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  onClick={handleConfirmRoute}
                >
                  Confirmar
                </button>
                <button
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                  onClick={handleCancelConfirm}
                >
                  Cancelar
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
              />
              
              {/* Filtered Clients List */}
              {hasActiveFilters && (
                <div className="mt-3 border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700">
                      Clientes Filtrados ({filteredClientsWithDates.length})
                    </h3>
                    <button
                      className="text-xs text-blue-600 hover:text-blue-800"
                      onClick={() => {
                        setCodigoFilter(null);
                        setVendedorFilter(null);
                        setSinVisitarFilter(false);
                      }}
                    >
                      Limpiar filtros
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {filteredClientsWithDates.map((client) => (
                      <div
                        key={client.name}
                        className={`px-3 py-2 text-sm cursor-pointer rounded border-l-2 transition-colors ${
                          selectedClient === client.name 
                            ? 'bg-blue-50 text-blue-700 border-blue-500' 
                            : client.isSinVisitar 
                              ? 'bg-yellow-50 hover:bg-yellow-100 border-yellow-400' 
                              : 'bg-gray-50 hover:bg-gray-100 border-gray-300'
                        }`}
                        onClick={() => {
                          setSelectedClient(client.name);
                          setRouteInfo(null);
                          setRouteMode(false);
                        }}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{client.name}</span>
                          <span className={`text-xs ${
                            client.isSinVisitar ? 'text-yellow-600' : 'text-gray-500'
                          }`}>
                            {formatVisitDate(client.lastVisitDate)}
                          </span>
                        </div>
                      </div>
                    ))}
                    {filteredClientsWithDates.length === 0 && (
                      <div className="px-3 py-4 text-center text-sm text-gray-500">
                        No hay clientes que coincidan con los filtros seleccionados
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isFiltering ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                  <span className="ml-3 text-gray-500 text-sm">Filtrando clientes…</span>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto mt-2">
                  {filteredClientsBySearch.map((name) => (
                    <div
                      key={name}
                      className={`px-4 py-2 text-sm cursor-pointer rounded hover:bg-gray-100 ${selectedClient === name ? 'bg-blue-50 text-blue-700' : ''}`}
                      onClick={() => {
                        setSelectedClient(name);
                        setRouteInfo(null);
                        setRouteMode(false);
                      }}
                    >
                      {name}
                    </div>
                  ))}
                  {searchTerm && filteredClientsBySearch.length === 20 && (
                    <div className="px-4 py-2 text-xs text-gray-500 italic">
                      Mostrando primeros 20 resultados. Continúa escribiendo para refinar la búsqueda.
                    </div>
                  )}
                  {!searchTerm && !hasActiveFilters && (
                    <div className="px-4 py-2 text-xs text-gray-400">Busca un cliente para navegar</div>
                  )}
                </div>
              )}
              {/* Show selected client info */}
              {selectedClient && selectedClientLocation && (
                <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200 relative">
                  {/* Close button */}
                  <button
                    className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-200 text-gray-500"
                    onClick={() => {
                      setSelectedClient("");
                      setRouteInfo(null);
                      setRouteMode(false);
                    }}
                    title="Quitar selección"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="font-semibold text-gray-800 text-base mb-1">{selectedClient}</div>
                  <div className="text-xs text-gray-500 mb-2">
                    Lat: {selectedClientLocation.lat}, Lng: {selectedClientLocation.lng}
                  </div>
                  {selectedClientCode && (
                    <div className="mb-2 text-xs text-gray-700">
                      <span className="font-semibold">Código:</span> {selectedClientCode}
                    </div>
                  )}
                  {routeInfo && (
                    <div className="mb-2 text-xs text-blue-700">
                      Distancia: {(routeInfo.distance / 1000).toFixed(2)} km &nbsp;•&nbsp; ETA: {Math.round(routeInfo.duration / 60)} min
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200"
                      onClick={handleNavigate}
                      disabled={!selectedClientLocation || isLocating}
                    >
                      {isLocating ? (
                        <span className="flex items-center justify-center"><RefreshCw className="h-4 w-4 animate-spin mr-2" />Obteniendo ubicación…</span>
                      ) : (
                        'Navegar'
                      )}
                    </button>
                    <button
                      className="px-4 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition-colors duration-200 flex items-center gap-1"
                      onClick={() => {
                        if (selectedClientLocation) {
                          const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedClientLocation.lat},${selectedClientLocation.lng}`;
                          window.open(url, '_blank');
                        }
                      }}
                      disabled={!selectedClientLocation}
                      title="Abrir en Google Maps"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                      </svg>
                      Maps
                    </button>
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