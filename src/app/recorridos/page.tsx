"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Menu, MapPin, Calendar, Clock, CheckCircle, XCircle,
  AlertTriangle, Users, Route, Navigation, Save, Timer,
} from "lucide-react";
import BlurIn from "@/components/ui/blur-in";
import VendorSelector from "@/components/VendorSelector";
import {
  getVendorIdentifiers, getVendorLabel, getVendorEmails,
  isMasterAccount, normalizeVendorValue,
} from "@/utils/auth";
import {
  RouteDay, VisitStatus, VisitType, ROUTE_DAYS, DAY_NAMES,
  getMazatlanTime, getMazatlanToday, getMazatlanDayName,
  getSelectedDayDate, normalizeDay, getWeekNumber, calculateDistance,
  getVisitType, getOriginalClientName, isCleyClient as checkIsCleyClient,
  getStatusColor, getClientTypeColor, buildApiUrl, getSelectedDayFormattedDate,
  optimizeRoute, calculateTotalRouteDistance, debug,
  DEFAULT_START_LAT, DEFAULT_START_LNG,
} from "@/utils/recorridos";

type Client = {
  Nombre: string;
  Latitude: number;
  Longitud: number;
  Dia: string;
  Frecuencia: number;
  Tipo_Cliente: string;
  Vendedor: string;
  Entrega?: string;
};

type ConfigSettings = {
  distanciaPorVisita: number;
  costoCombustiblePorKm: number;
  tiempoPromedioVisita: number;
  maximoClientesPorDia: number;
};

type ClientVisitHistory = {
  clientName: string;
  lastVisitDate: string;
  lastVisitWeek: number;
};

type ScheduledVisit = {
  clientName: string;
  scheduledDate: string;
  week: string;
  status: string;
};

type PostponedClient = {
  client: Client;
  originalDay: string;
  postponedOn: string;
};

type RescheduleInfo = {
  originalDay: string;
  newDay: string;
  visitType: string;
};

type PendingReschedule = {
  clientName: string;
  originalDay: string;
  newDay: string;
  visitType: VisitType;
};

