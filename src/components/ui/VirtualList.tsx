"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

type VirtualListProps<T> = {
  items: T[];
  itemHeight: number;
  height: number;
  overscan?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
};

export default function VirtualList<T>({
  items,
  itemHeight,
  height,
  overscan = 4,
  renderItem,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const touchStartY = useRef<number | null>(null);

  const onScroll = useCallback(() => {
    if (!containerRef.current) return;
    setScrollTop(containerRef.current.scrollTop);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", onScroll, { passive: true });

    const onWheel = (e: WheelEvent) => {
      if (!el) return;
      const atTop = el.scrollTop <= 0;
      const atBottom =
        Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;
      const scrollingUp = e.deltaY < 0;
      const scrollingDown = e.deltaY > 0;
      if ((atTop && scrollingUp) || (atBottom && scrollingDown)) {
        e.preventDefault();
        window.scrollBy({ top: e.deltaY, behavior: "auto" });
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!el || touchStartY.current === null) return;
      const currentY = e.touches[0]?.clientY ?? touchStartY.current;
      const delta = touchStartY.current - currentY; // >0 means swipe up (scroll down)
      const atTop = el.scrollTop <= 0;
      const atBottom =
        Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;
      const swipingDown = delta < 0;
      const swipingUp = delta > 0;
      if ((atTop && swipingDown) || (atBottom && swipingUp)) {
        e.preventDefault();
        window.scrollBy({ top: delta, behavior: "auto" });
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [onScroll]);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const viewportItemCount = Math.ceil(height / itemHeight) + overscan * 2;
  const endIndex = Math.min(items.length - 1, startIndex + viewportItemCount);
  const offsetY = startIndex * itemHeight;

  const visibleItems = [] as React.ReactNode[];
  for (let i = startIndex; i <= endIndex; i += 1) {
    visibleItems.push(
      <div key={i} style={{ height: itemHeight }}>
        {renderItem(items[i], i)}
      </div>,
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        height,
        overflowY: "auto",
        position: "relative",
        overscrollBehaviorY: "auto",
      }}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ position: "absolute", top: offsetY, left: 0, right: 0 }}>
          {visibleItems}
        </div>
      </div>
    </div>
  );
}
