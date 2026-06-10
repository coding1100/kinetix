"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ConversationType } from "@/lib/types/chat";
import type { MentionSelection } from "@/lib/chat/mention-types";
import { MentionPickerContent } from "./MentionPickerContent";

export function MentionAutocompleteDropdown({
  open,
  anchorRef,
  conversationType,
  conversationId,
  query,
  onSelect,
  onDismiss,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  conversationType?: ConversationType;
  conversationId?: string;
  query: string;
  onSelect: (selection: MentionSelection) => void;
  onDismiss: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !anchorRef.current) return;

    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 320;
      const left = Math.min(
        Math.max(8, rect.left),
        window.innerWidth - width - 8
      );
      setStyle({
        position: "fixed",
        left,
        bottom: window.innerHeight - rect.top + 6,
        width,
        zIndex: 60,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current?.contains(target)) return;
      onDismiss();
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, onDismiss]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={dropdownRef}
      data-mention-autocomplete-dropdown
      style={style}
      className="overflow-hidden rounded-lg border border-border bg-card shadow-lg"
    >
      <MentionPickerContent
        conversationType={conversationType}
        conversationId={conversationId}
        query={query}
        showSearch={false}
        onSelect={onSelect}
      />
    </div>,
    document.body
  );
}
