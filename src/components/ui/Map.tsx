'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { RefreshCw } from 'lucide-react'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

type MapProps = {
  onLocationUpdate?: (location: { lat: number, lng: number }) => void;
  clientLocation?: { lat: number, lng: number } | null;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  // Create local variables instead of reassigning parameters
  const lat1Fixed = Number(lat1.toFixed(5))
  const lon1Fixed = Number(lon1.toFixed(5))
  const lat2Fixed = Number(lat2.toFixed(5))
  const lon2Fixed = Number(lon2.toFixed(5))

  const R = 6371e3 // Earth's radius in meters
  const φ1 = lat1Fixed * Math.PI/180
  const φ2 = lat2Fixed * Math.PI/180
  const Δφ = (lat2Fixed-lat1Fixed) * Math.PI/180
  const Δλ = (lon2Fixed-lon1Fixed) * Math.PI/180

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  const distance = R * c

  return distance
}

const MIN_MOVEMENT_THRESHOLD = 5 // ✅ Reduced to 5 meters for more accurate updates

const hasSignificantMovement = (
  oldLocation: { lat: number; lng: number } | null,
  newLocation: { lat: number; lng: number }
): boolean => {
  if (!oldLocation) return true
  
  const distance = calculateDistance(
    oldLocation.lat,
    oldLocation.lng,
    newLocation.lat,
    newLocation.lng
  )
  
  return distance > MIN_MOVEMENT_THRESHOLD
}

