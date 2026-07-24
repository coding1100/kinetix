"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  PlusIcon,
  SearchIcon,
  FilterIcon,
  Settings2Icon,
  PanelLeftCloseIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FolderPlusIcon,
  HashIcon,
  ListIcon,
  ListPlusIcon,
  LockIcon,
  MessagesSquareIcon,
  ListChecksIcon,
  FolderIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Share2Icon,
  Trash2Icon,
} from "lucide-react";
import type { DmParticipant } from "@/lib/types/chat";
import {
  otherGroupParticipants,
  resolveGroupDmTitle,
} from "@/lib/chat/group-dm-display";
import { GroupDmAvatarStack } from "@/components/chat/GroupDmAvatarStack";
import { useUserPresence } from "@/stores/presence-store";
import { type PresenceStatus } from "@/stores/profile-store";
import {
  useHomeSidebarStore,
  toSidebarConfig,
  MY_TASKS_LINKS,
  type SidebarItem,
} from "@/stores/home-sidebar-store";
import { useUiStore } from "@/stores/ui-store";
import { useSpacesStore } from "@/stores/spaces-store";
import { useAuthStore, selectActiveWorkspace } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "sonner";
import { useShellStore } from "@/stores/shell-store";
import { SidebarNavIcon } from "@/components/icons/SidebarNavIcon";
import { useNotificationsUnread } from "@/hooks/use-notifications-unread";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import {
  fetchHomeSidebarConfig,
  updateHomeSidebarConfig,
} from "@/lib/api/home";
import {
  deleteFolder,
  deleteList,
  deleteSpace,
  fetchSpacesTree,
  type ShareResourceType,
} from "@/lib/api/spaces";
import { formatRequestError } from "@/lib/api/client";
import { fetchSharedWithMe } from "@/lib/api/home";
import { ShareModal } from "@/components/shared/ShareModal";
import {
  loadSidebarLists,
  mergeSidebarChannels,
  mergeSidebarDms,
} from "@/lib/chat/sidebar-lists-loader";
import { isSidebarCacheForSession, useChatStore } from "@/stores/chat-store";
import { useSidebarUnread } from "@/lib/chat/sidebar-display-unread";
import { UserAvatarWithPresence } from "@/components/shared/AvatarWithPresence";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import {
  SpacesHierarchyDialog,
  type HierarchyDialogMode,
} from "@/components/spaces/SpacesHierarchyDialog";

const navItemClass =
  "flex w-full min-w-0 items-center gap-2 rounded-md px-2.5 text-left text-sm font-medium text-sidebar-foreground transition-colors duration-150 hover:bg-sidebar-accent/80";

const navItemActiveClass =
  "bg-sidebar-accent font-medium text-sidebar-accent-foreground";

// Guests / limited members don't get a Spaces tree or create affordances in
// real ClickUp - they only see whatever's been individually shared with them.
function isRestrictedRole(role: string | undefined) {
  return role === "GUEST" || role === "LIMITED_MEMBER";
}

function formatUnreadCount(count: number) {
  if (count > 99) return "99+";
  return String(count);
}

