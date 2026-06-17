"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";
import type { ConversationType } from "@/lib/types/chat";
import type { MentionSelection } from "@/lib/chat/mention-types";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useMentionMembers } from "@/hooks/use-mention-members";
import { useMentionChannels } from "@/hooks/use-mention-channels";
import {
  filterMentionChannels,
  filterMentionMembers,
} from "@/lib/chat/mention-utils";
import { MentionMemberList } from "./MentionMemberList";
import { MentionChannelList } from "./MentionChannelList";

type MentionTab = "people" | "channels";

function MentionTabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
      {active ? (
        <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />
      ) : null}
    </button>
  );
}

export function MentionPickerContent({
  conversationType,
  conversationId,
  members: membersProp,
  query = "",
  onSelect,
  showSearch = true,
}: {
  conversationType?: ConversationType;
  conversationId?: string;
  members?: import("@/hooks/use-mention-members").MentionMember[];
  query?: string;
  onSelect: (selection: MentionSelection) => void;
  showSearch?: boolean;
}) {
  const [tab, setTab] = useState<MentionTab>("people");
  const [search, setSearch] = useState("");
  const activeQuery = showSearch ? search : query;

  const { members: hookMembers, loading: hookLoading } = useMentionMembers(
    membersProp ? undefined : conversationType,
    membersProp ? undefined : conversationId
  );
  const members = membersProp ?? hookMembers;
  const membersLoading = membersProp ? false : hookLoading;
  const { channels, loading: channelsLoading } = useMentionChannels();

  const filteredMembers = useMemo(
    () => filterMentionMembers(members, activeQuery).slice(0, 12),
    [members, activeQuery]
  );

  const filteredChannels = useMemo(
    () => filterMentionChannels(channels, activeQuery).slice(0, 12),
    [channels, activeQuery]
  );

  return (
    <div className="flex w-full flex-col bg-card text-foreground">
      {showSearch ? (
        <div className="border-b border-border p-2">
          <div className="relative">
            <SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people or channels"
              className="h-9 bg-background pl-8"
              autoFocus
            />
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-1 border-b border-border px-1">
        <MentionTabButton
          active={tab === "people"}
          onClick={() => setTab("people")}
        >
          People
        </MentionTabButton>
        <MentionTabButton
          active={tab === "channels"}
          onClick={() => setTab("channels")}
        >
          Channels
        </MentionTabButton>
      </div>

      <div className="w-full bg-card">
        {tab === "people" ? (
          <MentionMemberList
            members={filteredMembers}
            loading={membersLoading}
            onSelect={(member) =>
              onSelect({
                mentionType: "person",
                id: member.id,
                label: member.fullName,
              })
            }
            emptyLabel="No matching people"
          />
        ) : (
          <MentionChannelList
            channels={filteredChannels}
            loading={channelsLoading}
            onSelect={(channel) =>
              onSelect({
                mentionType: "channel",
                id: channel.id,
                label: channel.name,
              })
            }
            emptyLabel="No matching channels"
          />
        )}
      </div>
    </div>
  );
}
