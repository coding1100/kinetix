"use client";

import type { MentionMember } from "@/hooks/use-mention-members";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AtSignIcon, UsersIcon } from "lucide-react";
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
      {members.map((member, index) => {
        const isSpecial = member.id.startsWith("special:");
        return (
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
              {isSpecial ? (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/30">
                  <AtSignIcon className="size-4" />
                </div>
              ) : (
                <Avatar className="size-8 shrink-0">
                  {member.avatarUrl ? (
                    <AvatarImage src={member.avatarUrl} alt={member.fullName} />
                  ) : null}
                  <AvatarFallback
                    className={cn(
                      "text-xs font-semibold",
                      avatarColorClassForKey(member.id, member.fullName)
                    )}
                  >
                    {avatarInitialFromName(member.fullName)}
                  </AvatarFallback>
                </Avatar>
              )}
              <span className="min-w-0 flex-1 overflow-hidden">
                <span
                  className={cn(
                    "block truncate font-medium",
                    isSpecial ? "text-amber-400 font-semibold" : compact ? "leading-normal" : "leading-tight"
                  )}
                >
                  {isSpecial ? `@${member.fullName}` : member.fullName}
                </span>
                {compact && !isSpecial ? null : (
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
        );
      })}
    </ul>
  );
}
