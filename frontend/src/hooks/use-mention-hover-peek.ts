"use client";

import { useEffect, useRef, useState } from "react";

export interface MentionHoverTarget {
  userId: string;
  rect: DOMRect;
}

const OPEN_DELAY_MS = 200;
const CLOSE_DELAY_MS = 150;

/** Native hover tracking for `[data-mention-type="person"]` chips inside a
 * contenteditable composer - these are plain DOM nodes, not React elements,
 * so they can't use PopoverTrigger like the sent-message mention does. */
export function useMentionHoverPeek(
  editorRef: React.RefObject<HTMLElement | null>
) {
  const [target, setTarget] = useState<MentionHoverTarget | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveringPeek = useRef(false);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const clearOpenTimer = () => {
      if (openTimer.current) {
        clearTimeout(openTimer.current);
        openTimer.current = null;
      }
    };
    const clearCloseTimer = () => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };

    const onMouseOver = (e: MouseEvent) => {
      const chip = (e.target as HTMLElement)?.closest?.(
        '[data-mention-type="person"]'
      ) as HTMLElement | null;
      if (!chip || !el.contains(chip)) return;
      const userId = chip.dataset.mentionId;
      if (!userId) return;

      clearCloseTimer();
      if (openTimer.current) return;
      openTimer.current = setTimeout(() => {
        openTimer.current = null;
        setTarget({ userId, rect: chip.getBoundingClientRect() });
      }, OPEN_DELAY_MS);
    };

    const onMouseOut = (e: MouseEvent) => {
      const chip = (e.target as HTMLElement)?.closest?.(
        '[data-mention-type="person"]'
      ) as HTMLElement | null;
      if (!chip) return;
      clearOpenTimer();
      closeTimer.current = setTimeout(() => {
        closeTimer.current = null;
        if (!hoveringPeek.current) setTarget(null);
      }, CLOSE_DELAY_MS);
    };

    el.addEventListener("mouseover", onMouseOver);
    el.addEventListener("mouseout", onMouseOut);
    return () => {
      el.removeEventListener("mouseover", onMouseOver);
      el.removeEventListener("mouseout", onMouseOut);
      clearOpenTimer();
      clearCloseTimer();
    };
  }, [editorRef]);

  const holdOpen = () => {
    hoveringPeek.current = true;
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const releaseAndClose = () => {
    hoveringPeek.current = false;
    setTarget(null);
  };

  return { target, holdOpen, releaseAndClose };
}
