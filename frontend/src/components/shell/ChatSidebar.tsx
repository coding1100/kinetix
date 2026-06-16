"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PlusIcon,
  SearchIcon,
  PanelLeftCloseIcon,
  LayoutListIcon,
  ListIcon,
  HashIcon,
  LockIcon,
  StarIcon,
} from "lucide-react";
import type { Channel, DirectMessage, DmParticipant } from "@/lib/types/chat";
import { GroupDmAvatarStack } from "@/components/chat/GroupDmAvatarStack";
import {
  enrichGroupDms,
  otherGroupParticipants,
  resolveGroupDmTitle,
} from "@/lib/chat/group-dm-display";
import { fetchWorkspaceMembers } from "@/lib/api/chat";
import {
  loadSidebarLists,
  mergeSidebarChannels,
  mergeSidebarDms,
} from "@/lib/chat/sidebar-lists-loader";
import { useHomeQuery } from "@/hooks/use-home-query";
import { HomeDataState } from "@/components/home/HomeDataState";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useAuthStore } from "@/stores/auth-store";
import {
  isSidebarCacheForSession,
  useChatStore,
  type ChatFilter,
} from "@/stores/chat-store";
import { useUiStore } from "@/stores/ui-store";
import { UnderlineTabBar } from "@/components/shared/Tabs";
import { cn } from "@/lib/utils";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatarWithPresence } from "@/components/shared/AvatarWithPresence";
import { usePresenceStore, useUserPresence } from "@/stores/presence-store";
import { type PresenceStatus } from "@/stores/profile-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { matchesQuery } from "@/lib/search/match-query";
import { useSidebarUnread } from "@/lib/chat/sidebar-display-unread";
import { useShellStore } from "@/stores/shell-store";
import { useRouter } from "next/navigation";

function DmAvatar({
  name,
  userId,
  avatarUrl,
  presence,
  showPresence = true,
}: {
  name: string;
  userId?: string;
  avatarUrl?: string;
  presence: PresenceStatus;
  showPresence?: boolean;
}) {
  return (
    <UserAvatarWithPresence
      name={name}
      avatarUrl={avatarUrl}
      presence={presence}
      showPresence={showPresence}
      avatarClassName="size-6"
      dotSize="sm"
      borderClass="border-white"
      fallbackClassName={cn(
        "text-[10px] font-semibold",
        avatarColorClassForKey(userId, name)
      )}
      fallback={avatarInitialFromName(name)}
    />
  );
}

const FILTERS: { id: ChatFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "dms", label: "DMs" },
  { id: "channels", label: "Channels" },
];

