"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import type { DmParticipant } from "@/lib/types/chat";

export function GroupDmAvatarStack({
  participants,
  size = "sm",
  className,
}: {
  participants: DmParticipant[];
  size?: "sm" | "md";
  className?: string;
}) {
  const shown = participants.slice(0, 3);
  if (shown.length === 0) return null;

  const dim = size === "md" ? "size-8" : "size-6";
  const text = size === "md" ? "text-xs" : "text-[10px]";
  const overlap = size === "md" ? "ml-[-10px]" : "ml-[-8px]";

  return (
    <div className={cn("flex shrink-0 items-center", className)}>
      {shown.map((participant, index) => (
        <Avatar
          key={participant.id}
          className={cn(
            dim,
            "border-2 border-background",
            index > 0 && overlap,
            "relative"
          )}
          style={{ zIndex: shown.length - index }}
        >
          <AvatarFallback
            className={cn(
              text,
              "font-semibold",
              avatarColorClassForKey(participant.id, participant.fullName)
            )}
          >
            {avatarInitialFromName(participant.fullName)}
          </AvatarFallback>
        </Avatar>
      ))}
    </div>
  );
}
