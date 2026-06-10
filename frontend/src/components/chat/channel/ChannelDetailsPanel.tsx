"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  XIcon,
  PlusIcon,
  SearchIcon,
  BellIcon,
  LinkIcon,
  StarIcon,
  MailIcon,
  LockIcon,
  Share2Icon,
  UsersIcon,
  HashIcon,
  Link2Icon,
  BellOffIcon,
  ChevronRightIcon,
  PaperclipIcon,
  CircleAlertIcon,
  PenLineIcon,
  UserMinusIcon,
} from "lucide-react";
import {
  getChannelById,
  getChannelMeta,
  getChannelThreadReplies,
} from "@/lib/mocks/channel-details";
import {
  removeChannelMember,
  searchChannelMessages as searchChannelMessagesApi,
  updateChannelMemberById,
} from "@/lib/api/chat";
import type { Channel, ChannelMember, ChatSearchHit } from "@/lib/types/chat";
import { ConversationMessageSearch } from "@/components/chat/search/ConversationMessageSearch";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useChannelMembers } from "@/hooks/use-channel-members";
import { useChannelFiles } from "@/hooks/use-channel-files";
import { patchCachedChannelMembers } from "@/lib/chat/channel-members-cache";
import { useAuthStore } from "@/stores/auth-store";
import { AddChannelMembersDialog } from "@/components/chat/modals/AddChannelMembersDialog";
import {
  useChatStore,
  type ChannelDetailsView,
} from "@/stores/chat-store";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserAvatarWithPresence } from "@/components/shared/AvatarWithPresence";
import { useUserPresence } from "@/stores/presence-store";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatRequestError } from "@/lib/api/client";
import { PanelCardShell } from "@/components/shared/PanelCardShell";
import { useUiStore } from "@/stores/ui-store";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { ChannelNameLabel } from "@/components/chat/ChannelNameLabel";
import { useChannelFavorite } from "@/hooks/use-channel-favorite";

const TITLES: Record<ChannelDetailsView, string> = {
  followers: "Followers",
  search: "Search Channel",
  replies: "Replies",
  settings: "Channel settings",
};

function FollowerAvatar({ name, userId }: { name: string; userId: string }) {
  const presence = useUserPresence(userId, "offline");

  return (
    <UserAvatarWithPresence
      name={name}
      presence={presence}
      avatarClassName="size-7"
      dotSize="xs"
      borderClass="border-card"
      fallbackClassName={avatarColorClassForKey(userId, name)}
      fallback={avatarInitialFromName(name)}
    />
  );
}

export function ChannelDetailsPanel({ channelId }: { channelId: string }) {
  const view = useChatStore((s) => s.channelDetailsView);
  const setChannelDetailsView = useChatStore((s) => s.setChannelDetailsView);

  if (!view) return null;

  return (
    <PanelCardShell
      widthClass="w-[340px]"
      marginClassName="box-border flex h-full shrink-0 py-3 pl-2 pr-1"
    >
      <div className="flex h-12 shrink-0 items-center justify-between px-4 pt-1">
        <span className="text-sm font-semibold">{TITLES[view]}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 rounded-full"
          onClick={() => setChannelDetailsView(null)}
          aria-label="Close panel"
        >
          <XIcon className="size-4" strokeWidth={1.5} />
        </Button>
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          {view === "followers" && <FollowersView channelId={channelId} />}
          {view === "search" && <SearchView channelId={channelId} />}
          {view === "replies" && <RepliesView channelId={channelId} />}
          {view === "settings" && <SettingsView channelId={channelId} />}
        </div>
      </ScrollArea>
    </PanelCardShell>
  );
}

function accessPermission(role?: string | null) {
  if (role === "OWNER" || role === "ADMIN") return "admin";
  return "member";
}

