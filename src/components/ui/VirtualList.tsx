'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'

type VirtualListProps<T> = {
  items: T[]
  itemHeight: number
  height: number
  overscan?: number
  renderItem: (item: T, index: number) => React.ReactNode
}

export default function VirtualList<T>({ items, itemHeight, height, overscan = 4, renderItem }: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)

  const onScroll = useCallback(() => {
    if (!containerRef.current) return
    setScrollTop(containerRef.current.scrollTop)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
    }
  }, [onScroll])

  const totalHeight = items.length * itemHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const viewportItemCount = Math.ceil(height / itemHeight) + overscan * 2
  const endIndex = Math.min(items.length - 1, startIndex + viewportItemCount)
  const offsetY = startIndex * itemHeight

  const visibleItems = [] as React.ReactNode[]
  for (let i = startIndex; i <= endIndex; i += 1) {
    visibleItems.push(
      <div key={i} style={{ height: itemHeight }}>
        {renderItem(items[i], i)}
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ height, overflowY: 'auto', position: 'relative' }}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: offsetY, left: 0, right: 0 }}>
          {visibleItems}
        </div>
      </div>
    </div>
  )
}


