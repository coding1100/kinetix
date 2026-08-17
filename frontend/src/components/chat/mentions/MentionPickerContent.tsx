"use client";

import { useEffect, useMemo, useState } from "react";
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
  filterSpecialMentions,
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
  peopleOnly = false,
}: {
  conversationType?: ConversationType;
  conversationId?: string;
  members?: import("@/hooks/use-mention-members").MentionMember[];
  query?: string;
  onSelect: (selection: MentionSelection) => void;
  showSearch?: boolean;
  /** Task comments only ever mention people - hides the People/Channels tabs
   * and skips fetching channels entirely. */
  peopleOnly?: boolean;
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
  const { channels, loading: channelsLoading } = useMentionChannels(peopleOnly);

  const isChannel = conversationType === "channel";

  const filteredMembers = useMemo(() => {
    const matchedMembers = filterMentionMembers(members, activeQuery);
    if (!isChannel || peopleOnly) return matchedMembers.slice(0, 12);
    const matchedSpecials = filterSpecialMentions(activeQuery).map((s) => ({
      id: s.id,
      fullName: s.label,
      email: s.description,
    }));
    return [...matchedSpecials, ...matchedMembers].slice(0, 12);
  }, [members, activeQuery, isChannel, peopleOnly]);

  const filteredChannels = useMemo(
    () => filterMentionChannels(channels, activeQuery).slice(0, 12),
    [channels, activeQuery]
  );

  const activeTab = peopleOnly ? "people" : tab;
  const activeListLength =
    activeTab === "people" ? filteredMembers.length : filteredChannels.length;

  const [activeIndex, setActiveIndex] = useState(0);

  // Reset the highlighted row whenever the visible list changes shape (query
  // typed, tab switched) so it never points past the end or lingers on a row
  // that's no longer first - adjusted during render rather than an effect
  // (react.dev "you might not need an effect": derived state on prop change).
  const resetKey = `${activeTab}:${activeQuery}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setActiveIndex(0);
  }

  // Arrow keys/Enter should navigate the list even though focus stays in the
  // message editor - a capture-phase document listener intercepts them
  // before the editor's own keydown handling (Enter-to-send, cursor moves).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (activeListLength === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((i) => (i + 1) % activeListLength);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((i) => (i - 1 + activeListLength) % activeListLength);
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (activeTab === "people") {
          const member = filteredMembers[activeIndex];
          if (member) {
            onSelect({ mentionType: "person", id: member.id, label: member.fullName });
          }
        } else {
          const channel = filteredChannels[activeIndex];
          if (channel) {
            onSelect({ mentionType: "channel", id: channel.id, label: channel.name });
          }
        }
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [activeListLength, activeIndex, activeTab, filteredMembers, filteredChannels, onSelect]);

  return (
    <div className="flex w-full flex-col bg-card text-foreground">
      {showSearch ? (
        <div className="border-b border-border p-2">
          <div className="relative">
            <SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={peopleOnly ? "Search people" : "Search people or channels"}
              className="h-9 bg-background pl-8"
              autoFocus
            />
          </div>
        </div>
      ) : null}

      {!peopleOnly ? (
        <div className="flex items-center gap-1 border-b border-border px-1">
          <MentionTabButton
            active={activeTab === "people"}
            onClick={() => setTab("people")}
          >
            People
          </MentionTabButton>
          <MentionTabButton
            active={activeTab === "channels"}
            onClick={() => setTab("channels")}
          >
            Channels
          </MentionTabButton>
        </div>
      ) : (
        <p className="px-3 pt-2.5 pb-1 text-xs font-medium text-muted-foreground">
          People
        </p>
      )}

      <div className="w-full bg-card">
        {activeTab === "people" ? (
          <MentionMemberList
            members={filteredMembers}
            loading={membersLoading}
            compact={peopleOnly}
            activeIndex={activeIndex}
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
            activeIndex={activeIndex}
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
