"use client";

import mapboxgl from "mapbox-gl";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import convex from "@turf/convex";
import { featureCollection, point } from "@turf/helpers";
import { PenTool } from "lucide-react";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

const _DEFAULT_CENTER = { lng: -110.962, lat: 29.072 }; // Hermosillo, Sonora, MX
const FALLBACK_CENTER = { lng: -107.394, lat: 24.8091 }; // Culiacán, Sinaloa
const DEBUG_AREA_SELECTION = process.env.NODE_ENV !== "production";
const DEBUG_MARKER_TOUCH = process.env.NODE_ENV !== "production";

// Function to get pin color based on codigo
const getPinColor = (codigo?: string, isSelected: boolean = false) => {
  if (!codigo) return isSelected ? "#007AFF" : "#007AFF"; // Default blue

  const codigoLower = codigo.toLowerCase();
  let baseColor = "#007AFF"; // Default blue

  if (codigoLower.includes("cley")) {
    baseColor = "#DC2626"; // Red
  } else if (codigoLower.includes("tere")) {
    baseColor = "#16A34A"; // Green
  } else if (codigoLower.includes("oxx")) {
    baseColor = "#EA580C"; // Orange
  } else if (codigoLower.includes("eft")) {
    baseColor = "#EAB308"; // Yellow
  } else if (codigoLower.includes("kiosk")) {
    baseColor = "#9333EA"; // Purple
  }

  return baseColor;
};

export type Client = {
  name: string;
  lat: number;
  lng: number;
  codigo?: string;
};

export type RouteInfo = {
  geometry: any;
  distance: number;
  duration: number;
};

type NavegarMapProps = {
  clients: Client[];
  selectedClient?: string;
  onSelectClient?: (name: string) => void;
  currentLocation?: { lat: number; lng: number } | null;
  routeTo?: { lat: number; lng: number } | null;
  onRouteInfo?: (info: RouteInfo | null) => void;
  onAreaSelectionChange?: (
    clientsInArea: Client[],
    hasPolygon: boolean,
  ) => void;
  disableDrawing?: boolean;
};

type LngLatTuple = [number, number];
type PolygonCoordinates = LngLatTuple[][];
type MultiPolygonCoordinates = PolygonCoordinates[];

const EPSILON = 1e-10;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isLngLatTuple = (value: unknown): value is LngLatTuple =>
  Array.isArray(value) &&
  value.length >= 2 &&
  isFiniteNumber(value[0]) &&
  isFiniteNumber(value[1]);

const isPolygonCoordinates = (value: unknown): value is PolygonCoordinates =>
  Array.isArray(value) &&
  value.every(
    (ring) =>
      Array.isArray(ring) && ring.length >= 3 && ring.every(isLngLatTuple),
  );

const isMultiPolygonCoordinates = (
  value: unknown,
): value is MultiPolygonCoordinates =>
  Array.isArray(value) && value.every(isPolygonCoordinates);

const isPointOnSegment = (
  point: LngLatTuple,
  start: LngLatTuple,
  end: LngLatTuple,
): boolean => {
  const [px, py] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;

  const cross = (px - x1) * (y2 - y1) - (py - y1) * (x2 - x1);
  if (Math.abs(cross) > EPSILON) return false;

  const dot = (px - x1) * (px - x2) + (py - y1) * (py - y2);
  return dot <= EPSILON;
};

const isPointInsideRing = (
  point: LngLatTuple,
  ring: LngLatTuple[],
): boolean => {
  if (ring.length < 3) return false;

  let isInside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const start = ring[j];
    const end = ring[i];

    if (isPointOnSegment(point, start, end)) {
      return true;
    }

    const [x1, y1] = start;
    const [x2, y2] = end;
    const [px, py] = point;

    const intersects =
      y1 > py !== y2 > py &&
      px < ((x2 - x1) * (py - y1)) / (y2 - y1 + EPSILON) + x1;

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
};

