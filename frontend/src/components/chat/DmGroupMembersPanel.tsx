"use client";

import { useMemo, useState } from "react";
import { XIcon } from "lucide-react";
import type { DirectMessage, DmParticipant } from "@/lib/types/chat";
import { PanelCardShell } from "@/components/shared/PanelCardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { UserAvatarWithPresence } from "@/components/shared/AvatarWithPresence";
import { useUserPresence } from "@/stores/presence-store";
import { useChatStore } from "@/stores/chat-store";
import { useAuthStore } from "@/stores/auth-store";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { resolveGroupDmTitle } from "@/lib/chat/group-dm-display";

function MemberRow({
  member,
  isSelf,
}: {
  member: DmParticipant;
  isSelf: boolean;
}) {
  const presence = useUserPresence(member.id, "offline");

  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2">
      <UserAvatarWithPresence
        name={member.fullName}
        presence={presence}
        showPresence
        avatarClassName="size-8"
        dotSize="sm"
        borderClass="border-card"
        fallbackClassName={avatarColorClassForKey(member.id, member.fullName)}
        fallback={avatarInitialFromName(member.fullName)}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {member.fullName}
          {isSelf ? (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              (you)
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}

export function DmGroupMembersPanel({
  dmId,
  title,
  participants,
}: {
  dmId: string;
  title: string;
  participants: DmParticipant[];
}) {
  const setDmDetailsView = useChatStore((s) => s.setDmDetailsView);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [query, setQuery] = useState("");

  const members = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...participants].sort((a, b) => {
      if (a.id === currentUserId) return -1;
      if (b.id === currentUserId) return 1;
      return a.fullName.localeCompare(b.fullName);
    });
    if (!q) return sorted;
    return sorted.filter((m) => m.fullName.toLowerCase().includes(q));
  }, [participants, query, currentUserId]);

  return (
    <PanelCardShell
      widthClass="w-[340px]"
      marginClassName="box-border flex h-full shrink-0 py-3 pl-2 pr-1"
    >
      <div className="flex h-12 shrink-0 items-center justify-between px-4 pt-1">
        <span className="text-sm font-semibold">Members</span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 rounded-full"
          onClick={() => setDmDetailsView(null)}
          aria-label="Close members"
        >
          <XIcon className="size-4" strokeWidth={1.5} />
        </Button>
      </div>
      <Separator />
      <div className="space-y-3 px-4 pt-3">
        <div>
          <h2 className="truncate text-base font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">
            {participants.length} member{participants.length === 1 ? "" : "s"}
          </p>
        </div>
        <Input
          placeholder="Search members"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search members"
        />
      </div>
      <ScrollArea className="min-h-0 flex-1 px-2">
        <div className="space-y-0.5 pb-4 pt-2">
          {members.map((member) => (
            <MemberRow
              key={`${dmId}-${member.id}`}
              member={member}
              isSelf={member.id === currentUserId}
            />
          ))}
        </div>
      </ScrollArea>
    </PanelCardShell>
  );
}

export function resolveGroupMembersTitle(
  dm: Pick<DirectMessage, "name" | "isGroup" | "participants">,
  currentUserId?: string | null
) {
  return resolveGroupDmTitle(dm, currentUserId);
}
