"use client";

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

const DEFAULT_CENTER = { lng: -110.962, lat: 29.072 }; // Hermosillo, Sonora, MX
const FALLBACK_CENTER = { lng: -107.3940, lat: 24.8091 }; // Culiacán, Sinaloa

export type Client = {
  name: string;
  lat: number;
  lng: number;
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

const NavegarMap = forwardRef(function NavegarMap({ clients, selectedClient, onSelectClient, currentLocation, routeTo, onRouteInfo, onUserLocationChange }: NavegarMapProps & { onUserLocationChange?: (loc: { lat: number, lng: number } | null) => void }, ref) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationTried, setLocationTried] = useState(false);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const routeLayerId = "route-line";

  // Try to get user location on mount
  useEffect(() => {
    if (!locationTried) {
      setLocationTried(true);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          (err) => {
            console.warn("[NavegarMap] Geolocation failed, using Culiacán fallback", err);
            setUserLocation(FALLBACK_CENTER);
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
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
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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
      console.log("[NavegarMap] Initializing map with center:", center);
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
      el.style.background =
        client.name === selectedClient
          ? "#007AFF"
          : "#fff";
      el.style.border =
        client.name === selectedClient
          ? "3px solid #007AFF"
          : "2px solid #007AFF";
      el.style.borderRadius = "50%";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
      el.style.cursor = "pointer";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.fontFamily = "Inter, sans-serif";
      el.style.fontWeight = "bold";
      el.style.color = client.name === selectedClient ? "#fff" : "#007AFF";
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
          .addTo(map.current!)
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

  // Show loading state while determining user location
  if (!userLocation && !clients.length && !currentLocation) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-gray-500 text-sm">Obteniendo ubicación...</span>
      </div>
    );
  }

  return (
    <div ref={mapContainer} className="w-full h-screen" style={{ borderRadius: 0 }} />
  );
});

export default NavegarMap; 