function SectionLabel({
  label,
  collapsed,
  onToggleCollapsed,
  onAdd,
  addLabel,
}: {
  label: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <div className="mb-0.5 flex items-center justify-between px-1">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-0.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase transition-colors hover:bg-sidebar-accent/60"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
      >
        {collapsed ? (
          <ChevronRightIcon className="size-3 shrink-0" />
        ) : (
          <ChevronDownIcon className="size-3 shrink-0" />
        )}
        {label}
      </button>
      {onAdd ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="size-5 shrink-0 text-muted-foreground"
                aria-label={addLabel}
                onClick={onAdd}
              >
                <PlusIcon className="size-3.5" />
              </Button>
            }
          />
          <TooltipContent side="bottom">{addLabel}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

function HomeNavItem({
  item,
  active,
  unreadCount,
  expandable,
  expanded,
  onToggleExpand,
}: {
  item: SidebarItem;
  active: boolean;
  unreadCount?: number;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  return (
    <div
      className={cn(
        navItemClass,
        "h-8",
        active && navItemActiveClass
      )}
    >
      {expandable ? (
        <button
          type="button"
          className="flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
          aria-label={expanded ? "Collapse" : "Expand"}
          onClick={onToggleExpand}
        >
          {expanded ? (
            <ChevronDownIcon className="size-3.5" />
          ) : (
            <ChevronRightIcon className="size-3.5" />
          )}
        </button>
      ) : null}
      <Link href={item.href} className="flex min-w-0 flex-1 items-center gap-2">
        <SidebarNavIcon itemId={item.id} active={active} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.id === "inbox" && unreadCount && unreadCount > 0 ? (
          <Badge
            variant="default"
            className="h-4 min-w-4 shrink-0 rounded-full px-1 text-[10px] font-semibold leading-none"
          >
            {formatUnreadCount(unreadCount)}
          </Badge>
        ) : null}
      </Link>
    </div>
  );
}

function MyTasksSubNav({ pathname }: { pathname: string }) {
  return (
    <ul className="relative mb-1 ml-[18px] space-y-px border-l border-sidebar-border/60 py-0.5 pl-3">
      {MY_TASKS_LINKS.map((link) => {
        const subActive = pathname === link.href;
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              className={cn(
                navItemClass,
                "h-7 text-[13px] font-normal text-muted-foreground",
                subActive &&
                  "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
              )}
            >
              <SidebarNavIcon
                itemId="my-tasks"
                href={link.href}
                active={subActive}
                size="sm"
              />
              <span className="truncate">{link.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SpaceListLink({
  listId,
  name,
  taskCount,
  active,
  isPrivate,
  isPersonal,
  canShare,
  onShare,
  onRename,
  onDelete,
}: {
  listId: string;
  name: string;
  taskCount?: number;
  active: boolean;
  isPrivate?: boolean;
  isPersonal?: boolean;
  canShare?: boolean;
  onShare?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  const canDelete = Boolean(onDelete) && !isPersonal;
  const hasMenu = Boolean(onRename) || canDelete || (Boolean(canShare) && Boolean(onShare));
  return (
    <div className="group/list flex items-center gap-0.5">
      <Link
        href={`/home/l/${listId}`}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent/80",
          active
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            : "text-sidebar-foreground"
        )}
      >
        <ListChecksIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {isPrivate ? <LockIcon className="size-3 shrink-0 text-muted-foreground" /> : null}
        {typeof taskCount === "number" ? (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {taskCount}
          </span>
        ) : null}
      </Link>
      {hasMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="size-5 shrink-0 text-muted-foreground opacity-0 group-hover/list:opacity-100 data-[popup-open]:opacity-100"
                aria-label={`Actions for ${name}`}
              >
                <MoreHorizontalIcon className="size-3.5" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {onRename ? (
              <DropdownMenuItem onClick={onRename}>
                <PencilIcon className="size-4" />
                Rename
              </DropdownMenuItem>
            ) : null}
            {canShare && onShare ? (
              <DropdownMenuItem onClick={onShare}>
                <Share2Icon className="size-4" />
                Share
              </DropdownMenuItem>
            ) : null}
            {canDelete ? (
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2Icon className="size-4" />
                Delete list
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

type SpacesTreeMutationTarget = {
  type: "space" | "folder" | "list";
  id: string;
  name: string;
  isPersonal?: boolean;
};

function SpaceRow({
  space,
  expanded,
  onToggleExpanded,
  onAddFolder,
  onAddList,
  onAddListToFolder,
  onRename,
  onDelete,
  onShare,
  pathname,
}: {
  space: {
    id: string;
    name: string;
    color: string;
    description?: string;
    canShare?: boolean;
    canManageStructure?: boolean;
    isPrivate?: boolean;
    isPersonal?: boolean;
    folders?: {
      id: string;
      name: string;
      canShare?: boolean;
      canManageStructure?: boolean;
      isPrivate?: boolean;
      lists: {
        id: string;
        name: string;
        taskCount: number;
        canShare?: boolean;
        canManageStructure?: boolean;
        isPrivate?: boolean;
      }[];
    }[];
    standaloneLists?: {
      id: string;
      name: string;
      taskCount: number;
      canShare?: boolean;
      canManageStructure?: boolean;
      isPrivate?: boolean;
    }[];
  };
  expanded: boolean;
  onToggleExpanded: () => void;
  onAddFolder: () => void;
  onAddList: () => void;
  onAddListToFolder: (folderId: string) => void;
  onRename: (target: SpacesTreeMutationTarget) => void;
  onDelete: (target: SpacesTreeMutationTarget) => void;
  onShare: (target: { type: ShareResourceType; id: string; name: string }) => void;
  pathname: string;
}) {
  const hasChildren =
    (space.folders?.length ?? 0) > 0 || (space.standaloneLists?.length ?? 0) > 0;

  return (
    <div>
      <div className="group/space flex items-center gap-1 rounded-md pr-1 transition-colors hover:bg-sidebar-accent/80">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm text-sidebar-foreground"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
        >
          <span className="relative grid size-5 shrink-0 place-items-center">
            <span
              className={cn(
                "absolute inset-0 grid place-items-center rounded text-[10px] font-bold text-white transition-opacity",
                "group-hover/space:opacity-0"
              )}
              style={{ backgroundColor: space.color }}
              aria-hidden
            >
              {space.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="absolute inset-0 grid place-items-center rounded text-muted-foreground opacity-0 transition-opacity group-hover/space:opacity-100">
              {expanded ? (
                <ChevronDownIcon className="size-3.5" />
              ) : (
                <ChevronRightIcon className="size-3.5" />
              )}
            </span>
          </span>
          <span className="min-w-0 flex-1 truncate">{space.name}</span>
          {space.isPrivate ? (
            <LockIcon className="size-3 shrink-0 text-muted-foreground" />
          ) : null}
          {space.description ? (
            <span className="shrink-0 truncate text-xs text-muted-foreground">
              {space.description}
            </span>
          ) : null}
        </button>
        {space.canManageStructure || space.canShare ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="size-5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/space:opacity-100 data-[popup-open]:opacity-100"
                  aria-label={`Actions for ${space.name}`}
                >
                  <MoreHorizontalIcon className="size-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {space.canManageStructure ? (
                <>
                  <DropdownMenuItem onClick={onAddFolder}>
                    <FolderPlusIcon className="size-4" />
                    New folder
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onAddList}>
                    <ListPlusIcon className="size-4" />
                    New list
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      onRename({ type: "space", id: space.id, name: space.name })
                    }
                  >
                    <PencilIcon className="size-4" />
                    Rename
                  </DropdownMenuItem>
                </>
              ) : null}
              {space.canShare ? (
                <DropdownMenuItem
                  onClick={() =>
                    onShare({ type: "space", id: space.id, name: space.name })
                  }
                >
                  <Share2Icon className="size-4" />
                  Share
                </DropdownMenuItem>
              ) : null}
              {space.canManageStructure && !space.isPersonal ? (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() =>
                    onDelete({
                      type: "space",
                      id: space.id,
                      name: space.name,
                      isPersonal: space.isPersonal,
                    })
                  }
                >
                  <Trash2Icon className="size-4" />
                  Delete space
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {space.canManageStructure ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="size-5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/space:opacity-100"
                  aria-label="New list"
                  onClick={onAddList}
                >
                  <PlusIcon className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="bottom">New list</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {expanded && hasChildren ? (
        <div className="ml-3 space-y-0.5 border-l border-sidebar-border/60 py-0.5 pl-2">
          {space.folders?.map((folder) => (
            <div key={folder.id} className="group/folder">
              <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground">
                <FolderIcon className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                {folder.isPrivate ? (
                  <LockIcon className="size-3 shrink-0" />
                ) : null}
                {folder.canManageStructure || folder.canShare ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="size-5 shrink-0 opacity-0 group-hover/folder:opacity-100 data-[popup-open]:opacity-100"
                          aria-label={`Actions for ${folder.name}`}
                        >
                          <MoreHorizontalIcon className="size-3.5" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      {folder.canManageStructure ? (
                        <>
                          <DropdownMenuItem
                            onClick={() => onAddListToFolder(folder.id)}
                          >
                            <ListPlusIcon className="size-4" />
                            New list
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              onRename({
                                type: "folder",
                                id: folder.id,
                                name: folder.name,
                              })
                            }
                          >
                            <PencilIcon className="size-4" />
                            Rename
                          </DropdownMenuItem>
                        </>
                      ) : null}
                      {folder.canShare ? (
                        <DropdownMenuItem
                          onClick={() =>
                            onShare({
                              type: "folder",
                              id: folder.id,
                              name: folder.name,
                            })
                          }
                        >
                          <Share2Icon className="size-4" />
                          Share
                        </DropdownMenuItem>
                      ) : null}
                      {folder.canManageStructure ? (
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() =>
                            onDelete({
                              type: "folder",
                              id: folder.id,
                              name: folder.name,
                            })
                          }
                        >
                          <Trash2Icon className="size-4" />
                          Delete folder
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
              <div className="space-y-0.5 pl-1">
                {folder.lists.map((list) => (
                  <SpaceListLink
                    key={list.id}
                    listId={list.id}
                    name={list.name}
                    taskCount={list.taskCount}
                    active={pathname === `/home/l/${list.id}`}
                    isPrivate={list.isPrivate}
                    canShare={list.canShare}
                    onShare={() =>
                      onShare({ type: "list", id: list.id, name: list.name })
                    }
                    onRename={
                      list.canManageStructure
                        ? () =>
                            onRename({ type: "list", id: list.id, name: list.name })
                        : undefined
                    }
                    onDelete={
                      list.canManageStructure
                        ? () =>
                            onDelete({ type: "list", id: list.id, name: list.name })
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          ))}
          {space.standaloneLists?.map((list) => {
            const isPersonalList =
              space.isPersonal && list.name === "Personal List";
            return (
              <SpaceListLink
                key={list.id}
                listId={list.id}
                name={list.name}
                taskCount={list.taskCount}
                active={pathname === `/home/l/${list.id}`}
                isPrivate={list.isPrivate}
                isPersonal={isPersonalList}
                canShare={list.canShare}
                onShare={() =>
                  onShare({ type: "list", id: list.id, name: list.name })
                }
                onRename={
                  list.canManageStructure
                    ? () =>
                        onRename({ type: "list", id: list.id, name: list.name })
                    : undefined
                }
                onDelete={
                  list.canManageStructure
                    ? () =>
                        onDelete({
                          type: "list",
                          id: list.id,
                          name: list.name,
                          isPersonal: isPersonalList,
                        })
                    : undefined
                }
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ChannelRow({
  id,
  name,
  isPrivate,
  listChannel,
  unread,
  active,
}: {
  id: string;
  name: string;
  isPrivate?: boolean;
  listChannel?: boolean;
  unread: number;
  active: boolean;
}) {
  const unreadBadgeHold = useChatStore((s) => s.unreadBadgeHold);
  const displayUnread = useSidebarUnread(
    "channel",
    id,
    unread,
    active,
    unreadBadgeHold
  );

  return (
    <Link
      href={`/home/c/${id}`}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/80",
        active && "bg-sidebar-accent font-medium"
      )}
    >
      {listChannel ? (
        <span className="flex shrink-0 items-center gap-0.5">
          <HashIcon className="size-3.5 text-muted-foreground" />
          <ListIcon className="size-3.5 text-muted-foreground" />
        </span>
      ) : (
        <HashIcon className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {isPrivate ? <LockIcon className="size-3 shrink-0 text-muted-foreground" /> : null}
      {displayUnread > 0 && (
        <Badge className="size-5 min-w-5 shrink-0 justify-center rounded-full px-1 text-[10px]">
          {displayUnread}
        </Badge>
      )}
    </Link>
  );
}

function DmRow({
  id,
  name,
  avatarUrl,
  otherUserId,
  otherUserIsDisabled,
  participants,
  currentUserId,
  presenceFallback,
  isGroup,
  unread,
  active,
}: {
  id: string;
  name: string;
  avatarUrl?: string;
  otherUserId?: string;
  otherUserIsDisabled?: boolean;
  participants?: DmParticipant[];
  currentUserId?: string | null;
  presenceFallback?: PresenceStatus;
  isGroup?: boolean;
  unread: number;
  active: boolean;
}) {
  const unreadBadgeHold = useChatStore((s) => s.unreadBadgeHold);
  const displayUnread = useSidebarUnread(
    "dm",
    id,
    unread,
    active,
    unreadBadgeHold
  );
  const livePresence = useUserPresence(otherUserId, presenceFallback ?? "offline");
  const presence = otherUserIsDisabled ? "offline" : livePresence;
  const groupParticipants = isGroup
    ? otherGroupParticipants(participants, currentUserId)
    : [];
  const displayName = isGroup
    ? resolveGroupDmTitle({ name, isGroup: true, participants }, currentUserId)
    : name;

  return (
    <Link
      href={`/home/dm/${id}`}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/80",
        active && "bg-sidebar-accent font-medium"
      )}
    >
      {isGroup && groupParticipants.length > 0 ? (
        <GroupDmAvatarStack participants={groupParticipants} />
      ) : (
        <UserAvatarWithPresence
          name={displayName}
          avatarUrl={avatarUrl}
          presence={presence}
          showPresence={!isGroup}
          avatarClassName="size-6"
          dotSize="sm"
          borderClass="border-sidebar"
          fallbackClassName={cn(
            "text-[10px] font-semibold",
            avatarColorClassForKey(otherUserId, displayName)
          )}
          fallback={avatarInitialFromName(displayName)}
        />
      )}
      <span className="min-w-0 flex-1 truncate">
        {displayName}
        {!isGroup && otherUserIsDisabled ? (
          <span className="text-destructive"> (deactivated)</span>
        ) : null}
      </span>
      {displayUnread > 0 && (
        <Badge className="size-5 min-w-5 shrink-0 justify-center rounded-full px-1 text-[10px]">
          {displayUnread}
        </Badge>
      )}
    </Link>
  );
}

export function HomeSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inboxTab = pathname === "/home/inbox" ? searchParams.get("tab") : null;
  const currentUserId = useAuthStore((s) => s.user?.id);
  // Subscribed reactively (not just fetched once) so a live chat:message
  // socket event - which patches sidebarListsCache - re-sorts Home's
  // channel/DM lists immediately, matching ChatSidebar's behavior instead
  // of only re-sorting on the next full page load.
  const sidebarListsCache = useChatStore((s) => s.sidebarListsCache);
  const sidebarRefreshKey = useChatStore((s) => s.sidebarRefreshKey);
  const {
    items,
    filter,
    setFilter,
    myTasksExpanded,
    setMyTasksExpanded,
    collapsedSections,
    toggleSectionCollapsed,
    hydrateFromServer,
  } = useHomeSidebarStore();
  const mainItems = items.filter((i) => i.pinned);
  const hiddenItems = items.filter((i) => !i.pinned);
  const openModal = useUiStore((s) => s.openModal);
  const openModalDeferred = useUiStore((s) => s.openModalDeferred);
  const { secondaryPanelOpen, setSecondaryPanelOpen } = useShellStore();
  const { unreadCount } = useNotificationsUnread();
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const role = useAuthStore(selectActiveWorkspace)?.role;
  const restricted = isRestrictedRole(role);
  const onMyTasksRoute = pathname.startsWith("/home/my-tasks");
  const showMyTasksChildren = myTasksExpanded || onMyTasksRoute;
  const [moreOpen, setMoreOpen] = useState(false);
  const [spacesDialogMode, setSpacesDialogMode] = useState<HierarchyDialogMode | null>(null);
  const [spacesDialogOpen, setSpacesDialogOpen] = useState(false);
  const [expandedSpaces, setExpandedSpaces] = useState<Record<string, boolean>>({});
  const spacesRefreshKey = useSpacesStore((s) => s.refreshKey);
  const bumpSpacesRefresh = useSpacesStore((s) => s.bumpRefresh);
  const [shareTarget, setShareTarget] = useState<{
    type: ShareResourceType;
    id: string;
    name: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: "space" | "folder" | "list";
    id: string;
    name: string;
    isPersonal?: boolean;
  } | null>(null);
  const [deletingSpacesItem, setDeletingSpacesItem] = useState(false);

  function openRenameDialog(target: SpacesTreeMutationTarget) {
    if (target.type === "space") {
      setSpacesDialogMode({
        type: "edit-space",
        spaceId: target.id,
        initialName: target.name,
      });
    } else if (target.type === "folder") {
      setSpacesDialogMode({
        type: "edit-folder",
        folderId: target.id,
        initialName: target.name,
      });
    } else {
      setSpacesDialogMode({
        type: "edit-list",
        listId: target.id,
        initialName: target.name,
      });
    }
    setSpacesDialogOpen(true);
  }

  async function handleDeleteSpacesItem() {
    if (!deleteTarget || !ready || !accessToken || !workspaceId) return;
    setDeletingSpacesItem(true);
    try {
      if (deleteTarget.kind === "space") {
        await deleteSpace(accessToken, workspaceId, deleteTarget.id);
        toast.success("Space deleted");
      } else if (deleteTarget.kind === "folder") {
        await deleteFolder(accessToken, workspaceId, deleteTarget.id);
        toast.success("Folder deleted");
      } else {
        await deleteList(accessToken, workspaceId, deleteTarget.id);
        toast.success("List deleted");
        if (pathname === `/home/l/${deleteTarget.id}`) {
          router.push("/home");
        }
      }
      bumpSpacesRefresh();
      setDeleteTarget(null);
    } catch (err) {
      toast.error(formatRequestError(err));
    } finally {
      setDeletingSpacesItem(false);
    }
  }

  // Server config (pinned ids + order) is the source of truth; local storage
  // is just the instant-paint cache shown before this resolves.
  const sidebarConfigQuery = useHomeQuery(
    (token, ws) => fetchHomeSidebarConfig(token, ws),
    [workspaceId]
  );
  const lastServerConfigRef = useRef<string | null>(null);

  useEffect(() => {
    if (sidebarConfigQuery.data === null) return;
    hydrateFromServer(sidebarConfigQuery.data.config);
    const resolved = useHomeSidebarStore.getState();
    lastServerConfigRef.current = JSON.stringify(
      toSidebarConfig(resolved.items, resolved.collapsedSections)
    );
  }, [sidebarConfigQuery.data, hydrateFromServer]);

  useEffect(() => {
    if (lastServerConfigRef.current === null) return;
    if (!accessToken || !workspaceId) return;
    const next = toSidebarConfig(items, collapsedSections);
    const nextStr = JSON.stringify(next);
    if (nextStr === lastServerConfigRef.current) return;
    lastServerConfigRef.current = nextStr;
    void updateHomeSidebarConfig(accessToken, workspaceId, next);
  }, [items, collapsedSections, accessToken, workspaceId]);

  const spacesQuery = useHomeQuery(
    (token, ws) => fetchSpacesTree(token, ws).then((r) => r.data),
    [spacesRefreshKey]
  );
  const sharedWithMeQuery = useHomeQuery(
    (token, ws) => fetchSharedWithMe(token, ws).then((r) => r.data),
    [spacesRefreshKey]
  );

  const cacheValid = isSidebarCacheForSession(
    sidebarListsCache,
    currentUserId,
    workspaceId
  );

  const chatListsQuery = useHomeQuery(
    (token, ws) => loadSidebarLists(token, ws, { force: sidebarRefreshKey > 0 }),
    [sidebarRefreshKey]
  );

  if (!secondaryPanelOpen) return null;

  // Home's preview lists are recency-sorted (most recently active first) -
  // distinct from SpacesSidebar's alphabetical/personal-first order, which
  // is intentionally left untouched.
  const sortedSpaces = [...(spacesQuery.data ?? [])].sort(
    (a, b) =>
      new Date(b.lastActivityAt ?? 0).getTime() -
      new Date(a.lastActivityAt ?? 0).getTime()
  );

  // Merge functions already sort desc by lastAt (last message time).
  const channels = mergeSidebarChannels(
    chatListsQuery.data?.channels,
    cacheValid ? sidebarListsCache?.channels : undefined
  );
  const dms = mergeSidebarDms(
    chatListsQuery.data?.dms,
    cacheValid ? sidebarListsCache?.dms : undefined
  );

  return (
    <aside className="flex min-h-0 w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center justify-between border-b border-sidebar-border px-3 py-2.5">
        <span className="text-[13px] font-semibold tracking-tight text-sidebar-foreground">
          Home
        </span>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="ghost" size="icon-sm" className="size-7" aria-label="Search">
                  <SearchIcon className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Search</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={cn("size-7", filter === "unread" && "text-primary")}
                  aria-label="Filter unread"
                  onClick={() =>
                    setFilter(filter === "unread" ? "none" : "unread")
                  }
                >
                  <FilterIcon className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Filter unread</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7"
                  aria-label="Customize"
                  onClick={() => openModal("customize-home")}
                >
                  <Settings2Icon className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Customize</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button variant="ghost" size="icon-sm" className="size-7" aria-label="Create">
                        <PlusIcon className="size-3.5" />
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom">Create</TooltipContent>
                </Tooltip>
              }
            />
            <DropdownMenuContent align="end" className="w-44">
              {["Task", "Message", "Channel", "Doc"].map((item) => (
                <DropdownMenuItem
                  key={item}
                  onClick={() => {
                    if (item === "Channel") openModalDeferred("new-channel");
                    else if (item === "Message") openModalDeferred("new-dm");
                    else if (item === "Task") {
                      window.location.href = "/home/all-tasks";
                    } else toast(`${item} — coming soon`);
                  }}
                >
                  {item}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7"
                  aria-label="Collapse sidebar"
                  onClick={() => setSecondaryPanelOpen(false)}
                >
                  <PanelLeftCloseIcon className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Collapse sidebar</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {filter === "unread" && (
        <div className="px-3 py-2">
          <Badge variant="secondary" className="text-xs">
            Unread only
          </Badge>
        </div>
      )}
      <ScrollArea className="min-h-0 flex-1 px-2 pt-1">
        <nav className="flex flex-col gap-px pb-2">
          {mainItems.map((item) => {
            const active =
              item.id === "inbox"
                ? pathname === "/home/inbox" && inboxTab !== "replies"
                : pathname === item.href ||
                  (item.id === "my-tasks" && onMyTasksRoute);
            const isMyTasks = item.id === "my-tasks";

            return (
              <div key={item.id}>
                <HomeNavItem
                  item={item}
                  active={active}
                  unreadCount={item.id === "inbox" ? unreadCount : undefined}
                  expandable={isMyTasks}
                  expanded={showMyTasksChildren}
                  onToggleExpand={() =>
                    setMyTasksExpanded(!showMyTasksChildren)
                  }
                />
                {isMyTasks && showMyTasksChildren ? (
                  <MyTasksSubNav pathname={pathname} />
                ) : null}
              </div>
            );
          })}

          {hiddenItems.length > 0 ? (
            <div>
              <button
                type="button"
                className={cn(navItemClass, "h-8 text-muted-foreground")}
                onClick={() => setMoreOpen((v) => !v)}
              >
                {moreOpen ? (
                  <ChevronDownIcon className="size-3.5 shrink-0" />
                ) : (
                  <ChevronRightIcon className="size-3.5 shrink-0" />
                )}
                <span>More</span>
              </button>
              {moreOpen
                ? hiddenItems.map((item) => (
                    <HomeNavItem
                      key={item.id}
                      item={item}
                      active={pathname === item.href}
                    />
                  ))
                : null}
            </div>
          ) : null}
        </nav>

        <Separator className="my-2" />

        {/* Spaces (Owner/Admin/Member) or Shared with Me (Guest/Limited Member) */}
        <div className="mb-3">
          <SectionLabel
            label={restricted ? "Shared with Me" : "Spaces"}
            collapsed={collapsedSections.includes("spaces")}
            onToggleCollapsed={() => toggleSectionCollapsed("spaces")}
            onAdd={
              restricted
                ? undefined
                : () => {
                    setSpacesDialogMode({ type: "space" });
                    setSpacesDialogOpen(true);
                  }
            }
            addLabel="New space"
          />
          {!collapsedSections.includes("spaces") ? (
            <div className="space-y-0.5">
              {sortedSpaces.map((space) => (
                <SpaceRow
                  key={space.id}
                  space={space}
                  expanded={Boolean(expandedSpaces[space.id])}
                  onToggleExpanded={() =>
                    setExpandedSpaces((s) => ({ ...s, [space.id]: !s[space.id] }))
                  }
                  onAddFolder={() => {
                    setSpacesDialogMode({ type: "folder", spaceId: space.id });
                    setSpacesDialogOpen(true);
                  }}
                  onAddList={() => {
                    setSpacesDialogMode({ type: "list", spaceId: space.id });
                    setSpacesDialogOpen(true);
                  }}
                  onAddListToFolder={(folderId) => {
                    setSpacesDialogMode({
                      type: "list",
                      spaceId: space.id,
                      folderId,
                    });
                    setSpacesDialogOpen(true);
                  }}
                  onRename={openRenameDialog}
                  onDelete={(target) =>
                    setDeleteTarget({
                      kind: target.type,
                      id: target.id,
                      name: target.name,
                      isPersonal: target.isPersonal,
                    })
                  }
                  onShare={setShareTarget}
                  pathname={pathname}
                />
              ))}
              {sharedWithMeQuery.data?.map((entry) =>
                entry.type === "list" ? (
                  <SpaceListLink
                    key={`${entry.type}-${entry.id}`}
                    listId={entry.id}
                    name={entry.name}
                    active={pathname === `/home/l/${entry.id}`}
                  />
                ) : (
                  <div key={`${entry.type}-${entry.id}`}>
                    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground">
                      <FolderIcon className="size-3.5 shrink-0" />
                      <span className="truncate">{entry.name}</span>
                    </div>
                    <div className="ml-4 space-y-0.5 border-l border-sidebar-border pl-1">
                      {entry.lists?.map((lst) => (
                        <SpaceListLink
                          key={lst.id}
                          listId={lst.id}
                          name={lst.name}
                          taskCount={lst.taskCount}
                          isPrivate={lst.isPrivate}
                          active={pathname === `/home/l/${lst.id}`}
                        />
                      ))}
                    </div>
                  </div>
                )
              )}
              {!restricted ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/80"
                  onClick={() => {
                    setSpacesDialogMode({ type: "space" });
                    setSpacesDialogOpen(true);
                  }}
                >
                  <PlusIcon className="size-3.5 shrink-0" />
                  New Space
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Channels */}
        <div className="mb-3">
          <SectionLabel
            label="Channels"
            collapsed={collapsedSections.includes("channels")}
            onToggleCollapsed={() => toggleSectionCollapsed("channels")}
            onAdd={
              restricted ? undefined : () => openModalDeferred("new-channel")
            }
            addLabel="Add channel"
          />
          {!collapsedSections.includes("channels") ? (
            <div className="space-y-0.5">
              {channels.map((c) => (
                <ChannelRow
                  key={c.id}
                  id={c.id}
                  name={c.name}
                  isPrivate={c.isPrivate}
                  listChannel={c.isListPrimary}
                  unread={c.unread}
                  active={pathname === `/home/c/${c.id}`}
                />
              ))}
              {!restricted ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/80"
                  onClick={() => openModalDeferred("new-channel")}
                >
                  <PlusIcon className="size-3.5 shrink-0" />
                  Add Channel
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Direct Messages */}
        <div className="mb-3">
          <SectionLabel
            label="Direct Messages"
            collapsed={collapsedSections.includes("direct-messages")}
            onToggleCollapsed={() => toggleSectionCollapsed("direct-messages")}
          />
          {!collapsedSections.includes("direct-messages") ? (
            <div className="space-y-0.5">
              {dms.map((d) => (
                <DmRow
                  key={d.id}
                  id={d.id}
                  name={d.name}
                  avatarUrl={d.avatarUrl}
                  otherUserId={d.otherUserId}
                  otherUserIsDisabled={d.otherUserIsDisabled}
                  participants={d.participants}
                  currentUserId={currentUserId}
                  presenceFallback={d.presence}
                  isGroup={d.isGroup}
                  unread={d.unread}
                  active={pathname === `/home/dm/${d.id}`}
                />
              ))}
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/80"
                onClick={() => openModalDeferred("new-dm")}
              >
                <PlusIcon className="size-3.5 shrink-0" />
                New message
              </button>
            </div>
          ) : null}
        </div>

        {channels.length === 0 && dms.length === 0 && !chatListsQuery.loading ? (
          <p className="flex items-center gap-1.5 px-2 pb-2 text-xs text-muted-foreground">
            <MessagesSquareIcon className="size-3.5" />
            No chat activity yet.
          </p>
        ) : null}
      </ScrollArea>

      <div className="shrink-0 border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          className="h-8 w-full justify-center gap-1.5 rounded-md bg-sidebar-accent/60 text-xs text-muted-foreground"
          onClick={() => openModal("customize-home")}
        >
          Customize Sidebar
        </Button>
      </div>

      <SpacesHierarchyDialog
        open={spacesDialogOpen}
        onOpenChange={setSpacesDialogOpen}
        mode={spacesDialogMode}
        navigateOnCreate={false}
        onSpaceCreated={(spaceId) => router.push(`/home/spaces/${spaceId}`)}
      />
      {shareTarget ? (
        <ShareModal
          open={shareTarget !== null}
          onOpenChange={(open) => {
            if (!open) setShareTarget(null);
          }}
          resourceType={shareTarget.type}
          resourceId={shareTarget.id}
          resourceName={shareTarget.name}
        />
      ) : null}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={
          deleteTarget?.kind === "space"
            ? "Delete space?"
            : deleteTarget?.kind === "folder"
              ? "Delete folder?"
              : "Delete list?"
        }
        description={
          deleteTarget?.kind === "list" && deleteTarget.isPersonal
            ? "The Personal list cannot be deleted."
            : deleteTarget
              ? `"${deleteTarget.name}" and its tasks will be permanently deleted.`
              : ""
        }
        confirmLabel="Delete"
        loading={deletingSpacesItem}
        onConfirm={() => void handleDeleteSpacesItem()}
      />
    </aside>
  );
}
