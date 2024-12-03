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

export default function Map({ onLocationUpdate, clientLocation }: MapProps) {
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
      timeout: 5000,
      maximumAge: 0
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          lat: Number(position.coords.latitude.toFixed(5)),
          lng: Number(position.coords.longitude.toFixed(5))
        }
        setLocation(newLocation)
        onLocationUpdate?.(newLocation)
        
        if (map.current) {
          map.current.setCenter([newLocation.lng, newLocation.lat])
          // Update marker position
          const markers = document.getElementsByClassName('mapboxgl-marker')
          if (markers.length > 0) {
            markers[0].remove()
          }
          new mapboxgl.Marker()
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
            errorMessage = 'Please allow location access to use this feature'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable'
            break
          case error.TIMEOUT:
            errorMessage = 'Location request timed out'
            break
        }
        setLocationError(errorMessage)
        
        // Set default location if there's an error
        const defaultLocation = {
          lat: 29.07297,
          lng: -110.95592
        }
        setLocation(defaultLocation)
        onLocationUpdate?.(defaultLocation)
        setIsRefreshing(false)
      },
      options
    )
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

      // Add marker at user's location
      new mapboxgl.Marker()
        .setLngLat([location.lng, location.lat])
        .addTo(map.current)
    }
  }, [location])

  // Update the client location marker effect
  useEffect(() => {
    // Remove existing client markers first
    const clientMarkers = document.getElementsByClassName('client-marker')
    while (clientMarkers.length > 0) {
      clientMarkers[0].remove()
    }

    // Only add new marker if map exists and clientLocation is provided
    if (map.current && clientLocation) {
      // Create a red marker
      const marker = new mapboxgl.Marker({
        color: '#FF0000',
        scale: 0.8,
        className: 'client-marker' // Add this class to identify client markers
      })
        .setLngLat([clientLocation.lng, clientLocation.lat])
        .addTo(map.current)

      // Adjust map bounds to show both markers
      if (location) {
        const bounds = new mapboxgl.LngLatBounds()
        bounds.extend([location.lng, location.lat])
        bounds.extend([clientLocation.lng, clientLocation.lat])
        
        map.current.fitBounds(bounds, {
          padding: 50,
          maxZoom: 15
        })
      }
    }

    // Reset map view to user location if no client location
    if (map.current && !clientLocation && location) {
      map.current.flyTo({
        center: [location.lng, location.lat],
        zoom: 15
      })
    }
  }, [clientLocation, location])

  return (
    <div className="relative">
      <div ref={mapContainer} style={{ height: '300px', borderRadius: '0.5rem' }} />
      <div className="flex justify-between items-center mt-2">
        {locationError ? (
          <p className="text-xs text-red-500">
            {locationError}
          </p>
        ) : location && (
          <p className="text-xs text-gray-500">
            Ubicación: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          </p>
        )}
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
  )
} 