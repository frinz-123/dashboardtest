'use client'

import { useEffect } from 'react'

export function ZoomPrevention() {
  useEffect(() => {
    function preventZoom(e: TouchEvent) {
      if (e.touches.length > 1) {
        e.preventDefault()
      }
    }

    function preventDefaultZoom(e: WheelEvent) {
      if (e.ctrlKey) {
        e.preventDefault()
      }
    }

    document.addEventListener('touchstart', preventZoom, { passive: false })
    document.addEventListener('touchmove', preventZoom, { passive: false })
    document.addEventListener('wheel', preventDefaultZoom, { passive: false })

    return () => {
      document.removeEventListener('touchstart', preventZoom)
      document.removeEventListener('touchmove', preventZoom)
      document.removeEventListener('wheel', preventDefaultZoom)
    }
  }, [])

  return null
} 