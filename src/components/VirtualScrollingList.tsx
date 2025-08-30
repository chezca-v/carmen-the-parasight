import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'

interface VirtualScrollingListProps<T> {
  items: T[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  keyExtractor: (item: T, index: number) => string | number
  overscan?: number
}

function VirtualScrollingList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  keyExtractor,
  overscan = 5
}: VirtualScrollingListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )
    return { startIndex, endIndex }
  }, [scrollTop, containerHeight, itemHeight, items.length, overscan])

  // Calculate total height for scrollbar
  const totalHeight = items.length * itemHeight

  // Get visible items
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1)
  }, [items, visibleRange.startIndex, visibleRange.endIndex])

  // Handle scroll
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
  }, [])

  // Scroll to item
  const scrollToItem = useCallback((index: number) => {
    if (containerRef.current) {
      containerRef.current.scrollTop = index * itemHeight
    }
  }, [itemHeight])

  // Scroll to top
  const scrollToTop = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0
    }
  }, [])

  // Auto-scroll to top when items change
  useEffect(() => {
    scrollToTop()
  }, [items.length, scrollToTop])

  return (
    <div
      ref={containerRef}
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative'
      }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: visibleRange.startIndex * itemHeight,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={keyExtractor(item, visibleRange.startIndex + index)}
              style={{ height: itemHeight }}
            >
              {renderItem(item, visibleRange.startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default React.memo(VirtualScrollingList) as <T>(
  props: VirtualScrollingListProps<T>
) => React.ReactElement









