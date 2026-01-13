/**
 * Utility functions for the Recorridos page
 * Extracted to simplify the main component
 */

export type RouteDay = "Lunes" | "Martes" | "Miercoles" | "Jueves" | "Viernes" | "Sabado" | "Domingo";

export type VisitStatus = "pending" | "completed" | "skipped" | "postponed";

export type VisitType = "Pedidos" | "Entrega" | "Normal";

export const ROUTE_DAYS: RouteDay[] = [
  "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"
];

export const DAY_NAMES: RouteDay[] = [
  "Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"
];

const MAZATLAN_OFFSET = -7; // GMT-7

/**
 * Get current time in Mazatlán timezone
 */
export function getMazatlanTime(): Date {
  const utcNow = new Date();
  return new Date(utcNow.getTime() + MAZATLAN_OFFSET * 60 * 60 * 1000);
}

/**
 * Get today's date string in Mazatlán timezone (YYYY-MM-DD)
 */
export function getMazatlanToday(): string {
  return getMazatlanTime().toISOString().split("T")[0];
}

/**
 * Get current day name in Mazatlán timezone
 */
export function getMazatlanDayName(): RouteDay {
  return DAY_NAMES[getMazatlanTime().getDay()];
}

/**
 * Get the actual date for a selected day in the current week
 */
export function getSelectedDayDate(selectedDay: RouteDay): string {
  const mazatlanTime = getMazatlanTime();
  const currentDayIndex = mazatlanTime.getDay();
  const selectedDayIndex = DAY_NAMES.indexOf(selectedDay);
  const dayDifference = selectedDayIndex - currentDayIndex;

  const selectedDayDate = new Date(mazatlanTime);
  selectedDayDate.setDate(mazatlanTime.getDate() + dayDifference);

  return selectedDayDate.toISOString().split("T")[0];
}

/**
 * Normalize day names (remove accents, extra spaces)
 */
export function normalizeDay(day: string): string {
  if (!day) return "";
  return day
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[áàäâ]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u");
}

/**
 * Get ISO week number from a date
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(
  lat1: number, lon1: number, lat2: number, lon2: number
): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get visit type for CLEY clients
 */
export function getVisitType(clientName: string): VisitType {
  if (clientName.includes("(Pedidos)")) return "Pedidos";
  if (clientName.includes("(Entrega)")) return "Entrega";
  return "Normal";
}

/**
 * Get original client name (without visit type suffix)
 */
export function getOriginalClientName(clientName: string): string {
  return clientName.replace(/ \((Pedidos|Entrega)\)$/, "");
}

/**
 * Check if client is CLEY type
 */
export function isCleyClient(tipoCliente: string | undefined): boolean {
  return tipoCliente?.toUpperCase() === "CLEY";
}

/**
 * Get status color class
 */
export function getStatusColor(status: VisitStatus): string {
  switch (status) {
    case "completed": return "bg-green-500";
    case "skipped": return "bg-red-500";
    case "postponed": return "bg-yellow-500";
    default: return "bg-gray-300";
  }
}

/**
 * Get client type color class
 */
export function getClientTypeColor(type: string): string {
  switch (type?.toUpperCase()) {
    case "CLEY": return "bg-blue-100 text-blue-800";
    case "PREMIUM": return "bg-purple-100 text-purple-800";
    case "REGULAR": return "bg-green-100 text-green-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

/**
 * Build API URL with vendor selection parameters
 */
export function buildApiUrl(
  baseSheet: string,
  email: string | null,
  isMaster: boolean,
  selectedVendorEmail: string | null
): string {
  let apiUrl = `/api/recorridos?email=${encodeURIComponent(email || "")}&sheet=${baseSheet}`;

  if (isMaster) {
    if (selectedVendorEmail === "ALL_ROUTES") {
      apiUrl += `&viewAsEmail=null`;
    } else if (selectedVendorEmail) {
      apiUrl += `&viewAsEmail=${encodeURIComponent(selectedVendorEmail)}`;
    }
  }

  return apiUrl;
}

/**
 * Format date for Spanish locale
 */
export function formatDateSpanish(date: Date): string {
  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Get selected day's formatted date
 */
export function getSelectedDayFormattedDate(selectedDay: RouteDay): string {
  const mazatlanTime = getMazatlanTime();
  const currentWeekStart = new Date(mazatlanTime);
  const dayOfWeek = currentWeekStart.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 0 : dayOfWeek - 1;
  currentWeekStart.setDate(currentWeekStart.getDate() - daysToSubtract);

  const selectedDayIndex = DAY_NAMES.indexOf(selectedDay);
  const selectedDate = new Date(currentWeekStart);
  if (selectedDayIndex === 0) { // Sunday
    selectedDate.setDate(currentWeekStart.getDate() + 6);
  } else {
    selectedDate.setDate(currentWeekStart.getDate() + selectedDayIndex - 1);
  }

  return formatDateSpanish(selectedDate);
}

// Default starting coordinates (Mazatlán)
export const DEFAULT_START_LAT = 24.74403;
export const DEFAULT_START_LNG = -107.3749752;

/**
 * Optimize route using nearest neighbor algorithm
 */
export function optimizeRoute<T extends { Latitude: number; Longitud: number }>(
  clients: T[],
  startLat: number = DEFAULT_START_LAT,
  startLng: number = DEFAULT_START_LNG
): T[] {
  if (clients.length <= 1) return clients;

  const unvisited = [...clients];
  const optimizedRoute: T[] = [];
  let currentLat = startLat;
  let currentLng = startLng;

  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let shortestDistance = calculateDistance(
      currentLat, currentLng, unvisited[0].Latitude, unvisited[0].Longitud
    );

    for (let i = 1; i < unvisited.length; i++) {
      const distance = calculateDistance(
        currentLat, currentLng, unvisited[i].Latitude, unvisited[i].Longitud
      );
      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearestIndex = i;
      }
    }

    const nearestClient = unvisited.splice(nearestIndex, 1)[0];
    optimizedRoute.push(nearestClient);
    currentLat = nearestClient.Latitude;
    currentLng = nearestClient.Longitud;
  }

  return optimizedRoute;
}

/**
 * Calculate total route distance
 */
export function calculateTotalRouteDistance<T extends { Latitude: number; Longitud: number }>(
  clients: T[],
  startLat: number = DEFAULT_START_LAT,
  startLng: number = DEFAULT_START_LNG
): number {
  if (clients.length === 0) return 0;

  let totalDistance = 0;
  let currentLat = startLat;
  let currentLng = startLng;

  clients.forEach((client) => {
    const distance = calculateDistance(currentLat, currentLng, client.Latitude, client.Longitud);
    totalDistance += distance;
    currentLat = client.Latitude;
    currentLng = client.Longitud;
  });

  return totalDistance;
}

/**
 * Debug logger that only logs in development
 */
export const debug = {
  log: (...args: any[]) => {
    if (process.env.NODE_ENV === "development") {
      console.log(...args);
    }
  },
  warn: (...args: any[]) => {
    if (process.env.NODE_ENV === "development") {
      console.warn(...args);
    }
  },
  error: (...args: any[]) => {
    // Always log errors
    console.error(...args);
  },
};