export function ChatSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [listSearchOpen, setListSearchOpen] = useState(false);
  const [listQuery, setListQuery] = useState("");
  const { filter, layout, setFilter, setLayout } = useChatStore();
  const sidebarRefreshKey = useChatStore((s) => s.sidebarRefreshKey);
  const sidebarListsCache = useChatStore((s) => s.sidebarListsCache);
  const setSidebarListsCache = useChatStore((s) => s.setSidebarListsCache);
  const openModal = useUiStore((s) => s.openModal);
  const { secondaryPanelOpen, setSecondaryPanelOpen } = useShellStore();
  const seedPresence = usePresenceStore((s) => s.seedPresence);
  const userId = useAuthStore((s) => s.user?.id);
  const { workspaceId, ready } = useWorkspaceApi();

  const cacheValid = isSidebarCacheForSession(
    sidebarListsCache,
    userId,
    workspaceId
  );

  const initialSidebarData = useMemo(() => {
    if (!ready || !cacheValid || !sidebarListsCache) {
      return null;
    }
    return {
      channels: sidebarListsCache.channels,
      dms: sidebarListsCache.dms,
    };
  }, [ready, cacheValid, sidebarListsCache]);

  const sidebarQuery = useHomeQuery(
    async (token, ws) => {
      const lists = await loadSidebarLists(token, ws, {
        force: sidebarRefreshKey > 0,
      });
      return { channels: lists.channels, dms: lists.dms };
    },
    [sidebarRefreshKey],
    {
      initialData: initialSidebarData,
      refreshKey: sidebarRefreshKey,
      skipInitialFetch: Boolean(initialSidebarData) && sidebarRefreshKey === 0,
    }
  );

  const membersQuery = useHomeQuery(
    (token, ws) => fetchWorkspaceMembers(token, ws).then((r) => r.data),
    []
  );

  useEffect(() => {
    const source = cacheValid
      ? sidebarListsCache?.dms
      : sidebarQuery.data?.dms;
    if (!source?.length) return;
    seedPresence(
      source
        .filter((d) => d.otherUserId && d.presence)
        .map((d) => ({
          userId: d.otherUserId!,
          status: d.presence!,
        }))
    );
  }, [cacheValid, sidebarListsCache, sidebarQuery.data?.dms, seedPresence]);

  if (!secondaryPanelOpen) return null;

  const loading = cacheValid ? false : sidebarQuery.loading;
  const error = sidebarQuery.error;
  const workspaceReady = sidebarQuery.ready;

  const channelsSource = mergeSidebarChannels(
    sidebarQuery.data?.channels,
    cacheValid ? sidebarListsCache?.channels : undefined
  );
  const dmsSource = mergeSidebarDms(
    sidebarQuery.data?.dms,
    cacheValid ? sidebarListsCache?.dms : undefined
  );

  let channels = channelsSource;
  let dms = enrichGroupDms(
    dmsSource,
    membersQuery.data ?? [],
    userId
  );

  if (filter === "unread") {
    channels = channels.filter((c) => c.unread > 0);
    dms = dms.filter((d) => d.unread > 0);
  } else if (filter === "dms") {
    channels = [];
  } else if (filter === "channels") {
    dms = [];
  }

  const listSearchTerm = listQuery.trim();
  if (listSearchTerm) {
    channels = channels.filter((c) =>
      matchesQuery(listSearchTerm, c.name, c.topic, c.lastMessage)
    );
    dms = dms.filter((d) =>
      matchesQuery(listSearchTerm, d.name, d.lastMessage)
    );
  }

  const goToAllChannels = () => router.push("/chat/channels");

  const content =
    layout === "recents" ? (
      <RecentsList
        channels={channels}
        dms={dms}
        pathname={pathname}
        currentUserId={userId}
        onAddChannel={goToAllChannels}
      />
    ) : (
      <OrganizedList
        channels={channels}
        dms={dms}
        pathname={pathname}
        currentUserId={userId}
        onAddChannel={goToAllChannels}
      />
    );

  return (
    <aside className="flex min-h-0 w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-sm font-semibold">Chat</span>
        <div className="flex gap-0.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant={listSearchOpen ? "secondary" : "ghost"}
                  size="icon-sm"
                  aria-label="Search channels and DMs"
                  aria-pressed={listSearchOpen}
                  onClick={() => {
                    setListSearchOpen((open) => {
                      const next = !open;
                      if (!next) setListQuery("");
                      return next;
                    });
                  }}
                >
                  <SearchIcon className="size-4" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Search</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button variant="ghost" size="icon-sm" aria-label="Create chat">
                        <PlusIcon className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom">Create</TooltipContent>
                </Tooltip>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openModal("new-channel")}>
                New channel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openModal("new-dm")}>
                New DM
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Collapse sidebar"
                  onClick={() => setSecondaryPanelOpen(false)}
                >
                  <PanelLeftCloseIcon className="size-4" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Collapse sidebar</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {listSearchOpen ? (
        <div className="px-3 pb-2">
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-8 text-sm"
              placeholder="Filter channels and DMs"
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              autoFocus
              aria-label="Filter chat list"
            />
          </div>
        </div>
      ) : null}
      <UnderlineTabBar
        className="px-3"
        size="compact"
        tabs={FILTERS.map((f) => ({ id: f.id, label: f.label }))}
        active={filter}
        onChange={setFilter}
      />
      <ScrollArea className="min-h-0 flex-1 px-2 py-4">
        <HomeDataState
          loading={loading}
          error={error}
          empty={
            workspaceReady &&
            !loading &&
            !error &&
            channels.length === 0 &&
            dms.length === 0
          }
          emptyMessage={
            listSearchTerm
              ? `No channels or DMs match "${listSearchTerm}".`
              : "No channels or DMs yet. Create a channel or start a DM."
          }
        >
          {content}
        </HomeDataState>
      </ScrollArea>
      <Separator />
      <div className="hidden">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={layout === "organized" ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setLayout("organized")}
                aria-label="Organized"
              >
                <LayoutListIcon className="size-4" />
              </Button>
            }
          />
          <TooltipContent side="top">Organized</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={layout === "recents" ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setLayout("recents")}
                aria-label="Recents"
              >
                <ListIcon className="size-4" />
              </Button>
            }
          />
          <TooltipContent side="top">Recents</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}

