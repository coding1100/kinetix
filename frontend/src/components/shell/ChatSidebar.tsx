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
import type { Channel, DirectMessage } from "@/lib/types/chat";
import { loadSidebarLists } from "@/lib/chat/sidebar-lists-loader";
import { useHomeQuery } from "@/hooks/use-home-query";
import { HomeDataState } from "@/components/home/HomeDataState";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useChatStore, type ChatFilter } from "@/stores/chat-store";
import { useUiStore } from "@/stores/ui-store";
import { UnderlineTabBar } from "@/components/shared/Tabs";
import { cn } from "@/lib/utils";
import { avatarInitialFromName } from "@/lib/user-display";
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
import { matchesQuery } from "@/lib/search/match-query";
import { useShellStore } from "@/stores/shell-store";
import { useRouter } from "next/navigation";

const FALLBACK_COLORS = [
  "bg-violet-600 text-white",
  "bg-sky-600 text-white",
  "bg-emerald-600 text-white",
  "bg-amber-600 text-white",
  "bg-rose-600 text-white",
];

function fallbackColorForName(name: string) {
  const hash = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

function DmAvatar({
  name,
  avatarUrl,
  presence,
  showPresence = true,
}: {
  name: string;
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
      fallbackClassName={cn("text-[10px] font-semibold", fallbackColorForName(name))}
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
  const { workspaceId, ready } = useWorkspaceApi();

  const initialSidebarData = useMemo(() => {
    if (!ready || sidebarListsCache?.workspaceId !== workspaceId) {
      return null;
    }
    return {
      channels: sidebarListsCache.channels,
      dms: sidebarListsCache.dms,
    };
  }, [ready, workspaceId, sidebarListsCache]);

  const sidebarQuery = useHomeQuery(
    async (token, ws) => {
      const lists = await loadSidebarLists(token, ws, { force: true });
      return { channels: lists.channels, dms: lists.dms };
    },
    [sidebarRefreshKey],
    {
      initialData: initialSidebarData,
      refreshKey: sidebarRefreshKey,
    }
  );

  useEffect(() => {
    const source =
      sidebarListsCache?.workspaceId === workspaceId
        ? sidebarListsCache.dms
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
  }, [
    workspaceId,
    sidebarListsCache,
    sidebarQuery.data?.dms,
    seedPresence,
  ]);

  if (!secondaryPanelOpen) return null;

  const loading = sidebarQuery.loading;
  const error = sidebarQuery.error;
  const workspaceReady = sidebarQuery.ready;

  const channelsSource =
    sidebarListsCache?.workspaceId === workspaceId
      ? sidebarListsCache.channels
      : sidebarQuery.data?.channels;
  const dmsSource =
    sidebarListsCache?.workspaceId === workspaceId
      ? sidebarListsCache.dms
      : sidebarQuery.data?.dms;

  let channels = channelsSource ?? [];
  let dms = dmsSource ?? [];

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
        onAddChannel={goToAllChannels}
      />
    ) : (
      <OrganizedList
        channels={channels}
        dms={dms}
        pathname={pathname}
        onAddChannel={goToAllChannels}
      />
    );

  return (
    <aside className="flex min-h-0 w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-sm font-semibold">Chat</span>
        <div className="flex gap-0.5">
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
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm">
                  <PlusIcon className="size-4" />
                </Button>
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
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSecondaryPanelOpen(false)}
            title="Collapse sidebar"
          >
            <PanelLeftCloseIcon className="size-4" />
          </Button>
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
        <Button
          variant={layout === "organized" ? "secondary" : "ghost"}
          size="icon-sm"
          onClick={() => setLayout("organized")}
          title="Organized"
        >
          <LayoutListIcon className="size-4" />
        </Button>
        <Button
          variant={layout === "recents" ? "secondary" : "ghost"}
          size="icon-sm"
          onClick={() => setLayout("recents")}
          title="Recents"
        >
          <ListIcon className="size-4" />
        </Button>
      </div>
    </aside>
  );
}

function OrganizedList({
  channels,
  dms,
  pathname,
  onAddChannel,
}: {
  channels: Channel[];
  dms: DirectMessage[];
  pathname: string;
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
              href={`/chat/dm/${d.id}`}
              active={pathname === `/chat/dm/${d.id}`}
              name={d.name}
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
  onAddChannel,
}: {
  channels: Channel[];
  dms: DirectMessage[];
  pathname: string;
  onAddChannel: () => void;
}) {
  return (
    <OrganizedList
      channels={channels}
      dms={dms}
      pathname={pathname}
      onAddChannel={onAddChannel}
    />
  );
}

function ChannelRow({
  href,
  active,
  name,
  unread,
  privateChannel,
  starred,
}: {
  href: string;
  active: boolean;
  name: string;
  unread: number;
  privateChannel?: boolean;
  starred?: boolean;
}) {
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
        {unread > 0 && (
          <Badge className="size-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
            {unread}
          </Badge>
        )}
      </span>
    </Button>
  );
}

function DmRow({
  href,
  active,
  name,
  unread,
  avatarUrl,
  otherUserId,
  presenceFallback,
  isGroup,
}: {
  href: string;
  active: boolean;
  name: string;
  unread: number;
  avatarUrl?: string;
  otherUserId?: string;
  presenceFallback?: PresenceStatus;
  isGroup?: boolean;
}) {
  const presence = useUserPresence(
    otherUserId,
    presenceFallback ?? "offline"
  );

  return (
    <Button
      variant="ghost"
      nativeButton={false}
      render={<Link href={href} />}
      className={cn(
        "h-9 w-full justify-between rounded-md px-2 hover:bg-[#eaeaea]",
        active && "bg-[#eaeaea]"
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <DmAvatar
          name={name}
          avatarUrl={avatarUrl}
          presence={presence}
          showPresence={!isGroup}
        />
        <span className="truncate text-sm font-medium">{name}</span>
      </span>
      {unread > 0 ? (
        <Badge className="size-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
          {unread}
        </Badge>
      ) : null}
    </Button>
  );
}