export default function Map({ onLocationUpdate, clientLocation }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [locationError, setLocationError] = useState<string>('')
  const [isAutoUpdating, setIsAutoUpdating] = useState(true)
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const clientMarkerRef = useRef<mapboxgl.Marker | null>(null)

  const createLabeledMarker = (label: string, color: string) => {
    const el = document.createElement('div')
    el.style.position = 'relative'
    el.style.display = 'flex'
    el.style.flexDirection = 'column'
    el.style.alignItems = 'center'

    const bubble = document.createElement('div')
    bubble.style.backgroundColor = color
    bubble.style.width = '10px'
    bubble.style.height = '10px'
    bubble.style.borderRadius = '50%'
    bubble.style.boxShadow = '0 0 0 2px white'

    const text = document.createElement('div')
    text.textContent = label
    text.style.fontSize = '10px'
    text.style.color = '#111827'
    text.style.background = 'white'
    text.style.padding = '2px 4px'
    text.style.borderRadius = '4px'
    text.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)'
    text.style.marginTop = '4px'

    el.appendChild(bubble)
    el.appendChild(text)
    return el
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser')
      return
    }

    setIsRefreshing(true)
    setLocationError('')

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0  // ✅ Force fresh location data, no caching
    }

    let timeoutId: NodeJS.Timeout

    const geolocationPromise = new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options)
    })

    // Race between geolocation and a fallback timeout
    Promise.race([
      geolocationPromise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Location request timed out'))
        }, options.timeout + 1000)
      })
    ])
      .then((position: any) => {
        clearTimeout(timeoutId)
        const newLocation = {
          lat: Number(position.coords.latitude.toFixed(5)),
          lng: Number(position.coords.longitude.toFixed(5))
        }

        const shouldUpdateMap = hasSignificantMovement(location, newLocation)

        setLocation(newLocation)
        onLocationUpdate?.(newLocation)

        if (map.current && shouldUpdateMap) {
          if (userMarkerRef.current) {
            userMarkerRef.current.remove()
          }
          userMarkerRef.current = new mapboxgl.Marker({ element: createLabeledMarker('TU', '#2563EB') })
            .setLngLat([newLocation.lng, newLocation.lat])
            .addTo(map.current)

          if (!clientLocation) {
            map.current.setCenter([newLocation.lng, newLocation.lat])
          }
        }
        setIsRefreshing(false)
      })
      .catch((error) => {
        clearTimeout(timeoutId)
        console.error('Error getting location:', error)
        let errorMessage = 'Error getting location'
        
        if (error.code) {
          switch (error.code) {
            case 1:
              errorMessage = 'Please allow location access to use this feature'
              break
            case 2:
              errorMessage = 'Location information is unavailable'
              break
            case 3:
              errorMessage = 'Intentando obtener ubicación...'
              setTimeout(() => {
                getCurrentLocation()
              }, 1000)
              break
          }
        }

        setLocationError(errorMessage)
        
        // ✅ Don't set default location automatically - let user know they need to fix location access
        if (error.code !== 3) {
          console.warn("⚠️ Location access failed, NOT setting default location");
          // Don't call onLocationUpdate with default location to prevent form submission with wrong location
        }
        
        setIsRefreshing(false)
      })
  }

  // Request location permission when component mounts
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'granted') {
          getCurrentLocation()
        } else if (result.state === 'prompt') {
          // This will trigger the permission prompt
          getCurrentLocation()
        } else {
          setLocationError('Location permission denied')
        }
      })
    } else {
      getCurrentLocation()
    }
  }, [])

  useEffect(() => {
    if (location && mapContainer.current && !map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [location.lng, location.lat],
        zoom: 15
      })

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl())

      // Add marker at user's location with label
      if (userMarkerRef.current) userMarkerRef.current.remove()
      userMarkerRef.current = new mapboxgl.Marker({ element: createLabeledMarker('TU', '#2563EB') })
        .setLngLat([location.lng, location.lat])
        .addTo(map.current)
    }
  }, [location])

  // Update the client location marker effect to respect movement threshold
  useEffect(() => {
    const clientMarkers = document.getElementsByClassName('client-marker')
    while (clientMarkers.length > 0) {
      clientMarkers[0].remove()
    }

    if (map.current && clientLocation) {
      if (clientMarkerRef.current) clientMarkerRef.current.remove()
      clientMarkerRef.current = new mapboxgl.Marker({ element: createLabeledMarker('Cliente', '#DC2626') })
        .setLngLat([clientLocation.lng, clientLocation.lat])
        .addTo(map.current)

      // Only adjust bounds if there's significant movement
      if (location && hasSignificantMovement(location, clientLocation)) {
        const bounds = new mapboxgl.LngLatBounds()
        bounds.extend([location.lng, location.lat])
        bounds.extend([clientLocation.lng, clientLocation.lat])
        
        map.current.fitBounds(bounds, {
          padding: 50,
          maxZoom: 15,
          duration: 500 // Smooth transition
        })
      }
    }
  }, [clientLocation, location])

  // Modify the auto-update interval
  useEffect(() => {
    if (!isAutoUpdating) return

    const intervalId = setInterval(() => {
      if (!isRefreshing) {
        getCurrentLocation()
      }
    }, 3000)

    return () => {
      clearInterval(intervalId)
    }
  }, [isAutoUpdating, isRefreshing])

  return (
    <div className="relative">
      <div ref={mapContainer} style={{ height: '300px', borderRadius: '0.5rem' }} />
      <div className="flex justify-between items-center mt-2">
        <div className="flex items-center gap-2">
          {locationError ? (
            <div className="text-xs text-yellow-800 bg-yellow-100 px-2 py-1 rounded">
              {locationError}
            </div>
          ) : location && (
            <p className="text-xs text-gray-500">
              Ubicación: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </p>
          )}
          {isRefreshing && (
            <span className="text-xs text-blue-500">Actualizando...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {locationError && (
            <button
              onClick={() => getCurrentLocation()}
              className="text-xs px-2 py-1 rounded bg-yellow-200 text-yellow-900 hover:bg-yellow-300"
            >
              Reintentar
            </button>
          )}
          <button
            onClick={() => setIsAutoUpdating(!isAutoUpdating)}
            className={`text-xs px-2 py-1 rounded ${
              isAutoUpdating 
                ? 'bg-blue-100 text-blue-600' 
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {isAutoUpdating ? 'Auto' : 'Manual'}
          </button>
          <button
            onClick={() => {
              // ✅ Force clear any cached location and get fresh data
              setLocation(null);
              getCurrentLocation();
            }}
            className="text-xs px-2 py-1 rounded bg-red-100 text-red-600 hover:bg-red-200"
            disabled={isRefreshing}
          >
            Reset
          </button>
          <button
            onClick={getCurrentLocation}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
            disabled={isRefreshing}
          >
            <RefreshCw 
              className={`h-4 w-4 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} 
            />
          </button>
        </div>
      </div>
    </div>
  )
} 