const isPointInsidePolygon = (
  point: LngLatTuple,
  polygon: PolygonCoordinates,
): boolean => {
  if (!polygon.length) return false;
  if (!isPointInsideRing(point, polygon[0])) return false;

  for (let i = 1; i < polygon.length; i++) {
    if (isPointInsideRing(point, polygon[i])) {
      return false;
    }
  }

  return true;
};

const extractPolygonsFromFeature = (feature: unknown): PolygonCoordinates[] => {
  if (!feature || typeof feature !== "object") return [];
  const geometry = (
    feature as { geometry?: { type?: string; coordinates?: unknown } }
  ).geometry;
  if (!geometry || !geometry.type) return [];

  if (
    geometry.type === "Polygon" &&
    isPolygonCoordinates(geometry.coordinates)
  ) {
    return [geometry.coordinates];
  }

  if (
    geometry.type === "MultiPolygon" &&
    isMultiPolygonCoordinates(geometry.coordinates)
  ) {
    return geometry.coordinates;
  }

  return [];
};

const hasPolygonGeometry = (feature: unknown): boolean => {
  if (!feature || typeof feature !== "object") return false;
  const geometryType = (feature as { geometry?: { type?: string } }).geometry
    ?.type;
  return geometryType === "Polygon" || geometryType === "MultiPolygon";
};

