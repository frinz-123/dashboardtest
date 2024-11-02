'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { RefreshCw } from 'lucide-react'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

type MapProps = {
  onLocationUpdate?: (location: { lat: number, lng: number }) => void;
}

export default function Map({ onLocationUpdate }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [locationError, setLocationError] = useState<string>('')

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser')
      return
    }

    setIsRefreshing(true)
    setLocationError('')

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,  // Increased timeout for iOS
      maximumAge: 0,   // Always get fresh position
    }

    // For iOS, try to request permission explicitly
    if (typeof window !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' })
        .then(permissionStatus => {
          permissionStatus.onchange = () => {
            if (permissionStatus.state === 'granted') {
              getPosition()
            } else {
              setLocationError('Please enable location services in your settings')
            }
          }
        })
        .catch(() => {
          // Fallback to direct geolocation request if permissions API is not supported
          getPosition()
        })
    } else {
      // Direct geolocation request for older browsers
      getPosition()
    }
  }

  const getPosition = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }
        setLocation(newLocation)
        onLocationUpdate?.(newLocation)
        
        if (map.current) {
          map.current.setCenter([newLocation.lng, newLocation.lat])
          // Update marker position
          const markers = document.getElementsByClassName('mapboxgl-marker')
          Array.from(markers).forEach(marker => marker.remove())
          
          new mapboxgl.Marker({
            color: "#FF0000",
            draggable: false
          })
            .setLngLat([newLocation.lng, newLocation.lat])
            .addTo(map.current)
        }
        setIsRefreshing(false)
      },
      (error) => {
        console.error('Error getting location:', error)
        let errorMessage = 'Error getting location'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Please allow location access in your device settings'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable'
            break
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Please try again'
            break
        }
        setLocationError(errorMessage)
        
        // Set default location if there's an error
        const defaultLocation = {
          lat: 29.0729673,
          lng: -110.9559192
        }
        setLocation(defaultLocation)
        onLocationUpdate?.(defaultLocation)
        setIsRefreshing(false)
      },
      options
    )
  }

  // Initial location request
  useEffect(() => {
    // Add meta viewport tag for better mobile handling
    const meta = document.createElement('meta')
    meta.name = 'viewport'
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
    document.getElementsByTagName('head')[0].appendChild(meta)

    // Request location
    getCurrentLocation()

    // Cleanup
    return () => {
      document.getElementsByTagName('head')[0].removeChild(meta)
    }
  }, [])

  useEffect(() => {
    if (location && mapContainer.current && !map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [location.lng, location.lat],
        zoom: 15,
        attributionControl: false, // Hide attribution for cleaner mobile view
        cooperativeGestures: true  // Enable cooperative gestures for better iOS handling
      })

      // Add navigation controls
      map.current.addControl(
        new mapboxgl.NavigationControl({
          showCompass: false // Only show zoom controls
        }),
        'top-right'
      )

      // Add marker at user's location
      new mapboxgl.Marker({
        color: "#FF0000",
        draggable: false
      })
        .setLngLat([location.lng, location.lat])
        .addTo(map.current)
    }
  }, [location])

  return (
    <div className="relative">
      <div 
        ref={mapContainer} 
        style={{ 
          height: '300px', 
          borderRadius: '0.5rem',
          overflow: 'hidden', // Ensure no content spills out
          WebkitOverflowScrolling: 'touch' // Enable smooth scrolling on iOS
        }} 
      />
      <div className="flex justify-between items-center mt-2">
        {locationError ? (
          <p className="text-xs text-red-500">
            {locationError}
          </p>
        ) : location && (
          <p className="text-xs text-gray-500">
            Ubicación: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </p>
        )}
        <button
          onClick={getCurrentLocation}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200 active:bg-gray-200" // Added active state for better mobile feedback
          disabled={isRefreshing}
          aria-label="Refresh location"
        >
          <RefreshCw 
            className={`h-4 w-4 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} 
          />
        </button>
      </div>
    </div>
  )
} 