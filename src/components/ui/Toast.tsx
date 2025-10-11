'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface ToastProps {
  type: ToastType
  title: string
  message: string
  isVisible: boolean
  onClose: () => void
  duration?: number
}

export default function Toast({
  type,
  title,
  message,
  isVisible,
  onClose,
  duration = 4000
}: ToastProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null)

  const clearTimers = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true)
      clearTimers()

      timerRef.current = setTimeout(() => {
        setIsAnimating(false)
        closeTimerRef.current = setTimeout(onClose, 200) // Allow fade out animation
      }, duration)
    }

    return () => {
      clearTimers()
    }
  }, [isVisible, duration, onClose])

  const handleClose = () => {
    clearTimers()
    setIsAnimating(false)
    closeTimerRef.current = setTimeout(onClose, 200)
  }

  if (!isVisible && !isAnimating) return null

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <Check className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
        )
      case 'error':
        return (
          <div className="flex-shrink-0 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
            <X className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
      <div className={`
        bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-80 max-w-md
        transition-all duration-200 ease-out
        ${isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
      `}>
        <div className="flex items-start gap-3">
          {getIcon()}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              {title}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              {message}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Hook for managing toast state
export function useToast() {
  const [toast, setToast] = useState<{
    type: ToastType
    title: string
    message: string
    isVisible: boolean
    duration?: number
  } | null>(null)

  const showToast = (type: ToastType, title: string, message: string, duration?: number) => {
    setToast({ type, title, message, isVisible: true, duration })
  }

  const hideToast = () => {
    setToast(prev => prev ? { ...prev, isVisible: false } : null)
  }

  const success = (title: string, message: string, duration?: number) => showToast('success', title, message, duration)
  const error = (title: string, message: string, duration?: number) => showToast('error', title, message, duration)

  return {
    toast,
    showToast,
    hideToast,
    success,
    error
  }
}
