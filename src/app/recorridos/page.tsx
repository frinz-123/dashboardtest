"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  MapPin, Calendar, Clock, CheckCircle, XCircle,
  AlertTriangle, Users, Route, Navigation, Save, Timer,
  ChevronDown, Fuel, TrendingUp, X,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
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
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [selectedDay, setSelectedDay] = useState<RouteDay>(getMazatlanDayName);
  const [cleyDaySelector, setCleyDaySelector] = useState<string | null>(null);
  const [completingClient, setCompletingClient] = useState<string | null>(null);
  const [showPostponePool, setShowPostponePool] = useState(false);
  const [showCompletedSection, setShowCompletedSection] = useState(true);

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
    if (selectedVendorEmail) return selectedVendorEmail;
    return userEmail;
  };

  // ===== API FETCH FUNCTIONS =====
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
            ? record.proxima_visita_programada.slice(0, 10) : null;
          if (!scheduledDateOnly) return;
          const existing = visits[clientName];
          const classify = (d: string) => d === mazatlanToday ? 0 : d < mazatlanToday ? 1 : 2;
          const shouldReplace = !existing?.scheduledDate ||
            classify(scheduledDateOnly) < classify(existing.scheduledDate) ||
            (classify(scheduledDateOnly) === classify(existing.scheduledDate) &&
              (classify(scheduledDateOnly) === 1 ? scheduledDateOnly > existing.scheduledDate : scheduledDateOnly < existing.scheduledDate));
          if (shouldReplace) {
            visits[clientName] = { clientName, scheduledDate: scheduledDateOnly, week: record.semana_numero ? `Semana ${record.semana_numero}` : "", status: record.estado };
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
            reschedules[clientKey] = { originalDay: record.dia_original, newDay: record.dia_nuevo, visitType: record.tipo_visita };
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
      const email = selectedVendorEmail || userEmail;
      if (!email) return;
      const storageKey = `routeState_${email}_${getMazatlanToday()}`;
      const dayForState = dayToSave || selectedDay;
      if (startTime || finished) {
        localStorage.setItem(storageKey, JSON.stringify({ routeStartTime: startTime, selectedDay: dayForState, routeFinished: finished, finishedAt, timestamp: new Date().toISOString() }));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch (error) {
      debug.error("Error saving route state:", error);
    }
  };

  const loadPersistedRouteState = (dayToCheck?: RouteDay, performanceData?: any[]) => {
    try {
      const email = selectedVendorEmail || userEmail;
      if (!email) return;
      const mazatlanToday = getMazatlanToday();
      const dayToSearch = dayToCheck || selectedDay;
      setRouteFinishedToday(false);
      setRouteStartTime(null);
      setRouteInProgress(false);
      if (isMaster && selectedVendorEmail === null) return;
      const dataToCheck = performanceData ?? routePerformanceData;
      const vendorAliases = new Set<string>();
      const targetEmail = selectedVendorEmail || email;
      getVendorIdentifiers(targetEmail).forEach(v => vendorAliases.add(v));
      const matchingRecord = dataToCheck.find(record => {
        const isCorrectDay = record.dia_ruta?.toLowerCase() === dayToSearch.toLowerCase();
        const isCorrectDate = record.fecha === mazatlanToday;
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
      const storageKey = `routeState_${email}_${mazatlanToday}`;
      const savedState = localStorage.getItem(storageKey);
      if (savedState) {
        const { routeStartTime: savedStartTime, selectedDay: savedDay, routeFinished } = JSON.parse(savedState);
        if (savedDay === dayToSearch && dayToSearch === getMazatlanDayName()) {
          if (savedStartTime) { setRouteStartTime(savedStartTime); setRouteInProgress(true); }
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
      const hasCompletedVisitsToday = isSelectedDayToday && Object.values(visitHistory).some(h => h.lastVisitDate === mazatlanToday);
      const shouldShowFinishButton = isSelectedDayToday && (hasCompletedVisitsToday || (!!routeStartTime && !routeFinishedToday));
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
        for (const key of possibleKeys) { if (rescheduledClients[key]) { clientDay = rescheduledClients[key].newDay; break; } }
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
    if (scheduledVisit?.status === "Programado" && scheduledVisit.scheduledDate <= mazatlanToday) return true;
    if (!clientHistory) return true;
    if (clientHistory.lastVisitDate === mazatlanToday) return true;
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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deactivate_reschedule", userEmail: writeEmail, clientName, visitType, masterEmail: isMaster ? userEmail : undefined }),
      });
      if (response.ok) {
        const clientKey = `${clientName} (${visitType})`;
        setRescheduledClients(prev => { const newState = { ...prev }; delete newState[clientKey]; return newState; });
      }
    } catch (error) { debug.error("Error deactivating reschedule:", error); }
  };

  const updateVisitStatus = async (client: Client, status: VisitStatus, notes?: string) => {
    try {
      if (!routeStartTime && status === "completed") startRoute();
      if (status === "completed") {
        setCompletingClient(client.Nombre);
        setTimeout(() => { setVisitStatus(prev => ({ ...prev, [client.Nombre]: status })); setTimeout(() => setCompletingClient(null), 300); }, 100);
      } else {
        setVisitStatus(prev => ({ ...prev, [client.Nombre]: status }));
      }
      const visitTypeForCley = getVisitType(client.Nombre);
      const originalClientName = getOriginalClientName(client.Nombre);
      const writeEmail = getWriteVendorEmail();
      if (!writeEmail) return;
      const response = await fetch("/api/recorridos/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_visit_status", userEmail: writeEmail, clientName: originalClientName, routeDay: client.Dia, visitType: status, visitDate: getSelectedDayDate(selectedDay), location: currentLocation, notes: visitTypeForCley !== "Normal" ? `${visitTypeForCley}: ${notes || ""}` : notes || "", cleyVisitType: visitTypeForCley, masterEmail: isMaster ? userEmail : undefined }),
      });
      if (response.ok) {
        const responseData = await response.json().catch(() => null);
        if (status === "completed") {
          const fecha = responseData?.data?.fecha || getSelectedDayDate(selectedDay);
          setVisitHistory(prev => ({ ...prev, [originalClientName]: { clientName: originalClientName, lastVisitDate: fecha, lastVisitWeek: getWeekNumber(new Date(`${fecha}T12:00:00.000Z`)) } }));
          if (rescheduledClients[client.Nombre]) { deactivateRescheduleAfterVisit(originalClientName, visitTypeForCley); }
        }
      } else { setVisitStatus(prev => { const s = { ...prev }; delete s[client.Nombre]; return s; }); }
    } catch (error) { debug.error("Error updating visit status:", error); setVisitStatus(prev => { const s = { ...prev }; delete s[client.Nombre]; return s; }); }
  };

  const finishRoute = async () => {
    if (!routeStartTime && !routeInProgress) { alert("No se ha iniciado ninguna ruta. Completa al menos una visita primero."); return; }
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
      const skippedClients = clientsConsideredForVisitToday.filter(c => visitStatus[c.Nombre] === "skipped" || visitStatus[c.Nombre] === "postponed").map(c => c.Nombre);
      let observaciones = `Visitados: ${visitedClients.join(", ")}`;
      if (skippedClients.length > 0) observaciones += `. No visitados: ${skippedClients.join(", ")}`;
      const writeEmail = getWriteVendorEmail();
      if (!writeEmail) { alert("No se encontró el email del usuario."); return; }
      const response = await fetch("/api/recorridos/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_route_summary", userEmail: writeEmail, routeDay: selectedDay, fecha, clientesProgramados, clientesVisitados, ventasTotales: 0, tiempoInicio: actualStartTime, tiempoFin: endTime, kilometrosRecorridos: totalDistanceKm, combustibleGastado: fuelCost, observaciones: observaciones.slice(0, 500), masterEmail: isMaster ? userEmail : undefined }),
      });
      if (response.ok) {
        setRouteFinishedToday(true);
        saveRouteState(actualStartTime, true, endTime);
        alert(`Ruta del ${selectedDay} finalizada exitosamente!\n\nResumen:\n• ${clientesVisitados}/${clientesProgramados} clientes visitados\n• Tiempo: ${actualStartTime} - ${endTime}\n• Distancia: ${totalDistanceKm} km\n• Combustible: $${fuelCost}`);
        setVisitStatus({});
        setRouteStartTime(null);
        setRouteInProgress(false);
        await fetchVisitHistory();
      } else { alert("Error al guardar el resumen de la ruta. Inténtalo de nuevo."); }
    } catch (error) { debug.error("Error finishing route:", error); alert("Error al finalizar la ruta. Inténtalo de nuevo."); } finally { setSavingRoute(false); }
  };

  // ===== POSTPONE FUNCTIONS =====
  const postponeClient = async (client: Client, targetDay: RouteDay) => {
    const today = new Date().toISOString().split("T")[0];
    const isCley = checkIsCleyClient(client.Tipo_Cliente);
    setPostponePool(prev => ({ ...prev, [client.Nombre]: { client: { ...client, Dia: targetDay }, originalDay: client.Dia, postponedOn: today } }));
    setVisitStatus(prev => ({ ...prev, [client.Nombre]: "postponed" }));
    const writeEmail = getWriteVendorEmail();
    if (!writeEmail) { alert("No se encontró el email del usuario."); return; }
    try {
      const response = await fetch("/api/recorridos/reschedule", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "batch_reschedule", userEmail: writeEmail, reschedules: [{ clientName: client.Nombre, originalDay: client.Dia, newDay: targetDay, visitType: isCley ? getVisitType(client.Nombre) : "Normal" }], masterEmail: isMaster ? userEmail : undefined }),
      });
      if (response.ok) { setRescheduledClients(prev => ({ ...prev, [client.Nombre]: { originalDay: client.Dia, newDay: targetDay, visitType: isCley ? getVisitType(client.Nombre) : "Normal" } })); }
      else { setPostponePool(prev => { const p = { ...prev }; delete p[client.Nombre]; return p; }); setVisitStatus(prev => { const s = { ...prev }; delete s[client.Nombre]; return s; }); alert("Error al posponer el cliente. Inténtalo de nuevo."); }
    } catch (error) { setPostponePool(prev => { const p = { ...prev }; delete p[client.Nombre]; return p; }); setVisitStatus(prev => { const s = { ...prev }; delete s[client.Nombre]; return s; }); alert("Error de conexión al posponer el cliente. Inténtalo de nuevo."); }
  };

  const rescheduleFromPostponePool = (clientName: string, targetDay: RouteDay) => {
    const postponedClient = postponePool[clientName];
    if (!postponedClient) return;
    const visitType = getVisitType(clientName);
    const originalClientName = getOriginalClientName(clientName);
    const isCley = checkIsCleyClient(postponedClient.client.Tipo_Cliente);
    if (isCley) { setPendingReschedules(prev => { const filtered = prev.filter(r => !(r.clientName === originalClientName && r.visitType === visitType)); return [...filtered, { clientName: originalClientName, originalDay: postponedClient.originalDay, newDay: targetDay, visitType }]; }); }
    setRescheduledClients(prev => ({ ...prev, [clientName]: { originalDay: postponedClient.originalDay, newDay: targetDay, visitType: isCley ? visitType : "Normal" } }));
    setPostponePool(prev => { const p = { ...prev }; delete p[clientName]; return p; });
    setVisitStatus(prev => { const s = { ...prev }; delete s[clientName]; return s; });
  };

  const savePendingReschedules = async () => {
    if (pendingReschedules.length === 0) { alert("No hay cambios pendientes para guardar"); return; }
    try {
      setSavingReschedules(true);
      const writeEmail = getWriteVendorEmail();
      if (!writeEmail) { alert("No se encontró el email del usuario."); return; }
      const response = await fetch("/api/recorridos/reschedule", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "batch_reschedule", userEmail: writeEmail, reschedules: pendingReschedules, masterEmail: isMaster ? userEmail : undefined }),
      });
      if (response.ok) { setPendingReschedules([]); await fetchRescheduledVisits(); alert(`${pendingReschedules.length} reprogramaciones temporales guardadas exitosamente.`); }
      else { alert("Error al guardar las reprogramaciones. Inténtalo de nuevo."); }
    } catch (error) { debug.error("Error saving reschedules:", error); alert("Error al guardar las reprogramaciones. Inténtalo de nuevo."); } finally { setSavingReschedules(false); }
  };

  // ===== COMPUTED VALUES =====
  const expandedClients = useMemo(() => expandCleyClients(clients), [clients, rescheduledClients]);
  const clientsForSelectedDay = useMemo(() => expandedClients.filter(c => normalizeDay(c.Dia || "") === normalizeDay(selectedDay)), [expandedClients, selectedDay]);
  const postponedClientsForToday = useMemo(() => Object.values(postponePool).filter(p => normalizeDay(p.client.Dia || "") === normalizeDay(selectedDay)).map(p => p.client), [postponePool, selectedDay]);
  const allClientsForSelectedDay = useMemo(() => [...clientsForSelectedDay, ...postponedClientsForToday], [clientsForSelectedDay, postponedClientsForToday]);
  const clientsConsideredForVisitToday = useMemo(() => allClientsForSelectedDay.filter(client => { const isPostponed = postponedClientsForToday.some(p => p.Nombre === client.Nombre); return isPostponed || shouldBeConsideredForVisitToday(client); }), [allClientsForSelectedDay, postponedClientsForToday, visitHistory, scheduledVisits]);
  const selectedDayDateString = getSelectedDayDate(selectedDay);
  const actuallyPendingClients = useMemo(() => clientsConsideredForVisitToday.filter(client => { const originalName = getOriginalClientName(client.Nombre); const history = visitHistory[originalName]; const status = visitStatus[client.Nombre]; const wasVisitedOnSelectedDay = history?.lastVisitDate === selectedDayDateString; const isPostponed = postponedClientsForToday.some(p => p.Nombre === client.Nombre); if (isPostponed && status !== "completed") return true; if (status === "completed" || status === "skipped" || status === "postponed") return false; if (wasVisitedOnSelectedDay) return false; return true; }), [clientsConsideredForVisitToday, visitHistory, visitStatus, selectedDayDateString, postponedClientsForToday]);
  const optimizedPendingClients = useMemo(() => optimizeRoute(actuallyPendingClients), [actuallyPendingClients]);
  const totalRouteDistance = useMemo(() => calculateTotalRouteDistance(optimizedPendingClients), [optimizedPendingClients]);
  const allCompletedTodayClients = useMemo(() => allClientsForSelectedDay.filter(c => visitHistory[getOriginalClientName(c.Nombre)]?.lastVisitDate === selectedDayDateString), [allClientsForSelectedDay, visitHistory, selectedDayDateString]);
  const completedCount = allCompletedTodayClients.length;
  const pendingCount = optimizedPendingClients.length;
  const progressPercent = (completedCount + pendingCount) > 0 ? (completedCount / (completedCount + pendingCount)) * 100 : 0;

  // ===== HELPER FUNCTIONS =====
  const getCurrentLocation = () => { if (navigator.geolocation) { navigator.geolocation.getCurrentPosition(pos => setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }), err => debug.error("Error getting location:", err)); } };
  const openInMaps = (client: Client) => { window.open(`https://www.google.com/maps/dir/?api=1&destination=${client.Latitude},${client.Longitud}`, "_blank"); };
  const openFullRouteInMaps = () => { if (optimizedPendingClients.length === 0) return; const startPoint = `${DEFAULT_START_LAT},${DEFAULT_START_LNG}`; const waypoints = optimizedPendingClients.slice(0, -1).map(c => `${c.Latitude},${c.Longitud}`).join("|"); const destination = optimizedPendingClients[optimizedPendingClients.length - 1]; let url = `https://www.google.com/maps/dir/?api=1&origin=${startPoint}&destination=${destination.Latitude},${destination.Longitud}`; if (waypoints) url += `&waypoints=${waypoints}`; window.open(url, "_blank"); };

  const getVisitStatusText = (client: Client): string => {
    const originalName = getOriginalClientName(client.Nombre);
    const history = visitHistory[originalName];
    const scheduledVisit = scheduledVisits[originalName] || scheduledVisits[client.Nombre];
    const mazatlanToday = getMazatlanToday();
    if (scheduledVisit?.status === "Programado") { const daysDiff = Math.floor((new Date(scheduledVisit.scheduledDate).getTime() - new Date(mazatlanToday).getTime()) / (1000 * 60 * 60 * 24)); if (daysDiff === 0) return "Programado para hoy"; if (daysDiff < 0) return `Programado hace ${Math.abs(daysDiff)} días`; return `Programado en ${daysDiff} días`; }
    if (!history) return "Primera visita";
    const daysSince = Math.floor((Date.now() - new Date(history.lastVisitDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince === 0) return "Completado hoy";
    const weeksSince = Math.floor(daysSince / 7);
    return weeksSince === 0 ? `Visitado hace ${daysSince} días` : `Visitado hace ${weeksSince} semanas`;
  };

  const getStatusIcon = (status: VisitStatus) => {
    switch (status) {
      case "completed": return <CheckCircle className="h-5 w-5 text-emerald-500" />;
      case "skipped": return <XCircle className="h-5 w-5 text-red-500" />;
      case "postponed": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      default: return <Clock className="h-5 w-5 text-slate-300" />;
    }
  };

  const getTypeStyles = (type: string) => {
    switch (type?.toUpperCase()) {
      case "CLEY": return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "PREMIUM": return "bg-violet-50 text-violet-700 border-violet-200";
      case "REGULAR": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      default: return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  // ===== EFFECTS =====
  useEffect(() => {
    if (userEmail) {
      const masterStatus = isMasterAccount(userEmail);
      setIsMaster(masterStatus);
      let initialVendorEmail: string | null = null;
      if (masterStatus) {
        const vendors = getVendorEmails().map(email => ({ email, label: getVendorLabel(email) }));
        setAvailableVendors(vendors);
        const userHasOwnRoutes = vendors.some(v => v.email === userEmail);
        if (userHasOwnRoutes) { initialVendorEmail = userEmail; setSelectedVendorEmail(userEmail); setViewingAsVendor(getVendorLabel(userEmail)); }
        else if (vendors.length > 0) { initialVendorEmail = vendors[0].email; setSelectedVendorEmail(vendors[0].email); setViewingAsVendor(vendors[0].label); }
        else { initialVendorEmail = null; setSelectedVendorEmail(null); setViewingAsVendor("Todas las Rutas"); }
      }
      setDataLoaded(false);
      Promise.all([fetchClients(masterStatus, initialVendorEmail), fetchConfiguration(), fetchVisitHistory(masterStatus, initialVendorEmail), fetchScheduledVisits(masterStatus, initialVendorEmail), fetchRescheduledVisits(masterStatus, initialVendorEmail), fetchRoutePerformance(masterStatus, initialVendorEmail)]).then(() => { setDataLoaded(true); loadPersistedRouteState(); checkRouteInProgress(); }).catch(() => setDataLoaded(true));
      getCurrentLocation();
    }
  }, [session]);

  useEffect(() => {
    if (isMaster && dataLoaded) {
      setRouteFinishedToday(false); setRouteStartTime(null); setRouteInProgress(false);
      const fetchAndUpdateState = async () => {
        await Promise.all([fetchClients(), fetchVisitHistory(), fetchScheduledVisits(), fetchRescheduledVisits()]);
        try {
          const apiUrl = buildApiUrl("performance", userEmail, isMaster, selectedVendorEmail);
          const response = await fetch(apiUrl);
          if (response.ok) { const data = await response.json(); const freshPerformanceData = data.data || []; setRoutePerformanceData(freshPerformanceData); loadPersistedRouteState(undefined, freshPerformanceData); }
        } catch (error) { debug.error("Error fetching performance data:", error); }
        checkRouteInProgress();
      };
      fetchAndUpdateState();
    }
  }, [selectedVendorEmail, isMaster]);

  useEffect(() => { if (dataLoaded) checkRouteInProgress(); }, [visitHistory, dataLoaded]);

  const mazatlanDayName = getMazatlanDayName();

  // ===== RENDER =====
  if (status === "loading" || loading || !dataLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Route className="h-8 w-8 text-white animate-pulse" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-ping" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-slate-600 font-medium">{status === "loading" ? "Iniciando sesión..." : loading ? "Cargando rutas..." : "Preparando datos..."}</p>
          <p className="text-slate-400 text-sm mt-1">Un momento por favor</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes checkmark { 0% { transform: scale(0.8); opacity: 0; } 50% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
        .animate-slideUp { animation: slideUp 0.3s ease-out forwards; }
        .animate-scaleIn { animation: scaleIn 0.2s ease-out forwards; }
        .animate-checkmark { animation: checkmark 0.3s ease-out forwards; }
        .card-shadow { box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03); }
        .card-shadow-hover:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04); }
      `}} />

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <AppHeader title="Recorridos" icon={Route} subtitle={isMaster ? viewingAsVendor : undefined} />

        <main className="px-4 py-4 max-w-2xl mx-auto space-y-4">
          {/* Vendor Selector */}
          <VendorSelector currentVendor={selectedVendorEmail} vendors={availableVendors} onVendorChange={email => { setSelectedVendorEmail(email); setViewingAsVendor(email ? getVendorLabel(email) : "Todas las Rutas"); }} isVisible={isMaster} />

          {/* Progress Card */}
          <div className="bg-white rounded-2xl card-shadow border border-slate-200/50 overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">{selectedDay}</span>
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900">Progreso del Día</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{getSelectedDayFormattedDate(selectedDay)}</p>
                </div>
                {/* Circular Progress */}
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 -rotate-90">
                    <circle cx="32" cy="32" r="28" stroke="#e2e8f0" strokeWidth="6" fill="none" />
                    <circle cx="32" cy="32" r="28" stroke="url(#progressGradient)" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={`${progressPercent * 1.76} 176`} className="transition-all duration-500" />
                    <defs><linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#6366f1" /></linearGradient></defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-slate-900">{Math.round(progressPercent)}%</span>
                  </div>
                </div>
              </div>

              {routeStartTime && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg mb-4">
                  <Timer className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">Iniciada a las {routeStartTime}</span>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl p-3 text-center border border-emerald-200/50">
                  <div className="text-2xl font-bold text-emerald-600">{completedCount}</div>
                  <div className="text-xs text-emerald-600/80 font-medium">Completados</div>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-3 text-center border border-amber-200/50">
                  <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
                  <div className="text-xs text-amber-600/80 font-medium">Pendientes</div>
                </div>
                <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-3 text-center border border-slate-200/50">
                  <div className="text-2xl font-bold text-slate-600">{completedCount + pendingCount}</div>
                  <div className="text-xs text-slate-500 font-medium">Total</div>
                </div>
              </div>

              {/* Route Info */}
              {pendingCount > 0 && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200/50 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-semibold text-blue-900">Ruta Optimizada</span>
                    </div>
                    <button onClick={openFullRouteInMaps} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm">
                      <Navigation className="h-3.5 w-3.5" />Ver en Mapa
                    </button>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-blue-700">
                      <MapPin className="h-4 w-4" />
                      <span className="font-medium">{totalRouteDistance.toFixed(1)} km</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-blue-700">
                      <Fuel className="h-4 w-4" />
                      <span className="font-medium">${Math.round(totalRouteDistance * config.costoCombustiblePorKm)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Postponed Toggle */}
              {Object.keys(postponePool).length > 0 && (
                <button onClick={() => setShowPostponePool(!showPostponePool)} className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium rounded-xl transition-colors border border-amber-200/50 mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  {showPostponePool ? "Ocultar" : "Ver"} Pospuestos ({Object.keys(postponePool).length})
                </button>
              )}

              {/* Pending Reschedules */}
              {pendingReschedules.length > 0 && (
                <button onClick={savePendingReschedules} disabled={savingReschedules} className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-orange-500/20 mb-4">
                  {savingReschedules ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar Cambios ({pendingReschedules.length})
                </button>
              )}

              {/* Route Finished Badge */}
              {routeFinishedToday && (
                <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border border-emerald-200/50 mb-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-emerald-800">Ruta Completada</div>
                    <div className="text-sm text-emerald-600">Puedes finalizar nuevamente si es necesario</div>
                  </div>
                </div>
              )}

              {/* Finish Route Button */}
              {(routeInProgress || routeStartTime || routeFinishedToday) && (
                <button onClick={finishRoute} disabled={savingRoute} className={`w-full flex items-center justify-center gap-2 py-3.5 font-semibold rounded-xl transition-all disabled:opacity-50 shadow-lg ${routeFinishedToday ? "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-blue-500/20" : "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-emerald-500/20"}`}>
                  {savingRoute ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="h-5 w-5" />}
                  {routeFinishedToday ? "Re-Finalizar Ruta" : "Finalizar Ruta"}
                </button>
              )}
            </div>
          </div>

          {/* Day Selector */}
          <div className="bg-white rounded-2xl card-shadow border border-slate-200/50 p-2">
            <div className="grid grid-cols-7 gap-1">
              {ROUTE_DAYS.map(day => {
                const isToday = day === mazatlanDayName;
                const isSelected = selectedDay === day;
                return (
                  <button key={day} onClick={() => { setSelectedDay(day); setRouteFinishedToday(false); setRouteStartTime(null); setRouteInProgress(false); setVisitStatus(prev => Object.fromEntries(Object.entries(prev).filter(([_, s]) => s === "postponed"))); setTimeout(() => loadPersistedRouteState(day), 150); }}
                    className={`relative py-2.5 rounded-xl text-xs font-semibold transition-all ${isSelected ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-500 hover:bg-slate-100"}`}>
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{day.slice(0, 2)}</span>
                      {isToday && !isSelected && <div className="w-1 h-1 rounded-full bg-blue-500" />}
                      {isToday && isSelected && <div className="w-1 h-1 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Postpone Pool */}
          {showPostponePool && Object.keys(postponePool).length > 0 && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl card-shadow border border-amber-200/50 p-4 animate-slideUp">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h3 className="font-semibold text-amber-900">Clientes Pospuestos</h3>
              </div>
              <div className="space-y-3">
                {Object.entries(postponePool).map(([clientName, data]) => (
                  <div key={clientName} className="bg-white rounded-xl p-4 border border-amber-200/50">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-slate-900">{clientName}</h4>
                        <div className="text-xs text-slate-500 mt-0.5">
                          <span className="text-red-500">{data.originalDay}</span> → <span className="text-amber-600">{rescheduledClients[clientName]?.newDay || "—"}</span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${getTypeStyles(data.client.Tipo_Cliente)}`}>{data.client.Tipo_Cliente}</span>
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {ROUTE_DAYS.map(day => (
                        <button key={day} onClick={() => rescheduleFromPostponePool(clientName, day)} disabled={day === data.originalDay}
                          className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${day === data.originalDay ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-blue-100 text-blue-700 hover:bg-blue-200"}`}>
                          {day.slice(0, 2)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clients List */}
          <div className="space-y-3">
            {loading ? (
              <div className="bg-white rounded-2xl card-shadow border border-slate-200/50 p-12 text-center">
                <div className="w-12 h-12 rounded-full border-3 border-slate-200 border-t-blue-500 animate-spin mx-auto mb-4" />
                <p className="text-slate-500 font-medium">Cargando clientes...</p>
              </div>
            ) : optimizedPendingClients.length === 0 ? (
              <div className="bg-white rounded-2xl card-shadow border border-slate-200/50 p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Sin clientes pendientes</h3>
                <p className="text-sm text-slate-500">No hay visitas programadas para {selectedDay}</p>
              </div>
            ) : (
              optimizedPendingClients.map((client, index) => {
                const status = visitStatus[client.Nombre] || "pending";
                const distanceFromPrevious = index === 0 ? calculateDistance(DEFAULT_START_LAT, DEFAULT_START_LNG, client.Latitude, client.Longitud) : calculateDistance(optimizedPendingClients[index - 1].Latitude, optimizedPendingClients[index - 1].Longitud, client.Latitude, client.Longitud);
                const originalName = getOriginalClientName(client.Nombre);
                const isFirstTime = !visitHistory[originalName];
                const visitType = getVisitType(client.Nombre);
                const isCompleting = completingClient === client.Nombre;

                return (
                  <div key={index} className={`bg-white rounded-2xl card-shadow card-shadow-hover border border-slate-200/50 overflow-hidden transition-all duration-300 animate-slideUp ${isCompleting ? "scale-[0.98] opacity-70 border-emerald-300 bg-emerald-50" : ""}`} style={{ animationDelay: `${index * 50}ms` }}>
                    <div className="p-4">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/20 flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-semibold text-slate-900 truncate">{client.Nombre}</h3>
                            <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${getTypeStyles(client.Tipo_Cliente)}`}>{client.Tipo_Cliente}</span>
                            {visitType !== "Normal" && <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${visitType === "Pedidos" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-purple-50 text-purple-700 border-purple-200"}`}>{visitType}</span>}
                            {isFirstTime && <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Nueva</span>}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{distanceFromPrevious.toFixed(1)} km</span>
                            <span>•</span>
                            <span>Cada {client.Frecuencia} sem</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                            <Clock className="h-3 w-3" />{getVisitStatusText(client)}
                          </div>
                        </div>
                        <div className="flex-shrink-0">{getStatusIcon(status)}</div>
                      </div>

                      <div className="flex gap-2">
                        <button onClick={() => updateVisitStatus(client, "completed")} disabled={isCompleting}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${isCompleting ? "bg-emerald-500 text-white" : status === "completed" ? "bg-emerald-100 text-emerald-700 border border-emerald-300" : "bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"}`}>
                          {isCompleting ? <CheckCircle className="h-4 w-4 animate-checkmark" /> : null}
                          {isCompleting ? "Listo" : "Completar"}
                        </button>

                        {cleyDaySelector === client.Nombre ? (
                          <div className="flex-1 bg-amber-50 rounded-xl p-2 border border-amber-200">
                            <div className="grid grid-cols-3 gap-1 mb-1">
                              {ROUTE_DAYS.slice(0, 6).map(day => (
                                <button key={day} onClick={() => { postponeClient(client, day); setCleyDaySelector(null); }}
                                  className="py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200">{day.slice(0, 2)}</button>
                              ))}
                            </div>
                            <button onClick={() => setCleyDaySelector(null)} className="w-full py-1 text-xs text-slate-500 hover:text-slate-700">
                              <X className="h-3 w-3 mx-auto" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setCleyDaySelector(client.Nombre)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${status === "postponed" ? "bg-amber-100 text-amber-700 border border-amber-300" : "bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-700"}`}>
                            Posponer
                          </button>
                        )}

                        <button onClick={() => openInMaps(client)} className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center transition-colors">
                          <Navigation className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Completed Section */}
          {allCompletedTodayClients.length > 0 && (
            <div className="bg-white rounded-2xl card-shadow border border-slate-200/50 overflow-hidden">
              <button onClick={() => setShowCompletedSection(!showCompletedSection)} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-slate-900">{selectedDay === mazatlanDayName ? "Completados Hoy" : `Completados el ${selectedDay}`}</h3>
                    <p className="text-sm text-slate-500">{allCompletedTodayClients.length} clientes</p>
                  </div>
                </div>
                <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${showCompletedSection ? "rotate-180" : ""}`} />
              </button>

              {showCompletedSection && (
                <div className="px-4 pb-4 space-y-2 animate-slideUp">
                  {allCompletedTodayClients.map((client, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <div>
                          <h4 className="font-medium text-slate-900 text-sm">{client.Nombre}</h4>
                          <p className="text-xs text-slate-500">Próxima en {client.Frecuencia} sem</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${getTypeStyles(client.Tipo_Cliente)}`}>{client.Tipo_Cliente}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bottom Spacer */}
          <div className="h-8" />
        </main>
      </div>
    </>
  );
}
