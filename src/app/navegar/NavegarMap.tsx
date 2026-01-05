"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import convex from "@turf/convex";
import { featureCollection, point } from "@turf/helpers";
import { PenTool } from "lucide-react";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

const DEFAULT_CENTER = { lng: -110.962, lat: 29.072 }; // Hermosillo, Sonora, MX
const FALLBACK_CENTER = { lng: -107.394, lat: 24.8091 }; // Culiacán, Sinaloa

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
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const routeLayerId = "route-line";
  const [showDibujo, setShowDibujo] = useState(false);
  const polygonLayerId = "clients-polygon";
  const polygonSourceId = "clients-polygon-source";

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
            onUserLocationChange && onUserLocationChange(loc);
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
      onUserLocationChange && onUserLocationChange(loc);
      // Optionally, recenter map
      if (map.current) {
        map.current.flyTo({ center: [loc.lng, loc.lat], zoom: 15 });
      }
    } catch (e) {
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
        onRouteInfo && onRouteInfo(info);
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
        onRouteInfo && onRouteInfo(null);
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
      onRouteInfo && onRouteInfo(null);
    },
    getAccurateLocation,
    refreshLocation,
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
    }
  }, [userLocation]);

  // Add/Update markers
  useEffect(() => {
    if (!map.current) return;
    markers.current.forEach((m) => m.remove());
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
      el.onclick = (e) => {
        e.stopPropagation();
        onSelectClient && onSelectClient(client.name);
      };
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
  }, [clients, selectedClient, onSelectClient, currentLocation, userLocation]);

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

  // Draw/remove polygon around filtered clients when Dibujo is toggled
  useEffect(() => {
    if (!map.current) return;

    const removePolygon = () => {
      if (map.current?.getLayer(polygonLayerId)) {
        map.current.removeLayer(polygonLayerId);
      }
      if (map.current?.getLayer(polygonLayerId + "-outline")) {
        map.current.removeLayer(polygonLayerId + "-outline");
      }
      if (map.current?.getSource(polygonSourceId)) {
        map.current.removeSource(polygonSourceId);
      }
    };

    if (!showDibujo || clients.length < 3) {
      removePolygon();
      return;
    }

    // Create points from clients
    const points = clients.map((c) => point([c.lng, c.lat]));
    const fc = featureCollection(points);

    // Calculate convex hull
    const hull = convex(fc);

    if (!hull) {
      removePolygon();
      return;
    }

    // Remove existing polygon layers/sources first
    removePolygon();

    // Add the polygon source and layers
    map.current.addSource(polygonSourceId, {
      type: "geojson",
      data: hull,
    });

    // Add fill layer
    map.current.addLayer({
      id: polygonLayerId,
      type: "fill",
      source: polygonSourceId,
      paint: {
        "fill-color": "#8B5CF6",
        "fill-opacity": 0.2,
      },
    });

    // Add outline layer
    map.current.addLayer({
      id: polygonLayerId + "-outline",
      type: "line",
      source: polygonSourceId,
      paint: {
        "line-color": "#8B5CF6",
        "line-width": 2,
        "line-dasharray": [2, 2],
      },
    });

    // Cleanup on unmount or when dependencies change
    return () => {
      removePolygon();
    };
  }, [showDibujo, clients]);

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
        onClick={() => setShowDibujo((prev) => !prev)}
        className={`absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-2 rounded-lg shadow-lg text-sm font-medium transition-all ${
          showDibujo
            ? "bg-purple-600 text-white hover:bg-purple-700"
            : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
        }`}
        title={showDibujo ? "Ocultar área de cobertura" : "Mostrar área de cobertura"}
      >
        <PenTool className="w-4 h-4" />
        <span>Dibujo</span>
        {showDibujo && clients.length >= 3 && (
          <span className="ml-1 text-xs opacity-80">({clients.length})</span>
        )}
      </button>
      {/* Info tooltip when Dibujo is active but not enough clients */}
      {showDibujo && clients.length < 3 && (
        <div className="absolute top-16 left-3 z-10 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs px-3 py-2 rounded-lg shadow-md max-w-[200px]">
          Se necesitan al menos 3 clientes para dibujar el área de cobertura
        </div>
      )}
    </div>
  );
});

export default NavegarMap;
