'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { 
  Menu, 
  MapPin, 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Users,
  Route,
  Navigation,
  Save,
  Timer
} from 'lucide-react'
import BlurIn from '@/components/ui/blur-in'

type Client = {
  Nombre: string;
  Latitude: number;
  Longitud: number;
  Dia: string;
  Frecuencia: number;
  'Tipo_Cliente': string;
  Vendedor: string;
  Entrega?: string;
}

type VisitStatus = 'pending' | 'completed' | 'skipped' | 'postponed'

type VisitType = 'Pedidos' | 'Entrega' | 'Normal'

type RouteDay = 'Lunes' | 'Martes' | 'Miercoles' | 'Jueves' | 'Viernes' | 'Sabado' | 'Domingo'

type CleyClient = Client & {
  visitType: VisitType;
  originalDay: string;
  entregaDay?: string;
}

type ConfigSettings = {
  distanciaPorVisita: number;
  costoCombustiblePorKm: number;
  tiempoPromedioVisita: number;
  maximoClientesPorDia: number;
}

type ClientVisitHistory = {
  clientName: string;
  lastVisitDate: string;
  lastVisitWeek: number;
}

type ScheduledVisit = {
  clientName: string;
  scheduledDate: string;
  week: string;
  status: string;
}

const ROUTE_DAYS: RouteDay[] = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo']