function FollowersView({ channelId }: { channelId: string }) {
  const openModal = useUiStore((s) => s.openModal);
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"followers" | "access">("followers");
  const [addOpen, setAddOpen] = useState(false);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    | { type: "remove"; member: ChannelMember }
    | { type: "unfollow"; member: ChannelMember }
    | { type: "follow"; member: ChannelMember }
    | null
  >(null);

  const { members: allMembers, loading: membersLoading, reload } =
    useChannelMembers(channelId);
  const followers = useMemo(
    () => allMembers.filter((m) => m.isFollowing),
    [allMembers]
  );
  const q = query.trim().toLowerCase();
  const matchesQuery = (member: ChannelMember) =>
    !q ||
    member.fullName.toLowerCase().includes(q) ||
    member.email.toLowerCase().includes(q);
  const filteredFollowers = followers.filter(matchesQuery);
  const filteredAccessFollowing = allMembers.filter(
    (u) => u.isFollowing && matchesQuery(u)
  );
  const filteredAccessNotFollowing = allMembers.filter(
    (u) => !u.isFollowing && matchesQuery(u)
  );

  const channelIsPrivate = useChatStore((s) => {
    const fromCache = s.sidebarListsCache?.channels.find(
      (c) => c.id === channelId
    );
    return (
      fromCache?.isPrivate ?? getChannelById(channelId)?.isPrivate ?? false
    );
  });

  const workspaceRole = useAuthStore((s) =>
    s.workspaces.find((w) => w.id === workspaceId)?.role
  );
  const canAddToAccess = channelIsPrivate;
  const canManageMembers =
    workspaceRole === "OWNER" || workspaceRole === "ADMIN";
  const canRemoveMember = (member: ChannelMember) =>
    canManageMembers &&
    member.id !== currentUserId &&
    (channelIsPrivate ? allMembers.length > 1 : member.joinedAt != null);

  useEffect(() => {
    if (!membersLoading && followers.length === 0) {
      setActiveTab("access");
    }
  }, [membersLoading, followers.length]);

  const canChangeFollow = (_member: ChannelMember) => true;

  const setMemberFollowing = async (
    member: ChannelMember,
    following: boolean
  ) => {
    if (!ready) return;
    setMemberActionId(`${following ? "follow" : "unfollow"}:${member.id}`);
    try {
      await updateChannelMemberById(
        accessToken,
        workspaceId,
        channelId,
        member.id,
        { isFollowing: following }
      );
      patchCachedChannelMembers(workspaceId, channelId, (members) => {
        const exists = members.some((m) => m.id === member.id);
        if (!exists) {
          return [...members, { ...member, isFollowing: following }];
        }
        return members.map((m) =>
          m.id === member.id ? { ...m, isFollowing: following } : m
        );
      });
      if (following) {
        toast.success(
          member.id === currentUserId
            ? "You are following this channel"
            : `${member.fullName} added to followers`
        );
      } else {
        toast.success(
          member.id === currentUserId
            ? "You unfollowed this channel"
            : `${member.fullName} removed from followers`
        );
      }
    } catch (err) {
      const detail = formatRequestError(err);
      toast.error(
        following
          ? `Failed to add to followers — ${detail}`
          : `Failed to unfollow — ${detail}`,
        { duration: 8000 }
      );
    } finally {
      setMemberActionId(null);
    }
  };

  const removeMember = async (member: ChannelMember) => {
    if (!ready) return;
    setMemberActionId(`remove:${member.id}`);
    try {
      await removeChannelMember(
        accessToken,
        workspaceId,
        channelId,
        member.id
      );
      toast.success(`${member.fullName} removed from channel`);
      reload();
    } catch {
      toast.error("Failed to remove member");
    } finally {
      setMemberActionId(null);
    }
  };

  const handleConfirmMemberAction = async () => {
    if (!confirmAction) return;
    if (confirmAction.type === "unfollow") {
      await setMemberFollowing(confirmAction.member, false);
    } else if (confirmAction.type === "follow") {
      await setMemberFollowing(confirmAction.member, true);
    } else {
      await removeMember(confirmAction.member);
    }
    setConfirmAction(null);
  };

  const confirmLoading =
    confirmAction?.type === "unfollow"
      ? memberActionId === `unfollow:${confirmAction.member.id}`
      : confirmAction?.type === "follow"
        ? memberActionId === `follow:${confirmAction.member.id}`
        : confirmAction?.type === "remove"
          ? memberActionId === `remove:${confirmAction.member.id}`
          : false;

  return (
    <div className="space-y-3">
      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          v === "followers" || v === "access" ? setActiveTab(v) : undefined
        }
      >
        <div className="flex items-center justify-between gap-2">
          <TabsList variant="line" className="w-auto border-0">
            <TabsTrigger value="followers" className="gap-1 px-2 py-1.5">
              <UsersIcon className="size-3.5" />
              Followers
              <Badge className="h-4 min-w-4 px-1 text-[10px]">
                {followers.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="access" className="gap-1 px-2 py-1.5">
              <LockIcon className="size-3.5" />
              Access
              <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">
                {allMembers.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => openModal("channel-share", channelId)}
          >
            <Share2Icon className="size-3.5" />
            Share
          </Button>
        </div>
      </Tabs>

      <div className="relative">
        <SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Search people or invite by email"
          className="pl-8"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {activeTab === "followers" ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Following
          </p>
          <ul className="space-y-1">
            {membersLoading && (
              <li className="px-2 py-3 text-sm text-muted-foreground">Loading…</li>
            )}
            {!membersLoading && filteredFollowers.length === 0 ? (
              <li className="px-2 py-3 text-sm text-muted-foreground">
                No followers yet. People with access are listed under{" "}
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => setActiveTab("access")}
                >
                  Access
                </button>
                .
              </li>
            ) : null}
            {filteredFollowers.map((f) => (
              <li
                key={f.id}
                className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/50"
              >
                <FollowerAvatar name={f.fullName} userId={f.id} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.fullName}</p>
                </div>
                {canChangeFollow(f) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 gap-1 border-destructive/30 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() =>
                      setConfirmAction({ type: "unfollow", member: f })
                    }
                  >
                    <BellOffIcon className="size-3.5" />
                    Unfollow
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-4">
          {membersLoading && (
            <p className="px-2 py-3 text-sm text-muted-foreground">Loading…</p>
          )}
          {canAddToAccess ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => setAddOpen(true)}
            >
              <PlusIcon className="size-4" />
              Add people to access
            </Button>
          ) : null}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Following
            </p>
            <ul className="space-y-1">
              {filteredAccessFollowing.map((user) => (
                <li
                  key={user.id}
                  className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/50"
                >
                  <FollowerAvatar name={user.fullName} userId={user.id} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{user.fullName}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className="h-5 px-1.5 text-[10px] capitalize"
                  >
                    {accessPermission(user.workspaceRole)}
                  </Badge>
                  {canRemoveMember(user) ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 shrink-0 gap-1 px-2 text-xs"
                        onClick={() =>
                          setConfirmAction({ type: "remove", member: user })
                        }
                      >
                        <UserMinusIcon className="size-3.5" />
                        Remove
                      </Button>
                    ) : null}
                </li>
              ))}
              {!membersLoading && filteredAccessFollowing.length === 0 ? (
                <li className="px-2 py-2 text-sm text-muted-foreground">
                  No one is following yet.
                </li>
              ) : null}
            </ul>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Not following
            </p>
            <ul className="space-y-1">
              {filteredAccessNotFollowing.map((user) => (
                <li
                  key={user.id}
                  className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/50"
                >
                  <FollowerAvatar name={user.fullName} userId={user.id} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{user.fullName}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className="h-5 px-1.5 text-[10px] capitalize"
                  >
                    {accessPermission(user.workspaceRole)}
                  </Badge>
                  {canChangeFollow(user) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 gap-1 px-2 text-xs"
                      onClick={() =>
                        setConfirmAction({ type: "follow", member: user })
                      }
                    >
                      <BellIcon className="size-3.5" />
                      Follow
                    </Button>
                  ) : null}
                  {canRemoveMember(user) ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 shrink-0 gap-1 px-2 text-xs"
                        onClick={() =>
                          setConfirmAction({ type: "remove", member: user })
                        }
                      >
                        <UserMinusIcon className="size-3.5" />
                        Remove
                      </Button>
                    ) : null}
                </li>
              ))}
              {!membersLoading && filteredAccessNotFollowing.length === 0 ? (
                <li className="px-2 py-2 text-sm text-muted-foreground">
                  Everyone with access is following.
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      )}
      <AddChannelMembersDialog
        channelId={channelId}
        open={addOpen}
        onOpenChange={setAddOpen}
        existingMemberIds={allMembers.map((m) => m.id)}
        onAdded={reload}
      />
      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={
          confirmAction?.type === "unfollow"
            ? confirmAction.member.id === currentUserId
              ? "Unfollow this channel?"
              : `Remove ${confirmAction.member.fullName} from followers?`
            : confirmAction?.type === "follow"
              ? confirmAction.member.id === currentUserId
                ? "Follow this channel?"
                : `Add ${confirmAction.member.fullName} to followers?`
              : "Remove from channel?"
        }
        description={
          confirmAction?.type === "unfollow"
            ? confirmAction.member.id === currentUserId
              ? "You will stop following this channel but keep access. You'll appear under Not following in Access."
              : `${confirmAction.member.fullName} will keep channel access but stop following and move to Not following.`
            : confirmAction?.type === "follow"
              ? confirmAction.member.id === currentUserId
                ? "You'll follow this channel and appear in the Followers list."
                : `${confirmAction.member.fullName} will follow this channel and receive updates.`
              : `Remove ${confirmAction?.type === "remove" ? confirmAction.member.fullName : "this member"} from the channel? They will lose access to channel messages.`
        }
        confirmLabel={
          confirmAction?.type === "unfollow"
            ? "Unfollow"
            : confirmAction?.type === "follow"
              ? "Follow"
              : "Remove"
        }
        loading={confirmLoading}
        onConfirm={handleConfirmMemberAction}
      />
    </div>
  );
}

