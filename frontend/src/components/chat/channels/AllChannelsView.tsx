"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HashIcon, LockIcon, SearchIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUiStore } from "@/stores/ui-store";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { updateChannelMember } from "@/lib/api/chat";
import { loadSidebarLists } from "@/lib/chat/sidebar-lists-loader";
import { HomeDataState } from "@/components/home/HomeDataState";
import type { Channel } from "@/lib/types/chat";
import { cn, formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";

export function AllChannelsView() {
  const openModal = useUiStore((s) => s.openModal);
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [query, setQuery] = useState("");
  const [followingOverrides, setFollowingOverrides] = useState<
    Record<string, boolean>
  >({});

  const channelsQuery = useHomeQuery(
    (token, ws) => loadSidebarLists(token, ws).then((r) => r.channels),
    []
  );

  const channels = channelsQuery.data ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.spaceLabel?.toLowerCase().includes(q) ||
        c.topic?.toLowerCase().includes(q)
    );
  }, [channels, query]);

  const isFollowing = (channel: Channel) =>
    followingOverrides[channel.id] ?? channel.isFollowing ?? false;

  const toggleFollow = async (channel: Channel) => {
    if (!ready) return;
    const next = !isFollowing(channel);
    setFollowingOverrides((prev) => ({ ...prev, [channel.id]: next }));
    try {
      await updateChannelMember(accessToken, workspaceId, channel.id, {
        isFollowing: next,
      });
    } catch {
      setFollowingOverrides((prev) => ({ ...prev, [channel.id]: !next }));
      toast.error("Failed to update follow status");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <PageHeader title="All Channels">
        <Button onClick={() => openModal("new-channel")}>Create Channel</Button>
      </PageHeader>

      <div className="border-b px-6 py-3">
        <div className="relative max-w-xl">
          <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for Channels"
            className="h-9 pl-9 focus-visible:ring-[0.5px]"
          />
        </div>
      </div>

      <HomeDataState
        loading={channelsQuery.loading}
        error={channelsQuery.error}
        empty={filtered.length === 0 && !channelsQuery.loading}
      >
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-6 py-2.5 font-medium">Channels and Spaces</th>
                <th className="px-4 py-2.5 font-medium">Topic</th>
                <th className="px-4 py-2.5 font-medium">Followers</th>
                <th className="px-4 py-2.5 font-medium">Last updated</th>
                <th className="px-6 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((channel) => {
                const following = isFollowing(channel);
                return (
                  <tr
                    key={channel.id}
                    className="border-b border-border/80 hover:bg-muted/30"
                  >
                    <td className="px-6 py-3">
                      <ChannelNameCell channel={channel} />
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                      {channel.topic ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {channel.memberCount}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatRelativeTime(new Date(channel.lastAt))}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-w-[88px]"
                        onClick={() => toggleFollow(channel)}
                      >
                        {following ? "Following" : "Follow"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-muted-foreground"
                  >
                    No channels match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </HomeDataState>
    </div>
  );
}

function ChannelNameCell({ channel }: { channel: Channel }) {
  return (
    <Link
      href={`/chat/c/${channel.id}`}
      className="group flex min-w-0 items-start gap-2.5"
    >
      {channel.customIconColor ? (
        <span
          className={cn(
            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white",
            channel.customIconColor
          )}
        >
          {channel.name.slice(0, 1).toUpperCase()}
        </span>
      ) : (
        <HashIcon className="mt-1 size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
      )}
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-medium text-foreground group-hover:text-primary">
            {channel.name}
          </span>
          {channel.isPrivate ? (
            <LockIcon className="size-3 shrink-0 text-muted-foreground" />
          ) : null}
        </span>
        {channel.spaceLabel ? (
          <span className="block truncate text-xs text-muted-foreground">
            {channel.spaceLabel}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
