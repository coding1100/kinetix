"use client";

import type { MentionMember } from "@/hooks/use-mention-members";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";

export function MentionMemberList({
  members,
  loading,
  onSelect,
  emptyLabel = "No members found",
  compact = false,
  activeIndex = -1,
}: {
  members: MentionMember[];
  loading?: boolean;
  onSelect: (member: MentionMember) => void;
  emptyLabel?: string;
  compact?: boolean;
  activeIndex?: number;
}) {
  if (loading) {
    return (
      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
        Loading members…
      </p>
    );
  }

  if (members.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="max-h-56 w-full overflow-y-auto py-1">
      {members.map((member, index) => (
        <li key={member.id} className="w-full">
          <button
            type="button"
            data-mention-active={index === activeIndex || undefined}
            ref={(el) => {
              if (index === activeIndex) el?.scrollIntoView({ block: "nearest" });
            }}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm",
              index === activeIndex ? "bg-muted/80" : "bg-card hover:bg-muted/80"
            )}
            onClick={() => onSelect(member)}
          >
            <Avatar className="size-8 shrink-0">
              <AvatarFallback
                className={cn(
                  "text-xs font-semibold",
                  avatarColorClassForKey(member.id, member.fullName)
                )}
              >
                {avatarInitialFromName(member.fullName)}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 overflow-hidden">
              <span
                className={cn(
                  "block truncate font-medium",
                  compact ? "leading-normal" : "leading-tight"
                )}
              >
                {member.fullName}
              </span>
              {compact ? null : (
                <span
                  className="block truncate text-xs text-muted-foreground"
                  title={member.email}
                >
                  {member.email}
                </span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