function SearchView({ channelId }: { channelId: string }) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const setChannelDetailsView = useChatStore((s) => s.setChannelDetailsView);
  const setActiveThread = useChatStore((s) => s.setActiveThread);
  const requestMessageScroll = useChatStore((s) => s.requestMessageScroll);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChatSearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (!ready || !term) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      searchChannelMessagesApi(accessToken, workspaceId, channelId, term)
        .then((res) => setResults(res.data))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [accessToken, channelId, query, ready, workspaceId]);

  const handleSelect = (hit: ChatSearchHit) => {
    setChannelDetailsView(null);
    if (hit.inThread && hit.parentId) {
      setActiveThread(hit.parentId);
      return;
    }
    setActiveThread(null);
    requestMessageScroll(hit.id);
  };

  return (
    <ConversationMessageSearch
      placeholder="Search messages in this channel"
      emptyHint="Search keywords or phrases in this channel only."
      query={query}
      onQueryChange={setQuery}
      results={results}
      loading={loading}
      onSelect={handleSelect}
    />
  );
}

function RepliesView({ channelId }: { channelId: string }) {
  const threads = getChannelThreadReplies(channelId);

  if (threads.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No threads with replies in this channel.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {threads.map((t) => (
        <li
          key={t.id}
          className="rounded-lg border border-border px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium">{t.authorName}</span>
            {t.unread && (
              <Badge variant="default" className="h-5 px-1.5 text-[10px]">
                New
              </Badge>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
            {t.preview}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.replyCount}{" "}
            {t.replyCount === 1 ? "reply" : "replies"}{" "}
            · {formatRelativeTime(t.lastAt)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Open from the reply link on the parent message.
          </p>
        </li>
      ))}
    </ul>
  );
}

function SettingsView({ channelId }: { channelId: string }) {
  const openModal = useUiStore((s) => s.openModal);
  const setChannelDetailsView = useChatStore((s) => s.setChannelDetailsView);
  const cachedChannel = useChatStore((s) =>
    s.sidebarListsCache?.channels.find((c: Channel) => c.id === channelId)
  );
  const overrideChannelName = useChatStore(
    (s) => s.channelMetaOverrides[channelId]?.name
  );
  const overrideChannelStarred = useChatStore(
    (s) => s.channelMetaOverrides[channelId]?.starred
  );
  const channel = useMemo(() => {
    const fallback = getChannelById(channelId);
    const base = cachedChannel ?? fallback;
    if (!base && overrideChannelName === undefined && overrideChannelStarred === undefined) {
      return undefined;
    }
    return {
      ...(base ?? { id: channelId, name: "channel" }),
      ...(overrideChannelName !== undefined ? { name: overrideChannelName } : {}),
      ...(overrideChannelStarred !== undefined
        ? { starred: overrideChannelStarred }
        : {}),
    } as Channel;
  }, [cachedChannel, channelId, overrideChannelName, overrideChannelStarred]);
  const meta = getChannelMeta(channelId);
  const { members: settingsMembers } = useChannelMembers(channelId);
  const followers = useMemo(
    () => settingsMembers.filter((m) => m.isFollowing),
    [settingsMembers]
  );
  const { files } = useChannelFiles(channelId);
  const filePreview = files.slice(0, 8);
  const {
    channelFollowing,
    channelNotifications,
    setChannelFollowing,
    setChannelNotifications,
  } = useChatStore();

  const following = channelFollowing[channelId] ?? meta.following;
  const notifications = channelNotifications[channelId] ?? meta.notifications;
  const followerPreview = followers.slice(0, 10);
  const { starred, toggleFavorite } = useChannelFavorite(
    channelId,
    channel?.starred ?? false
  );

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-border bg-card p-3">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
            <HashIcon className="size-6" />
          </span>
          <div>
            <p className="text-[22px] font-semibold leading-none">
              <ChannelNameLabel
                name={channel?.name ?? "channel"}
                starred={starred}
                prefix={false}
                nameClassName="font-semibold"
              />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {channel?.spaceLabel ?? "in Workspace"}
            </p>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 rounded-full px-3"
              onClick={() => openModal("syncup", channelId)}
            >
              <Link2Icon className="size-3.5" />
              SyncUp
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1 rounded-full px-3",
                following && "border-amber-300 bg-amber-50 text-amber-700"
              )}
              onClick={() => {
                setChannelFollowing(channelId, !following);
                toast.success(following ? "Unfollowed channel" : "Following channel");
              }}
            >
              <BellOffIcon className="size-3.5" />
              {following ? "Unfollow" : "Follow"}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-3">
        <Label className="text-xs text-muted-foreground">Topic</Label>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {meta.topic ?? "Add a topic for this channel"}
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Description</Label>
          <CircleAlertIcon className="size-4 text-muted-foreground" />
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {meta.description ?? "Add a short description for this channel"}
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-3">
        <Label className="text-xs text-muted-foreground">
          Followers ({followers.length}/{channel?.memberCount ?? followers.length})
        </Label>
        <div className="relative mt-2">
          <SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Search or add followers" className="h-9 pl-8" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {followerPreview.map((f) => (
            <FollowerAvatar key={f.id} name={f.fullName} userId={f.id} />
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-8 w-full justify-between px-0"
          onClick={() => setChannelDetailsView("followers")}
        >
          View All
          <ChevronRightIcon className="size-4 text-muted-foreground" />
        </Button>
      </section>

      <section className="rounded-xl border border-border bg-card p-3">
        <Label className="text-xs text-muted-foreground">Files ({files.length})</Label>
        <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
          {filePreview.map((file) => (
            <a
              key={file.id}
              href={file.downloadUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="flex h-14 w-[58px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30"
              title={file.fileName}
            >
              {file.mimeType.startsWith("image/") && file.downloadUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={file.downloadUrl}
                  alt={file.fileName}
                  className="size-full object-cover"
                />
              ) : (
                <PaperclipIcon className="size-5 text-muted-foreground" />
              )}
            </a>
          ))}
          {files.length === 0 ? (
            <p className="text-xs text-muted-foreground">No files yet</p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-8 w-full justify-between px-0"
          onClick={() => openModal("channel-files", channelId)}
        >
          View all files
          <ChevronRightIcon className="size-4 text-muted-foreground" />
        </Button>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="px-3 py-2">
          <Label className="text-xs text-muted-foreground">Options</Label>
        </div>
        <OptionRow
          icon={<MailIcon className="size-4" />}
          label="Mark as unread"
          shortcut="U"
          onClick={() => toast.success("Marked as unread")}
        />
        <OptionRow
          icon={<PenLineIcon className="size-4" />}
          label="Rename"
          onClick={() => openModal("rename-channel", channelId)}
        />
        <OptionRow
          icon={<LinkIcon className="size-4" />}
          label="Copy link"
          shortcut="C"
          onClick={() => toast.success("Link copied")}
        />
        <OptionRow
          icon={
            <StarIcon
              className={cn(
                "size-4",
                starred && "fill-amber-400 text-amber-400"
              )}
            />
          }
          label={starred ? "Remove from favorites" : "Favorite"}
          trailing={
            starred ? (
              <StarIcon className="size-4 fill-amber-400 text-amber-400" />
            ) : undefined
          }
          onClick={() => void toggleFavorite()}
        />
        <OptionRow
          icon={<MailIcon className="size-4" />}
          label="Email to Channel"
          onClick={() => toast("Email to channel — Phase 3")}
        />
        <OptionRow
          icon={<BellIcon className="size-4" />}
          label="Notification settings"
          onClick={() => {
            const next = notifications === "all" ? "mentions" : "all";
            setChannelNotifications(channelId, next);
            toast.success(`Notifications: ${next === "all" ? "All messages" : "Mentions only"}`);
          }}
        />
        <OptionRow
          icon={<BellOffIcon className="size-4" />}
          label={following ? "Unfollow" : "Follow"}
          onClick={() => {
            setChannelFollowing(channelId, !following);
            toast.success(following ? "Unfollowed channel" : "Following channel");
          }}
          description={
            following
              ? "Stop following this channel from your sidebar."
              : "Follow this channel to show it in your sidebar."
          }
        />
        <OptionRow
          icon={<Share2Icon className="size-4" />}
          label="Sharing & Permissions"
          onClick={() => openModal("channel-share", channelId)}
        />
      </section>
    </div>
  );
}

function OptionRow({
  icon,
  label,
  onClick,
  shortcut,
  trailing,
  description,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  shortcut?: string;
  trailing?: ReactNode;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-2 border-t border-border px-3 py-2 text-left hover:bg-muted/40"
    >
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
      {shortcut ? (
        <span className="text-xs text-muted-foreground">{shortcut}</span>
      ) : trailing ? (
        <span className="text-muted-foreground">{trailing}</span>
      ) : null}
    </button>
  );
}
