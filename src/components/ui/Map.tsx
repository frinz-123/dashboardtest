"use client";

import { RefreshCw } from "lucide-react";
import mapboxgl from "mapbox-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

type MapProps = {
  onLocationUpdate?: (location: {
    lat: number;
    lng: number;
    accuracy?: number;
    timestamp?: number;
  }) => void;
  clientLocation?: { lat: number; lng: number } | null;
};

type Location = { lat: number; lng: number };

const FALLBACK_CENTER: Location = {
  lat: 29.0729673,
  lng: -110.9559192,
};
const MAP_STYLE = "mapbox://styles/mapbox/streets-v12?optimize=true";
const HIGH_ACCURACY_THRESHOLD = 40; // meters
const HIGH_ACCURACY_TIMEOUT = 12000;
const MAX_AUTO_RETRIES = 3;
const AUTO_RETRY_BASE_DELAY_MS = 1000;
const GEOLOCATION_PERMISSION_DENIED = 1;
const GEOLOCATION_POSITION_UNAVAILABLE = 2;
const GEOLOCATION_TIMEOUT = 3;

function parseGeolocationError(error: GeolocationPositionError | Error): {
  code: number | null;
  message: string;
} {
  const code =
    "code" in error && typeof error.code === "number" ? error.code : null;

  const messageFromError =
    "message" in error && typeof error.message === "string"
      ? error.message.trim()
      : "";

  if (messageFromError) {
    return { code, message: messageFromError };
  }

  if (code === GEOLOCATION_PERMISSION_DENIED) {
    return { code, message: "Permiso de ubicación denegado." };
  }
  if (code === GEOLOCATION_POSITION_UNAVAILABLE) {
    return { code, message: "No hay señal de ubicación disponible." };
  }
  if (code === GEOLOCATION_TIMEOUT) {
    return { code, message: "La solicitud de ubicación excedió el tiempo." };
  }

  return { code, message: "Error desconocido de geolocalización." };
}