function OrganizedList({
  channels,
  dms,
  pathname,
  currentUserId,
  onAddChannel,
}: {
  channels: Channel[];
  dms: DirectMessage[];
  pathname: string;
  currentUserId?: string | null;
  onAddChannel: () => void;
}) {
  const favoriteChannels = channels.filter((c) => c.starred);
  const otherChannels = channels.filter((c) => !c.starred);

  return (
    <div className="space-y-4 pb-4">
      {favoriteChannels.length > 0 ? (
        <div>
          <p className="mb-1 px-2 text-xs font-semibold text-muted-foreground uppercase">
            Favorites
          </p>
          <div className="space-y-0.5">
            {favoriteChannels.map((c) => (
              <ChannelRow
                key={c.id}
                channelId={c.id}
                href={`/chat/c/${c.id}`}
                active={pathname === `/chat/c/${c.id}`}
                name={c.name}
                unread={c.unread}
                privateChannel={c.isPrivate}
                starred
              />
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-1 px-2 text-xs font-semibold text-muted-foreground uppercase">
          Channels
        </p>
        <div className="space-y-0.5">
          {otherChannels.map((c) => (
            <ChannelRow
              key={c.id}
              channelId={c.id}
              href={`/chat/c/${c.id}`}
              active={pathname === `/chat/c/${c.id}`}
              name={c.name}
              unread={c.unread}
              privateChannel={c.isPrivate}
            />
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full justify-start gap-2 px-2 text-muted-foreground"
            onClick={onAddChannel}
          >
            <PlusIcon className="size-3.5" />
            Add Channel
          </Button>
        </div>
      </div>

      <div>
        <p className="mb-1 px-2 text-xs font-semibold text-muted-foreground uppercase">
          Direct Messages
        </p>
        <div className="space-y-0.5">
          {dms.map((d) => (
            <DmRow
              key={d.id}
              dmId={d.id}
              href={`/chat/dm/${d.id}`}
              active={pathname === `/chat/dm/${d.id}`}
              name={d.name}
              participants={d.participants}
              currentUserId={currentUserId}
              unread={d.unread}
              avatarUrl={d.avatarUrl}
              otherUserId={d.otherUserId}
              presenceFallback={d.presence}
              isGroup={d.isGroup}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RecentsList({
  channels,
  dms,
  pathname,
  currentUserId,
  onAddChannel,
}: {
  channels: Channel[];
  dms: DirectMessage[];
  pathname: string;
  currentUserId?: string | null;
  onAddChannel: () => void;
}) {
  return (
    <OrganizedList
      channels={channels}
      dms={dms}
      pathname={pathname}
      currentUserId={currentUserId}
      onAddChannel={onAddChannel}
    />
  );
}

function ChannelRow({
  channelId,
  href,
  active,
  name,
  unread,
  privateChannel,
  starred,
}: {
  channelId: string;
  href: string;
  active: boolean;
  name: string;
  unread: number;
  privateChannel?: boolean;
  starred?: boolean;
}) {
  const unreadBadgeHold = useChatStore((s) => s.unreadBadgeHold);
  const displayUnread = useSidebarUnread(
    "channel",
    channelId,
    unread,
    active,
    unreadBadgeHold
  );

  return (
    <Button
      variant="ghost"
      nativeButton={false}
      render={<Link href={href} />}
      className={cn(
        "h-8 w-full justify-between rounded-md px-2",
        active && "bg-sidebar-accent"
      )}
    >
      <span className="flex min-w-0 items-center gap-2 text-sm">
        <HashIcon className="size-3.5 shrink-0 text-muted-foreground" />
        {starred ? (
          <StarIcon className="size-3 shrink-0 fill-amber-400 text-amber-400" />
        ) : null}
        <span className="truncate font-medium">{name}</span>
        {privateChannel ? <LockIcon className="size-3 text-muted-foreground" /> : null}
      </span>
      <span className="flex items-center gap-1">
        {displayUnread > 0 && (
          <Badge className="size-5 min-w-5 justify-center rounded-full px-1 text-[10px] transition-opacity duration-300">
            {displayUnread}
          </Badge>
        )}
      </span>
    </Button>
  );
}

function DmRow({
  dmId,
  href,
  active,
  name,
  participants,
  currentUserId,
  unread,
  avatarUrl,
  otherUserId,
  presenceFallback,
  isGroup,
}: {
  dmId: string;
  href: string;
  active: boolean;
  name: string;
  participants?: DmParticipant[];
  currentUserId?: string | null;
  unread: number;
  avatarUrl?: string;
  otherUserId?: string;
  presenceFallback?: PresenceStatus;
  isGroup?: boolean;
}) {
  const unreadBadgeHold = useChatStore((s) => s.unreadBadgeHold);
  const displayUnread = useSidebarUnread(
    "dm",
    dmId,
    unread,
    active,
    unreadBadgeHold
  );
  const presence = useUserPresence(
    otherUserId,
    presenceFallback ?? "offline"
  );
  const groupParticipants = isGroup
    ? otherGroupParticipants(participants, currentUserId)
    : [];
  const displayName = isGroup
    ? resolveGroupDmTitle({ name, isGroup: true, participants }, currentUserId)
    : name;

  return (
    <Button
      variant="ghost"
      nativeButton={false}
      render={<Link href={href} />}
      className={cn(
        "h-9 w-full justify-between rounded-md px-2",
        active && "bg-sidebar-accent text-sidebar-accent-foreground"
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {isGroup && groupParticipants.length > 0 ? (
          <GroupDmAvatarStack participants={groupParticipants} />
        ) : (
          <DmAvatar
            name={displayName}
            userId={otherUserId}
            avatarUrl={avatarUrl}
            presence={presence}
            showPresence={!isGroup}
          />
        )}
        <span className="truncate text-sm font-medium">{displayName}</span>
      </span>
      {displayUnread > 0 ? (
        <Badge className="size-5 min-w-5 justify-center rounded-full px-1 text-[10px] transition-opacity duration-300">
          {displayUnread}
        </Badge>
      ) : null}
    </Button>
  );
}
