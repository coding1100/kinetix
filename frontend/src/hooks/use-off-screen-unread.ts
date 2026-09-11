"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const ANCHOR_SELECTOR = "[data-unread-anchor='true']";
const HIGHLIGHT_MS = 1400;

export type OffScreenUnreadState = {
  hasUnreadAbove: boolean;
  hasUnreadBelow: boolean;
  scrollToNearestAbove: () => void;
  scrollToNearestBelow: () => void;
};

/**
 * Tracks whether any unread sidebar row (marked with
 * data-unread-anchor="true" and a matching `id`) is scrolled out of view
 * above or below the given scroll container - the "jump to unread" pill
 * pattern (ClickUp/Slack). Recomputes on scroll, resize, and whenever the
 * list content itself changes (new messages, filtering, etc.) since rows
 * are added/removed without necessarily firing a scroll event.
 */
export function useOffScreenUnread(
  containerRef: React.RefObject<HTMLDivElement | null>
): OffScreenUnreadState {
  const [hasUnreadAbove, setHasUnreadAbove] = useState(false);
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false);

  const recompute = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      setHasUnreadAbove(false);
      setHasUnreadBelow(false);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const anchors = container.querySelectorAll<HTMLElement>(ANCHOR_SELECTOR);

    let above = false;
    let below = false;
    anchors.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.bottom < containerRect.top) above = true;
      else if (rect.top > containerRect.bottom) below = true;
    });

    setHasUnreadAbove(above);
    setHasUnreadBelow(below);
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    recompute();

    container.addEventListener("scroll", recompute, { passive: true });
    window.addEventListener("resize", recompute);

    // Rows are added/removed/reordered (new unread arrives, filter changes,
    // list re-sorts) without a scroll event firing - a MutationObserver
    // catches that so the pill doesn't go stale.
    const mutationObserver = new MutationObserver(recompute);
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-unread-anchor"],
    });

    return () => {
      container.removeEventListener("scroll", recompute);
      window.removeEventListener("resize", recompute);
      mutationObserver.disconnect();
    };
  }, [containerRef, recompute]);

  const scrollToNearest = useCallback(
    (direction: "above" | "below") => {
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const anchors = Array.from(
        container.querySelectorAll<HTMLElement>(ANCHOR_SELECTOR)
      );

      const candidates = anchors
        .map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .filter(({ rect }) =>
          direction === "above"
            ? rect.bottom < containerRect.top
            : rect.top > containerRect.bottom
        );
      if (candidates.length === 0) return;

      // Nearest to the visible edge, not the topmost/bottommost overall.
      const target =
        direction === "above"
          ? candidates.reduce((a, b) => (b.rect.top > a.rect.top ? b : a))
          : candidates.reduce((a, b) => (b.rect.top < a.rect.top ? b : a));

      target.el.scrollIntoView({ behavior: "smooth", block: "center" });

      target.el.classList.add("sidebar-unread-jump-highlight");
      window.setTimeout(() => {
        target.el.classList.remove("sidebar-unread-jump-highlight");
      }, HIGHLIGHT_MS);
    },
    [containerRef]
  );

  return {
    hasUnreadAbove,
    hasUnreadBelow,
    scrollToNearestAbove: () => scrollToNearest("above"),
    scrollToNearestBelow: () => scrollToNearest("below"),
  };
}