export default function RecorridosPage() {

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      window.location.href = '/auth/signin'
    }
  })

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [visitHistory, setVisitHistory] = useState<Record<string, ClientVisitHistory>>({})
  const [scheduledVisits, setScheduledVisits] = useState<Record<string, ScheduledVisit>>({})
  const [config, setConfig] = useState<ConfigSettings>({
    distanciaPorVisita: 2.5,
    costoCombustiblePorKm: 1.2,
    tiempoPromedioVisita: 15,
    maximoClientesPorDia: 20
  })
  const [loading, setLoading] = useState(true)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [selectedDay, setSelectedDay] = useState<RouteDay>(() => {
    const today = new Date()
    const dayNames: RouteDay[] = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
    return dayNames[today.getDay()]
  })
  const [visitStatus, setVisitStatus] = useState<Record<string, VisitStatus>>({})
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null)
  const [routeStartTime, setRouteStartTime] = useState<string | null>(null)
  const [savingRoute, setSavingRoute] = useState(false)
  
  // ✅ NEW: Postpone pool state for CLEY clients
  const [postponePool, setPostponePool] = useState<Record<string, { client: Client, originalDay: string, postponedOn: string }>>({})
  const [showPostponePool, setShowPostponePool] = useState(false)
  const [cleyDaySelector, setCleyDaySelector] = useState<string | null>(null) // Track which client is showing day selector
  
  // ✅ NEW: Pending reschedules state
  const [pendingReschedules, setPendingReschedules] = useState<Array<{
    clientName: string;
    originalDay: string;
    newDay: string;
    visitType: 'Pedidos' | 'Entrega' | 'Normal';
  }>>([])
  const [savingReschedules, setSavingReschedules] = useState(false)
  const [rescheduledClients, setRescheduledClients] = useState<Record<string, { originalDay: string, newDay: string, visitType: string }>>({}) // Active reschedules from sheet

  // ✅ VALIDATION: Log when postpone pool changes
  useEffect(() => {
    console.log('🔄 POSTPONE POOL CHANGED:', {
      count: Object.keys(postponePool).length,
      clients: Object.keys(postponePool),
      details: Object.entries(postponePool).map(([name, data]) => ({
        name,
        originalDay: data.originalDay,
        currentDay: data.client.Dia,
        postponedOn: data.postponedOn
      }))
    });
  }, [postponePool]);

  useEffect(() => {
    if (session?.user?.email) {
      setDataLoaded(false); // Reset data loaded state
      Promise.all([
        fetchClients(),
        fetchConfiguration(),
        fetchVisitHistory(),
        fetchScheduledVisits(),
        fetchRescheduledVisits()
      ]).then(() => {
        setDataLoaded(true);
      }).catch((error) => {
        console.error('Error in data fetching:', error);
        setDataLoaded(true); // Set to true even on error to prevent infinite loading
      });
      getCurrentLocation()
    }
  }, [session])



  const fetchClients = async () => {
    try {
      setLoading(true)
      
      const response = await fetch(`/api/recorridos?email=${encodeURIComponent(session?.user?.email || '')}&sheet=clientes`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch clients')
      }
      
      const data = await response.json()
      setClients(data.data || [])
    } catch (error) {
      console.error('❌ Error fetching clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchConfiguration = async () => {
    try {
      const response = await fetch(`/api/recorridos?email=${encodeURIComponent(session?.user?.email || '')}&sheet=configuracion`)
      
      if (!response.ok) {
        console.warn('Failed to fetch configuration, using defaults')
        return
      }
      
      const data = await response.json()
      
      if (data.data && data.data.length > 0) {
        // Expected configuration structure: clave, valor, descripcion, activo
        const configMap = data.data.reduce((acc: any, item: any) => {
          if (item.clave && item.valor && item.activo === 'Si') {
            acc[item.clave] = item.valor
          }
          return acc
        }, {})

        // Update config with values from sheet
        setConfig(prev => ({
          distanciaPorVisita: parseFloat(configMap.distancia_por_visita) || prev.distanciaPorVisita,
          costoCombustiblePorKm: parseFloat(configMap.costo_combustible_km) || prev.costoCombustiblePorKm,
          tiempoPromedioVisita: parseInt(configMap.tiempo_promedio_visita) || prev.tiempoPromedioVisita,
          maximoClientesPorDia: parseInt(configMap.maximo_clientes_dia) || prev.maximoClientesPorDia
        }))
      }
    } catch (error) {
      console.error('❌ Error fetching configuration:', error)
    }
  }

  const fetchVisitHistory = async () => {
    try {
      const response = await fetch(`/api/recorridos?email=${encodeURIComponent(session?.user?.email || '')}&sheet=metricas`)
      
      if (!response.ok) {
        console.warn('❌ Failed to fetch visit history, treating all as first-time visits')
        return
      }
      
      const data = await response.json()
      
      if (data.data && data.data.length > 0) {
        const history: Record<string, ClientVisitHistory> = {}
        
        data.data.forEach((record: any) => {
          // Ensure records have the necessary fields and are for completed visits
          if (record.cliente && record.fecha && record.tipo_visita === 'completed' && record.semana) {
            const clientName = record.cliente
            const visitDate = record.fecha
            const weekNumber = parseInt(record.semana) 
            
            if (isNaN(weekNumber)) {
              console.warn('Skipped record with invalid week number:', record);
              return;
            }
            
            if (!history[clientName] || new Date(visitDate) > new Date(history[clientName].lastVisitDate)) {
              history[clientName] = {
                clientName,
                lastVisitDate: visitDate,
                lastVisitWeek: weekNumber
              }
            }
          } 
        })
        
        setVisitHistory(history)
      }
    } catch (error) {
      console.error('❌ Error fetching visit history:', error)
    }
  }

  const fetchScheduledVisits = async () => {
    try {
      const response = await fetch(`/api/recorridos?email=${encodeURIComponent(session?.user?.email || '')}&sheet=programacion`)
      
      if (!response.ok) {
        console.warn('❌ Failed to fetch scheduled visits')
        return
      }
      
      const data = await response.json()
      
      if (data.data && data.data.length > 0) {
        const visits: Record<string, ScheduledVisit> = {}
        
        data.data.forEach((record: any) => {
          // ✅ CORRECTED: Expected fields matching actual sheet structure:
          // semana_numero, fecha_inicio, dia_semana, cliente_nombre, vendedor, ultima_visita, proxima_visita_programada, estado, orden_visita
          if (record.cliente_nombre && record.proxima_visita_programada && record.estado) {
            const clientName = record.cliente_nombre
            const scheduledDate = record.proxima_visita_programada
            const week = record.semana_numero ? `Semana ${record.semana_numero}` : ''
            const status = record.estado
            
            // Keep the most recent scheduled visit for each client
            if (!visits[clientName] || new Date(scheduledDate) > new Date(visits[clientName].scheduledDate)) {
              visits[clientName] = {
                clientName,
                scheduledDate,
                week,
                status
              }
            }
          } 
        })
        
        setScheduledVisits(visits)
      }
    } catch (error) {
      console.error('❌ Error fetching scheduled visits:', error)
    }
  }

  const fetchRescheduledVisits = async () => {
    try {
      const response = await fetch(`/api/recorridos?email=${encodeURIComponent(session?.user?.email || '')}&sheet=reprogramadas`)
      
      if (!response.ok) {
        console.warn('❌ Failed to fetch rescheduled visits')
        return
      }
      
      const data = await response.json()
      
      if (data.data && data.data.length > 0) {
        const reschedules: Record<string, { originalDay: string, newDay: string, visitType: string }> = {}
        
        data.data.forEach((record: any) => {
          // Expected fields: cliente_original, tipo_visita, dia_original, dia_nuevo, fecha_reprogramacion, vendedor, activo
          if (record.cliente_original && record.tipo_visita && record.dia_nuevo && record.activo === 'Si') {
            const clientKey = `${record.cliente_original} (${record.tipo_visita})`
            reschedules[clientKey] = {
              originalDay: record.dia_original,
              newDay: record.dia_nuevo,
              visitType: record.tipo_visita
            }
          }
        })
        
        console.log('🔄 RESCHEDULE FETCH: Loaded active reschedules:', Object.keys(reschedules));
        setRescheduledClients(reschedules)
      }
    } catch (error) {
      console.error('❌ Error fetching rescheduled visits:', error)
    }
  }

  // Helper function to get ISO week number
  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  }

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        (error) => {
          console.error('Error getting location:', error)
        }
      )
    }
  }

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371 // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c // Distance in kilometers
  }

  // ✅ ADDED: Route optimization function using nearest neighbor algorithm
  const optimizeRoute = (clients: Client[], startLat: number = 24.74403, startLng: number = -107.3749752): Client[] => {
    if (clients.length <= 1) return clients;

    const unvisited = [...clients];
    const optimizedRoute: Client[] = [];
    let currentLat = startLat;
    let currentLng = startLng;

    // Nearest neighbor algorithm
    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let shortestDistance = calculateDistance(currentLat, currentLng, unvisited[0].Latitude, unvisited[0].Longitud);

      // Find the nearest unvisited client
      for (let i = 1; i < unvisited.length; i++) {
        const distance = calculateDistance(currentLat, currentLng, unvisited[i].Latitude, unvisited[i].Longitud);
        if (distance < shortestDistance) {
          shortestDistance = distance;
          nearestIndex = i;
        }
      }

      // Add the nearest client to the route
      const nearestClient = unvisited.splice(nearestIndex, 1)[0];
      optimizedRoute.push(nearestClient);
      
      // Update current position
      currentLat = nearestClient.Latitude;
      currentLng = nearestClient.Longitud;
    }

    return optimizedRoute;
  };

  // ✅ ADDED: Calculate total route distance for display
  const calculateTotalRouteDistance = (clients: Client[], startLat: number = 24.74403, startLng: number = -107.3749752): number => {
    if (clients.length === 0) return 0;

    let totalDistance = 0;
    let currentLat = startLat;
    let currentLng = startLng;

    clients.forEach(client => {
      const distance = calculateDistance(currentLat, currentLng, client.Latitude, client.Longitud);
      totalDistance += distance;
      currentLat = client.Latitude;
      currentLng = client.Longitud;
    });

    return totalDistance;
  };

  // ✅ NEW: Function to expand CLEY clients into dual visits (Pedidos + Entrega) and apply reschedules
  const expandCleyClients = (clients: Client[]): Client[] => {
    const expandedClients: Client[] = [];
    
    clients.forEach((client, index) => {
      if (client.Tipo_Cliente?.toUpperCase() === 'CLEY' && client.Entrega) {
        // Create Pedidos visit (using original Dia)
        let pedidosDay = client.Dia;
        const pedidosKey = `${client.Nombre} (Pedidos)`;
        if (rescheduledClients[pedidosKey]) {
          pedidosDay = rescheduledClients[pedidosKey].newDay;
          console.log(`🔄 RESCHEDULE APPLIED: ${pedidosKey} moved from ${client.Dia} to ${pedidosDay}`);
        }

        const pedidosVisit: Client = {
          ...client,
          Nombre: pedidosKey,
          Dia: pedidosDay,
        };

        // Create Entrega visit (using Entrega column)
        let entregaDay = client.Entrega;
        const entregaKey = `${client.Nombre} (Entrega)`;
        if (rescheduledClients[entregaKey]) {
          entregaDay = rescheduledClients[entregaKey].newDay;
          console.log(`🔄 RESCHEDULE APPLIED: ${entregaKey} moved from ${client.Entrega} to ${entregaDay}`);
        }

        const entregaVisit: Client = {
          ...client,
          Nombre: entregaKey,
          Dia: entregaDay,
        };

        expandedClients.push(pedidosVisit, entregaVisit);
      } else {
        // Regular client (including non-CLEY clients)
        let clientDay = client.Dia;
        const normalKey = `${client.Nombre} (Normal)`;
        if (rescheduledClients[normalKey]) {
          clientDay = rescheduledClients[normalKey].newDay;
          console.log(`🔄 RESCHEDULE APPLIED: ${normalKey} moved from ${client.Dia} to ${clientDay}`);
        }

        const regularClient: Client = {
          ...client,
          Dia: clientDay
        };

        expandedClients.push(regularClient);
      }
    });
    
    return expandedClients;
  };

  // ✅ NEW: Get visit type for CLEY clients
  const getVisitType = (clientName: string): VisitType => {
    if (clientName.includes('(Pedidos)')) return 'Pedidos';
    if (clientName.includes('(Entrega)')) return 'Entrega';
    return 'Normal';
  };

  // ✅ NEW: Get original client name (without visit type suffix)
  const getOriginalClientName = (clientName: string): string => {
    return clientName.replace(/ \((Pedidos|Entrega)\)$/, '');
  };

  // ✅ NEW: Check if client is CLEY type
  const isCleyClient = (client: Client): boolean => {
    return client.Tipo_Cliente?.toUpperCase() === 'CLEY';
  };

  // ✅ NEW: Handle CLEY client postpone - add to postpone pool
  const postponeCleyClient = (client: Client, targetDay: RouteDay) => {
    const originalName = getOriginalClientName(client.Nombre);
    const visitType = getVisitType(client.Nombre);
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`🔍 CLEY POSTPONE: Adding ${client.Nombre} to postpone pool for ${targetDay}`);
    
    setPostponePool(prev => ({
      ...prev,
      [client.Nombre]: {
        client: {
          ...client,
          Dia: targetDay // Update the day for rescheduling
        },
        originalDay: client.Dia,
        postponedOn: today
      }
    }));
    
    // Mark as postponed in current route
    setVisitStatus(prev => ({
      ...prev,
      [client.Nombre]: 'postponed'
    }));
    
    console.log(`✅ CLEY POSTPONE: ${client.Nombre} added to postpone pool for ${targetDay}`);
  };

  // ✅ NEW: Reschedule client from postpone pool to specific day (add to pending reschedules)
  const rescheduleFromPostponePool = (clientName: string, targetDay: RouteDay) => {
    const postponedClient = postponePool[clientName];
    if (!postponedClient) {
      console.error(`❌ RESCHEDULE ERROR: Client ${clientName} not found in postpone pool`);
      return;
    }
    
    console.log(`🔄 CLEY RESCHEDULE: Adding ${clientName} to pending reschedules for ${targetDay}`);
    console.log(`🔍 RESCHEDULE DEBUG: Original day: ${postponedClient.originalDay}, Target day: ${targetDay}`);
    
    const visitType = getVisitType(clientName);
    const originalClientName = getOriginalClientName(clientName);
    
    // Add to pending reschedules
    setPendingReschedules(prev => {
      // Remove any existing pending reschedule for this client+visit type
      const filtered = prev.filter(r => !(r.clientName === originalClientName && r.visitType === visitType));
      
      const newReschedule = {
        clientName: originalClientName,
        originalDay: postponedClient.originalDay,
        newDay: targetDay,
        visitType: visitType
      };
      
      console.log(`📝 PENDING RESCHEDULE: Added ${clientName} to pending list`);
      return [...filtered, newReschedule];
    });
    
    // Apply the reschedule immediately to local state for UI
    setRescheduledClients(prev => ({
      ...prev,
      [clientName]: {
        originalDay: postponedClient.originalDay,
        newDay: targetDay,
        visitType: visitType
      }
    }));
    
    // Remove from postpone pool
    setPostponePool(prev => {
      const newPool = { ...prev };
      delete newPool[clientName];
      console.log(`🗑️ RESCHEDULE: Removed ${clientName} from postpone pool. Remaining:`, Object.keys(newPool));
      return newPool;
    });
    
    // Clear postponed status (will appear as pending on target day)
    setVisitStatus(prev => {
      const newStatus = { ...prev };
      delete newStatus[clientName];
      console.log(`🔄 RESCHEDULE: Cleared visit status for ${clientName}`);
      return newStatus;
    });
    
    console.log(`✅ CLEY RESCHEDULE: ${clientName} added to pending reschedules for ${targetDay}`);
  };

  // ✅ NEW: Save all pending reschedules to the sheet
  const savePendingReschedules = async () => {
    if (pendingReschedules.length === 0) {
      alert('No hay cambios pendientes para guardar');
      return;
    }

    try {
      setSavingReschedules(true);
      console.log('💾 SAVING RESCHEDULES: Starting batch save for', pendingReschedules.length, 'reschedules');

      const response = await fetch('/api/recorridos/reschedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'batch_reschedule',
          userEmail: session?.user?.email,
          reschedules: pendingReschedules
        }),
      });

      if (response.ok) {
        console.log('✅ RESCHEDULES SAVED: All pending reschedules saved successfully');
        
        // Clear pending reschedules
        setPendingReschedules([]);
        
        // Refresh the rescheduled visits from the sheet to ensure consistency
        await fetchRescheduledVisits();
        
        alert(`✅ ${pendingReschedules.length} reprogramaciones temporales guardadas exitosamente.\n\nNOTA: Las reprogramaciones son temporales y se revertirán automáticamente después de la visita.`);
      } else {
        const errorData = await response.json();
        console.error('❌ SAVE ERROR: Failed to save reschedules:', errorData);
        alert('Error al guardar las reprogramaciones. Inténtalo de nuevo.');
      }
    } catch (error) {
      console.error('❌ SAVE ERROR: Exception during save:', error);
      alert('Error al guardar las reprogramaciones. Inténtalo de nuevo.');
    } finally {
      setSavingReschedules(false);
    }
  };

  // ✅ REVISED: Determines if a client is generally scheduled for a visit today or is due.
  const shouldBeConsideredForVisitToday = (client: Client): boolean => {
    const originalName = getOriginalClientName(client.Nombre);
    const clientHistory = visitHistory[originalName];
    const scheduledVisit = scheduledVisits[originalName] || scheduledVisits[client.Nombre];
    const today = new Date().toISOString().split('T')[0];

    // ✅ PRIORITY 1: Check if client has a scheduled visit for today
    if (scheduledVisit && scheduledVisit.scheduledDate === today && scheduledVisit.status === 'Programado') {
      console.log(`👍 ${client.Nombre} (${originalName}): YES (scheduled for today)`);
      return true;
    }

    // ✅ PRIORITY 2: Check if client has a scheduled visit that's overdue
    if (scheduledVisit && scheduledVisit.status === 'Programado') {
      const scheduledDate = new Date(scheduledVisit.scheduledDate);
      const todayDate = new Date(today);
      if (scheduledDate <= todayDate) {
        console.log(`👍 ${client.Nombre} (${originalName}): YES (overdue scheduled visit from ${scheduledVisit.scheduledDate})`);
        return true;
      }
    }

    // If never visited before, show for first-time visit
    if (!clientHistory) {
      console.log(`👍 ${client.Nombre} (${originalName}): YES (no history - first visit)`);
      return true;
    }
    
    // If completed today (in a previous route or this one), they are part of today's general consideration
    // but will be filtered out from "pending" list later if visitStatus is 'completed'.
    // This ensures they are available for the "Completados Hoy" list.
    if (clientHistory.lastVisitDate === today) {
      console.log(`👍 ${client.Nombre} (${originalName}): YES (last visit was today)`);
      return true; 
    }
    
    // ✅ FALLBACK: Calculate weeks since last visit for clients visited on previous days (old logic)
    const currentDate = new Date();
    const currentWeek = getWeekNumber(currentDate);
    const lastVisitWeek = clientHistory.lastVisitWeek;
    
    if (isNaN(lastVisitWeek)) { 
        console.warn(`⚠️ ${client.Nombre} (${originalName}): YES (lastVisitWeek is NaN - assuming needs visit)`);
        return true; 
    }

    const weeksSinceLastVisit = currentWeek - lastVisitWeek;
    const isDue = weeksSinceLastVisit >= client.Frecuencia;

    console.log(`👍 ${client.Nombre} (${originalName}): ${isDue ? 'YES' : 'NO'} (due: ${isDue}, weeksSinceLast: ${weeksSinceLastVisit}, freq: ${client.Frecuencia})`);
    return isDue;
  };

  const startRoute = () => {
    const now = new Date()
    setRouteStartTime(now.toTimeString().slice(0, 5)) // HH:MM format
  }

  // ✅ NEW: Deactivate a temporary reschedule after the visit is completed
  const deactivateRescheduleAfterVisit = async (clientName: string, visitType: string) => {
    try {
      console.log(`🔄 DEACTIVATING RESCHEDULE: ${clientName} (${visitType})`);
      
      const response = await fetch('/api/recorridos/reschedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'deactivate_reschedule',
          userEmail: session?.user?.email,
          clientName: clientName,
          visitType: visitType
        }),
      });

      if (response.ok) {
        console.log(`✅ RESCHEDULE DEACTIVATED: ${clientName} (${visitType}) will return to original schedule`);
        
        // Remove from local rescheduled clients state
        const clientKey = `${clientName} (${visitType})`;
        setRescheduledClients(prev => {
          const newState = { ...prev };
          delete newState[clientKey];
          return newState;
        });
      } else {
        console.error(`❌ Failed to deactivate reschedule for ${clientName} (${visitType})`);
      }
    } catch (error) {
      console.error(`❌ Error deactivating reschedule:`, error);
    }
  };

  const updateVisitStatus = async (client: Client, status: VisitStatus, notes?: string) => {
    try {
      if (!routeStartTime && status === 'completed') {
        startRoute(); // This will call setRouteStartTime
      }

      setVisitStatus(prev => ({ ...prev, [client.Nombre]: status }));
      
      // ✅ NEW: Get visit type and original client name for CLEY clients
      const visitTypeForCley = getVisitType(client.Nombre);
      const originalClientName = getOriginalClientName(client.Nombre);
      const notesWithVisitType = visitTypeForCley !== 'Normal' 
        ? `${visitTypeForCley}: ${notes || ''}` 
        : notes || '';
      
      const response = await fetch('/api/recorridos/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_visit_status',
          userEmail: session?.user?.email,
          clientName: originalClientName, // Use original name for sheet recording
          routeDay: client.Dia,
          visitType: status,
          location: currentLocation,
          notes: notesWithVisitType,
          cleyVisitType: visitTypeForCley, // Additional field for CLEY visit type
        }),
      });
      
      if (response.ok) {
        if (status === 'completed') {
          const now = new Date();
          const fecha = now.toISOString().split('T')[0];
          const currentWeek = getWeekNumber(now);
          
          const historyKey = originalClientName; // Use original client name for history tracking
          const newHistoryEntry = {
            clientName: historyKey,
            lastVisitDate: fecha,
            lastVisitWeek: currentWeek
          };
          
          setVisitHistory(prev => ({ ...prev, [historyKey]: newHistoryEntry }));
          
          // ✅ NEW: Check if this was a rescheduled visit and deactivate it
          const clientKey = client.Nombre; // The full name with (Pedidos) or (Entrega)
          if (rescheduledClients[clientKey]) {
            console.log(`🔄 TEMP RESCHEDULE: Deactivating reschedule for ${clientKey} after completion`);
            
            // Call API to deactivate the reschedule
            deactivateRescheduleAfterVisit(originalClientName, visitTypeForCley);
          }
        }
      } else {
        const errorData = await response.text();
        console.error(`❌ Failed to record visit in sheet for ${client.Nombre}:`, {
          status: response.status,
          error: errorData
        });
        // Revert optimistic update for visitStatus
        setVisitStatus(prev => {
          const newState = { ...prev };
          delete newState[client.Nombre];
          return newState;
        });
      }
    } catch (error) {
      console.error(`❌ Error updating visit status for ${client.Nombre}:`, error);
      // Revert optimistic update for visitStatus
      setVisitStatus(prev => {
        const newState = { ...prev };
        delete newState[client.Nombre];
        return newState;
      });
    }
  };

  const finishRoute = async () => {
    if (!routeStartTime) {
      alert('No se ha iniciado ninguna ruta. Completa al menos una visita primero.');
      return;
    }

    try {
      setSavingRoute(true);
      
      const now = new Date();
      const endTime = now.toTimeString().slice(0, 5); // HH:MM format
      const fecha = now.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // ✅ REVISED: Use clientsConsideredForVisitToday for total scheduled count
      const clientesProgramados = clientsConsideredForVisitToday.length;
      // ✅ REVISED: Count all clients completed today (including previous sessions and current session)
      const clientesVisitados = allCompletedTodayClients.length;
      
      // ✅ REVISED: Calculate route metrics using actual optimized route distance
      const completedClients = allCompletedTodayClients;
      const actualRouteDistance = calculateTotalRouteDistance(completedClients);
      const totalDistanceKm = Math.round(actualRouteDistance > 0 ? actualRouteDistance : clientesVisitados * config.distanciaPorVisita);
      const fuelCost = Math.round(totalDistanceKm * config.costoCombustiblePorKm);
      
      // ✅ REVISED: Base these lists on allCompletedTodayClients and actuallyPendingClients for accuracy
      const visitedClients = allCompletedTodayClients.map(c => c.Nombre);
      
      const skippedClients = clientsConsideredForVisitToday.filter(client => 
        visitStatus[client.Nombre] === 'skipped' || visitStatus[client.Nombre] === 'postponed'
      ).map(c => c.Nombre);
      
      let observaciones = `Visitados: ${visitedClients.join(', ')}`
      if (skippedClients.length > 0) {
        observaciones += `. No visitados: ${skippedClients.join(', ')}`
      }



      const response = await fetch('/api/recorridos/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_route_summary',
          userEmail: session?.user?.email,
          routeDay: selectedDay,
          fecha,
          clientesProgramados,
          clientesVisitados,
          ventasTotales: 0, // TODO: integrate with sales data if needed
          tiempoInicio: routeStartTime,
          tiempoFin: endTime,
          kilometrosRecorridos: totalDistanceKm,
          combustibleGastado: fuelCost,
          observaciones: observaciones.slice(0, 500) // Limit to 500 chars
        }),
      })

      if (response.ok) {
        alert(`✅ Ruta del ${selectedDay} finalizada exitosamente!\n\n📊 Resumen:\n• ${clientesVisitados}/${clientesProgramados} clientes visitados\n• Tiempo: ${routeStartTime} - ${endTime}\n• Distancia: ${totalDistanceKm} km\n• Combustible: $${fuelCost}`)
        
        // Reset route state
        setVisitStatus({})
        setRouteStartTime(null)
        
        // ✅ Refresh visit history from sheets to ensure consistency
        await fetchVisitHistory()
      } else {
        const errorData = await response.json()
        console.error('Failed to save route summary:', errorData)
        alert('Error al guardar el resumen de la ruta. Inténtalo de nuevo.')
      }
    } catch (error) {
      console.error('Error finishing route:', error)
      alert('Error al finalizar la ruta. Inténtalo de nuevo.')
    } finally {
      setSavingRoute(false)
    }
  }

  const getStatusColor = (status: VisitStatus): string => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'skipped': return 'bg-red-500'
      case 'postponed': return 'bg-yellow-500'
      default: return 'bg-gray-300'
    }
  }

  const getStatusIcon = (status: VisitStatus) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'skipped': return <XCircle className="h-5 w-5 text-red-600" />
      case 'postponed': return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      default: return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  const getClientTypeColor = (type: string): string => {
    switch (type.toUpperCase()) {
      case 'CLEY': return 'bg-blue-100 text-blue-800'
      case 'PREMIUM': return 'bg-purple-100 text-purple-800'
      case 'REGULAR': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const openInMaps = (client: Client) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${client.Latitude},${client.Longitud}`
    window.open(url, '_blank')
  }

  // ✅ ADDED: Open full optimized route in Google Maps
  const openFullRouteInMaps = () => {
    if (optimizedPendingClients.length === 0) return;
    
    const startPoint = "24.74403,-107.3749752";
    const waypoints = optimizedPendingClients.slice(0, -1).map(client => 
      `${client.Latitude},${client.Longitud}`
    ).join('|');
    const destination = optimizedPendingClients[optimizedPendingClients.length - 1];
    const destinationCoords = `${destination.Latitude},${destination.Longitud}`;
    
    let url = `https://www.google.com/maps/dir/?api=1&origin=${startPoint}&destination=${destinationCoords}`;
    if (waypoints) {
      url += `&waypoints=${waypoints}`;
    }
    
    window.open(url, '_blank');
  };

  // Helper function to get visit status text
  const getVisitStatusText = (client: Client): string => {
    const originalName = getOriginalClientName(client.Nombre);
    const history = visitHistory[originalName]
    const scheduledVisit = scheduledVisits[originalName] || scheduledVisits[client.Nombre]
    const today = new Date().toISOString().split('T')[0]

    // ✅ PRIORITY: Show scheduled visit info if available
    if (scheduledVisit && scheduledVisit.status === 'Programado') {
      const scheduledDate = new Date(scheduledVisit.scheduledDate)
      const todayDate = new Date(today)
      const daysDiff = Math.floor((scheduledDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysDiff === 0) {
        return 'Programado para hoy'
      } else if (daysDiff < 0) {
        return `Programado hace ${Math.abs(daysDiff)} días`
      } else {
        return `Programado en ${daysDiff} días`
      }
    }
    
    if (!history) {
      return 'Primera visita'
    }
    
    const daysSinceLastVisit = Math.floor((new Date().getTime() - new Date(history.lastVisitDate).getTime()) / (1000 * 60 * 60 * 24))
    const weeksSinceLastVisit = Math.floor(daysSinceLastVisit / 7)
    
    if (daysSinceLastVisit === 0) {
      return 'Completado hoy'
    } else if (weeksSinceLastVisit === 0) {
      return `Visitado hace ${daysSinceLastVisit} días`
    } else {
      return `Visitado hace ${weeksSinceLastVisit} semanas`
    }
  }

  // ✅ NEW: Expand CLEY clients into dual visits
  const expandedClients = expandCleyClients(clients);
  
  // ✅ Basic validation for rescheduled clients
  useEffect(() => {
    const rescheduledCount = Object.keys(postponePool).length;
    if (rescheduledCount > 0) {
      console.log(`🔄 VALIDATION: ${rescheduledCount} clients in postpone pool`);
    }
  }, [expandedClients, postponePool]);

  // Helper function to normalize day names (remove accents, extra spaces, etc.)
  const normalizeDay = (day: string): string => {
    if (!day) return '';
    return day.trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[áàäâ]/g, 'a')
      .replace(/[éèëê]/g, 'e')  
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o')
      .replace(/[úùüû]/g, 'u');
  };

  const clientsForSelectedDay = expandedClients.filter(client => {
    const normalizedClientDay = normalizeDay(client.Dia || '');
    const normalizedSelectedDay = normalizeDay(selectedDay);
    const matches = normalizedClientDay === normalizedSelectedDay;
    
    return matches;
  });

  // ✅ NEW: Add postponed CLEY clients that were rescheduled to this day
  const postponedClientsForToday = Object.values(postponePool)
    .filter(postponed => {
      const normalizedPostponedDay = normalizeDay(postponed.client.Dia || '');
      const normalizedSelectedDay = normalizeDay(selectedDay);
      return normalizedPostponedDay === normalizedSelectedDay;
    })
    .map(postponed => postponed.client);

  // ✅ NEW: Combine regular clients with postponed clients for this day
  const allClientsForSelectedDay = [...clientsForSelectedDay, ...postponedClientsForToday];

  // Debug client counts for selected day
  if (postponedClientsForToday.length > 0) {
    console.log(`📅 DEBUG: ${selectedDay} - Regular: ${clientsForSelectedDay.length}, Postponed: ${postponedClientsForToday.length}, Total: ${allClientsForSelectedDay.length}`);
  }

  // ✅ REVISED: Clients considered for today based on their schedule and history (frequency, first visit)
  const clientsConsideredForVisitToday = allClientsForSelectedDay.filter(client => {
    // For postponed clients, they are automatically considered for visit on their rescheduled day
    const isPostponedClient = postponedClientsForToday.some(p => p.Nombre === client.Nombre);
    return isPostponedClient || shouldBeConsideredForVisitToday(client);
  });

  // ✅ REVISED: The main list of clients to INTERACT with - only those genuinely PENDING for the current route.
  const todayClients = clientsConsideredForVisitToday.filter(client => 
    !visitStatus[client.Nombre] || visitStatus[client.Nombre] === 'pending'
  );
  
  // ✅ REVISED: Properly exclude clients who were already visited today (even in previous sessions)
  const today = new Date().toISOString().split('T')[0];
  const actuallyPendingClients = clientsConsideredForVisitToday.filter(client => {
    const originalName = getOriginalClientName(client.Nombre);
    const history = visitHistory[originalName];
    const status = visitStatus[client.Nombre];
    const wasVisitedToday = history?.lastVisitDate === today;
    const isPostponedClient = postponedClientsForToday.some(p => p.Nombre === client.Nombre);
    
    // Postponed clients that were rescheduled to today should appear as pending
    if (isPostponedClient && status !== 'completed') {
      return true;
    }
    
    // If visited today in a previous session, they shouldn't be pending
    if (wasVisitedToday && !routeStartTime) {
      return false;
    }
    
    // If visited today in current session and marked as completed, they shouldn't be pending
    if (status === 'completed' || status === 'skipped' || status === 'postponed') {
      return false;
    }
    
    return true;
  });
  
  // ✅ ADDED: Optimize the route for pending clients
  const optimizedPendingClients = optimizeRoute(actuallyPendingClients);
  const totalRouteDistance = calculateTotalRouteDistance(optimizedPendingClients);
  


  // ✅ REVISED: Clients actually completed during THIS active route session for the "Completados Hoy" card
  const completedThisSessionClients = allClientsForSelectedDay.filter(client => {
    const originalName = getOriginalClientName(client.Nombre);
    const history = visitHistory[originalName];
    const today = new Date().toISOString().split('T')[0];
    // Ensure they were marked 'completed' in visitStatus, 
    // their last recorded visit in history is today, 
    // and a route is currently active (or was active when they were completed).
    return visitStatus[client.Nombre] === 'completed' && 
           history?.lastVisitDate === today && 
           !!routeStartTime; // routeStartTime ensures it's part of the current active session
  });
  
  // ✅ REVISED: All clients completed today (including previous sessions)
  const allCompletedTodayClients = allClientsForSelectedDay.filter(client => {
    const originalName = getOriginalClientName(client.Nombre);
    const history = visitHistory[originalName];
    const today = new Date().toISOString().split('T')[0];
    return history?.lastVisitDate === today;
  });
  

  
  // ✅ REVISED: Use corrected counts
  const completedCount = allCompletedTodayClients.length; // All completed today (any session)
  const pendingCount = optimizedPendingClients.length; // Actually pending clients (optimized)



  if (status === 'loading' || loading || !dataLoaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-2 text-gray-600">
          {status === 'loading' ? 'Cargando sesión...' : 
           loading ? 'Cargando datos...' : 
           'Procesando información...'}
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white px-4 py-3 font-sans w-full" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem' }}>
      <header className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-600 rounded-full mr-2 flex items-center justify-center">
            <Route className="h-5 w-5 text-white" />
          </div>
          <BlurIn
            word="Recorridos"
            className="text-2xl font-medium tracking-tight"
            duration={0.5}
            variant={{
              hidden: { filter: 'blur(4px)', opacity: 0 },
              visible: { filter: 'blur(0px)', opacity: 1 }
            }}
          />
        </div>
        <div className="flex items-center">
          <div className="relative">
            <button
              className="p-1 rounded-full hover:bg-gray-200 transition-colors duration-200"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <Menu className="h-5 w-5 text-gray-600" />
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                <div className="py-1" role="menu" aria-orientation="vertical">
                  <Link href="/" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">
                    Dashboard
                  </Link>
                  <Link href="/form" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">
                    Ventas
                  </Link>
                  <Link href="/inventario" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">
                    Inventario
                  </Link>
                  <Link href="/admin" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">
                    Admin
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Progress Summary */}
      <div className="bg-white rounded-lg mb-4 p-4 border border-[#E2E4E9]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Progreso del Día</h2>
          </div>
          <div className="text-sm text-gray-500">
            {completedCount} / {completedCount + pendingCount} completados 
            {/* Total for progress bar denominator could be clientsConsideredForVisitToday.length if you want to show progress against all potential visits for the day*/}
          </div>
        </div>
        
        {routeStartTime && (
          <div className="flex items-center text-sm text-blue-600 mb-2">
            <Timer className="h-4 w-4 mr-1" />
            <span>Ruta iniciada: {routeStartTime}</span>
          </div>
        )}
        
        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
            style={{ width: `${(completedCount + pendingCount) > 0 ? (completedCount / (completedCount + pendingCount)) * 100 : 0}%` }}
            // Denominator updated for progress bar
          ></div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center mb-3">
          <div>
            <div className="text-2xl font-bold text-blue-600">{completedCount}</div>
            <div className="text-xs text-gray-500">Completados</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">{pendingCount}</div>
            <div className="text-xs text-gray-500">Pendientes</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-600">{completedCount + pendingCount}</div> 
            {/* Total updated */}
            <div className="text-xs text-gray-500">Total</div>
          </div>
        </div>

        {/* Estimated metrics using config */}
        {routeStartTime && completedCount > 0 && (
          <div className="text-xs text-gray-500 mb-3">
            <span>Est. {Math.round(completedCount * config.distanciaPorVisita)} km • </span>
            <span>Est. ${Math.round(completedCount * config.distanciaPorVisita * config.costoCombustiblePorKm)} combustible</span>
          </div>
        )}

        {/* Route optimization info */}
        {pendingCount > 0 && (
          <div className="text-xs text-gray-500 mb-3 p-2 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                <Route className="h-3 w-3 text-blue-600 mr-1" />
                <span className="font-medium text-blue-700">Ruta Optimizada</span>
              </div>
              <button
                onClick={openFullRouteInMaps}
                className="text-xs bg-blue-600 text-white px-2 py-1 rounded-md hover:bg-blue-700 transition-colors flex items-center"
              >
                <Navigation className="h-3 w-3 mr-1" />
                Ver Ruta Completa
              </button>
            </div>
            <div>
              <span>Distancia total estimada: {totalRouteDistance.toFixed(1)} km</span>
              <span className="mx-2">•</span>
              <span>Combustible: ${Math.round(totalRouteDistance * config.costoCombustiblePorKm)}</span>
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Los clientes están ordenados por proximidad para minimizar el recorrido
            </div>
          </div>
        )}

        {/* Postpone Pool Toggle Button */}
        {Object.keys(postponePool).length > 0 && (
          <div className="mb-3">
            <button
              onClick={() => setShowPostponePool(!showPostponePool)}
              className="w-full py-2 px-4 bg-yellow-100 text-yellow-800 rounded-lg font-medium hover:bg-yellow-200 transition-colors flex items-center justify-center"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              {showPostponePool ? 'Ocultar' : 'Mostrar'} Clientes Pospuestos ({Object.keys(postponePool).length})
            </button>
          </div>
        )}

        {/* Save Pending Reschedules Button */}
        {pendingReschedules.length > 0 && (
          <div className="mb-3">
            <button
              onClick={savePendingReschedules}
              disabled={savingReschedules}
              className="w-full py-2 px-4 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {savingReschedules ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Cambios Temporales ({pendingReschedules.length})
                </>
              )}
            </button>
            <div className="text-xs text-gray-500 text-center mt-1">
              Los cambios son temporales y se revertirán después de la visita
            </div>
          </div>
        )}

        {/* Finish Route Button */}
        {routeStartTime && (
          <button
            onClick={finishRoute}
            disabled={savingRoute}
            className="w-full py-2 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {savingRoute ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Finalizar Ruta del {selectedDay}
              </>
            )}
          </button>
        )}
      </div>

      {/* Day Selector */}
      <div className="bg-gray-100 rounded-lg mb-4 p-1">
        <div className="grid grid-cols-7 gap-1">
          {ROUTE_DAYS.map((day) => (
            <button
              key={day}
              className={`py-2 px-1 text-xs font-medium rounded-md transition-colors duration-200 ${
                selectedDay === day
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setSelectedDay(day)}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* Postpone Pool Interface */}
      {showPostponePool && Object.keys(postponePool).length > 0 && (
        <div className="mb-4 bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="flex items-center mb-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
            <h3 className="text-lg font-semibold text-yellow-800">Clientes CLEY Pospuestos</h3>
          </div>
          
          <div className="text-xs text-yellow-700 mb-3">
            <div className="mb-2">
              <strong>⚠️ Reprogramación Temporal:</strong> Los clientes CLEY pospuestos se pueden reprogramar temporalmente a otro día. 
              Después de completar la visita reprogramada, el cliente volverá automáticamente a su horario original.
            </div>
            <div className="text-xs text-yellow-600">
              Úsalo solo cuando no puedas completar tu ruta regular. Las reprogramaciones son una medida de emergencia.
            </div>
            {pendingReschedules.length > 0 && (
              <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                <span className="font-medium text-blue-700">
                  ⏳ {pendingReschedules.length} cambio(s) temporal(es) pendiente(s) - Haz clic en "Guardar Cambios" para confirmar
                </span>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            {Object.entries(postponePool).map(([clientName, postponedData]) => {
              const today = new Date().toISOString().split('T')[0];
              const isToday = (day: RouteDay) => {
                const dayNames: RouteDay[] = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
                const todayDay = dayNames[new Date().getDay()];
                return day === todayDay;
              };
              
              return (
                <div key={clientName} className="bg-white rounded-lg p-3 border border-yellow-100">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">{clientName}</h4>
                        {/* Show pending reschedule indicator */}
                        {pendingReschedules.some(r => 
                          `${r.clientName} (${r.visitType})` === clientName
                        ) && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            ⏳ Temporal pendiente
                          </span>
                        )}
                        {/* Show saved reschedule indicator */}
                        {rescheduledClients[clientName] && !pendingReschedules.some(r => 
                          `${r.clientName} (${r.visitType})` === clientName
                        ) && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                            🔄 Temporal activo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center text-xs text-gray-500">
                        <span className="text-red-600 font-medium">{postponedData.originalDay}</span>
                        <span className="mx-1">→</span>
                        {pendingReschedules.find(r => `${r.clientName} (${r.visitType})` === clientName) ? (
                          <span className="text-blue-600 font-medium">
                            {pendingReschedules.find(r => `${r.clientName} (${r.visitType})` === clientName)?.newDay} (temporal pendiente)
                          </span>
                        ) : rescheduledClients[clientName] ? (
                          <span className="text-orange-600 font-medium">
                            {rescheduledClients[clientName].newDay} (temporal activo)
                          </span>
                        ) : (
                          <span className="text-orange-600 font-medium">Sin reprogramar</span>
                        )}
                        <span className="mx-2">•</span>
                        <span>Pospuesto el {postponedData.postponedOn}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getClientTypeColor(postponedData.client.Tipo_Cliente)}`}>
                      {postponedData.client.Tipo_Cliente}
                    </span>
                  </div>
                  
                  {/* Clear action label */}
                  <div className="text-xs font-medium text-gray-700 mb-2">
                    Selecciona nuevo día para reprogramar:
                  </div>
                  
                  {/* Reschedule buttons for each day */}
                  <div className="grid grid-cols-7 gap-1">
                    {ROUTE_DAYS.map((day) => {
                      const isOriginalDay = day === postponedData.originalDay;
                      const isTodayDay = isToday(day);
                      
                      return (
                        <button
                          key={day}
                          onClick={() => {
                            rescheduleFromPostponePool(clientName, day);
                            // Show success feedback
                            const successToast = document.createElement('div');
                            successToast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm';
                            successToast.textContent = `${clientName} reprogramado para ${day}`;
                            document.body.appendChild(successToast);
                            setTimeout(() => {
                              document.body.removeChild(successToast);
                            }, 3000);
                          }}
                          disabled={isOriginalDay}
                          title={
                            isOriginalDay 
                              ? `Día original (${day})` 
                              : isTodayDay 
                                ? `Reprogramar para hoy (${day})` 
                                : `Reprogramar para ${day}`
                          }
                          className={`py-1 px-1 text-xs rounded transition-colors ${
                            isOriginalDay
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : isTodayDay
                                ? 'bg-green-100 text-green-700 hover:bg-green-200 font-medium border border-green-300'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          }`}
                        >
                          {day.slice(0, 3)}
                          {isTodayDay && <span className="block text-xs">HOY</span>}
                        </button>
                      );
                    })}
                  </div>
                  
                  <div className="text-xs text-gray-500 mt-2 text-center">
                    <div>El cliente aparecerá temporalmente en el día seleccionado.</div>
                    <div className="text-xs text-gray-400 mt-1">Después de la visita, volverá a su horario original.</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Clients List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Cargando clientes...</p>
          </div>
        ) : optimizedPendingClients.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No hay clientes pendientes para {selectedDay}</p>
            <p className="text-xs text-gray-400 mt-1">
              Los clientes aparecen según su frecuencia de visita
            </p>
          </div>
        ) : (
          optimizedPendingClients.map((client, index) => {
            const status = visitStatus[client.Nombre] || 'pending'
            const startLat = 24.74403;
            const startLng = -107.3749752;
            
            // Calculate distance from starting point or previous client
            let distanceFromPrevious: number;
            if (index === 0) {
              distanceFromPrevious = calculateDistance(startLat, startLng, client.Latitude, client.Longitud);
            } else {
              const prevClient = optimizedPendingClients[index - 1];
              distanceFromPrevious = calculateDistance(prevClient.Latitude, prevClient.Longitud, client.Latitude, client.Longitud);
            }
            
            const visitStatusText = getVisitStatusText(client)
            const originalName = getOriginalClientName(client.Nombre);
            const isFirstTime = !visitHistory[originalName]

            return (
              <div key={index} className="bg-white rounded-lg border border-[#E2E4E9] p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex items-center">
                        <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mr-2">
                          {index + 1}
                        </div>
                      <h3 className="font-semibold text-gray-900">{client.Nombre}</h3>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getClientTypeColor(client.Tipo_Cliente)}`}>
                        {client.Tipo_Cliente}
                      </span>
                      {getVisitType(client.Nombre) !== 'Normal' && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          getVisitType(client.Nombre) === 'Pedidos' 
                            ? 'bg-orange-100 text-orange-700' 
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {getVisitType(client.Nombre)}
                        </span>
                      )}
                      {isFirstTime && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Nueva
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-500 mb-1">
                      <MapPin className="h-4 w-4 mr-1" />
                      <span>
                        {distanceFromPrevious.toFixed(1)} km {index === 0 ? 'desde inicio' : 'desde anterior'}
                      </span>
                      <span className="mx-2">•</span>
                      <span>Cada {client.Frecuencia} semanas</span>
                    </div>
                    
                    <div className="flex items-center text-xs text-gray-400">
                      <Clock className="h-3 w-3 mr-1" />
                      <span>{visitStatusText}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status)}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => updateVisitStatus(client, 'completed')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      status === 'completed' 
                        ? 'bg-green-100 text-green-700 border border-green-300' 
                        : 'bg-gray-100 text-gray-700 hover:bg-green-50'
                    }`}
                  >
                    Completar
                  </button>
                  
                  {isCleyClient(client) ? (
                    cleyDaySelector === client.Nombre ? (
                      // Show day selector for CLEY clients
                      <div className="flex-1">
                        <div className="text-xs text-center mb-1 text-gray-600">Reprogramar para:</div>
                        <div className="grid grid-cols-3 gap-1">
                          {ROUTE_DAYS.slice(0, 6).map((day) => ( // Exclude Sunday for CLEY
                            <button
                              key={day}
                              onClick={() => {
                                postponeCleyClient(client, day);
                                setCleyDaySelector(null);
                              }}
                              className="py-1 px-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
                            >
                              {day.slice(0, 3)}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setCleyDaySelector(null)}
                          className="w-full mt-1 py-1 text-xs text-gray-500 hover:text-gray-700"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      // Regular postpone button for CLEY clients
                      <button
                        onClick={() => setCleyDaySelector(client.Nombre)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          status === 'postponed' 
                            ? 'bg-yellow-100 text-yellow-700 border border-yellow-300' 
                            : 'bg-gray-100 text-gray-700 hover:bg-yellow-50'
                        }`}
                      >
                        Reprogramar
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => updateVisitStatus(client, 'postponed')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        status === 'postponed' 
                          ? 'bg-yellow-100 text-yellow-700 border border-yellow-300' 
                          : 'bg-gray-100 text-gray-700 hover:bg-yellow-50'
                      }`}
                    >
                      Posponer
                    </button>
                  )}
                  
                  <button
                    onClick={() => openInMaps(client)}
                    className="py-2 px-3 rounded-lg text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                  >
                    <Navigation className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Recently Completed Clients Section */}
      {allCompletedTodayClients.length > 0 && (
        <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center mb-3">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Completados Hoy</h3>
            <span className="ml-auto text-sm text-gray-500">{allCompletedTodayClients.length} clientes</span>
          </div>
          
          <div className="space-y-2">
            {allCompletedTodayClients.map((client, index) => (
              <div key={index} className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-100">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  <div>
                    <h4 className="font-medium text-gray-900">{client.Nombre}</h4>
                    <p className="text-xs text-gray-500">
                      Próxima visita en {client.Frecuencia} semanas
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getClientTypeColor(client.Tipo_Cliente)}`}>
                  {client.Tipo_Cliente}
                </span>
              </div>
            ))}
          </div>
          
          <div className="mt-3 text-xs text-gray-500 text-center">
            Estos clientes aparecerán nuevamente según su frecuencia de visita
          </div>
        </div>
      )}
    </div>
  )
} 