const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const lat1Fixed = Number(lat1.toFixed(5));
  const lon1Fixed = Number(lon1.toFixed(5));
  const lat2Fixed = Number(lat2.toFixed(5));
  const lon2Fixed = Number(lon2.toFixed(5));

  const R = 6371e3;
  const φ1 = (lat1Fixed * Math.PI) / 180;
  const φ2 = (lat2Fixed * Math.PI) / 180;
  const Δφ = ((lat2Fixed - lat1Fixed) * Math.PI) / 180;
  const Δλ = ((lon2Fixed - lon1Fixed) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const MIN_MOVEMENT_THRESHOLD = 5;

const hasSignificantMovement = (
  oldLocation: Location | null,
  newLocation: Location,
): boolean => {
  if (!oldLocation) return true;

  const distance = calculateDistance(
    oldLocation.lat,
    oldLocation.lng,
    newLocation.lat,
    newLocation.lng,
  );

  return distance > MIN_MOVEMENT_THRESHOLD;
};

export default function MapView({
  onLocationUpdate,
  clientLocation,
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  const [location, setLocation] = useState<Location | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [locationError, setLocationError] = useState<string>("");
  const [isAutoUpdating, setIsAutoUpdating] = useState(true);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [mapInitError, setMapInitError] = useState<string>("");
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const clientMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const bestEffortPosition = useRef<GeolocationPosition | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isComponentUnmounted = useRef(false);
  const locationWatchId = useRef<number | null>(null);
  const accuracyFallbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const locationRef = useRef<Location | null>(null);
  const clientLocationRef = useRef<Location | null>(null);
  const onLocationUpdateRef =
    useRef<MapProps["onLocationUpdate"]>(onLocationUpdate);
  const geoRetryCountRef = useRef(0);

  const staticMapUrl = useMemo(() => {
    if (!mapboxgl.accessToken) return null;
    const center = location ?? FALLBACK_CENTER;
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${center.lng},${center.lat},14/1200x600?access_token=${encodeURIComponent(
      mapboxgl.accessToken,
    )}`;
  }, [location]);

  const stopWatchingLocation = useCallback(() => {
    if (locationWatchId.current !== null) {
      navigator.geolocation.clearWatch(locationWatchId.current);
      locationWatchId.current = null;
    }

    if (accuracyFallbackTimeout.current) {
      clearTimeout(accuracyFallbackTimeout.current);
      accuracyFallbackTimeout.current = null;
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const createLabeledMarker = useCallback((label: string, color: string) => {
    const el = document.createElement("div");
    el.style.position = "relative";
    el.style.display = "flex";
    el.style.flexDirection = "column";
    el.style.alignItems = "center";

    const bubble = document.createElement("div");
    bubble.style.backgroundColor = color;
    bubble.style.width = "10px";
    bubble.style.height = "10px";
    bubble.style.borderRadius = "50%";
    bubble.style.boxShadow = "0 0 0 2px white";

    const text = document.createElement("div");
    text.textContent = label;
    text.style.fontSize = "10px";
    text.style.color = "#111827";
    text.style.background = "white";
    text.style.padding = "2px 4px";
    text.style.borderRadius = "4px";
    text.style.boxShadow = "0 1px 2px rgba(0,0,0,0.1)";
    text.style.marginTop = "4px";

    el.appendChild(bubble);
    el.appendChild(text);
    return el;
  }, []);

  const getCurrentLocation = useCallback(
    (options?: { resetRetryCount?: boolean }) => {
      if (options?.resetRetryCount) {
        geoRetryCountRef.current = 0;
      }

      if (isComponentUnmounted.current) {
        return;
      }

      if (process.env.NODE_ENV !== "production") {
        console.debug("Map: getCurrentLocation requested");
      }

      if (!navigator.geolocation) {
        setLocationError("Geolocation is not supported by your browser");
        setIsRefreshing(false);
        return;
      }

      stopWatchingLocation();
      setIsRefreshing(true);
      setLocationError("");
      setLocationAccuracy(null);
      bestEffortPosition.current = null;

      const geolocationOptions = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      };

      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let hasResolved = false;

      const applyLocation = (position: GeolocationPosition) => {
        if (isComponentUnmounted.current) return;
        if (hasResolved) return;
        hasResolved = true;
        geoRetryCountRef.current = 0;

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        const newLocation = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        };

        const shouldUpdateMap = hasSignificantMovement(
          locationRef.current,
          newLocation,
        );

        setLocation(newLocation);
        setLocationError("");
        setLocationAccuracy(position.coords.accuracy);
        onLocationUpdateRef.current?.({
          ...newLocation,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp || Date.now(),
        });

        if (map.current && shouldUpdateMap) {
          if (userMarkerRef.current) {
            userMarkerRef.current.remove();
          }
          userMarkerRef.current = new mapboxgl.Marker({
            element: createLabeledMarker("TU", "#2563EB"),
          })
            .setLngLat([newLocation.lng, newLocation.lat])
            .addTo(map.current);

          if (!clientLocationRef.current) {
            map.current.setCenter([newLocation.lng, newLocation.lat]);
          }
        }

        setIsRefreshing(false);
        stopWatchingLocation();
      };

      const handleGeolocationSuccess = (position: GeolocationPosition) => {
        if (isComponentUnmounted.current) return;
        if (hasResolved) return;

        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        setLocationAccuracy(position.coords.accuracy);

        if (
          !bestEffortPosition.current ||
          position.coords.accuracy < bestEffortPosition.current.coords.accuracy
        ) {
          bestEffortPosition.current = position;
        }

        if (position.coords.accuracy <= HIGH_ACCURACY_THRESHOLD) {
          applyLocation(position);
          return;
        }

        if (accuracyFallbackTimeout.current) {
          clearTimeout(accuracyFallbackTimeout.current);
        }

        accuracyFallbackTimeout.current = setTimeout(() => {
          const fallbackPosition = bestEffortPosition.current ?? position;
          applyLocation(fallbackPosition);
        }, HIGH_ACCURACY_TIMEOUT);
      };

      const handleGeolocationError = (
        error: GeolocationPositionError | Error,
      ) => {
        if (isComponentUnmounted.current) return;
        if (hasResolved) return;
        hasResolved = true;

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        stopWatchingLocation();
        const { code, message } = parseGeolocationError(error);
        if (process.env.NODE_ENV !== "production") {
          console.warn("Map geolocation failed", {
            code,
            message,
          });
        }

        const isRetryable =
          code === GEOLOCATION_POSITION_UNAVAILABLE ||
          code === GEOLOCATION_TIMEOUT ||
          message.toLowerCase().includes("timed out");

        if (isRetryable && geoRetryCountRef.current < MAX_AUTO_RETRIES) {
          geoRetryCountRef.current += 1;
          const retryAttempt = geoRetryCountRef.current;
          const retryDelay = AUTO_RETRY_BASE_DELAY_MS * retryAttempt;

          setLocationError(
            `Intentando obtener ubicación... (${retryAttempt}/${MAX_AUTO_RETRIES})`,
          );

          retryTimeoutRef.current = setTimeout(() => {
            getCurrentLocation();
          }, retryDelay);
          return;
        }

        let errorMessage =
          "No se pudo obtener ubicación. Revisa GPS y toca Reintentar.";

        if (code === GEOLOCATION_PERMISSION_DENIED) {
          errorMessage = "Permite acceso a tu ubicación para continuar.";
        } else if (code === GEOLOCATION_POSITION_UNAVAILABLE) {
          errorMessage = "La información de ubicación no está disponible.";
        }

        setLocationError(errorMessage);
        setIsRefreshing(false);
      };

      timeoutId = setTimeout(() => {
        handleGeolocationError(new Error("Location request timed out"));
      }, geolocationOptions.timeout + 1000);

      locationWatchId.current = navigator.geolocation.watchPosition(
        handleGeolocationSuccess,
        (error) => handleGeolocationError(error),
        geolocationOptions,
      );
    },
    [createLabeledMarker, stopWatchingLocation],
  );

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    if (!mapboxgl.accessToken) {
      setMapInitError("Falta NEXT_PUBLIC_MAPBOX_TOKEN para cargar el mapa.");
      return;
    }

    if (typeof mapboxgl.supported === "function" && !mapboxgl.supported()) {
      setMapInitError(
        "Este dispositivo no soporta el mapa interactivo. Mostrando vista estática.",
      );
      return;
    }

    try {
      const initialCenter = locationRef.current ?? FALLBACK_CENTER;
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: MAP_STYLE,
        center: [initialCenter.lng, initialCenter.lat],
        zoom: 15,
        refreshExpiredTiles: false,
        minTileCacheSize: 64,
      });

      map.current.addControl(new mapboxgl.NavigationControl());
      map.current.on("load", () => {
        if (!isComponentUnmounted.current) {
          setIsMapLoaded(true);
        }
      });
      map.current.on("error", () => {
        if (
          !isComponentUnmounted.current &&
          process.env.NODE_ENV !== "production"
        ) {
          console.warn("Map reported an error event");
        }
      });
    } catch (error) {
      console.error("Map initialization failed:", error);
      setMapInitError(
        "No se pudo inicializar el mapa en este dispositivo. Mostrando vista estática.",
      );
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    clientLocationRef.current = clientLocation ?? null;
  }, [clientLocation]);

  useEffect(() => {
    onLocationUpdateRef.current = onLocationUpdate;
  }, [onLocationUpdate]);

  useEffect(() => {
    isComponentUnmounted.current = false;
    let isCancelled = false;

    const requestLocation = () => {
      if (!isCancelled) {
        getCurrentLocation({ resetRetryCount: true });
      }
    };

    if (process.env.NODE_ENV !== "production") {
      console.debug("Map: permission check effect");
    }

    if (typeof window !== "undefined" && navigator.permissions) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          if (isCancelled) return;

          if (result.state === "granted" || result.state === "prompt") {
            requestLocation();
          } else {
            setLocationError("Location permission denied");
            setIsRefreshing(false);
          }
        })
        .catch(() => {
          requestLocation();
        });
    } else {
      requestLocation();
    }

    return () => {
      isCancelled = true;
      isComponentUnmounted.current = true;
      stopWatchingLocation();
    };
  }, [getCurrentLocation, stopWatchingLocation]);

  useEffect(() => {
    if (!map.current || !clientLocation) {
      if (clientMarkerRef.current) {
        clientMarkerRef.current.remove();
        clientMarkerRef.current = null;
      }
      return;
    }

    if (clientMarkerRef.current) clientMarkerRef.current.remove();
    clientMarkerRef.current = new mapboxgl.Marker({
      element: createLabeledMarker("Cliente", "#DC2626"),
    })
      .setLngLat([clientLocation.lng, clientLocation.lat])
      .addTo(map.current);

    if (location && hasSignificantMovement(location, clientLocation)) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([location.lng, location.lat]);
      bounds.extend([clientLocation.lng, clientLocation.lat]);

      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15,
        duration: 500,
      });
    }
  }, [clientLocation, location, createLabeledMarker]);

  useEffect(() => {
    if (!isAutoUpdating) return;

    const intervalMs = location ? 5000 : 15000;

    const intervalId = setInterval(() => {
      if (!isRefreshing) {
        const hasResolvedLocation = Boolean(locationRef.current);
        getCurrentLocation({ resetRetryCount: !hasResolvedLocation });
      }
    }, intervalMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [isAutoUpdating, isRefreshing, getCurrentLocation, location]);

  return (
    <div className="relative">
      {mapInitError ? (
        staticMapUrl ? (
          <div className="h-[300px] overflow-hidden rounded-lg border border-yellow-200">
            {/* biome-ignore lint/performance/noImgElement: Static Mapbox image is a lightweight fallback when WebGL map init fails. */}
            <img
              src={staticMapUrl}
              alt="Mapa estático de respaldo"
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="h-[300px] rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-900">
            {mapInitError}
          </div>
        )
      ) : (
        <div className="relative">
          <div
            ref={mapContainer}
            style={{ height: "300px", borderRadius: "0.5rem" }}
          />
          {!isMapLoaded && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-white/70 text-xs text-gray-500">
              Cargando mapa...
            </div>
          )}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {mapInitError ? (
            <div className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
              {mapInitError}
            </div>
          ) : locationError ? (
            <div className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
              {locationError}
            </div>
          ) : (
            location && (
              <div className="flex flex-col text-xs text-gray-500">
                <span>
                  Ubicación: {location.lat.toFixed(5)},{" "}
                  {location.lng.toFixed(5)}
                </span>
                {locationAccuracy !== null && (
                  <span className="text-[10px] text-gray-400">
                    Precisión: ±{Math.round(locationAccuracy)}m
                  </span>
                )}
              </div>
            )
          )}
          {isRefreshing && (
            <span className="text-xs text-blue-500">Actualizando...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {locationError && (
            <button
              onClick={() => getCurrentLocation({ resetRetryCount: true })}
              type="button"
              className="text-xs px-2 py-1 rounded bg-yellow-200 text-yellow-900 hover:bg-yellow-300"
            >
              Reintentar
            </button>
          )}
          <button
            onClick={() => setIsAutoUpdating(!isAutoUpdating)}
            type="button"
            className={`text-xs px-2 py-1 rounded ${
              isAutoUpdating
                ? "bg-blue-100 text-blue-600"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {isAutoUpdating ? "Auto" : "Manual"}
          </button>
          <button
            onClick={() => {
              setLocation(null);
              getCurrentLocation({ resetRetryCount: true });
            }}
            type="button"
            className="text-xs px-2 py-1 rounded bg-red-100 text-red-600 hover:bg-red-200"
            disabled={isRefreshing}
          >
            Reset
          </button>
          <button
            onClick={() => getCurrentLocation({ resetRetryCount: true })}
            type="button"
            className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`h-4 w-4 text-gray-600 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
