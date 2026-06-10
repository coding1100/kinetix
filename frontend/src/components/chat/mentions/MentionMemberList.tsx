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
}: {
  members: MentionMember[];
  loading?: boolean;
  onSelect: (member: MentionMember) => void;
  emptyLabel?: string;
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
      {members.map((member) => (
        <li key={member.id} className="w-full">
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm",
              "bg-card hover:bg-muted/80"
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
              <span className="block truncate font-medium leading-tight">
                {member.fullName}
              </span>
              <span
                className="block truncate text-xs text-muted-foreground"
                title={member.email}
              >
                {member.email}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
