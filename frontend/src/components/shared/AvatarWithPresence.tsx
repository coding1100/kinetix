"use client";

import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  presenceDotClass,
  presenceOfflineDotClass,
  type PresenceStatus,
} from "@/stores/profile-store";

type DotSize = "xs" | "sm" | "md";

const DOT_SIZE: Record<DotSize, string> = {
  xs: "size-2",
  sm: "size-2.5",
  md: "size-3",
};

const DOT_BORDER: Record<DotSize, string> = {
  xs: "border-[1.5px]",
  sm: "border-2",
  md: "border-2",
};

export function PresenceDot({
  presence,
  size = "sm",
  borderClass = "border-background",
  className,
  inline = false,
}: {
  presence: PresenceStatus;
  size?: DotSize;
  borderClass?: string;
  className?: string;
  inline?: boolean;
}) {
  const isOffline = presence === "offline";
  // Both dots render one size down from the requested box so the small,
  // subtle presence indicator matches across online/offline states.
  const STEP_DOWN: Record<DotSize, DotSize> = {
    xs: "xs",
    sm: "xs",
    md: "sm",
  };
  const effectiveSize = STEP_DOWN[size];
  const dim = DOT_SIZE[effectiveSize];
  const border = DOT_BORDER[effectiveSize];
  const position = inline
    ? "relative inline-block shrink-0"
    : "absolute -bottom-px -right-px z-10";

  return (
    <span
      className={cn(
        position,
        "rounded-full",
        border,
        isOffline ? presenceOfflineDotClass() : cn(borderClass, presenceDotClass(presence)),
        dim,
        className
      )}
      aria-hidden
    />
  );
}

export function AvatarWithPresence({
  children,
  presence,
  showPresence = true,
  dotSize = "sm",
  borderClass = "border-background",
  className,
}: {
  children: ReactNode;
  presence: PresenceStatus;
  showPresence?: boolean;
  dotSize?: DotSize;
  borderClass?: string;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {children}
      {showPresence ? (
        <PresenceDot
          presence={presence}
          size={dotSize}
          borderClass={borderClass}
        />
      ) : null}
    </span>
  );
}

export function UserAvatarWithPresence({
  name,
  avatarUrl,
  presence,
  avatarClassName,
  fallbackClassName,
  fallback,
  showPresence = true,
  dotSize = "sm",
  borderClass = "border-background",
}: {
  name: string;
  avatarUrl?: string | null;
  presence: PresenceStatus;
  avatarClassName?: string;
  fallbackClassName?: string;
  fallback?: ReactNode;
  showPresence?: boolean;
  dotSize?: DotSize;
  borderClass?: string;
}) {
  return (
    <AvatarWithPresence
      presence={presence}
      showPresence={showPresence}
      dotSize={dotSize}
      borderClass={borderClass}
    >
      <Avatar className={avatarClassName}>
        {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
        <AvatarFallback className={fallbackClassName}>{fallback}</AvatarFallback>
      </Avatar>
    </AvatarWithPresence>
  );
}
