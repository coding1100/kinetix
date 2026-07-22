"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UserProfileCardContent } from "@/components/chat/UserProfilePeek";

const PEEK_WIDTH = 320;

export function ComposerMentionHoverPeek({
  userId,
  rect,
  channelId,
  onMouseEnter,
  onMouseLeave,
}: {
  userId: string;
  rect: DOMRect;
  channelId?: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const left = Math.min(
    Math.max(8, rect.left),
    window.innerWidth - PEEK_WIDTH - 8
  );

  return createPortal(
    <div
      style={{
        position: "fixed",
        left,
        bottom: window.innerHeight - rect.top + 6,
        width: PEEK_WIDTH,
        zIndex: 110,
      }}
      className="gap-0 overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <UserProfileCardContent userId={userId} channelId={channelId} />
    </div>,
    document.body
  );
}
