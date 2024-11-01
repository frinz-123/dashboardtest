'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { RefreshCw } from 'lucide-react'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = 'pk.eyJ1IjoiZGVyZnJhbnoiLCJhIjoiY20wb2swMnJrMDk4bzJxcHE3Mm9tcHI4MiJ9.s8-tOip-Idq6D2zES4NFGA'

type MapProps = {
  onLocationUpdate?: (location: { lat: number, lng: number }) => void;
}

export default function Map({ onLocationUpdate }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      setIsRefreshing(true)
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
          const defaultLocation = {
            lat: 29.0729673,
            lng: -110.9559192
          }
          setLocation(defaultLocation)
          onLocationUpdate?.(defaultLocation)
          setIsRefreshing(false)
        }
      )
    }
  }

  useEffect(() => {
    getCurrentLocation()
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

  return (
    <div className="relative">
      <div ref={mapContainer} style={{ height: '300px', borderRadius: '0.5rem' }} />
      <div className="flex justify-between items-center mt-2">
        {location && (
          <p className="text-xs text-gray-500">
            Ubicación: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
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