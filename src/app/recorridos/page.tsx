'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
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
import VendorSelector from '@/components/VendorSelector'
import { isMasterAccount, getVendorEmails, getVendorLabel } from '@/utils/auth'

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
    // ✅ FIX: Use Mazatlán timezone for day selection
    const utcNow = new Date();
    const mazatlanOffset = -7; // GMT-7
    const mazatlanTime = new Date(utcNow.getTime() + (mazatlanOffset * 60 * 60 * 1000));
    const dayNames: RouteDay[] = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
    const mazatlanDay = dayNames[mazatlanTime.getDay()];
    
    console.log(' DAY SELECTION INIT:', {
      utcTime: utcNow.toISOString(),
      mazatlanTime: mazatlanTime.toISOString(),
      utcDay: dayNames[utcNow.getDay()],
      mazatlanDay: mazatlanDay,
      selectedDay: mazatlanDay
    });
    
    return mazatlanDay;
  })
  const [visitStatus, setVisitStatus] = useState<Record<string, VisitStatus>>({})
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null)
  const [routeStartTime, setRouteStartTime] = useState<string | null>(null)
  const [savingRoute, setSavingRoute] = useState(false)
  const [routeInProgress, setRouteInProgress] = useState(false) // Track if route is active
  const [routeFinishedToday, setRouteFinishedToday] = useState(false) // Track if route was already finished today
  
  // ✅ NEW: Postpone pool state for CLEY clients
  const [postponePool, setPostponePool] = useState<Record<string, { client: Client, originalDay: string, postponedOn: string }>>({})
  const [showPostponePool, setShowPostponePool] = useState(false)
  const [cleyDaySelector, setCleyDaySelector] = useState<string | null>(null) // Track which client is showing day selector
  const [completingClient, setCompletingClient] = useState<string | null>(null) // Track which client is being completed for animation
  
  // ✅ NEW: Pending reschedules state
  const [pendingReschedules, setPendingReschedules] = useState<Array<{
    clientName: string;
    originalDay: string;
    newDay: string;
    visitType: 'Pedidos' | 'Entrega' | 'Normal';
  }>>([])
  const [savingReschedules, setSavingReschedules] = useState(false)
  const [rescheduledClients, setRescheduledClients] = useState<Record<string, { originalDay: string, newDay: string, visitType: string }>>({}) // Active reschedules from sheet
  const [routePerformanceData, setRoutePerformanceData] = useState<Array<any>>([]) // Route performance records
  
  // ✅ NEW: Master account state
  const [isMaster, setIsMaster] = useState(false)
  const [selectedVendorEmail, setSelectedVendorEmail] = useState<string | null>(null)
  const [availableVendors, setAvailableVendors] = useState<Array<{email: string, label: string, clientCount?: number}>>([])
  const [viewingAsVendor, setViewingAsVendor] = useState<string>('')

  // ✅ HELPER: Calculate the actual date for the selected day in the current week
  const getSelectedDayDate = (selectedDay: RouteDay): string => {
    const utcNow = new Date();
    const mazatlanOffset = -7; // GMT-7
    const mazatlanTime = new Date(utcNow.getTime() + (mazatlanOffset * 60 * 60 * 1000));
    
    const dayNames: RouteDay[] = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    const currentDayIndex = mazatlanTime.getDay();
    const selectedDayIndex = dayNames.indexOf(selectedDay);
    
    // Calculate the date for the selected day in the current week
    const selectedDayDate = new Date(mazatlanTime);
    const dayDifference = selectedDayIndex - currentDayIndex;
    selectedDayDate.setDate(mazatlanTime.getDate() + dayDifference);
    
    return selectedDayDate.toISOString().split('T')[0];
  };

  // ✅ VALIDATION: Log when postpone pool changes
  useEffect(() => {
    console.log(' POSTPONE POOL CHANGED:', {
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

  // ✅ NEW: Check route progress when visit history or pending clients change
  useEffect(() => {
    if (dataLoaded) {
      checkRouteInProgress();
    }
  }, [visitHistory, dataLoaded]);

  useEffect(() => {
    if (session?.user?.email) {
      // Check if user is master account
      const masterStatus = isMasterAccount(session.user.email);
      setIsMaster(masterStatus);
      
      if (masterStatus) {
        // Initialize available vendors for master accounts
        const vendors = getVendorEmails().map(email => ({
          email,
          label: getVendorLabel(email)
        }));
        
        // ✅ FIXED: Add "All Routes" option explicitly for master accounts
        const vendorsWithAllOption = [
          { email: 'ALL_ROUTES', label: 'Todas las Rutas' },
          ...vendors
        ];
        
        setAvailableVendors(vendorsWithAllOption);
        
        // ✅ FIXED: Default to user's own routes if they exist, otherwise default to first vendor
        const userHasOwnRoutes = vendors.some(v => v.email === session.user?.email);
        if (userHasOwnRoutes && session.user?.email) {
          setSelectedVendorEmail(session.user.email);
          setViewingAsVendor(getVendorLabel(session.user.email));
        } else if (vendors.length > 0) {
          setSelectedVendorEmail(vendors[0].email);
          setViewingAsVendor(vendors[0].label);
        } else {
          setSelectedVendorEmail('ALL_ROUTES');
          setViewingAsVendor('Todas las Rutas');
        }
      }
      
      // ✅ NEW: Load persisted route state from localStorage
      loadPersistedRouteState();
      
      setDataLoaded(false); // Reset data loaded state
      console.log(' DATA LOADING: Starting Promise.all with all fetch functions');
      Promise.all([
        fetchClients(),
        fetchConfiguration(),
        fetchVisitHistory(),
        fetchScheduledVisits(),
        fetchRescheduledVisits(),
        fetchRoutePerformance()
      ]).then(() => {
        console.log('✅ DATA LOADING: All Promise.all functions completed successfully');
        setDataLoaded(true);
        // ✅ NEW: Load route state after all data is available
        loadPersistedRouteState();
        // ✅ NEW: Check if route is in progress after data loads
        checkRouteInProgress();
      }).catch((error) => {
        console.error('❌ DATA LOADING ERROR: Promise.all failed:', error);
        console.error('❌ DATA LOADING ERROR: Error stack:', error?.stack);
        setDataLoaded(true); // Set to true even on error to prevent infinite loading
      });
      getCurrentLocation()
    }
  }, [session])

  // ✅ NEW: Refetch data when vendor selection changes for master accounts
  useEffect(() => {
    if (isMaster && dataLoaded) {
      console.log(' MASTER DEBUG: Vendor selection changed, refetching data for:', selectedVendorEmail || 'all vendors')
      console.log(' VENDOR REFETCH: Starting Promise.all for vendor change');
      Promise.all([
        fetchClients(),
        fetchVisitHistory(),
        fetchScheduledVisits(),
        fetchRescheduledVisits(),
        fetchRoutePerformance()
      ]).then(() => {
        console.log('✅ VENDOR REFETCH: All functions completed successfully');
        // ✅ NEW: Load route state after vendor data refresh
        loadPersistedRouteState();
        // ✅ NEW: Recheck route progress after vendor data refresh
        checkRouteInProgress();
      }).catch((error) => {
        console.error('Error refetching data for vendor change:', error)
      })
    }
  }, [selectedVendorEmail, isMaster])

  // ✅ NEW: Dedicated effect to ALWAYS fetch route performance when session or vendor changes (for debugging)
  useEffect(() => {
    if (session?.user?.email) {
      console.log(' PERFORMANCE EFFECT: Triggering fetchRoutePerformance due to email/vendor change');
      fetchRoutePerformance();
    }
  }, [session?.user?.email, selectedVendorEmail]);

  // ✅ NEW: Save route state to localStorage
  const saveRouteState = (startTime: string | null, finished: boolean = false, finishedAt?: string, dayToSave?: RouteDay) => {
    try {
      const userEmail = selectedVendorEmail || session?.user?.email;
      if (!userEmail) return;

      const utcNow = new Date();
      const mazatlanOffset = -7; // GMT-7
      const mazatlanTime = new Date(utcNow.getTime() + (mazatlanOffset * 60 * 60 * 1000));
      const mazatlanToday = mazatlanTime.toISOString().split('T')[0];
      
      const storageKey = `routeState_${userEmail}_${mazatlanToday}`;
      const dayForState = dayToSave || selectedDay;
      
      if (startTime || finished) {
        const stateToSave = {
          routeStartTime: startTime,
          selectedDay: dayForState,
          routeFinished: finished,
          finishedAt: finishedAt,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem(storageKey, JSON.stringify(stateToSave));
        console.log(' ROUTE PERSISTENCE: Saved route state to localStorage', { startTime, finished, finishedAt, day: dayForState });
      } else {
        localStorage.removeItem(storageKey);
        console.log('️ ROUTE PERSISTENCE: Cleared route state from localStorage');
      }
    } catch (error) {
      console.error('❌ Error saving route state:', error);
    }
  };

  // ✅ NEW: Load persisted route state and check Rutas_Performance
  const loadPersistedRouteState = (dayToCheck?: RouteDay) => {
    console.log('🔍 ROUTE STATE: Starting loadPersistedRouteState function');
    console.log('🔍 ROUTE STATE DEBUG:', {
      dayToCheck,
      selectedDay,
      routePerformanceDataLength: routePerformanceData.length,
      userEmail: selectedVendorEmail || session?.user?.email,
      isMaster,
      selectedVendorEmail
    });
    
    try {
      const userEmail = selectedVendorEmail || session?.user?.email;
      if (!userEmail) {
        console.log('❌ ROUTE STATE: No user email available');
        return;
      }

      const utcNow = new Date();
      const mazatlanOffset = -7; // GMT-7
      const mazatlanTime = new Date(utcNow.getTime() + (mazatlanOffset * 60 * 60 * 1000));
      const mazatlanToday = mazatlanTime.toISOString().split('T')[0];
      
      // ✅ FIXED: Use the dayToCheck parameter if provided, otherwise use selectedDay
      const dayToSearch = dayToCheck || selectedDay;
      
      console.log('🔍 ROUTE STATE: Search parameters:', {
        userEmail,
        mazatlanToday,
        dayToSearch,
        searchingForToday: mazatlanToday,
        dayToSearchLower: dayToSearch.toLowerCase()
      });
      
      // ✅ VALIDATION: Log all available performance records for debugging
      console.log('🔍 PERFORMANCE RECORDS ANALYSIS:');
      console.log('📊 Total performance records:', routePerformanceData.length);
      
      if (routePerformanceData.length > 0) {
        console.log('📊 Sample performance records:');
        routePerformanceData.slice(0, 5).forEach((record, index) => {
          console.log(`  Record ${index + 1}:`, {
            fecha: record.fecha,
            dia_ruta: record.dia_ruta,
            vendedor: record.vendedor,
            tiempo_inicio: record.tiempo_inicio,
            tiempo_fin: record.tiempo_fin,
            matchesDate: record.fecha === mazatlanToday,
            matchesDay: record.dia_ruta?.toLowerCase() === dayToSearch.toLowerCase(),
            vendorCheck: {
              recordVendor: record.vendedor,
              userEmail,
              directMatch: record.vendedor === userEmail,
              labelMatch: record.vendedor === 'Franz',
              shouldMatch: record.vendedor === userEmail || record.vendedor === 'Franz'
            }
          });
        });
        
        // ✅ VALIDATION: Check for finished routes on the selected day (any date)
        console.log('🔍 SEARCHING FOR FINISHED ROUTES ON SELECTED DAY (ANY DATE):');
        const dayRouteRecords = routePerformanceData.filter(record => {
          const recordDay = record.dia_ruta?.toLowerCase();
          const searchDay = dayToSearch.toLowerCase();
          const dayMatch = recordDay === searchDay;
          
          console.log(`  Day filter: ${record.dia_ruta} (${recordDay}) vs ${dayToSearch} (${searchDay}) = ${dayMatch}`);
          return dayMatch;
        });
        
        console.log(`📊 Found ${dayRouteRecords.length} records for ${dayToSearch}:`, dayRouteRecords.map(r => ({
          fecha: r.fecha,
          vendedor: r.vendedor,
          tiempo_inicio: r.tiempo_inicio,
          tiempo_fin: r.tiempo_fin
        })));
        
        // ✅ VALIDATION: Check vendor matching for each record
        dayRouteRecords.forEach((record, index) => {
          const vendorAliases = new Set<string>();
          if (userEmail) {
            vendorAliases.add(userEmail);
            vendorAliases.add('Franz'); // Franz is the friendly label for franzcharbell@gmail.com
          }
          if (isMaster) {
            if (selectedVendorEmail === 'ALL_ROUTES') {
              vendorAliases.add('*'); // Special marker for all vendors
            } else if (selectedVendorEmail) {
              vendorAliases.add(selectedVendorEmail);
              vendorAliases.add(getVendorLabel(selectedVendorEmail));
            }
          }
          
          const isCorrectVendor = vendorAliases.has('*') || vendorAliases.has(record.vendedor);
          
          console.log(`  Record ${index + 1} vendor check:`, {
            recordVendor: record.vendedor,
            vendorAliases: Array.from(vendorAliases),
            isCorrectVendor,
            wouldShowRefinalizar: isCorrectVendor
          });
        });
      }
      
      // ✅ ENHANCED: Check for ANY completed route on the selected day (not just today)
      console.log('🔍 PERFORMANCE CHECK: Looking for completed route with criteria:', {
        userEmail,
        selectedVendorEmail,
        dayToSearch: dayToSearch.toLowerCase(),
        selectedDay: selectedDay.toLowerCase(),
        totalRecords: routePerformanceData.length,
        isMaster,
        searchCriteria: `ANY date AND day:${dayToSearch.toLowerCase()}`,
        masterAccountContext: {
          isMaster,
          selectedVendorEmail,
          hasOwnRoutes: userEmail === session?.user?.email,
          viewingOwnRoutes: selectedVendorEmail === session?.user?.email,
          viewingAllRoutes: selectedVendorEmail === 'ALL_ROUTES',
          viewingSpecificVendor: selectedVendorEmail && selectedVendorEmail !== 'ALL_ROUTES' && selectedVendorEmail !== session?.user?.email
        }
      });
      
      const anyDayRouteRecord = routePerformanceData.find(record => {
        const recordDay = record.dia_ruta?.toLowerCase();
        const recordVendor = record.vendedor;
        
        const isCorrectDay = recordDay === dayToSearch.toLowerCase();
        
        // ✅ FIXED: Build vendor aliases based on the SELECTED VENDOR, not the master account
        const vendorAliases = new Set<string>();
        
        if (isMaster && selectedVendorEmail && selectedVendorEmail !== 'ALL_ROUTES') {
          // ✅ FIXED: When master is viewing a specific vendor, check THAT vendor's routes
          if (selectedVendorEmail === session?.user?.email) {
            // Master viewing their own routes
            vendorAliases.add(selectedVendorEmail);
            vendorAliases.add('Franz'); // Add Franz label for franzcharbell@gmail.com
            console.log(`🔍 MASTER VIEWING OWN ROUTES: Checking ${selectedVendorEmail} (Franz) routes`);
          } else {
            // Master viewing another vendor's routes - check ONLY that vendor
            vendorAliases.add(selectedVendorEmail);
            vendorAliases.add(getVendorLabel(selectedVendorEmail));
            console.log(`🔍 MASTER VIEWING OTHER VENDOR: Checking ${selectedVendorEmail} (${getVendorLabel(selectedVendorEmail)}) routes, NOT Franz routes`);
          }
        } else if (isMaster && selectedVendorEmail === 'ALL_ROUTES') {
          // For ALL_ROUTES, accept any vendor
          vendorAliases.add('*'); // Special marker for all vendors
          console.log(`🔍 MASTER VIEWING ALL ROUTES: Accepting any vendor`);
        } else {
          // Regular user or master without vendor selection - use their own identifiers
          if (userEmail) {
            vendorAliases.add(userEmail);
            vendorAliases.add('Franz'); // Add the friendly label mapping for franzcharbell@gmail.com
            console.log(`🔍 REGULAR USER OR DEFAULT: Checking ${userEmail} (Franz) routes`);
          }
        }
        
        const isCorrectVendor = vendorAliases.has('*') || vendorAliases.has(recordVendor);
        
        console.log('🔍 PERFORMANCE RECORD CHECK (ANY DATE):', {
          recordDate: record.fecha,
          recordDay,
          recordVendor,
          isCorrectDay: `${isCorrectDay} (${recordDay} === ${dayToSearch.toLowerCase()})`,
          isCorrectVendor,
          vendorAliases: Array.from(vendorAliases),
          matches: isCorrectDay && isCorrectVendor,
          reason: !isCorrectDay ? 'Day mismatch' : !isCorrectVendor ? 'Vendor mismatch' : 'All match',
          masterAccountDebug: {
            isMaster,
            selectedVendorEmail,
            sessionUserEmail: session?.user?.email,
            isViewingOwnRoutes: selectedVendorEmail === session?.user?.email,
            isViewingAllRoutes: selectedVendorEmail === 'ALL_ROUTES',
            isViewingOtherVendor: selectedVendorEmail && selectedVendorEmail !== session?.user?.email && selectedVendorEmail !== 'ALL_ROUTES',
            recordBelongsToSelectedVendor: vendorAliases.has(recordVendor),
            shouldShowRefinalizar: isCorrectDay && isCorrectVendor
          }
        });
        
        return isCorrectDay && isCorrectVendor;
      });
      
      if (anyDayRouteRecord) {
        console.log('✅ PERFORMANCE CHECK: Found completed route for selected day (any date):', {
          fecha: anyDayRouteRecord.fecha,
          dia_ruta: anyDayRouteRecord.dia_ruta,
          vendedor: anyDayRouteRecord.vendedor,
          tiempo_inicio: anyDayRouteRecord.tiempo_inicio,
          tiempo_fin: anyDayRouteRecord.tiempo_fin,
          selectedDay: dayToSearch,
          shouldShowRefinalizar: true,
          masterAccountContext: {
            isMaster,
            selectedVendorEmail,
            isViewingOwnRoute: anyDayRouteRecord.vendedor === userEmail || anyDayRouteRecord.vendedor === 'Franz',
            isViewingOtherVendorRoute: anyDayRouteRecord.vendedor !== userEmail && anyDayRouteRecord.vendedor !== 'Franz'
          }
        });
        
        // ✅ FIXED: Always set route as finished if there's a completed route for this day
        setRouteFinishedToday(true);
        setRouteStartTime(anyDayRouteRecord.tiempo_inicio || '08:00');
        setRouteInProgress(false);
        
        // Also save to localStorage for consistency
        saveRouteState(anyDayRouteRecord.tiempo_inicio, true, anyDayRouteRecord.tiempo_fin, dayToSearch);
        
        console.log('✅ ROUTE STATE: Set finished state for selected day with re-finalizar capability');
        return;
      } else {
        console.log('❌ PERFORMANCE CHECK: No completed route found for selected day:', {
          dayToSearch,
          totalRecordsChecked: routePerformanceData.length,
          userEmail,
          selectedVendorEmail,
          masterAccountAnalysis: {
            isMaster,
            totalRecords: routePerformanceData.length,
            franzRecords: routePerformanceData.filter(r => r.vendedor === userEmail || r.vendedor === 'Franz').length,
            mazatlanRecords: routePerformanceData.filter(r => r.vendedor === 'Mazatlan').length,
            brendaRecords: routePerformanceData.filter(r => r.vendedor === 'Brenda').length,
            lidiaRecords: routePerformanceData.filter(r => r.vendedor === 'Lidia').length,
            arlynRecords: routePerformanceData.filter(r => r.vendedor === 'Arlyn').length,
            recordsForSelectedDay: routePerformanceData.filter(r => r.dia_ruta?.toLowerCase() === dayToSearch.toLowerCase()).map(r => ({
              fecha: r.fecha,
              vendedor: r.vendedor,
              tiempo_inicio: r.tiempo_inicio
            }))
          },
          vendorMatches: routePerformanceData.filter(r => {
            // ✅ FIXED: Use same vendor alias logic as the main check
            const vendorAliases = new Set<string>();
            
            if (isMaster && selectedVendorEmail && selectedVendorEmail !== 'ALL_ROUTES') {
              if (selectedVendorEmail === session?.user?.email) {
                // Master viewing their own routes
                vendorAliases.add(selectedVendorEmail);
                vendorAliases.add('Franz');
              } else {
                // Master viewing another vendor's routes
                vendorAliases.add(selectedVendorEmail);
                vendorAliases.add(getVendorLabel(selectedVendorEmail));
              }
            } else if (isMaster && selectedVendorEmail === 'ALL_ROUTES') {
              vendorAliases.add('*');
            } else {
              if (userEmail) {
                vendorAliases.add(userEmail);
                vendorAliases.add('Franz');
              }
            }
            
            return vendorAliases.has('*') || vendorAliases.has(r.vendedor);
          }).length,
          dayMatches: routePerformanceData.filter(r => r.dia_ruta?.toLowerCase() === dayToSearch.toLowerCase()).length
        });
      }
      
      // ✅ ENHANCED: Check for today's specific route record  
      const todayRouteRecord = routePerformanceData.find(record => {
        const recordDate = record.fecha;
        const recordDay = record.dia_ruta?.toLowerCase();
        const recordVendor = record.vendedor;
        
        const isToday = recordDate === mazatlanToday;
        const isCorrectDay = recordDay === dayToSearch.toLowerCase();
        
        // ✅ FIXED: Build vendor aliases based on the SELECTED VENDOR, not the master account
        const vendorAliases = new Set<string>();
        
        if (isMaster && selectedVendorEmail && selectedVendorEmail !== 'ALL_ROUTES') {
          // ✅ FIXED: When master is viewing a specific vendor, check THAT vendor's routes
          if (selectedVendorEmail === session?.user?.email) {
            // Master viewing their own routes
            vendorAliases.add(selectedVendorEmail);
            vendorAliases.add('Franz'); // Add Franz label for franzcharbell@gmail.com
          } else {
            // Master viewing another vendor's routes - check ONLY that vendor
            vendorAliases.add(selectedVendorEmail);
            vendorAliases.add(getVendorLabel(selectedVendorEmail));
          }
        } else if (isMaster && selectedVendorEmail === 'ALL_ROUTES') {
          // For ALL_ROUTES, accept any vendor
          vendorAliases.add('*'); // Special marker for all vendors
        } else {
          // Regular user or master without vendor selection - use their own identifiers
          if (userEmail) {
            vendorAliases.add(userEmail);
            vendorAliases.add('Franz'); // Add Franz label for franzcharbell@gmail.com
          }
        }
        
        const isCorrectVendor = vendorAliases.has('*') || vendorAliases.has(recordVendor);
        
        console.log('🔍 TODAY PERFORMANCE RECORD CHECK:', {
          recordDate,
          recordDay,
          recordVendor,
          isToday: `${isToday} (${recordDate} === ${mazatlanToday})`,
          isCorrectDay: `${isCorrectDay} (${recordDay} === ${dayToSearch.toLowerCase()})`,
          isCorrectVendor,
          vendorAliases: Array.from(vendorAliases),
          matches: isToday && isCorrectDay && isCorrectVendor,
          reason: !isToday ? 'Date mismatch' : !isCorrectDay ? 'Day mismatch' : !isCorrectVendor ? 'Vendor mismatch' : 'All match',
          selectedVendorContext: {
            isMaster,
            selectedVendorEmail,
            isViewingOwnRoutes: selectedVendorEmail === session?.user?.email,
            isViewingOtherVendor: selectedVendorEmail && selectedVendorEmail !== session?.user?.email && selectedVendorEmail !== 'ALL_ROUTES'
          }
        });
        
        return isToday && isCorrectDay && isCorrectVendor;
      });
      
      if (todayRouteRecord) {
        console.log('✅ PERFORMANCE CHECK: Found completed route in Rutas_Performance for TODAY:', {
          fecha: todayRouteRecord.fecha,
          dia_ruta: todayRouteRecord.dia_ruta,
          vendedor: todayRouteRecord.vendedor,
          tiempo_inicio: todayRouteRecord.tiempo_inicio,
          tiempo_fin: todayRouteRecord.tiempo_fin
        });
        
        setRouteFinishedToday(true);
        setRouteStartTime(todayRouteRecord.tiempo_inicio || '08:00');
        setRouteInProgress(false);
        
        // Also save to localStorage for consistency
        saveRouteState(todayRouteRecord.tiempo_inicio, true, todayRouteRecord.tiempo_fin);
        return;
      }
      
      // ✅ FALLBACK: Check localStorage if no performance record found
      const storageKey = `routeState_${userEmail}_${mazatlanToday}`;
      const savedState = localStorage.getItem(storageKey);
      
      if (savedState) {
        const { 
          routeStartTime: savedStartTime, 
          selectedDay: savedDay, 
          routeFinished: savedFinished,
          finishedAt: savedFinishedAt
        } = JSON.parse(savedState);
        
        console.log('🔍 ROUTE PERSISTENCE: Loading saved route state from localStorage:', {
          savedStartTime,
          savedDay,
          savedFinished,
          savedFinishedAt,
          currentDay: dayToSearch,
          selectedDay
        });
        
        if (savedDay === dayToSearch) {
          // ✅ ADDITIONAL CHECK: Only restore state if we're viewing today's tab
          const dayNames: RouteDay[] = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
          const actualDayName = dayNames[mazatlanTime.getDay()];
          const isViewingToday = dayToSearch === actualDayName;
          
          if (isViewingToday) {
            if (savedStartTime) {
              setRouteStartTime(savedStartTime);
              setRouteInProgress(true);
            }
            if (savedFinished) {
              setRouteFinishedToday(true);
              console.log('✅ ROUTE PERSISTENCE: Route was already finished today at', savedFinishedAt);
            }
            console.log('✅ ROUTE PERSISTENCE: Restored route session from localStorage for today');
          } else {
            console.log('🔍 ROUTE PERSISTENCE: Skipping state restoration - viewing different day than today');
            // ✅ FIXED: Don't clear states when viewing other days - let them show re-finalizar if they have completed routes
            // setRouteStartTime(null);
            // setRouteInProgress(false);
            // setRouteFinishedToday(false);
          }
        } else {
          console.log('🔍 ROUTE PERSISTENCE: Saved day mismatch - clearing states');
          // Clear states if saved day doesn't match
          setRouteStartTime(null);
          setRouteInProgress(false);
          setRouteFinishedToday(false);
        }
      } else {
        console.log('🔍 ROUTE PERSISTENCE: No localStorage state found for today');
        // ✅ FIXED: Don't clear states if no localStorage - let performance records determine state
        // setRouteStartTime(null);
        // setRouteInProgress(false);
        // setRouteFinishedToday(false);
      }
    } catch (error) {
      console.error('❌ Error loading persisted route state:', error);
    }
  };

  // ✅ NEW: Check if route is in progress based on completed visits today - FIXED TIMEZONE & DAY-AWARE
  const checkRouteInProgress = () => {
    try {
      // ✅ FIX: Use Mazatlán timezone consistently
      const utcNow = new Date();
      const mazatlanOffset = -7; // GMT-7
      const mazatlanTime = new Date(utcNow.getTime() + (mazatlanOffset * 60 * 60 * 1000));
      const mazatlanToday = mazatlanTime.toISOString().split('T')[0];
      
      const userEmail = selectedVendorEmail || session?.user?.email;
      
      if (!userEmail) return;

      const dayNames: RouteDay[] = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
      const actualDayName = dayNames[mazatlanTime.getDay()];

      // ✅ FIXED: Only check for completed visits that are relevant to the current context
      // If the selected day is TODAY, check for completed visits today
      // If the selected day is NOT today, don't consider completed visits (they're for a different day)
      const isSelectedDayToday = selectedDay === actualDayName;
      
      const hasCompletedVisitsToday = isSelectedDayToday && Object.values(visitHistory).some(history => {
        return history.lastVisitDate === mazatlanToday;
      });

      // ✅ REMOVED: Auto-switch logic that was causing interference
      // Let users manually control day selection without automatic switching

      // ✅ FIXED: Only check pending visits for the selected day, not all days
      // Note: We can't use actuallyPendingClients here as it's defined later in the component
      // Instead, we'll rely on the other conditions
      
      // ✅ FIXED: Only show finish button if we're on the correct day AND have valid reason
      const shouldShowFinishButton = isSelectedDayToday && (
        hasCompletedVisitsToday || 
        (!!routeStartTime && !routeFinishedToday) // Only consider routeStartTime if route not finished
      );
      
      console.log(' ROUTE PROGRESS CHECK (DAY-AWARE):', {
        userEmail,
        mazatlanToday,
        selectedDay,
        actualDayName,
        isSelectedDayToday,
        hasCompletedVisitsToday,
        routeStartTime,
        routeFinishedToday,
        shouldShowFinishButton,
        completedTodayCount: Object.values(visitHistory).filter(h => h.lastVisitDate === mazatlanToday).length,
        reason: !isSelectedDayToday ? "Not today's tab" : 
                !hasCompletedVisitsToday && !routeStartTime ? 'No completed visits and no start time' :
                routeFinishedToday && !!routeStartTime ? 'Route already finished' : 
                'Should show button'
      });

      setRouteInProgress(shouldShowFinishButton);
      
      // ✅ FIXED: Only set default start time if we're on today's tab and have completed visits
      if (isSelectedDayToday && hasCompletedVisitsToday && !routeStartTime) {
        const defaultStartTime = '08:00'; // Default morning start
        setRouteStartTime(defaultStartTime);
        saveRouteState(defaultStartTime);
        console.log(' ROUTE PROGRESS: Set default start time for existing completed visits on correct day');
      }
      
    } catch (error) {
      console.error('❌ Error checking route progress:', error);
    }
  };



  const fetchClients = async () => {
    try {
      setLoading(true)
      
      // Determine which email to use for the API call
      let apiUrl = `/api/recorridos?email=${encodeURIComponent(session?.user?.email || '')}&sheet=clientes`
      
      // ✅ FIXED: Handle master account vendor selection properly
      if (isMaster) {
        if (selectedVendorEmail === 'ALL_ROUTES') {
          // Explicitly request all routes by passing viewAsEmail=null
          apiUrl += `&viewAsEmail=null`
        } else if (selectedVendorEmail) {
          // View specific vendor (including master's own email)
          apiUrl += `&viewAsEmail=${encodeURIComponent(selectedVendorEmail)}`
        }
      }
      
      console.log(' MASTER DEBUG: Fetching clients with URL:', apiUrl)
      
      const response = await fetch(apiUrl)
      
      if (!response.ok) {
        throw new Error('Failed to fetch clients')
      }
      
      const data = await response.json()
      setClients(data.data || [])
      
      console.log(' MASTER DEBUG: Received clients:', data.data?.length || 0)
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
      let apiUrl = `/api/recorridos?email=${encodeURIComponent(session?.user?.email || '')}&sheet=metricas`
      
      // ✅ FIXED: Handle master account vendor selection properly
      if (isMaster) {
        if (selectedVendorEmail === 'ALL_ROUTES') {
          // Explicitly request all routes by passing viewAsEmail=null
          apiUrl += `&viewAsEmail=null`
        } else if (selectedVendorEmail) {
          // View specific vendor (including master's own email)
          apiUrl += `&viewAsEmail=${encodeURIComponent(selectedVendorEmail)}`
        }
      }
      
      const response = await fetch(apiUrl)
      
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
      let apiUrl = `/api/recorridos?email=${encodeURIComponent(session?.user?.email || '')}&sheet=programacion`
      
      // ✅ FIXED: Handle master account vendor selection properly
      if (isMaster) {
        if (selectedVendorEmail === 'ALL_ROUTES') {
          // Explicitly request all routes by passing viewAsEmail=null
          apiUrl += `&viewAsEmail=null`
        } else if (selectedVendorEmail) {
          // View specific vendor (including master's own email)
          apiUrl += `&viewAsEmail=${encodeURIComponent(selectedVendorEmail)}`
        }
      }
      
      const response = await fetch(apiUrl)
      
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
      let apiUrl = `/api/recorridos?email=${encodeURIComponent(session?.user?.email || '')}&sheet=reprogramadas`
      
      // ✅ FIXED: Handle master account vendor selection properly
      if (isMaster) {
        if (selectedVendorEmail === 'ALL_ROUTES') {
          // Explicitly request all routes by passing viewAsEmail=null
          apiUrl += `&viewAsEmail=null`
        } else if (selectedVendorEmail) {
          // View specific vendor (including master's own email)
          apiUrl += `&viewAsEmail=${encodeURIComponent(selectedVendorEmail)}`
        }
      }
      
      const response = await fetch(apiUrl)
      
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
        
        console.log('✅ RESCHEDULE FETCH: Loaded active reschedules:', Object.keys(reschedules));
        setRescheduledClients(reschedules)
      }
    } catch (error) {
      console.error('❌ Error fetching rescheduled visits:', error)
    }
  }

  const fetchRoutePerformance = async () => {
    console.log(' PERFORMANCE FETCH: Starting fetchRoutePerformance function');
    console.log(' PERFORMANCE FETCH: Session email:', session?.user?.email);
    console.log(' PERFORMANCE FETCH: Selected vendor email:', selectedVendorEmail);
    console.log(' PERFORMANCE FETCH: Is master:', isMaster);
    try {
      let apiUrl = `/api/recorridos?email=${encodeURIComponent(session?.user?.email || '')}&sheet=performance`
      
      // ✅ FIXED: Handle master account vendor selection properly
      if (isMaster) {
        if (selectedVendorEmail === 'ALL_ROUTES') {
          // Explicitly request all routes by passing viewAsEmail=null
          apiUrl += `&viewAsEmail=null`
        } else if (selectedVendorEmail) {
          // View specific vendor (including master's own email)
          apiUrl += `&viewAsEmail=${encodeURIComponent(selectedVendorEmail)}`
        }
      }
      
      console.log('✅ PERFORMANCE API: Making request to:', apiUrl);
      
      const response = await fetch(apiUrl).catch(fetchError => {
        console.error('❌ PERFORMANCE FETCH NETWORK ERROR:', fetchError);
        throw fetchError;
      });
      
      console.log(' PERFORMANCE API: Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        console.warn('❌ Failed to fetch route performance data - Status:', response.status);
        const errorText = await response.text();
        console.warn('❌ Error response:', errorText);
        return
      }
      
      const data = await response.json()
      
      console.log(' PERFORMANCE API: Raw response data:', data);
      
      if (data.data && data.data.length > 0) {
        console.log(' PERFORMANCE FETCH: Loaded route performance data:', data.data.length, 'records');
        console.log(' PERFORMANCE FETCH: Sample records:', data.data.slice(0, 3));
        setRoutePerformanceData(data.data)
      } else {
        console.log(' PERFORMANCE FETCH: No performance data returned');
        setRoutePerformanceData([]);
      }
    } catch (error: any) {
      console.error('❌ PERFORMANCE FETCH ERROR:', error)
      console.error('❌ PERFORMANCE ERROR STACK:', error?.stack)
      // Set empty array on error so the logic still works
      setRoutePerformanceData([]);
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
          console.log(` RESCHEDULE APPLIED: ${pedidosKey} moved from ${client.Dia} to ${pedidosDay}`);
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
          console.log(` RESCHEDULE APPLIED: ${entregaKey} moved from ${client.Entrega} to ${entregaDay}`);
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
        
        // ✅ ENHANCED: Check multiple possible keys for regular clients
        const possibleKeys = [
          client.Nombre, // Direct name (used by postpone system)
          `${client.Nombre} (Normal)` // Original key format
        ];
        
        let foundReschedule = false;
        let usedKey = '';
        
        for (const key of possibleKeys) {
          if (rescheduledClients[key]) {
            clientDay = rescheduledClients[key].newDay;
            foundReschedule = true;
            usedKey = key;
            console.log(`🔄 REGULAR RESCHEDULE APPLIED: ${client.Nombre} moved from ${client.Dia} to ${clientDay} (using key: "${usedKey}")`);
            break;
          }
        }
        
        if (!foundReschedule) {
          console.log(`📋 REGULAR CLIENT: ${client.Nombre} staying on original day ${client.Dia} (no reschedule found)`);
        }
        
        console.log(`🏗️ EXPANDING REGULAR CLIENT:`, {
          originalName: client.Nombre,
          originalDay: client.Dia,
          finalDay: clientDay,
          wasRescheduled: foundReschedule,
          rescheduleKey: usedKey,
          availableRescheduleKeys: Object.keys(rescheduledClients)
        });

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
    
    console.log(` CLEY POSTPONE: Adding ${client.Nombre} to postpone pool for ${targetDay}`);
    
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

  // ✅ NEW: Handle regular client postpone - add to postpone pool with day selection
  const postponeRegularClient = (client: Client, targetDay: RouteDay) => {
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`🔄 REGULAR POSTPONE START: Adding ${client.Nombre} to postpone pool for ${targetDay}`);
    console.log(`🔄 REGULAR POSTPONE CLIENT DATA:`, {
      clientName: client.Nombre,
      originalDay: client.Dia,
      targetDay: targetDay,
      clientType: client.Tipo_Cliente,
      isClientCley: client.Tipo_Cliente?.toUpperCase() === 'CLEY'
    });
    
    // ✅ VALIDATION: Log that this is only client-side
    console.log(`❌ REGULAR POSTPONE ISSUE: This function only updates React state - NO API CALL!`);
    console.log(`❌ MISSING: API call to save postpone action to backend`);
    console.log(`❌ COMPARISON: CLEY clients use rescheduleFromPostponePool() → API call, regular clients don't`);
    
    setPostponePool(prev => {
      const newPool = {
        ...prev,
        [client.Nombre]: {
          client: {
            ...client,
            Dia: targetDay // Update the day for rescheduling
          },
          originalDay: client.Dia,
          postponedOn: today
        }
      };
      
      console.log(`🔄 REGULAR POSTPONE POOL UPDATE:`, {
        clientName: client.Nombre,
        poolBefore: Object.keys(prev),
        poolAfter: Object.keys(newPool),
        newEntry: newPool[client.Nombre]
      });
      
      return newPool;
    });
    
    // Mark as postponed in current route
    setVisitStatus(prev => {
      console.log(`🔄 REGULAR POSTPONE STATUS UPDATE:`, {
        clientName: client.Nombre,
        statusBefore: prev[client.Nombre] || 'none',
        statusAfter: 'postponed'
      });
      
      return {
        ...prev,
        [client.Nombre]: 'postponed' as VisitStatus
      };
    });
    
    // ✅ FIX: Add immediate API call to save the postpone action
    console.log(`🔄 REGULAR POSTPONE API: Now calling reschedule API to persist the postpone`);
    
    // Create a reschedule request for the regular client
    const rescheduleRequest = {
      clientName: client.Nombre,
      originalDay: client.Dia,
      newDay: targetDay,
      visitType: 'Normal' as const
    };
    
    // Call the reschedule API immediately
    fetch('/api/recorridos/reschedule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'batch_reschedule',
        userEmail: selectedVendorEmail || session?.user?.email,
        reschedules: [rescheduleRequest],
        masterEmail: isMaster ? session?.user?.email : undefined,
      }),
    })
    .then(response => {
      if (response.ok) {
        console.log(`✅ REGULAR POSTPONE API SUCCESS: ${client.Nombre} postpone saved to backend`);
        
        // Update rescheduledClients state to reflect the API save
        setRescheduledClients(prev => ({
          ...prev,
          [client.Nombre]: {
            originalDay: client.Dia,
            newDay: targetDay,
            visitType: 'Normal'
          }
        }));
        
        console.log(`🔄 REGULAR POSTPONE STATE: Added ${client.Nombre} to rescheduledClients mapping`);
      } else {
        console.error(`❌ REGULAR POSTPONE API ERROR: Failed to save ${client.Nombre} postpone to backend`);
        response.json().then(errorData => {
          console.error(`❌ REGULAR POSTPONE ERROR DETAILS:`, errorData);
        });
        
        // Revert the postpone if API call failed
        setPostponePool(prev => {
          const newPool = { ...prev };
          delete newPool[client.Nombre];
          return newPool;
        });
        
        setVisitStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[client.Nombre];
          return newStatus;
        });
        
        alert('Error al posponer el cliente. Inténtalo de nuevo.');
      }
    })
    .catch(error => {
      console.error(`❌ REGULAR POSTPONE NETWORK ERROR:`, error);
      
      // Revert the postpone if network error
      setPostponePool(prev => {
        const newPool = { ...prev };
        delete newPool[client.Nombre];
        return newPool;
      });
      
      setVisitStatus(prev => {
        const newStatus = { ...prev };
        delete newStatus[client.Nombre];
        return newStatus;
      });
      
      alert('Error de conexión al posponer el cliente. Inténtalo de nuevo.');
    });
    
    console.log(`✅ REGULAR POSTPONE COMPLETE: ${client.Nombre} added to postpone pool for ${targetDay} and API call initiated`);
  };

  // ✅ NEW: Reschedule client from postpone pool to specific day (add to pending reschedules)
  const rescheduleFromPostponePool = (clientName: string, targetDay: RouteDay) => {
    const postponedClient = postponePool[clientName];
    if (!postponedClient) {
      console.error(`❌ RESCHEDULE ERROR: Client ${clientName} not found in postpone pool`);
      return;
    }
    
    const visitType = getVisitType(clientName);
    const originalClientName = getOriginalClientName(clientName);
    const isCley = isCleyClient(postponedClient.client);
    
    console.log(` ${isCley ? 'CLEY' : 'REGULAR'} RESCHEDULE: Adding ${clientName} to ${isCley ? 'pending reschedules' : 'target day'} for ${targetDay}`);
    console.log(` RESCHEDULE DEBUG: Original day: ${postponedClient.originalDay}, Target day: ${targetDay}`);
    
    if (isCley) {
      // CLEY clients use temporary reschedules that revert after visit
      setPendingReschedules(prev => {
        // Remove any existing pending reschedule for this client+visit type
        const filtered = prev.filter(r => !(r.clientName === originalClientName && r.visitType === visitType));
        
        const newReschedule = {
          clientName: originalClientName,
          originalDay: postponedClient.originalDay,
          newDay: targetDay,
          visitType: visitType
        };
        
        console.log(`🔄 CLEY PENDING RESCHEDULE: Added ${clientName} to pending list`);
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
      console.log(`🔄 CLEY RESCHEDULE STATE: Added ${clientName} to rescheduledClients for ${targetDay}`);
    } else {
      // ✅ FIXED: Regular clients need to be added to rescheduledClients with correct key
      console.log(`🔄 REGULAR RESCHEDULE: Moving ${clientName} from ${postponedClient.originalDay} to ${targetDay}`);
      
      // For regular clients, use the client name directly (without visit type suffix)
      const regularClientKey = clientName; // Regular clients don't have (Pedidos)/(Entrega) suffix
      
      setRescheduledClients(prev => ({
        ...prev,
        [regularClientKey]: {
          originalDay: postponedClient.originalDay,
          newDay: targetDay,
          visitType: 'Normal'
        }
      }));
      
      console.log(`🔄 REGULAR RESCHEDULE STATE: Added ${regularClientKey} to rescheduledClients mapping from ${postponedClient.originalDay} to ${targetDay}`);
    }
    
    // Remove from postpone pool
    setPostponePool(prev => {
      const newPool = { ...prev };
      delete newPool[clientName];
      console.log(`️ RESCHEDULE: Removed ${clientName} from postpone pool. Remaining:`, Object.keys(newPool));
      return newPool;
    });
    
    // Clear postponed status (will appear as pending on target day)
    setVisitStatus(prev => {
      const newStatus = { ...prev };
      delete newStatus[clientName];
      console.log(` RESCHEDULE: Cleared visit status for ${clientName}`);
      return newStatus;
    });
    
    console.log(`✅ ${isCley ? 'CLEY' : 'REGULAR'} RESCHEDULE: ${clientName} ${isCley ? 'added to pending reschedules' : 'moved'} for ${targetDay}`);
  };

  // ✅ NEW: Save all pending reschedules to the sheet
  const savePendingReschedules = async () => {
    if (pendingReschedules.length === 0) {
      alert('No hay cambios pendientes para guardar');
      return;
    }

    try {
      setSavingReschedules(true);
      console.log(' SAVING RESCHEDULES: Starting batch save for', pendingReschedules.length, 'reschedules');

      const response = await fetch('/api/recorridos/reschedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'batch_reschedule',
          userEmail: selectedVendorEmail || session?.user?.email, // Use selected vendor for master accounts
          reschedules: pendingReschedules,
          masterEmail: isMaster ? session?.user?.email : undefined, // Audit trail for master accounts
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

  // ✅ REVISED: Determines if a client is generally scheduled for a visit today or is due - FIXED TIMEZONE
  const shouldBeConsideredForVisitToday = (client: Client): boolean => {
    const originalName = getOriginalClientName(client.Nombre);
    const clientHistory = visitHistory[originalName];
    const scheduledVisit = scheduledVisits[originalName] || scheduledVisits[client.Nombre];
    
    // ✅ FIX: Use Mazatlán timezone consistently
    const utcNow = new Date();
    const mazatlanOffset = -7; // GMT-7
    const mazatlanTime = new Date(utcNow.getTime() + (mazatlanOffset * 60 * 60 * 1000));
    const mazatlanToday = mazatlanTime.toISOString().split('T')[0];

    // ✅ PRIORITY 1: Check if client has a scheduled visit for today
    if (scheduledVisit && scheduledVisit.scheduledDate === mazatlanToday && scheduledVisit.status === 'Programado') {
      console.log(` ${client.Nombre} (${originalName}): YES (scheduled for today)`);
      return true;
    }

    // ✅ PRIORITY 2: Check if client has a scheduled visit that's overdue
    if (scheduledVisit && scheduledVisit.status === 'Programado') {
      const scheduledDate = new Date(scheduledVisit.scheduledDate);
      const todayDate = new Date(mazatlanToday);
      if (scheduledDate <= todayDate) {
        console.log(` ${client.Nombre} (${originalName}): YES (overdue scheduled visit from ${scheduledVisit.scheduledDate})`);
        return true;
      }
    }

    // If never visited before, show for first-time visit
    if (!clientHistory) {
      console.log(` ${client.Nombre} (${originalName}): YES (no history - first visit)`);
      return true;
    }
    
    // If completed today (in a previous route or this one), they are part of today's general consideration
    // but will be filtered out from "pending" list later if visitStatus is 'completed'.
    // This ensures they are available for the "Completados Hoy" list.
    if (clientHistory.lastVisitDate === mazatlanToday) {
      console.log(` ${client.Nombre} (${originalName}): YES (last visit was today)`);
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

    // ✅ ENHANCED DEBUG: Show detailed week calculation
    console.log(` WEEK CALCULATION: ${client.Nombre} (${originalName}):`, {
      currentWeek,
      lastVisitWeek,
      lastVisitDate: clientHistory.lastVisitDate,
      weeksSinceLastVisit,
      frequency: client.Frecuencia,
      isDue,
      decision: isDue ? 'YES - include for visit' : 'NO - not due yet',
      mazatlanToday
    });

    return isDue;
  };

  const startRoute = () => {
    const now = new Date()
    const startTime = now.toTimeString().slice(0, 5) // HH:MM format
    setRouteStartTime(startTime)
    setRouteInProgress(true)
    saveRouteState(startTime) // ✅ NEW: Persist route state
    console.log(' ROUTE START: Route started at', startTime)
  }

  // ✅ NEW: Deactivate a temporary reschedule after the visit is completed
  const deactivateRescheduleAfterVisit = async (clientName: string, visitType: string) => {
    try {
      console.log(` DEACTIVATING RESCHEDULE: ${clientName} (${visitType})`);
      
      const response = await fetch('/api/recorridos/reschedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'deactivate_reschedule',
          userEmail: selectedVendorEmail || session?.user?.email, // Use selected vendor for master accounts
          clientName: clientName,
          visitType: visitType,
          masterEmail: isMaster ? session?.user?.email : undefined, // Audit trail for master accounts
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

      // ✅ NEW: Handle completion animation
      if (status === 'completed') {
        setCompletingClient(client.Nombre);
        
        // Wait for animation to start before updating status
        setTimeout(() => {
          setVisitStatus(prev => ({ ...prev, [client.Nombre]: status }));
          
          // Clear animation state after animation completes
          setTimeout(() => {
            setCompletingClient(null);
          }, 300); // Match the animation duration
        }, 100);
      } else {
        setVisitStatus(prev => ({ ...prev, [client.Nombre]: status }));
      }
      
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
          userEmail: selectedVendorEmail || session?.user?.email, // Use selected vendor for master accounts
          clientName: originalClientName, // Use original name for sheet recording
          routeDay: client.Dia,
          visitType: status,
          location: currentLocation,
          notes: notesWithVisitType,
          cleyVisitType: visitTypeForCley, // Additional field for CLEY visit type
          masterEmail: isMaster ? session?.user?.email : undefined, // Audit trail for master accounts
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
            console.log(` TEMP RESCHEDULE: Deactivating reschedule for ${clientKey} after completion`);
            
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
    // ✅ UPDATED: Allow finishing route if there's progress, even without explicit start time
    if (!routeStartTime && !routeInProgress) {
      alert('No se ha iniciado ninguna ruta. Completa al menos una visita primero.');
      return;
    }

    // ✅ NEW: If no start time but route is in progress, use default start time
    let actualStartTime = routeStartTime;
    if (!actualStartTime && routeInProgress) {
      actualStartTime = '08:00'; // Default start time for routes with completed visits
      console.log(' ROUTE FINISH: Using default start time for route with completed visits');
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
          userEmail: selectedVendorEmail || session?.user?.email, // Use selected vendor for master accounts
          routeDay: selectedDay,
          fecha,
          clientesProgramados,
          clientesVisitados,
          ventasTotales: 0, // TODO: integrate with sales data if needed
          tiempoInicio: actualStartTime,
          tiempoFin: endTime,
          kilometrosRecorridos: totalDistanceKm,
          combustibleGastado: fuelCost,
          observaciones: observaciones.slice(0, 500), // Limit to 500 chars
          masterEmail: isMaster ? session?.user?.email : undefined, // Audit trail for master accounts
        }),
      })

      if (response.ok) {
        // ✅ NEW: Mark route as finished and save to localStorage
        setRouteFinishedToday(true);
        saveRouteState(actualStartTime, true, endTime);
        
        alert(`✅ Ruta del ${selectedDay} finalizada exitosamente!\n\n Resumen:\n• ${clientesVisitados}/${clientesProgramados} clientes visitados\n• Tiempo: ${actualStartTime} - ${endTime}\n• Distancia: ${totalDistanceKm} km\n• Combustible: $${fuelCost}`)
        
        // Reset route state but keep finished status
        setVisitStatus({})
        setRouteStartTime(null)
        setRouteInProgress(false)
        
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

  // Helper function to get visit status text - FIXED TIMEZONE
  const getVisitStatusText = (client: Client): string => {
    const originalName = getOriginalClientName(client.Nombre);
    const history = visitHistory[originalName]
    const scheduledVisit = scheduledVisits[originalName] || scheduledVisits[client.Nombre]
    
    // ✅ FIX: Use Mazatlán timezone consistently
    const utcNow = new Date();
    const mazatlanOffset = -7; // GMT-7
    const mazatlanTime = new Date(utcNow.getTime() + (mazatlanOffset * 60 * 60 * 1000));
    const mazatlanToday = mazatlanTime.toISOString().split('T')[0];

    // ✅ PRIORITY: Show scheduled visit info if available
    if (scheduledVisit && scheduledVisit.status === 'Programado') {
      const scheduledDate = new Date(scheduledVisit.scheduledDate)
      const todayDate = new Date(mazatlanToday)
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
      console.log(` VALIDATION: ${rescheduledCount} clients in postpone pool`);
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
    
    console.log(`📅 DAY FILTER: ${client.Nombre} - originalDay: "${client.Dia}" → normalizedDay: "${normalizedClientDay}" vs selectedDay: "${normalizedSelectedDay}" = ${matches ? 'INCLUDED' : 'EXCLUDED'}`);
    
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
    console.log(` DEBUG: ${selectedDay} - Regular: ${clientsForSelectedDay.length}, Postponed: ${postponedClientsForToday.length}, Total: ${allClientsForSelectedDay.length}`);
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
  
  // ✅ FIXED: Properly exclude clients who were already visited on the SELECTED DAY (not just today) - FIXED TIMEZONE
  const selectedDayDateString = getSelectedDayDate(selectedDay);
  
  const actuallyPendingClients = clientsConsideredForVisitToday.filter(client => {
    const originalName = getOriginalClientName(client.Nombre);
    const history = visitHistory[originalName];
    const status = visitStatus[client.Nombre];
    const wasVisitedOnSelectedDay = history?.lastVisitDate === selectedDayDateString;
    const isPostponedClient = postponedClientsForToday.some(p => p.Nombre === client.Nombre);
    
    // ✅ DEBUG: Log detailed filtering logic for each client
    const shouldInclude = (() => {
      // Postponed clients that were rescheduled to the selected day should appear as pending
      if (isPostponedClient && status !== 'completed') {
        console.log(` PENDING FILTER: ${client.Nombre} - INCLUDED (postponed client rescheduled to ${selectedDay})`);
        return true;
      }
      
      // If visited on selected day in a previous session, they shouldn't be pending
      if (wasVisitedOnSelectedDay && !routeStartTime) {
        console.log(` PENDING FILTER: ${client.Nombre} - EXCLUDED (visited on ${selectedDay} in previous session, no active route)`);
        return false;
      }
      
      // If visited on selected day in current session and marked as completed, they shouldn't be pending
      if (status === 'completed' || status === 'skipped' || status === 'postponed') {
        console.log(` PENDING FILTER: ${client.Nombre} - EXCLUDED (status: ${status})`);
        return false;
      }
      
      // ✅ FIXED: If client was completed on the selected day, they should NOT appear as pending
      if (wasVisitedOnSelectedDay) {
        console.log(` PENDING FILTER: ${client.Nombre} - EXCLUDED (already completed on ${selectedDay}: ${history?.lastVisitDate})`);
        return false;
      }
      
      console.log(` PENDING FILTER: ${client.Nombre} - INCLUDED (genuinely pending)`);
      return true;
    })();
    
    return shouldInclude;
  });
  
  // ✅ ADDED: Optimize the route for pending clients
  const optimizedPendingClients = useMemo(
    () => optimizeRoute(actuallyPendingClients),
    [actuallyPendingClients]
  );
  const totalRouteDistance = useMemo(
    () => calculateTotalRouteDistance(optimizedPendingClients),
    [optimizedPendingClients]
  );
  


  // ✅ FIXED: Clients actually completed during THIS active route session for the selected day - FIXED TIMEZONE
  const completedThisSessionClients = allClientsForSelectedDay.filter(client => {
    const originalName = getOriginalClientName(client.Nombre);
    const history = visitHistory[originalName];
    
    // ✅ FIXED: Use helper function to get selected day date
    const selectedDayDateString = getSelectedDayDate(selectedDay);
    
    // Ensure they were marked 'completed' in visitStatus, 
    // their last recorded visit in history is on the selected day, 
    // and a route is currently active (or was active when they were completed).
    return visitStatus[client.Nombre] === 'completed' && 
           history?.lastVisitDate === selectedDayDateString && 
           !!routeStartTime; // routeStartTime ensures it's part of the current active session
  });
  
  // ✅ FIXED: All clients completed on the SELECTED DAY (not just today) - FIXED TIMEZONE
  const allCompletedTodayClients = allClientsForSelectedDay.filter(client => {
    const originalName = getOriginalClientName(client.Nombre);
    const history = visitHistory[originalName];
    
    // ✅ FIXED: Use helper function to get selected day date
    const selectedDayDateString = getSelectedDayDate(selectedDay);
    const wasCompletedOnSelectedDay = history?.lastVisitDate === selectedDayDateString;
    
    // ✅ DEBUG: Log completed client filtering with selected day info
    if (wasCompletedOnSelectedDay) {
      console.log(`✅ COMPLETED ON SELECTED DAY: ${client.Nombre} (${originalName}) - last visit: ${history?.lastVisitDate}, selectedDayDate: ${selectedDayDateString}, selectedDay: ${selectedDay}`);
    }
    
    return wasCompletedOnSelectedDay;
  });
  

  
  // ✅ REVISED: Use corrected counts
  const completedCount = allCompletedTodayClients.length; // All completed today (any session)
  const pendingCount = optimizedPendingClients.length; // Actually pending clients (optimized)

  // ✅ DEBUG: Check for duplicate clients (same client in both completed and pending)
  useEffect(() => {
    const completedNames = allCompletedTodayClients.map(c => getOriginalClientName(c.Nombre));
    const pendingNames = optimizedPendingClients.map(c => getOriginalClientName(c.Nombre));
    const duplicates = completedNames.filter(name => pendingNames.includes(name));
    
    if (duplicates.length > 0) {
      console.error('❌ DUPLICATE CLIENTS DETECTED:', {
        duplicateClients: duplicates,
        completedClients: completedNames,
        pendingClients: pendingNames,
        selectedDay,
        selectedDayDate: getSelectedDayDate(selectedDay)
      });
      
      // Show details for each duplicate
      duplicates.forEach(duplicateName => {
        const completedClient = allCompletedTodayClients.find(c => getOriginalClientName(c.Nombre) === duplicateName);
        const pendingClient = optimizedPendingClients.find(c => getOriginalClientName(c.Nombre) === duplicateName);
        const history = visitHistory[duplicateName];
        
        console.error(` DUPLICATE DETAILS for ${duplicateName}:`, {
          completedClient: completedClient ? {
            name: completedClient.Nombre,
            day: completedClient.Dia,
            type: completedClient.Tipo_Cliente
          } : 'Not found',
          pendingClient: pendingClient ? {
            name: pendingClient.Nombre,
            day: pendingClient.Dia,
            type: pendingClient.Tipo_Cliente
          } : 'Not found',
          visitHistory: history,
          visitStatus: visitStatus[pendingClient?.Nombre || ''] || 'none'
        });
      });
    } else {
      console.log('✅ NO DUPLICATES: All clients properly separated between completed and pending');
    }
  }, [allCompletedTodayClients, optimizedPendingClients, selectedDay]);

  // ✅ DEBUG: Log finish button visibility logic
  useEffect(() => {
    // ✅ TIMEZONE DEBUG: Check all date calculations
    const utcNow = new Date();
    const mazatlanOffset = -7; // GMT-7
    const mazatlanTime = new Date(utcNow.getTime() + (mazatlanOffset * 60 * 60 * 1000));
    const utcToday = utcNow.toISOString().split('T')[0];
    const mazatlanToday = mazatlanTime.toISOString().split('T')[0];
    
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    const utcDayName = dayNames[utcNow.getDay()];
    const mazatlanDayName = dayNames[mazatlanTime.getDay()];
    
    console.log(' TIMEZONE DEBUG:', {
      utcTime: utcNow.toISOString(),
      mazatlanTime: mazatlanTime.toISOString(),
      utcToday,
      mazatlanToday,
      utcDayName: utcDayName as string,
      mazatlanDayName: mazatlanDayName as string,
      selectedDay,
      timezoneMatch: mazatlanDayName === selectedDay,
      utcMatch: utcDayName === selectedDay,
      dateComparisonForVisitHistory: {
        usingUtcToday: utcToday,
        usingMazatlanToday: mazatlanToday,
        shouldUseMazatlanTime: true
      }
    });
    
    console.log(' FINISH BUTTON DEBUG:', {
      routeInProgress,
      routeStartTime,
      routeFinishedToday,
      completedCount,
      pendingCount,
      shouldShowButton: routeInProgress || !!routeStartTime || routeFinishedToday,
      hasCompletedToday: completedCount > 0,
      selectedDay,
      actualDayName: mazatlanDayName as string,
      today: mazatlanToday,
      allClientsForSelectedDayCount: allClientsForSelectedDay.length,
      totalVisitHistoryEntries: Object.keys(visitHistory).length,
      routePerformanceRecords: routePerformanceData.length
    });
    
    // ✅ DEBUG: Show recent performance records for current user/vendor
    const userEmail = selectedVendorEmail || session?.user?.email;
    if (routePerformanceData.length > 0 && userEmail) {
      const userRecords = routePerformanceData.filter(record => {
        const recordVendor = record.vendedor;
        return recordVendor === userEmail || 
               (isMaster && selectedVendorEmail && recordVendor === selectedVendorEmail);
      }).slice(0, 3); // Show last 3 records
      
      console.log(' PERFORMANCE RECORDS for current user:', userRecords.map(record => ({
        fecha: record.fecha,
        dia_ruta: record.dia_ruta,
        vendedor: record.vendedor,
        tiempo_inicio: record.tiempo_inicio,
        tiempo_fin: record.tiempo_fin,
        clientes_visitados: record.clientes_visitados,
        isToday: record.fecha === mazatlanToday,
        isSelectedDay: record.dia_ruta?.toLowerCase() === selectedDay.toLowerCase()
      })));
    }
    
    // ✅ DEBUG: Log visit history with today's date (using both UTC and Mazatlan time)
    const utcTodayVisits = Object.entries(visitHistory).filter(([name, history]) => history.lastVisitDate === utcToday);
    const mazatlanTodayVisits = Object.entries(visitHistory).filter(([name, history]) => history.lastVisitDate === mazatlanToday);
    
    if (utcTodayVisits.length > 0) {
      console.log(' VISITS COMPLETED TODAY (UTC):', utcTodayVisits.map(([name, history]) => ({
        clientName: name,
        lastVisitDate: history.lastVisitDate,
        lastVisitWeek: history.lastVisitWeek
      })));
    }
    
    if (mazatlanTodayVisits.length > 0) {
      console.log(' VISITS COMPLETED TODAY (MAZATLAN):', mazatlanTodayVisits.map(([name, history]) => ({
        clientName: name,
        lastVisitDate: history.lastVisitDate,
        lastVisitWeek: history.lastVisitWeek
      })));
    }
    
    if (utcTodayVisits.length === 0 && mazatlanTodayVisits.length === 0) {
      console.log(' NO VISITS FOUND FOR TODAY - Checking recent visits:');
      const recentVisits = Object.entries(visitHistory)
        .filter(([name, history]) => {
          const visitDate = new Date(history.lastVisitDate);
          const daysDiff = Math.floor((utcNow.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysDiff <= 7; // Last 7 days
        })
        .sort(([,a], [,b]) => new Date(b.lastVisitDate).getTime() - new Date(a.lastVisitDate).getTime());
      
      console.log(' RECENT VISITS (last 7 days):', recentVisits.slice(0, 5).map(([name, history]) => ({
        clientName: name,
        lastVisitDate: history.lastVisitDate,
        daysAgo: Math.floor((utcNow.getTime() - new Date(history.lastVisitDate).getTime()) / (1000 * 60 * 60 * 24))
      })));
    }
  }, [routeInProgress, routeStartTime, completedCount, pendingCount, selectedDay, allClientsForSelectedDay.length, visitHistory]);



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
    <>
      {/* ✅ NEW: Add CSS animation for completion effect */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes gentle-pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.02); }
            100% { transform: scale(0.95); }
          }
        `
      }} />
      
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
                  <Link href="/navegar" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">
                    Navegar
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Vendor Selector for Master Accounts */}
      <VendorSelector
        currentVendor={selectedVendorEmail}
        vendors={availableVendors}
        onVendorChange={(vendorEmail) => {
          setSelectedVendorEmail(vendorEmail)
          setViewingAsVendor(vendorEmail ? getVendorLabel(vendorEmail) : 'Todas las Rutas')
          console.log(' MASTER DEBUG: Switching to vendor:', vendorEmail || 'all vendors')
        }}
        isVisible={isMaster}
      />

      {/* Progress Summary */}
      <div className="bg-white rounded-lg mb-4 p-4 border border-[#E2E4E9]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 text-blue-600 mr-2" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Progreso del Día - {selectedDay}
              </h2>
              <p className="text-xs text-gray-500">
                {(() => {
                  const utcNow = new Date();
                  const mazatlanOffset = -7; // GMT-7
                  const mazatlanTime = new Date(utcNow.getTime() + (mazatlanOffset * 60 * 60 * 1000));
                  const dayNames: RouteDay[] = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
                  const currentWeekStart = new Date(mazatlanTime);
                  const dayOfWeek = currentWeekStart.getDay();
                  const daysToSubtract = dayOfWeek === 0 ? 0 : dayOfWeek - 1; // Monday = 0, Sunday = 6
                  currentWeekStart.setDate(currentWeekStart.getDate() - daysToSubtract);
                  
                  const selectedDayIndex = dayNames.indexOf(selectedDay);
                  const selectedDate = new Date(currentWeekStart);
                  if (selectedDayIndex === 0) { // Sunday
                    selectedDate.setDate(currentWeekStart.getDate() + 6);
                  } else {
                    selectedDate.setDate(currentWeekStart.getDate() + selectedDayIndex - 1);
                  }
                  
                  return selectedDate.toLocaleDateString('es-ES', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  });
                })()}
              </p>
              {isMaster && (
                <p className="text-xs text-blue-600">
                  Viendo: {viewingAsVendor}
                </p>
              )}
            </div>
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

        {/* Route Finished Indicator */}
        {routeFinishedToday && (
          <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              <div className="flex-1">
                <div className="text-sm font-medium text-green-800">
                  ✅ Ruta del {selectedDay} ya finalizada
                </div>
                <div className="text-xs text-green-600">
                  Puedes finalizar nuevamente si tienes clientes adicionales
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Finish Route Button */}
        {(routeInProgress || routeStartTime || routeFinishedToday) && (
          <button
            onClick={finishRoute}
            disabled={savingRoute}
            className={`w-full py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
              routeFinishedToday 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {savingRoute ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {routeFinishedToday 
                  ? `Re-Finalizar Ruta del ${selectedDay}` 
                  : `Finalizar Ruta del ${selectedDay}`
                }
              </>
            )}
          </button>
        )}
      </div>

      {/* Day Selector - Current Week Only */}
      <div className="bg-gray-100 rounded-lg mb-4 p-1">
        <div className="grid grid-cols-7 gap-1">
          {ROUTE_DAYS.map((day) => {
            // Calculate if this day is in the current week
            const utcNow = new Date();
            const mazatlanOffset = -7; // GMT-7
            const mazatlanTime = new Date(utcNow.getTime() + (mazatlanOffset * 60 * 60 * 1000));
            const dayNames: RouteDay[] = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
            
            // Calculate current week start (Monday)
            const currentWeekStart = new Date(mazatlanTime);
            const dayOfWeek = currentWeekStart.getDay();
            const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 6, Monday = 0
            currentWeekStart.setDate(currentWeekStart.getDate() - daysToSubtract);
            
            // Calculate the date for this day in the current week
            const selectedDayIndex = dayNames.indexOf(day);
            const dayDate = new Date(currentWeekStart);
            if (selectedDayIndex === 0) { // Sunday
              dayDate.setDate(currentWeekStart.getDate() + 6);
            } else {
              dayDate.setDate(currentWeekStart.getDate() + selectedDayIndex - 1);
            }
            
            // Check if this day is within the current week (allow future days within same week)
            const isToday = dayDate.toDateString() === mazatlanTime.toDateString();
            const isPast = dayDate < mazatlanTime;
            const isFuture = dayDate > mazatlanTime;
            const isWithinCurrentWeek = true; // All calculated days are within current week by design
            
            return (
              <button
                key={day}
                className={`py-2 px-1 text-xs font-medium rounded-md transition-colors duration-200 ${
                  selectedDay === day
                    ? 'bg-white text-gray-900 shadow-sm'
                    : isWithinCurrentWeek
                      ? 'bg-gray-100 text-gray-500 hover:text-gray-700'
                      : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                } ${isToday ? 'ring-2 ring-blue-400' : ''} ${isFuture ? 'text-blue-600' : ''}`}
                disabled={!isWithinCurrentWeek}
                onClick={() => {
                  if (!isWithinCurrentWeek) return;
                  
                  console.log('📅 DAY SWITCH: Switching to day:', day, 'from:', selectedDay);
                  
                  // Reset route states before switch
                  console.log('📅 DAY SWITCH: Resetting route states before switch');
                  setSelectedDay(day);
                  setRouteFinishedToday(false);
                  setRouteStartTime(null);
                  setRouteInProgress(false);
                  
                  // Clear session-specific visit status but preserve postponed clients
                  setVisitStatus(prev => {
                    const preservedStatuses: Record<string, VisitStatus> = {};
                    // Keep postponed clients in their status to prevent them from reappearing
                    Object.entries(prev).forEach(([clientName, status]) => {
                      if (status === 'postponed') {
                        preservedStatuses[clientName] = status;
                      }
                    });
                    return preservedStatuses;
                  });
                  
                  console.log('📅 DAY SWITCH: States reset, loading persisted state for:', day);
                  
                  // Load persisted state for the new day
                  setTimeout(() => {
                    console.log('📅 DAY SWITCH: Loading persisted state for:', day);
                    loadPersistedRouteState(day);
                    // Force a route progress check after loading state
                    setTimeout(() => {
                      console.log('📅 DAY SWITCH: Checking route progress after state load for:', day);
                      checkRouteInProgress();
                    }, 50);
                  }, 150);
                }}
              >
                <div className="flex flex-col items-center">
                  <span>{day.slice(0, 3)}</span>
                  {isToday && <span className="text-xs text-blue-600">HOY</span>}
                  {isPast && !isToday && <span className="text-xs text-gray-400">•</span>}
                  {isFuture && <span className="text-xs text-blue-500">↗</span>}
                </div>
              </button>
            );
          })}
        </div>
        <div className="text-xs text-gray-500 text-center mt-2">
          Semana actual • Días pasados muestran lo completado • Días futuros para planificación
        </div>
      </div>

      {/* Postpone Pool Interface */}
      {showPostponePool && Object.keys(postponePool).length > 0 && (
        <div className="mb-4 bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="flex items-center mb-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
            <h3 className="text-lg font-semibold text-yellow-800">Clientes Pospuestos</h3>
          </div>
          
          <div className="text-xs text-yellow-700 mb-3">
            <div className="mb-2">
              <strong>⚠️ Reprogramación:</strong> Los clientes pospuestos se pueden reprogramar a otro día. 
              Para clientes CLEY, la reprogramación es temporal y volverán automáticamente a su horario original después de la visita.
            </div>
            <div className="text-xs text-yellow-600">
              Úsalo solo cuando no puedas completar tu ruta regular. Las reprogramaciones deben usarse con moderación.
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
                             Temporal activo
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
      <div className="space-y-3 transition-all duration-300 ease-out">
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
              <div 
                key={index} 
                className={`bg-white rounded-lg border border-[#E2E4E9] p-4 transition-all duration-300 ease-out ${
                  completingClient === client.Nombre 
                    ? 'transform scale-95 opacity-60 bg-green-50 border-green-200 shadow-lg' 
                    : 'transform scale-100 opacity-100 hover:shadow-md'
                }`}
                style={{
                  animation: completingClient === client.Nombre 
                    ? 'gentle-pulse 0.3s ease-out' 
                    : undefined
                }}
              >
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
                    disabled={completingClient === client.Nombre}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      completingClient === client.Nombre
                        ? 'bg-green-500 text-white border border-green-500 transform scale-95'
                        : status === 'completed' 
                          ? 'bg-green-100 text-green-700 border border-green-300' 
                          : 'bg-gray-100 text-gray-700 hover:bg-green-50'
                    }`}
                  >
                    {completingClient === client.Nombre ? (
                      <span className="flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Completado
                      </span>
                    ) : (
                      'Completar'
                    )}
                  </button>
                  
                  {cleyDaySelector === client.Nombre ? (
                    // Show day selector for ALL clients (both CLEY and regular)
                    <div className="flex-1">
                      <div className="text-xs text-center mb-1 text-gray-600">Posponer para:</div>
                      <div className="grid grid-cols-3 gap-1">
                        {(isCleyClient(client) ? ROUTE_DAYS.slice(0, 6) : ROUTE_DAYS).map((day) => (
                          <button
                            key={day}
                            onClick={() => {
                              if (isCleyClient(client)) {
                                postponeCleyClient(client, day);
                              } else {
                                // Handle regular client postpone with day selection
                                postponeRegularClient(client, day);
                              }
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
                    // Show postpone button for ALL clients
                    <button
                      onClick={() => setCleyDaySelector(client.Nombre)}
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
            <h3 className="text-lg font-semibold text-gray-900">
              {(() => {
                const utcNow = new Date();
                const mazatlanOffset = -7; // GMT-7
                const mazatlanTime = new Date(utcNow.getTime() + (mazatlanOffset * 60 * 60 * 1000));
                const dayNames: RouteDay[] = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
                const currentDayName = dayNames[mazatlanTime.getDay()];
                
                return selectedDay === currentDayName ? 'Completados Hoy' : `Completados el ${selectedDay}`;
              })()}
            </h3>
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
    </>
  )
}