const NavegarMap = forwardRef(function NavegarMap(
  {
    clients,
    selectedClient,
    onSelectClient,
    currentLocation,
    routeTo,
    onRouteInfo,
    onUserLocationChange,
    onAreaSelectionChange,
    disableDrawing = false,
  }: NavegarMapProps & {
    onUserLocationChange?: (loc: { lat: number; lng: number } | null) => void;
  },
  ref,
) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationTried, setLocationTried] = useState(false);
  const [_route, setRoute] = useState<RouteInfo | null>(null);
  const routeLayerId = "route-line";
  const [showDibujo, setShowDibujo] = useState(false);
  const [isManualDibujo, setIsManualDibujo] = useState(false);
  const [selectedAreaCount, setSelectedAreaCount] = useState(0);
  const drawControlRef = useRef<MapboxDraw | null>(null);
  const isHandlingDrawEventRef = useRef(false);
  const autoPolygonLayerId = "clients-polygon";
  const autoPolygonSourceId = "clients-polygon-source";

  const emitClientsInArea = useCallback(
    (polygons: PolygonCoordinates[]) => {
      if (!polygons.length) {
        setSelectedAreaCount(0);
        onAreaSelectionChange?.([], false);
        if (DEBUG_AREA_SELECTION) {
          console.debug("[NavegarMap][draw] no polygons to evaluate");
        }
        return;
      }

      const clientsInArea = clients.filter((client) => {
        const point: LngLatTuple = [client.lng, client.lat];
        return polygons.some((polygon) => isPointInsidePolygon(point, polygon));
      });

      setSelectedAreaCount(clientsInArea.length);
      onAreaSelectionChange?.(clientsInArea, true);
      if (DEBUG_AREA_SELECTION) {
        console.debug("[NavegarMap][draw] clients in polygon:", {
          totalVisibleClients: clients.length,
          selectedClients: clientsInArea.length,
        });
      }
    },
    [clients, onAreaSelectionChange],
  );

  const getDrawnPolygonFeature = useCallback(() => {
    if (!drawControlRef.current) return null;
    const featureCollection = drawControlRef.current.getAll();
    return (
      featureCollection.features.find((feature) => {
        const geometryType = feature.geometry?.type;
        return geometryType === "Polygon" || geometryType === "MultiPolygon";
      }) || null
    );
  }, []);

  const emitAreaSelection = useCallback(() => {
    const drawnPolygon = getDrawnPolygonFeature();
    if (!drawnPolygon) {
      setSelectedAreaCount(0);
      onAreaSelectionChange?.([], false);
      if (DEBUG_AREA_SELECTION) {
        console.debug("[NavegarMap][draw] no drawn polygon in store");
      }
      return;
    }

    const polygons = extractPolygonsFromFeature(drawnPolygon);
    emitClientsInArea(polygons);
  }, [emitClientsInArea, getDrawnPolygonFeature, onAreaSelectionChange]);

  const clearDrawnArea = useCallback(() => {
    if (!drawControlRef.current) return;
    drawControlRef.current.deleteAll();
    setSelectedAreaCount(0);
    onAreaSelectionChange?.([], false);
  }, [onAreaSelectionChange]);

  const removeAutoPolygon = useCallback(() => {
    if (!map.current) return;
    if (map.current.getLayer(autoPolygonLayerId)) {
      map.current.removeLayer(autoPolygonLayerId);
    }
    if (map.current.getLayer(`${autoPolygonLayerId}-outline`)) {
      map.current.removeLayer(`${autoPolygonLayerId}-outline`);
    }
    if (map.current.getSource(autoPolygonSourceId)) {
      map.current.removeSource(autoPolygonSourceId);
    }
  }, []);

  // Try to get user location on mount
  useEffect(() => {
    if (!locationTried) {
      setLocationTried(true);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
          },
          (err) => {
            console.warn(
              "[NavegarMap] Geolocation failed, using Culiacán fallback",
              err,
            );
            setUserLocation(FALLBACK_CENTER);
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
        );
      } else {
        setUserLocation(FALLBACK_CENTER);
      }
    }
  }, [locationTried]);

  // Helper to get accurate location
  const getAccurateLocation = () => {
    return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setUserLocation(loc);
            onUserLocationChange?.(loc);
            resolve(loc);
          },
          (err) => {
            reject(err);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        );
      } else {
        reject(new Error("Geolocation not supported"));
      }
    });
  };

  // Manual refresh location
  const refreshLocation = async () => {
    try {
      const loc = await getAccurateLocation();
      setUserLocation(loc);
      onUserLocationChange?.(loc);
      // Optionally, recenter map
      if (map.current) {
        map.current.flyTo({ center: [loc.lng, loc.lat], zoom: 15 });
      }
    } catch (_e) {
      // Optionally, show error
    }
  };

  // Expose fetchRoute, getUserLocation, clearRoute, getAccurateLocation, refreshLocation
  useImperativeHandle(ref, () => ({
    fetchRoute: async (to: { lat: number; lng: number }) => {
      const latestUserLocation = userLocation;
      if (!latestUserLocation) return null;
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${latestUserLocation.lng},${latestUserLocation.lat};${to.lng},${to.lat}?geometries=geojson&access_token=${mapboxgl.accessToken}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const routeData = data.routes[0];
        const info: RouteInfo = {
          geometry: routeData.geometry,
          distance: routeData.distance,
          duration: routeData.duration,
        };
        setRoute(info);
        onRouteInfo?.(info);
        // Draw route on map
        if (map.current) {
          if (map.current.getLayer(routeLayerId)) {
            map.current.removeLayer(routeLayerId);
          }
          if (map.current.getSource(routeLayerId)) {
            map.current.removeSource(routeLayerId);
          }
          map.current.addSource(routeLayerId, {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: info.geometry,
              properties: {},
            },
          });
          map.current.addLayer({
            id: routeLayerId,
            type: "line",
            source: routeLayerId,
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#007AFF",
              "line-width": 5,
              "line-opacity": 0.85,
            },
          });
        }
        return info;
      } else {
        setRoute(null);
        onRouteInfo?.(null);
        return null;
      }
    },
    getUserLocation: () => userLocation,
    clearRoute: () => {
      setRoute(null);
      if (map.current) {
        if (map.current.getLayer(routeLayerId)) {
          map.current.removeLayer(routeLayerId);
        }
        if (map.current.getSource(routeLayerId)) {
          map.current.removeSource(routeLayerId);
        }
      }
      onRouteInfo?.(null);
    },
    getAccurateLocation,
    refreshLocation,
    clearDrawnArea,
  }));

  // Initialize map
  useEffect(() => {
    if (!map.current && mapContainer.current) {
      let center: [number, number];
      if (userLocation) {
        center = [userLocation.lng, userLocation.lat];
      } else {
        center = [FALLBACK_CENTER.lng, FALLBACK_CENTER.lat];
      }
      if (!mapboxgl.accessToken) {
        console.warn("[NavegarMap] Mapbox access token is missing!");
      }
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center,
        zoom: 13,
      });
      map.current.addControl(new mapboxgl.NavigationControl());
      const drawControl = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: false,
          trash: false,
        },
        defaultMode: "simple_select",
      });
      map.current.addControl(drawControl);
      drawControlRef.current = drawControl;
    }
  }, [userLocation]);

  // Add/Update markers
  useEffect(() => {
    if (!map.current) return;
    markers.current.forEach((m) => {
      m.remove();
    });
    markers.current = [];
    // Add client markers
    clients.forEach((client) => {
      const el = document.createElement("div");
      el.className = "client-marker";
      el.style.width = "22px";
      el.style.height = "22px";
      const isSelected = client.name === selectedClient;
      const pinColor = getPinColor(client.codigo, isSelected);

      el.style.background = isSelected ? pinColor : "#fff";
      el.style.border = isSelected
        ? `3px solid ${pinColor}`
        : `2px solid ${pinColor}`;
      el.style.borderRadius = "50%";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
      el.style.cursor = "pointer";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.fontFamily = "Inter, sans-serif";
      el.style.fontWeight = "bold";
      el.style.color = isSelected ? "#fff" : pinColor;
      el.innerText = client.name[0].toUpperCase();
      // While drawing manually, let clicks pass through markers to the draw layer.
      const isManualDrawingActive = showDibujo && isManualDibujo;
      el.style.pointerEvents = isManualDrawingActive ? "none" : "auto";
      if (!isManualDrawingActive) {
        const selectClient = () => {
          if (DEBUG_MARKER_TOUCH) {
            console.debug("[NavegarMap][marker] select", client.name);
          }
          onSelectClient?.(client.name);
        };

        el.onclick = (e) => {
          e.stopPropagation();
          selectClient();
        };

        let touchStartPoint: { x: number; y: number } | null = null;

        el.addEventListener(
          "touchstart",
          (event) => {
            const touch = event.touches[0];
            if (!touch) return;
            touchStartPoint = { x: touch.clientX, y: touch.clientY };
            if (DEBUG_MARKER_TOUCH) {
              console.debug("[NavegarMap][marker] touchstart", {
                client: client.name,
                x: touch.clientX,
                y: touch.clientY,
              });
            }
          },
          { passive: true },
        );

        el.addEventListener("touchend", (event) => {
          const changedTouch = event.changedTouches[0];
          if (!changedTouch || !touchStartPoint) return;

          const dx = Math.abs(changedTouch.clientX - touchStartPoint.x);
          const dy = Math.abs(changedTouch.clientY - touchStartPoint.y);
          const TAP_MAX_MOVE = 12;
          const isTap = dx <= TAP_MAX_MOVE && dy <= TAP_MAX_MOVE;
          touchStartPoint = null;

          if (DEBUG_MARKER_TOUCH) {
            console.debug("[NavegarMap][marker] touchend", {
              client: client.name,
              dx,
              dy,
              isTap,
            });
          }

          if (!isTap) return;

          // Avoid map pan gesture finishing into click suppression.
          event.preventDefault();
          event.stopPropagation();
          selectClient();
        });
      }
      const marker = new mapboxgl.Marker(el)
        .setLngLat([client.lng, client.lat])
        .addTo(map.current!);
      markers.current.push(marker);
    });
    // Optionally, add current location marker
    if (currentLocation) {
      const el = document.createElement("div");
      el.style.width = "18px";
      el.style.height = "18px";
      el.style.background = "#34C759";
      el.style.border = "2px solid #fff";
      el.style.borderRadius = "50%";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
      el.style.zIndex = "10";
      const marker = new mapboxgl.Marker(el)
        .setLngLat([currentLocation.lng, currentLocation.lat])
        .addTo(map.current!);
      markers.current.push(marker);
    }
    // Add user location marker
    if (userLocation) {
      const el = document.createElement("div");
      el.style.width = "20px";
      el.style.height = "20px";
      el.style.background = "#34C759";
      el.style.border = "3px solid #fff";
      el.style.borderRadius = "50%";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
      el.style.zIndex = "10";
      markers.current.push(
        new mapboxgl.Marker(el)
          .setLngLat([userLocation.lng, userLocation.lat])
          .addTo(map.current!),
      );
    }
  }, [
    clients,
    selectedClient,
    onSelectClient,
    currentLocation,
    userLocation,
    showDibujo,
    isManualDibujo,
  ]);

  // Center map on selected client
  useEffect(() => {
    if (!map.current) return;
    if (selectedClient) {
      const client = clients.find((c) => c.name === selectedClient);
      if (client) {
        map.current.flyTo({ center: [client.lng, client.lat], zoom: 15 });
      }
    }
  }, [selectedClient, clients]);

  useEffect(() => {
    if (!map.current) return;

    if (!showDibujo || isManualDibujo || clients.length < 3) {
      removeAutoPolygon();
      return;
    }

    const points = clients.map((client) => point([client.lng, client.lat]));
    const hull = convex(featureCollection(points));
    if (!hull) {
      removeAutoPolygon();
      return;
    }

    removeAutoPolygon();
    map.current.addSource(autoPolygonSourceId, {
      type: "geojson",
      data: hull,
    });

    map.current.addLayer({
      id: autoPolygonLayerId,
      type: "fill",
      source: autoPolygonSourceId,
      paint: {
        "fill-color": "#8B5CF6",
        "fill-opacity": 0.2,
      },
    });

    map.current.addLayer({
      id: `${autoPolygonLayerId}-outline`,
      type: "line",
      source: autoPolygonSourceId,
      paint: {
        "line-color": "#8B5CF6",
        "line-width": 2,
        "line-dasharray": [2, 2],
      },
    });

    return () => {
      removeAutoPolygon();
    };
  }, [showDibujo, isManualDibujo, clients, removeAutoPolygon]);

  useEffect(() => {
    if (!map.current || !drawControlRef.current) return;

    const getEventPolygons = (event: unknown): PolygonCoordinates[] => {
      const eventFeatures =
        event &&
        typeof event === "object" &&
        Array.isArray((event as { features?: unknown[] }).features)
          ? (event as { features: unknown[] }).features
          : [];

      const polygonFeature =
        eventFeatures.find((feature) => hasPolygonGeometry(feature)) || null;

      if (polygonFeature) {
        return extractPolygonsFromFeature(polygonFeature);
      }

      return [];
    };

    const handleDrawCreate = (event: unknown) => {
      if (!showDibujo || !isManualDibujo) {
        return;
      }
      if (isHandlingDrawEventRef.current) {
        if (DEBUG_AREA_SELECTION) {
          console.debug("[NavegarMap][draw] skipping recursive draw.create");
        }
        return;
      }
      isHandlingDrawEventRef.current = true;

      const polygons = getEventPolygons(event);
      try {
        if (polygons.length > 0) {
          emitClientsInArea(polygons);
        } else {
          emitAreaSelection();
        }
      } finally {
        isHandlingDrawEventRef.current = false;
      }
    };

    const handleDrawUpdate = (event: unknown) => {
      if (!showDibujo || !isManualDibujo) {
        return;
      }
      if (isHandlingDrawEventRef.current) {
        if (DEBUG_AREA_SELECTION) {
          console.debug("[NavegarMap][draw] skipping recursive draw.update");
        }
        return;
      }
      // Avoid interrupting draw flow before the polygon is actually completed.
      if (drawControlRef.current?.getMode() === "draw_polygon") {
        return;
      }
      isHandlingDrawEventRef.current = true;

      try {
        const polygons = getEventPolygons(event);
        if (polygons.length > 0) {
          emitClientsInArea(polygons);
        } else {
          emitAreaSelection();
        }
      } finally {
        isHandlingDrawEventRef.current = false;
      }
    };

    const handleDrawDelete = () => {
      if (!showDibujo || !isManualDibujo) {
        return;
      }
      setSelectedAreaCount(0);
      onAreaSelectionChange?.([], false);
    };

    const mapInstance = map.current;
    mapInstance.on("draw.create", handleDrawCreate);
    mapInstance.on("draw.update", handleDrawUpdate);
    mapInstance.on("draw.delete", handleDrawDelete);

    return () => {
      mapInstance.off("draw.create", handleDrawCreate);
      mapInstance.off("draw.update", handleDrawUpdate);
      mapInstance.off("draw.delete", handleDrawDelete);
    };
  }, [
    emitAreaSelection,
    onAreaSelectionChange,
    emitClientsInArea,
    showDibujo,
    isManualDibujo,
  ]);

  useEffect(() => {
    if (!drawControlRef.current || !showDibujo || !isManualDibujo) return;
    emitAreaSelection();
  }, [emitAreaSelection, showDibujo, isManualDibujo]);

  useEffect(() => {
    if (!drawControlRef.current) return;
    if (disableDrawing && showDibujo) {
      setShowDibujo(false);
    }

    if (!showDibujo || disableDrawing) {
      drawControlRef.current.changeMode("simple_select");
      clearDrawnArea();
      removeAutoPolygon();
      onAreaSelectionChange?.([], false);
      return;
    }

    if (isManualDibujo) {
      clearDrawnArea();
      drawControlRef.current.changeMode("draw_polygon");
      removeAutoPolygon();
      return;
    }

    drawControlRef.current.changeMode("simple_select");
    clearDrawnArea();
    onAreaSelectionChange?.([], false);
  }, [
    disableDrawing,
    showDibujo,
    isManualDibujo,
    clearDrawnArea,
    onAreaSelectionChange,
    removeAutoPolygon,
  ]);

  // Show loading state while determining user location
  if (!userLocation && !clients.length && !currentLocation) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-gray-500 text-sm">
          Obteniendo ubicación...
        </span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen">
      <div
        ref={mapContainer}
        className="w-full h-full"
        style={{ borderRadius: 0 }}
      />
      {/* Dibujo toggle button - top left */}
      <button
        type="button"
        onClick={() => {
          const nextShowDibujo = !showDibujo;
          setShowDibujo(nextShowDibujo);
          // Always default to automatic coverage mode when opening Dibujo.
          if (nextShowDibujo) {
            setIsManualDibujo(false);
          }
        }}
        disabled={disableDrawing}
        className={`absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-2 rounded-lg shadow-lg text-sm font-medium transition-all ${
          showDibujo
            ? "bg-purple-600 text-white hover:bg-purple-700"
            : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
        }`}
        title={showDibujo ? "Ocultar dibujo" : "Mostrar dibujo"}
      >
        <PenTool className="w-4 h-4" />
        <span>Dibujo</span>
        {showDibujo && (
          <span className="ml-1 text-xs opacity-80">
            ({isManualDibujo ? selectedAreaCount : clients.length})
          </span>
        )}
      </button>
      {showDibujo && !disableDrawing && (
        <div className="absolute top-16 left-3 z-10">
          <button
            type="button"
            onClick={() => setIsManualDibujo((prev) => !prev)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium shadow-md transition-colors ${
              isManualDibujo
                ? "border-purple-300 bg-purple-50 text-purple-700"
                : "border-gray-200 bg-white text-gray-700"
            }`}
            title="Activar selección manual dentro de polígono"
          >
            <span>Manual</span>
            <span
              className={`relative h-4 w-7 rounded-full transition-colors ${
                isManualDibujo ? "bg-purple-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                  isManualDibujo ? "translate-x-3.5" : "translate-x-0.5"
                }`}
              />
            </span>
          </button>
        </div>
      )}
      {disableDrawing && (
        <div className="absolute top-16 left-3 z-10 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs px-3 py-2 rounded-lg shadow-md max-w-[220px]">
          Cierra la navegación activa para habilitar dibujo de área.
        </div>
      )}
      {showDibujo && !isManualDibujo && clients.length < 3 && (
        <div className="absolute top-28 left-3 z-10 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs px-3 py-2 rounded-lg shadow-md max-w-[220px]">
          Se necesitan al menos 3 clientes para el polígono automático.
        </div>
      )}
    </div>
  );
});

export default NavegarMap;
