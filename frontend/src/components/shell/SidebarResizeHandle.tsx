"use client";

import { useCallback, useRef } from "react";
import {
  SECONDARY_PANEL_MAX_WIDTH,
  SECONDARY_PANEL_MIN_WIDTH,
  useShellStore,
} from "@/stores/shell-store";

/** Drag handle for the secondary sidebar's right edge - drop into a
 * `relative`-positioned `<aside>` alongside its other children. Shares
 * `secondaryPanelWidth` across Home/Spaces/Chat sidebars via shell-store.
 *
 * Drags mutate the aside's width directly on the DOM instead of going
 * through the store - the store is `persist`-backed, so a `set()` per
 * pointermove was a synchronous localStorage write plus a full sidebar
 * re-render on every pixel (very laggy). The store only gets one write,
 * on pointerup, once the final width is known. */
export function SidebarResizeHandle() {
  const setSecondaryPanelWidth = useShellStore((s) => s.setSecondaryPanelWidth);
  const draggingRef = useRef(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const aside = e.currentTarget.parentElement as HTMLElement | null;
      if (!aside) return;
      draggingRef.current = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      let latestWidth = aside.getBoundingClientRect().width;

      function onMove(ev: PointerEvent) {
        if (!draggingRef.current) return;
        const rect = aside!.getBoundingClientRect();
        latestWidth = Math.min(
          SECONDARY_PANEL_MAX_WIDTH,
          Math.max(SECONDARY_PANEL_MIN_WIDTH, ev.clientX - rect.left)
        );
        aside!.style.width = `${latestWidth}px`;
      }
      function onUp() {
        draggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setSecondaryPanelWidth(latestWidth);
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [setSecondaryPanelWidth]
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      onPointerDown={onPointerDown}
      className="absolute inset-y-0 right-0 z-10 w-1 cursor-col-resize select-none hover:bg-primary/30 active:bg-primary/50"
    />
  );
}
