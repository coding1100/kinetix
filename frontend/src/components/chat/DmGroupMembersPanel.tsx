"use client";

import { useMemo, useState } from "react";
import { XIcon, UserMinusIcon } from "lucide-react";
import type { DirectMessage, DmParticipant } from "@/lib/types/chat";
import { PanelCardShell } from "@/components/shared/PanelCardShell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { UserAvatarWithPresence } from "@/components/shared/AvatarWithPresence";
import { useUserPresence } from "@/stores/presence-store";
import { useChatStore } from "@/stores/chat-store";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useWorkspaceMembersQuery } from "@/hooks/use-workspace-members-query";
import {
  addDmParticipants,
  removeDmParticipant,
  renameGroupDm,
} from "@/lib/api/chat";
import { formatRequestError } from "@/lib/api/client";
import { patchSidebarDm } from "@/lib/chat/sidebar-dm";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function MemberRow({
  member,
  isSelf,
  onRemove,
}: {
  member: DmParticipant;
  isSelf: boolean;
  onRemove?: () => void;
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
      {onRemove ? (
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 text-muted-foreground hover:text-destructive"
          aria-label={`Remove ${member.fullName}`}
          onClick={onRemove}
        >
          <UserMinusIcon className="size-4" />
        </Button>
      ) : null}
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
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const membersQuery = useWorkspaceMembersQuery();
  const [query, setQuery] = useState("");
  const [groupName, setGroupName] = useState(title);
  const [addQuery, setAddQuery] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [justAdded, setJustAdded] = useState<Set<string>>(() => new Set());

  const addCandidates = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    const pool = (membersQuery.data ?? []).filter(
      (m) => !participants.some((p) => p.id === m.id) && !justAdded.has(m.id)
    );
    if (!q) return pool;
    return pool.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [membersQuery.data, participants, justAdded, addQuery]);

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

  const handleRename = async () => {
    const next = groupName.trim();
    if (!next || !ready) return;
    setSavingName(true);
    try {
      await renameGroupDm(accessToken, workspaceId, dmId, next);
      patchSidebarDm(dmId, { name: next });
      toast.success("Group renamed");
    } catch (err) {
      toast.error(formatRequestError(err));
    } finally {
      setSavingName(false);
    }
  };

  const handleAddMember = async (member: { id: string; fullName: string }) => {
    if (!ready) return;
    setAddingId(member.id);
    try {
      await addDmParticipants(accessToken, workspaceId, dmId, [member.id]);
      toast.success(`Added ${member.fullName}`);
      setJustAdded((prev) => new Set(prev).add(member.id));
      setAddQuery("");
    } catch (err) {
      toast.error(formatRequestError(err));
    } finally {
      setAddingId(null);
    }
  };

  const handleRemove = async (targetUserId: string) => {
    if (!ready) return;
    try {
      await removeDmParticipant(accessToken, workspaceId, dmId, targetUserId);
      toast.success(
        targetUserId === currentUserId ? "You left the group" : "Member removed"
      );
      if (targetUserId === currentUserId) {
        setDmDetailsView(null);
      }
    } catch (err) {
      toast.error(formatRequestError(err));
    }
  };

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
        <div className="flex gap-2">
          <Input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name"
            aria-label="Group name"
          />
          <Button
            size="sm"
            disabled={savingName || !groupName.trim()}
            onClick={() => void handleRename()}
          >
            Save
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dm-add-people">Add people</Label>
          <Input
            id="dm-add-people"
            placeholder="Name or email"
            value={addQuery}
            onChange={(e) => setAddQuery(e.target.value)}
            onFocus={() => setAddOpen(true)}
            onBlur={() => setTimeout(() => setAddOpen(false), 150)}
          />
          {addOpen ? (
            <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
              {addCandidates.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    disabled={addingId !== null}
                    onClick={() => void handleAddMember(m)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-muted/50",
                      addingId === m.id && "opacity-50"
                    )}
                  >
                    <Avatar className="size-7">
                      <AvatarFallback
                        className={cn(
                          "text-xs font-semibold",
                          avatarColorClassForKey(m.id, m.fullName)
                        )}
                      >
                        {avatarInitialFromName(m.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {m.fullName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {m.email}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {addCandidates.length === 0 ? (
                <li className="px-2 py-3 text-sm text-muted-foreground">
                  {addQuery.trim()
                    ? "No matching workspace member found"
                    : "Everyone in the workspace is already in this group"}
                </li>
              ) : null}
            </ul>
          ) : null}
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
              onRemove={() => void handleRemove(member.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </PanelCardShell>
  );
}