export default function RecorridosPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated: () => { window.location.href = "/auth/signin"; },
  });

  // UI State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [selectedDay, setSelectedDay] = useState<RouteDay>(getMazatlanDayName);
  const [cleyDaySelector, setCleyDaySelector] = useState<string | null>(null);
  const [completingClient, setCompletingClient] = useState<string | null>(null);
  const [showPostponePool, setShowPostponePool] = useState(false);

  // Data State
  const [clients, setClients] = useState<Client[]>([]);
  const [visitHistory, setVisitHistory] = useState<Record<string, ClientVisitHistory>>({});
  const [scheduledVisits, setScheduledVisits] = useState<Record<string, ScheduledVisit>>({});
  const [rescheduledClients, setRescheduledClients] = useState<Record<string, RescheduleInfo>>({});
  const [routePerformanceData, setRoutePerformanceData] = useState<any[]>([]);
  const [config, setConfig] = useState<ConfigSettings>({
    distanciaPorVisita: 2.5,
    costoCombustiblePorKm: 1.2,
    tiempoPromedioVisita: 15,
    maximoClientesPorDia: 20,
  });

  // Route State
  const [visitStatus, setVisitStatus] = useState<Record<string, VisitStatus>>({});
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [routeStartTime, setRouteStartTime] = useState<string | null>(null);
  const [savingRoute, setSavingRoute] = useState(false);
  const [routeInProgress, setRouteInProgress] = useState(false);
  const [routeFinishedToday, setRouteFinishedToday] = useState(false);

  // Postpone State
  const [postponePool, setPostponePool] = useState<Record<string, PostponedClient>>({});
  const [pendingReschedules, setPendingReschedules] = useState<PendingReschedule[]>([]);
  const [savingReschedules, setSavingReschedules] = useState(false);

  // Master Account State
  const [isMaster, setIsMaster] = useState(false);
  const [selectedVendorEmail, setSelectedVendorEmail] = useState<string | null>(null);
  const [availableVendors, setAvailableVendors] = useState<{ email: string; label: string }[]>([]);
  const [viewingAsVendor, setViewingAsVendor] = useState("");

  const userEmail = session?.user?.email || null;

  const getWriteVendorEmail = (): string | null => {
    if (!userEmail) return null;
    if (!isMaster) return userEmail;
    // null means "all routes" - use master's email for writes
    if (selectedVendorEmail) return selectedVendorEmail;
    return userEmail;
  };

  // ===== API FETCH FUNCTIONS =====
  // Note: These accept override params to handle initial load race conditions

  const fetchClients = async (overrideMaster?: boolean, overrideVendor?: string | null) => {
    try {
      setLoading(true);
      const useMaster = overrideMaster ?? isMaster;
      const useVendor = overrideVendor !== undefined ? overrideVendor : selectedVendorEmail;
      const apiUrl = buildApiUrl("clientes", userEmail, useMaster, useVendor);
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error("Failed to fetch clients");
      const data = await response.json();
      setClients(data.data || []);
    } catch (error) {
      debug.error("Error fetching clients:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfiguration = async () => {
    try {
      const response = await fetch(buildApiUrl("configuracion", userEmail, false, null));
      if (!response.ok) return;
      const data = await response.json();
      if (data.data?.length > 0) {
        const configMap = data.data.reduce((acc: any, item: any) => {
          if (item.clave && item.valor && item.activo === "Si") acc[item.clave] = item.valor;
          return acc;
        }, {});
        setConfig(prev => ({
          distanciaPorVisita: parseFloat(configMap.distancia_por_visita) || prev.distanciaPorVisita,
          costoCombustiblePorKm: parseFloat(configMap.costo_combustible_km) || prev.costoCombustiblePorKm,
          tiempoPromedioVisita: parseInt(configMap.tiempo_promedio_visita) || prev.tiempoPromedioVisita,
          maximoClientesPorDia: parseInt(configMap.maximo_clientes_dia) || prev.maximoClientesPorDia,
        }));
      }
    } catch (error) {
      debug.error("Error fetching configuration:", error);
    }
  };

  const fetchVisitHistory = async (overrideMaster?: boolean, overrideVendor?: string | null) => {
    try {
      const useMaster = overrideMaster ?? isMaster;
      const useVendor = overrideVendor !== undefined ? overrideVendor : selectedVendorEmail;
      const apiUrl = buildApiUrl("metricas", userEmail, useMaster, useVendor);
      const response = await fetch(apiUrl);
      if (!response.ok) return;
      const data = await response.json();
      if (data.data?.length > 0) {
        const history: Record<string, ClientVisitHistory> = {};
        data.data.forEach((record: any) => {
          if (record.cliente && record.fecha && record.tipo_visita === "completed" && record.semana) {
            const clientName = record.cliente;
            const visitDate = record.fecha;
            const weekNumber = parseInt(record.semana);
            if (isNaN(weekNumber)) return;
            if (!history[clientName] || new Date(visitDate) > new Date(history[clientName].lastVisitDate)) {
              history[clientName] = { clientName, lastVisitDate: visitDate, lastVisitWeek: weekNumber };
            }
          }
        });
        setVisitHistory(history);
      }
    } catch (error) {
      debug.error("Error fetching visit history:", error);
    }
  };

  const fetchScheduledVisits = async (overrideMaster?: boolean, overrideVendor?: string | null) => {
    try {
      const useMaster = overrideMaster ?? isMaster;
      const useVendor = overrideVendor !== undefined ? overrideVendor : selectedVendorEmail;
      const apiUrl = buildApiUrl("programacion", userEmail, useMaster, useVendor);
      const response = await fetch(apiUrl);
      if (!response.ok) return;
      const data = await response.json();
      if (data.data?.length > 0) {
        const visits: Record<string, ScheduledVisit> = {};
        const mazatlanToday = getMazatlanToday();

        data.data.forEach((record: any) => {
          if (!record.cliente_nombre || !record.proxima_visita_programada || record.estado !== "Programado") return;

          const clientName = record.cliente_nombre;
          const scheduledDateOnly = typeof record.proxima_visita_programada === "string" &&
            /^\d{4}-\d{2}-\d{2}/.test(record.proxima_visita_programada)
            ? record.proxima_visita_programada.slice(0, 10)
            : null;

          if (!scheduledDateOnly) return;

          const existing = visits[clientName];
          const classify = (d: string) => d === mazatlanToday ? 0 : d < mazatlanToday ? 1 : 2;
          const shouldReplace = !existing?.scheduledDate ||
            classify(scheduledDateOnly) < classify(existing.scheduledDate) ||
            (classify(scheduledDateOnly) === classify(existing.scheduledDate) &&
              (classify(scheduledDateOnly) === 1 ? scheduledDateOnly > existing.scheduledDate : scheduledDateOnly < existing.scheduledDate));

          if (shouldReplace) {
            visits[clientName] = {
              clientName,
              scheduledDate: scheduledDateOnly,
              week: record.semana_numero ? `Semana ${record.semana_numero}` : "",
              status: record.estado,
            };
          }
        });
        setScheduledVisits(visits);
      }
    } catch (error) {
      debug.error("Error fetching scheduled visits:", error);
    }
  };

  const fetchRescheduledVisits = async (overrideMaster?: boolean, overrideVendor?: string | null) => {
    try {
      const useMaster = overrideMaster ?? isMaster;
      const useVendor = overrideVendor !== undefined ? overrideVendor : selectedVendorEmail;
      const apiUrl = buildApiUrl("reprogramadas", userEmail, useMaster, useVendor);
      const response = await fetch(apiUrl);
      if (!response.ok) return;
      const data = await response.json();
      if (data.data?.length > 0) {
        const reschedules: Record<string, RescheduleInfo> = {};
        data.data.forEach((record: any) => {
          if (record.cliente_original && record.tipo_visita && record.dia_nuevo && record.activo === "Si") {
            const clientKey = `${record.cliente_original} (${record.tipo_visita})`;
            reschedules[clientKey] = {
              originalDay: record.dia_original,
              newDay: record.dia_nuevo,
              visitType: record.tipo_visita,
            };
          }
        });
        setRescheduledClients(reschedules);
      }
    } catch (error) {
      debug.error("Error fetching rescheduled visits:", error);
    }
  };

  const fetchRoutePerformance = async (overrideMaster?: boolean, overrideVendor?: string | null) => {
    try {
      const useMaster = overrideMaster ?? isMaster;
      const useVendor = overrideVendor !== undefined ? overrideVendor : selectedVendorEmail;
      const apiUrl = buildApiUrl("performance", userEmail, useMaster, useVendor);
      const response = await fetch(apiUrl);
      if (!response.ok) return;
      const data = await response.json();
      setRoutePerformanceData(data.data || []);
    } catch (error) {
      debug.error("Error fetching route performance:", error);
      setRoutePerformanceData([]);
    }
  };

  // ===== ROUTE STATE MANAGEMENT =====

  const saveRouteState = (startTime: string | null, finished = false, finishedAt?: string, dayToSave?: RouteDay) => {
    try {
      // null means "all routes" - use userEmail for storage key
      const email = selectedVendorEmail || userEmail;
      if (!email) return;

      const storageKey = `routeState_${email}_${getMazatlanToday()}`;
      const dayForState = dayToSave || selectedDay;

      if (startTime || finished) {
        localStorage.setItem(storageKey, JSON.stringify({
          routeStartTime: startTime,
          selectedDay: dayForState,
          routeFinished: finished,
          finishedAt,
          timestamp: new Date().toISOString(),
        }));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch (error) {
      debug.error("Error saving route state:", error);
    }
  };

  const loadPersistedRouteState = (dayToCheck?: RouteDay, performanceData?: any[]) => {
    try {
      // null means "all routes" - use userEmail for storage key
      const email = selectedVendorEmail || userEmail;
      if (!email) return;

      const mazatlanToday = getMazatlanToday();
      const dayToSearch = dayToCheck || selectedDay;

      // Reset route state before checking - ensures state is per-vendor
      setRouteFinishedToday(false);
      setRouteStartTime(null);
      setRouteInProgress(false);

      // For "Todas las Rutas" mode, don't show finished indicator (it's aggregate view)
      if (isMaster && selectedVendorEmail === null) {
        return;
      }

      // Use passed performanceData or fall back to state (passed data is fresher)
      const dataToCheck = performanceData ?? routePerformanceData;

      // Check performance records for completed route on this day for SPECIFIC vendor
      const vendorAliases = new Set<string>();
      const targetEmail = selectedVendorEmail || email;
      getVendorIdentifiers(targetEmail).forEach(v => vendorAliases.add(v));

      const matchingRecord = dataToCheck.find(record => {
        const isCorrectDay = record.dia_ruta?.toLowerCase() === dayToSearch.toLowerCase();
        const isCorrectDate = record.fecha === mazatlanToday; // Must be today's date
        const isCorrectVendor = vendorAliases.has(normalizeVendorValue(String(record.vendedor || "")));
        return isCorrectDay && isCorrectDate && isCorrectVendor;
      });

      if (matchingRecord) {
        setRouteFinishedToday(true);
        setRouteStartTime(matchingRecord.tiempo_inicio || "08:00");
        setRouteInProgress(false);
        saveRouteState(matchingRecord.tiempo_inicio, true, matchingRecord.tiempo_fin, dayToSearch);
        return;
      }

      // Check localStorage fallback
      const storageKey = `routeState_${email}_${mazatlanToday}`;
      const savedState = localStorage.getItem(storageKey);
      if (savedState) {
        const { routeStartTime: savedStartTime, selectedDay: savedDay, routeFinished } = JSON.parse(savedState);
        if (savedDay === dayToSearch && dayToSearch === getMazatlanDayName()) {
          if (savedStartTime) {
            setRouteStartTime(savedStartTime);
            setRouteInProgress(true);
          }
          if (routeFinished) setRouteFinishedToday(true);
        }
      }
    } catch (error) {
      debug.error("Error loading persisted route state:", error);
    }
  };

  const checkRouteInProgress = () => {
    try {
      const mazatlanToday = getMazatlanToday();
      const actualDayName = getMazatlanDayName();
      const isSelectedDayToday = selectedDay === actualDayName;

      const hasCompletedVisitsToday = isSelectedDayToday &&
        Object.values(visitHistory).some(h => h.lastVisitDate === mazatlanToday);

      const shouldShowFinishButton = isSelectedDayToday &&
        (hasCompletedVisitsToday || (!!routeStartTime && !routeFinishedToday));

      setRouteInProgress(shouldShowFinishButton);

      if (isSelectedDayToday && hasCompletedVisitsToday && !routeStartTime) {
        setRouteStartTime("08:00");
        saveRouteState("08:00");
      }
    } catch (error) {
      debug.error("Error checking route progress:", error);
    }
  };

  // ===== CLIENT PROCESSING =====

  const expandCleyClients = (clients: Client[]): Client[] => {
    const expanded: Client[] = [];
    clients.forEach(client => {
      if (checkIsCleyClient(client.Tipo_Cliente) && client.Entrega) {
        let pedidosDay = rescheduledClients[`${client.Nombre} (Pedidos)`]?.newDay || client.Dia;
        let entregaDay = rescheduledClients[`${client.Nombre} (Entrega)`]?.newDay || client.Entrega;
        expanded.push({ ...client, Nombre: `${client.Nombre} (Pedidos)`, Dia: pedidosDay });
        expanded.push({ ...client, Nombre: `${client.Nombre} (Entrega)`, Dia: entregaDay });
      } else {
        const possibleKeys = [client.Nombre, `${client.Nombre} (Normal)`];
        let clientDay = client.Dia;
        for (const key of possibleKeys) {
          if (rescheduledClients[key]) {
            clientDay = rescheduledClients[key].newDay;
            break;
          }
        }
        expanded.push({ ...client, Dia: clientDay });
      }
    });
    return expanded;
  };

  const shouldBeConsideredForVisitToday = (client: Client): boolean => {
    const originalName = getOriginalClientName(client.Nombre);
    const clientHistory = visitHistory[originalName];
    const scheduledVisit = scheduledVisits[originalName] || scheduledVisits[client.Nombre];
    const mazatlanToday = getMazatlanToday();
    const mazatlanTime = getMazatlanTime();

    // Check scheduled visits
    if (scheduledVisit?.status === "Programado") {
      if (scheduledVisit.scheduledDate <= mazatlanToday) return true;
    }

    // First time visit
    if (!clientHistory) return true;

    // Already completed today
    if (clientHistory.lastVisitDate === mazatlanToday) return true;

    // Check if due based on frequency
    const lastVisitDateObj = new Date(`${clientHistory.lastVisitDate}T12:00:00.000Z`);
    const daysSinceLastVisit = Math.floor((mazatlanTime.getTime() - lastVisitDateObj.getTime()) / (1000 * 60 * 60 * 24));
    const weeksSinceLastVisit = Math.floor(daysSinceLastVisit / 7);
    return weeksSinceLastVisit >= client.Frecuencia;
  };

  // ===== VISIT ACTIONS =====

  const startRoute = () => {
    const startTime = new Date().toTimeString().slice(0, 5);
    setRouteStartTime(startTime);
    setRouteInProgress(true);
    saveRouteState(startTime);
  };

  const deactivateRescheduleAfterVisit = async (clientName: string, visitType: string) => {
    try {
      const writeEmail = getWriteVendorEmail();
      if (!writeEmail) return;

      const response = await fetch("/api/recorridos/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deactivate_reschedule",
          userEmail: writeEmail,
          clientName,
          visitType,
          masterEmail: isMaster ? userEmail : undefined,
        }),
      });

      if (response.ok) {
        const clientKey = `${clientName} (${visitType})`;
        setRescheduledClients(prev => {
          const newState = { ...prev };
          delete newState[clientKey];
          return newState;
        });
      }
    } catch (error) {
      debug.error("Error deactivating reschedule:", error);
    }
  };

  const updateVisitStatus = async (client: Client, status: VisitStatus, notes?: string) => {
    try {
      if (!routeStartTime && status === "completed") startRoute();

      if (status === "completed") {
        setCompletingClient(client.Nombre);
        setTimeout(() => {
          setVisitStatus(prev => ({ ...prev, [client.Nombre]: status }));
          setTimeout(() => setCompletingClient(null), 300);
        }, 100);
      } else {
        setVisitStatus(prev => ({ ...prev, [client.Nombre]: status }));
      }

      const visitTypeForCley = getVisitType(client.Nombre);
      const originalClientName = getOriginalClientName(client.Nombre);
      const writeEmail = getWriteVendorEmail();
      if (!writeEmail) return;

      const response = await fetch("/api/recorridos/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_visit_status",
          userEmail: writeEmail,
          clientName: originalClientName,
          routeDay: client.Dia,
          visitType: status,
          visitDate: getSelectedDayDate(selectedDay),
          location: currentLocation,
          notes: visitTypeForCley !== "Normal" ? `${visitTypeForCley}: ${notes || ""}` : notes || "",
          cleyVisitType: visitTypeForCley,
          masterEmail: isMaster ? userEmail : undefined,
        }),
      });

      if (response.ok) {
        const responseData = await response.json().catch(() => null);
        if (status === "completed") {
          const fecha = responseData?.data?.fecha || getSelectedDayDate(selectedDay);
          setVisitHistory(prev => ({
            ...prev,
            [originalClientName]: {
              clientName: originalClientName,
              lastVisitDate: fecha,
              lastVisitWeek: getWeekNumber(new Date(`${fecha}T12:00:00.000Z`)),
            },
          }));
          if (rescheduledClients[client.Nombre]) {
            deactivateRescheduleAfterVisit(originalClientName, visitTypeForCley);
          }
        }
      } else {
        setVisitStatus(prev => { const s = { ...prev }; delete s[client.Nombre]; return s; });
      }
    } catch (error) {
      debug.error("Error updating visit status:", error);
      setVisitStatus(prev => { const s = { ...prev }; delete s[client.Nombre]; return s; });
    }
  };

  const finishRoute = async () => {
    if (!routeStartTime && !routeInProgress) {
      alert("No se ha iniciado ninguna ruta. Completa al menos una visita primero.");
      return;
    }

    try {
      setSavingRoute(true);
      const actualStartTime = routeStartTime || "08:00";
      const endTime = new Date().toTimeString().slice(0, 5);
      const fecha = getSelectedDayDate(selectedDay);

      const clientesProgramados = clientsConsideredForVisitToday.length;
      const clientesVisitados = allCompletedTodayClients.length;
      const actualRouteDistance = calculateTotalRouteDistance(allCompletedTodayClients);
      const totalDistanceKm = Math.round(actualRouteDistance > 0 ? actualRouteDistance : clientesVisitados * config.distanciaPorVisita);
      const fuelCost = Math.round(totalDistanceKm * config.costoCombustiblePorKm);

      const visitedClients = allCompletedTodayClients.map(c => c.Nombre);
      const skippedClients = clientsConsideredForVisitToday
        .filter(c => visitStatus[c.Nombre] === "skipped" || visitStatus[c.Nombre] === "postponed")
        .map(c => c.Nombre);

      let observaciones = `Visitados: ${visitedClients.join(", ")}`;
      if (skippedClients.length > 0) observaciones += `. No visitados: ${skippedClients.join(", ")}`;

      const writeEmail = getWriteVendorEmail();
      if (!writeEmail) {
        alert("No se encontró el email del usuario.");
        return;
      }

      const response = await fetch("/api/recorridos/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_route_summary",
          userEmail: writeEmail,
          routeDay: selectedDay,
          fecha,
          clientesProgramados,
          clientesVisitados,
          ventasTotales: 0,
          tiempoInicio: actualStartTime,
          tiempoFin: endTime,
          kilometrosRecorridos: totalDistanceKm,
          combustibleGastado: fuelCost,
          observaciones: observaciones.slice(0, 500),
          masterEmail: isMaster ? userEmail : undefined,
        }),
      });

      if (response.ok) {
        setRouteFinishedToday(true);
        saveRouteState(actualStartTime, true, endTime);
        alert(`Ruta del ${selectedDay} finalizada exitosamente!\n\nResumen:\n• ${clientesVisitados}/${clientesProgramados} clientes visitados\n• Tiempo: ${actualStartTime} - ${endTime}\n• Distancia: ${totalDistanceKm} km\n• Combustible: $${fuelCost}`);
        setVisitStatus({});
        setRouteStartTime(null);
        setRouteInProgress(false);
        await fetchVisitHistory();
      } else {
        alert("Error al guardar el resumen de la ruta. Inténtalo de nuevo.");
      }
    } catch (error) {
      debug.error("Error finishing route:", error);
      alert("Error al finalizar la ruta. Inténtalo de nuevo.");
    } finally {
      setSavingRoute(false);
    }
  };

  // ===== POSTPONE FUNCTIONS =====

  const postponeClient = async (client: Client, targetDay: RouteDay) => {
    const today = new Date().toISOString().split("T")[0];
    const isCley = checkIsCleyClient(client.Tipo_Cliente);

    setPostponePool(prev => ({
      ...prev,
      [client.Nombre]: { client: { ...client, Dia: targetDay }, originalDay: client.Dia, postponedOn: today },
    }));
    setVisitStatus(prev => ({ ...prev, [client.Nombre]: "postponed" }));

    const writeEmail = getWriteVendorEmail();
    if (!writeEmail) {
      alert("No se encontró el email del usuario.");
      return;
    }

    try {
      const response = await fetch("/api/recorridos/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch_reschedule",
          userEmail: writeEmail,
          reschedules: [{
            clientName: client.Nombre,
            originalDay: client.Dia,
            newDay: targetDay,
            visitType: isCley ? getVisitType(client.Nombre) : "Normal",
          }],
          masterEmail: isMaster ? userEmail : undefined,
        }),
      });

      if (response.ok) {
        setRescheduledClients(prev => ({
          ...prev,
          [client.Nombre]: { originalDay: client.Dia, newDay: targetDay, visitType: isCley ? getVisitType(client.Nombre) : "Normal" },
        }));
      } else {
        // Revert on error
        setPostponePool(prev => { const p = { ...prev }; delete p[client.Nombre]; return p; });
        setVisitStatus(prev => { const s = { ...prev }; delete s[client.Nombre]; return s; });
        alert("Error al posponer el cliente. Inténtalo de nuevo.");
      }
    } catch (error) {
      setPostponePool(prev => { const p = { ...prev }; delete p[client.Nombre]; return p; });
      setVisitStatus(prev => { const s = { ...prev }; delete s[client.Nombre]; return s; });
      alert("Error de conexión al posponer el cliente. Inténtalo de nuevo.");
    }
  };

  const rescheduleFromPostponePool = (clientName: string, targetDay: RouteDay) => {
    const postponedClient = postponePool[clientName];
    if (!postponedClient) return;

    const visitType = getVisitType(clientName);
    const originalClientName = getOriginalClientName(clientName);
    const isCley = checkIsCleyClient(postponedClient.client.Tipo_Cliente);

    if (isCley) {
      setPendingReschedules(prev => {
        const filtered = prev.filter(r => !(r.clientName === originalClientName && r.visitType === visitType));
        return [...filtered, { clientName: originalClientName, originalDay: postponedClient.originalDay, newDay: targetDay, visitType }];
      });
    }

    setRescheduledClients(prev => ({
      ...prev,
      [clientName]: { originalDay: postponedClient.originalDay, newDay: targetDay, visitType: isCley ? visitType : "Normal" },
    }));

    setPostponePool(prev => { const p = { ...prev }; delete p[clientName]; return p; });
    setVisitStatus(prev => { const s = { ...prev }; delete s[clientName]; return s; });
  };

  const savePendingReschedules = async () => {
    if (pendingReschedules.length === 0) {
      alert("No hay cambios pendientes para guardar");
      return;
    }

    try {
      setSavingReschedules(true);
      const writeEmail = getWriteVendorEmail();
      if (!writeEmail) {
        alert("No se encontró el email del usuario.");
        return;
      }

      const response = await fetch("/api/recorridos/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch_reschedule",
          userEmail: writeEmail,
          reschedules: pendingReschedules,
          masterEmail: isMaster ? userEmail : undefined,
        }),
      });

      if (response.ok) {
        setPendingReschedules([]);
        await fetchRescheduledVisits();
        alert(`${pendingReschedules.length} reprogramaciones temporales guardadas exitosamente.`);
      } else {
        alert("Error al guardar las reprogramaciones. Inténtalo de nuevo.");
      }
    } catch (error) {
      debug.error("Error saving reschedules:", error);
      alert("Error al guardar las reprogramaciones. Inténtalo de nuevo.");
    } finally {
      setSavingReschedules(false);
    }
  };

  // ===== COMPUTED VALUES =====

  const expandedClients = useMemo(() => expandCleyClients(clients), [clients, rescheduledClients]);

  const clientsForSelectedDay = useMemo(() =>
    expandedClients.filter(c => normalizeDay(c.Dia || "") === normalizeDay(selectedDay)),
    [expandedClients, selectedDay]
  );

  const postponedClientsForToday = useMemo(() =>
    Object.values(postponePool)
      .filter(p => normalizeDay(p.client.Dia || "") === normalizeDay(selectedDay))
      .map(p => p.client),
    [postponePool, selectedDay]
  );

  const allClientsForSelectedDay = useMemo(() =>
    [...clientsForSelectedDay, ...postponedClientsForToday],
    [clientsForSelectedDay, postponedClientsForToday]
  );

  const clientsConsideredForVisitToday = useMemo(() =>
    allClientsForSelectedDay.filter(client => {
      const isPostponed = postponedClientsForToday.some(p => p.Nombre === client.Nombre);
      return isPostponed || shouldBeConsideredForVisitToday(client);
    }),
    [allClientsForSelectedDay, postponedClientsForToday, visitHistory, scheduledVisits]
  );

  const selectedDayDateString = getSelectedDayDate(selectedDay);

  const actuallyPendingClients = useMemo(() =>
    clientsConsideredForVisitToday.filter(client => {
      const originalName = getOriginalClientName(client.Nombre);
      const history = visitHistory[originalName];
      const status = visitStatus[client.Nombre];
      const wasVisitedOnSelectedDay = history?.lastVisitDate === selectedDayDateString;
      const isPostponed = postponedClientsForToday.some(p => p.Nombre === client.Nombre);

      if (isPostponed && status !== "completed") return true;
      if (status === "completed" || status === "skipped" || status === "postponed") return false;
      if (wasVisitedOnSelectedDay) return false;
      return true;
    }),
    [clientsConsideredForVisitToday, visitHistory, visitStatus, selectedDayDateString, postponedClientsForToday]
  );

  const optimizedPendingClients = useMemo(() => optimizeRoute(actuallyPendingClients), [actuallyPendingClients]);
  const totalRouteDistance = useMemo(() => calculateTotalRouteDistance(optimizedPendingClients), [optimizedPendingClients]);

  const allCompletedTodayClients = useMemo(() =>
    allClientsForSelectedDay.filter(c => visitHistory[getOriginalClientName(c.Nombre)]?.lastVisitDate === selectedDayDateString),
    [allClientsForSelectedDay, visitHistory, selectedDayDateString]
  );

  const completedCount = allCompletedTodayClients.length;
  const pendingCount = optimizedPendingClients.length;

  // ===== HELPER FUNCTIONS =====

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        err => debug.error("Error getting location:", err)
      );
    }
  };

  const openInMaps = (client: Client) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${client.Latitude},${client.Longitud}`, "_blank");
  };

  const openFullRouteInMaps = () => {
    if (optimizedPendingClients.length === 0) return;
    const startPoint = `${DEFAULT_START_LAT},${DEFAULT_START_LNG}`;
    const waypoints = optimizedPendingClients.slice(0, -1).map(c => `${c.Latitude},${c.Longitud}`).join("|");
    const destination = optimizedPendingClients[optimizedPendingClients.length - 1];
    let url = `https://www.google.com/maps/dir/?api=1&origin=${startPoint}&destination=${destination.Latitude},${destination.Longitud}`;
    if (waypoints) url += `&waypoints=${waypoints}`;
    window.open(url, "_blank");
  };

  const getVisitStatusText = (client: Client): string => {
    const originalName = getOriginalClientName(client.Nombre);
    const history = visitHistory[originalName];
    const scheduledVisit = scheduledVisits[originalName] || scheduledVisits[client.Nombre];
    const mazatlanToday = getMazatlanToday();

    if (scheduledVisit?.status === "Programado") {
      const daysDiff = Math.floor((new Date(scheduledVisit.scheduledDate).getTime() - new Date(mazatlanToday).getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff === 0) return "Programado para hoy";
      if (daysDiff < 0) return `Programado hace ${Math.abs(daysDiff)} días`;
      return `Programado en ${daysDiff} días`;
    }

    if (!history) return "Primera visita";

    const daysSince = Math.floor((Date.now() - new Date(history.lastVisitDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince === 0) return "Completado hoy";
    const weeksSince = Math.floor(daysSince / 7);
    return weeksSince === 0 ? `Visitado hace ${daysSince} días` : `Visitado hace ${weeksSince} semanas`;
  };

  const getStatusIcon = (status: VisitStatus) => {
    switch (status) {
      case "completed": return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "skipped": return <XCircle className="h-5 w-5 text-red-600" />;
      case "postponed": return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      default: return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  // ===== EFFECTS =====

  useEffect(() => {
    if (userEmail) {
      const masterStatus = isMasterAccount(userEmail);
      setIsMaster(masterStatus);

      // Determine initial vendor selection for master accounts
      let initialVendorEmail: string | null = null;
      if (masterStatus) {
        const vendors = getVendorEmails().map(email => ({ email, label: getVendorLabel(email) }));
        // Don't add ALL_ROUTES here - VendorSelector has built-in "Todas las Rutas" that passes null
        setAvailableVendors(vendors);
        const userHasOwnRoutes = vendors.some(v => v.email === userEmail);
        if (userHasOwnRoutes) {
          initialVendorEmail = userEmail;
          setSelectedVendorEmail(userEmail);
          setViewingAsVendor(getVendorLabel(userEmail));
        } else if (vendors.length > 0) {
          initialVendorEmail = vendors[0].email;
          setSelectedVendorEmail(vendors[0].email);
          setViewingAsVendor(vendors[0].label);
        } else {
          // null means "all routes" - VendorSelector's built-in option
          initialVendorEmail = null;
          setSelectedVendorEmail(null);
          setViewingAsVendor("Todas las Rutas");
        }
      }

      setDataLoaded(false);
      // Pass the computed values directly to avoid race conditions with state
      Promise.all([
        fetchClients(masterStatus, initialVendorEmail),
        fetchConfiguration(),
        fetchVisitHistory(masterStatus, initialVendorEmail),
        fetchScheduledVisits(masterStatus, initialVendorEmail),
        fetchRescheduledVisits(masterStatus, initialVendorEmail),
        fetchRoutePerformance(masterStatus, initialVendorEmail),
      ]).then(() => {
        setDataLoaded(true);
        loadPersistedRouteState();
        checkRouteInProgress();
      }).catch(() => setDataLoaded(true));
      getCurrentLocation();
    }
  }, [session]);

  useEffect(() => {
    if (isMaster && dataLoaded) {
      // Immediately reset route state when vendor changes
      setRouteFinishedToday(false);
      setRouteStartTime(null);
      setRouteInProgress(false);

      // Fetch fresh data for the new vendor
      const fetchAndUpdateState = async () => {
        await Promise.all([
          fetchClients(), fetchVisitHistory(), fetchScheduledVisits(),
          fetchRescheduledVisits(),
        ]);

        // Fetch performance data and pass it directly to avoid stale state
        try {
          const apiUrl = buildApiUrl("performance", userEmail, isMaster, selectedVendorEmail);
          const response = await fetch(apiUrl);
          if (response.ok) {
            const data = await response.json();
            const freshPerformanceData = data.data || [];
            setRoutePerformanceData(freshPerformanceData);
            // Pass fresh data directly to loadPersistedRouteState
            loadPersistedRouteState(undefined, freshPerformanceData);
          }
        } catch (error) {
          debug.error("Error fetching performance data:", error);
        }

        checkRouteInProgress();
      };

      fetchAndUpdateState();
    }
  }, [selectedVendorEmail, isMaster]);

  useEffect(() => {
    if (dataLoaded) checkRouteInProgress();
  }, [visitHistory, dataLoaded]);

  // ===== RENDER =====

  if (status === "loading" || loading || !dataLoaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-2 text-gray-600">
          {status === "loading" ? "Cargando sesión..." : loading ? "Cargando datos..." : "Procesando información..."}
        </p>
      </div>
    );
  }

  const mazatlanDayName = getMazatlanDayName();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes gentle-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.02); } 100% { transform: scale(0.95); } }` }} />

      <div className="min-h-screen bg-white px-4 py-3 font-sans w-full" style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8rem" }}>
        {/* Header */}
        <header className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 rounded-full mr-2 flex items-center justify-center">
              <Route className="h-5 w-5 text-white" />
            </div>
            <BlurIn word="Recorridos" className="text-2xl font-medium tracking-tight" duration={0.5}
              variant={{ hidden: { filter: "blur(4px)", opacity: 0 }, visible: { filter: "blur(0px)", opacity: 1 } }} />
          </div>
          <div className="relative">
            <button className="p-1 rounded-full hover:bg-gray-200 transition-colors" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              <Menu className="h-5 w-5 text-gray-600" />
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                <div className="py-1">
                  {["/", "/form", "/clientes", "/inventario", "/admin", "/navegar"].map(href => (
                    <Link key={href} href={href} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      {href === "/" ? "Dashboard" : href === "/form" ? "Ventas" : href.slice(1).charAt(0).toUpperCase() + href.slice(2)}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Vendor Selector */}
        <VendorSelector
          currentVendor={selectedVendorEmail}
          vendors={availableVendors}
          onVendorChange={email => {
            setSelectedVendorEmail(email);
            setViewingAsVendor(email ? getVendorLabel(email) : "Todas las Rutas");
          }}
          isVisible={isMaster}
        />

        {/* Progress Summary */}
        <div className="bg-white rounded-lg mb-4 p-4 border border-[#E2E4E9]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-blue-600 mr-2" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Progreso del Día - {selectedDay}</h2>
                <p className="text-xs text-gray-500">{getSelectedDayFormattedDate(selectedDay)}</p>
                {isMaster && <p className="text-xs text-blue-600">Viendo: {viewingAsVendor}</p>}
              </div>
            </div>
            <div className="text-sm text-gray-500">{completedCount} / {completedCount + pendingCount} completados</div>
          </div>

          {routeStartTime && (
            <div className="flex items-center text-sm text-blue-600 mb-2">
              <Timer className="h-4 w-4 mr-1" /><span>Ruta iniciada: {routeStartTime}</span>
            </div>
          )}

          <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedCount + pendingCount) > 0 ? (completedCount / (completedCount + pendingCount)) * 100 : 0}%` }} />
          </div>

          <div className="grid grid-cols-3 gap-4 text-center mb-3">
            <div><div className="text-2xl font-bold text-blue-600">{completedCount}</div><div className="text-xs text-gray-500">Completados</div></div>
            <div><div className="text-2xl font-bold text-orange-600">{pendingCount}</div><div className="text-xs text-gray-500">Pendientes</div></div>
            <div><div className="text-2xl font-bold text-gray-600">{completedCount + pendingCount}</div><div className="text-xs text-gray-500">Total</div></div>
          </div>

          {routeStartTime && completedCount > 0 && (
            <div className="text-xs text-gray-500 mb-3">
              <span>Est. {Math.round(completedCount * config.distanciaPorVisita)} km • </span>
              <span>Est. ${Math.round(completedCount * config.distanciaPorVisita * config.costoCombustiblePorKm)} combustible</span>
            </div>
          )}

          {pendingCount > 0 && (
            <div className="text-xs text-gray-500 mb-3 p-2 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center">
                  <Route className="h-3 w-3 text-blue-600 mr-1" /><span className="font-medium text-blue-700">Ruta Optimizada</span>
                </div>
                <button onClick={openFullRouteInMaps} className="text-xs bg-blue-600 text-white px-2 py-1 rounded-md hover:bg-blue-700 flex items-center">
                  <Navigation className="h-3 w-3 mr-1" />Ver Ruta Completa
                </button>
              </div>
              <div><span>Distancia total estimada: {totalRouteDistance.toFixed(1)} km</span><span className="mx-2">•</span><span>Combustible: ${Math.round(totalRouteDistance * config.costoCombustiblePorKm)}</span></div>
              <div className="text-xs text-blue-600 mt-1">Los clientes están ordenados por proximidad para minimizar el recorrido</div>
            </div>
          )}

          {Object.keys(postponePool).length > 0 && (
            <button onClick={() => setShowPostponePool(!showPostponePool)}
              className="w-full mb-3 py-2 px-4 bg-yellow-100 text-yellow-800 rounded-lg font-medium hover:bg-yellow-200 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 mr-2" />
              {showPostponePool ? "Ocultar" : "Mostrar"} Clientes Pospuestos ({Object.keys(postponePool).length})
            </button>
          )}

          {pendingReschedules.length > 0 && (
            <div className="mb-3">
              <button onClick={savePendingReschedules} disabled={savingReschedules}
                className="w-full py-2 px-4 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center">
                {savingReschedules ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />Guardando...</> :
                  <><Save className="h-4 w-4 mr-2" />Guardar Cambios Temporales ({pendingReschedules.length})</>}
              </button>
              <div className="text-xs text-gray-500 text-center mt-1">Los cambios son temporales y se revertirán después de la visita</div>
            </div>
          )}

          {routeFinishedToday && (
            <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-green-800">Ruta del {selectedDay} ya finalizada</div>
                  <div className="text-xs text-green-600">Puedes finalizar nuevamente si tienes clientes adicionales</div>
                </div>
              </div>
            </div>
          )}

          {(routeInProgress || routeStartTime || routeFinishedToday) && (
            <button onClick={finishRoute} disabled={savingRoute}
              className={`w-full py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center ${routeFinishedToday ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-green-600 text-white hover:bg-green-700"}`}>
              {savingRoute ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />Guardando...</> :
                <><Save className="h-4 w-4 mr-2" />{routeFinishedToday ? `Re-Finalizar Ruta del ${selectedDay}` : `Finalizar Ruta del ${selectedDay}`}</>}
            </button>
          )}
        </div>

        {/* Day Selector */}
        <div className="bg-gray-100 rounded-lg mb-4 p-1">
          <div className="grid grid-cols-7 gap-1">
            {ROUTE_DAYS.map(day => {
              const isToday = day === mazatlanDayName;
              return (
                <button key={day}
                  className={`py-2 px-1 text-xs font-medium rounded-md transition-colors ${selectedDay === day ? "bg-white text-gray-900 shadow-sm" : "bg-gray-100 text-gray-500 hover:text-gray-700"} ${isToday ? "ring-2 ring-blue-400" : ""}`}
                  onClick={() => {
                    setSelectedDay(day);
                    setRouteFinishedToday(false);
                    setRouteStartTime(null);
                    setRouteInProgress(false);
                    setVisitStatus(prev => Object.fromEntries(Object.entries(prev).filter(([_, s]) => s === "postponed")));
                    setTimeout(() => loadPersistedRouteState(day), 150);
                  }}>
                  <div className="flex flex-col items-center">
                    <span>{day.slice(0, 3)}</span>
                    {isToday && <span className="text-xs text-blue-600">HOY</span>}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="text-xs text-gray-500 text-center mt-2">Semana actual • Días pasados muestran lo completado</div>
        </div>

        {/* Postpone Pool */}
        {showPostponePool && Object.keys(postponePool).length > 0 && (
          <div className="mb-4 bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="flex items-center mb-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
              <h3 className="text-lg font-semibold text-yellow-800">Clientes Pospuestos</h3>
            </div>
            <div className="space-y-2">
              {Object.entries(postponePool).map(([clientName, data]) => (
                <div key={clientName} className="bg-white rounded-lg p-3 border border-yellow-100">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">{clientName}</h4>
                      <div className="text-xs text-gray-500">
                        <span className="text-red-600">{data.originalDay}</span> → <span className="text-orange-600">{rescheduledClients[clientName]?.newDay || "Sin reprogramar"}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getClientTypeColor(data.client.Tipo_Cliente)}`}>{data.client.Tipo_Cliente}</span>
                  </div>
                  <div className="text-xs font-medium text-gray-700 mb-2">Selecciona nuevo día:</div>
                  <div className="grid grid-cols-7 gap-1">
                    {ROUTE_DAYS.map(day => (
                      <button key={day} onClick={() => rescheduleFromPostponePool(clientName, day)} disabled={day === data.originalDay}
                        className={`py-1 px-1 text-xs rounded transition-colors ${day === data.originalDay ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-blue-100 text-blue-700 hover:bg-blue-200"}`}>
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clients List */}
        <div className="space-y-3 transition-all duration-300">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
              <p className="text-gray-500 mt-2">Cargando clientes...</p>
            </div>
          ) : optimizedPendingClients.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No hay clientes pendientes para {selectedDay}</p>
              <p className="text-xs text-gray-400 mt-1">Los clientes aparecen según su frecuencia de visita</p>
            </div>
          ) : (
            optimizedPendingClients.map((client, index) => {
              const status = visitStatus[client.Nombre] || "pending";
              const distanceFromPrevious = index === 0
                ? calculateDistance(DEFAULT_START_LAT, DEFAULT_START_LNG, client.Latitude, client.Longitud)
                : calculateDistance(optimizedPendingClients[index - 1].Latitude, optimizedPendingClients[index - 1].Longitud, client.Latitude, client.Longitud);
              const originalName = getOriginalClientName(client.Nombre);
              const isFirstTime = !visitHistory[originalName];
              const visitType = getVisitType(client.Nombre);

              return (
                <div key={index}
                  className={`bg-white rounded-lg border border-[#E2E4E9] p-4 transition-all duration-300 ${completingClient === client.Nombre ? "transform scale-95 opacity-60 bg-green-50 border-green-200 shadow-lg" : "hover:shadow-md"}`}
                  style={{ animation: completingClient === client.Nombre ? "gentle-pulse 0.3s ease-out" : undefined }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mr-2">{index + 1}</div>
                        <h3 className="font-semibold text-gray-900">{client.Nombre}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getClientTypeColor(client.Tipo_Cliente)}`}>{client.Tipo_Cliente}</span>
                        {visitType !== "Normal" && <span className={`px-2 py-1 rounded-full text-xs font-medium ${visitType === "Pedidos" ? "bg-orange-100 text-orange-700" : "bg-purple-100 text-purple-700"}`}>{visitType}</span>}
                        {isFirstTime && <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Nueva</span>}
                      </div>
                      <div className="flex items-center text-sm text-gray-500 mb-1">
                        <MapPin className="h-4 w-4 mr-1" /><span>{distanceFromPrevious.toFixed(1)} km {index === 0 ? "desde inicio" : "desde anterior"}</span>
                        <span className="mx-2">•</span><span>Cada {client.Frecuencia} semanas</span>
                      </div>
                      <div className="flex items-center text-xs text-gray-400"><Clock className="h-3 w-3 mr-1" /><span>{getVisitStatusText(client)}</span></div>
                    </div>
                    <div className="flex items-center gap-2">{getStatusIcon(status)}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateVisitStatus(client, "completed")} disabled={completingClient === client.Nombre}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${completingClient === client.Nombre ? "bg-green-500 text-white transform scale-95" : status === "completed" ? "bg-green-100 text-green-700 border border-green-300" : "bg-gray-100 text-gray-700 hover:bg-green-50"}`}>
                      {completingClient === client.Nombre ? <span className="flex items-center justify-center"><CheckCircle className="h-4 w-4 mr-1" />Completado</span> : "Completar"}
                    </button>
                    {cleyDaySelector === client.Nombre ? (
                      <div className="flex-1">
                        <div className="text-xs text-center mb-1 text-gray-600">Posponer para:</div>
                        <div className="grid grid-cols-3 gap-1">
                          {ROUTE_DAYS.slice(0, 6).map(day => (
                            <button key={day} onClick={() => { postponeClient(client, day); setCleyDaySelector(null); }}
                              className="py-1 px-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200">{day.slice(0, 3)}</button>
                          ))}
                        </div>
                        <button onClick={() => setCleyDaySelector(null)} className="w-full mt-1 py-1 text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
                      </div>
                    ) : (
                      <button onClick={() => setCleyDaySelector(client.Nombre)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${status === "postponed" ? "bg-yellow-100 text-yellow-700 border border-yellow-300" : "bg-gray-100 text-gray-700 hover:bg-yellow-50"}`}>
                        Posponer
                      </button>
                    )}
                    <button onClick={() => openInMaps(client)} className="py-2 px-3 rounded-lg text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200">
                      <Navigation className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Completed Clients Section */}
        {allCompletedTodayClients.length > 0 && (
          <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center mb-3">
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedDay === mazatlanDayName ? "Completados Hoy" : `Completados el ${selectedDay}`}
              </h3>
              <span className="ml-auto text-sm text-gray-500">{allCompletedTodayClients.length} clientes</span>
            </div>
            <div className="space-y-2">
              {allCompletedTodayClients.map((client, index) => (
                <div key={index} className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-100">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3" />
                    <div>
                      <h4 className="font-medium text-gray-900">{client.Nombre}</h4>
                      <p className="text-xs text-gray-500">Próxima visita en {client.Frecuencia} semanas</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getClientTypeColor(client.Tipo_Cliente)}`}>{client.Tipo_Cliente}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-gray-500 text-center">Estos clientes aparecerán nuevamente según su frecuencia de visita</div>
          </div>
        )}
      </div>
    </>
  );
}
