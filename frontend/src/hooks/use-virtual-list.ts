"use client";

import { useState, useEffect, useRef, useMemo } from "react";

export interface UseVirtualListOptions {
  itemCount: number;
  itemHeight: number;
  overscan?: number;
}

export function useVirtualList<T extends HTMLElement = HTMLDivElement>({
  itemCount,
  itemHeight,
  overscan = 5,
}: UseVirtualListOptions) {
  const containerRef = useRef<T | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      setScrollTop(el.scrollTop);
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    setContainerHeight(el.clientHeight);
    setScrollTop(el.scrollTop);

    el.addEventListener("scroll", handleScroll, { passive: true });
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
  }, []);

  const { startIndex, endIndex, totalHeight, paddingTop, paddingBottom } =
    useMemo(() => {
      const totalH = itemCount * itemHeight;
      if (!containerHeight || itemCount === 0) {
        return {
          startIndex: 0,
          endIndex: Math.min(itemCount, 25),
          totalHeight: totalH,
          paddingTop: 0,
          paddingBottom: 0,
        };
      }

      const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      const end = Math.min(
        itemCount,
        Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
      );

      const topPad = start * itemHeight;
      const bottomPad = Math.max(0, (itemCount - end) * itemHeight);

      return {
        startIndex: start,
        endIndex: end,
        totalHeight: totalH,
        paddingTop: topPad,
        paddingBottom: bottomPad,
      };
    }, [itemCount, itemHeight, containerHeight, scrollTop, overscan]);

  return {
    containerRef,
    startIndex,
    endIndex,
    totalHeight,
    paddingTop,
    paddingBottom,
  };
}
