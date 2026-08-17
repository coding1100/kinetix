"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderPlusIcon,
  LayoutListIcon,
  ListChecksIcon,
  ListPlusIcon,
  LockIcon,
  MoreHorizontalIcon,
  PanelLeftCloseIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Settings2Icon,
  Share2Icon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import {
  deleteFolder,
  deleteList,
  deleteSpace,
  fetchSpacesTree,
  type ShareResourceType,
  type StatusConfigItem,
} from "@/lib/api/spaces";
import { fetchSharedWithMe } from "@/lib/api/home";
import { ShareModal } from "@/components/shared/ShareModal";
import { useHomeQuery } from "@/hooks/use-home-query";
import { HomeDataState } from "@/components/home/HomeDataState";
import { useShellStore } from "@/stores/shell-store";
import { SidebarResizeHandle } from "@/components/shell/SidebarResizeHandle";
import { useSpacesStore } from "@/stores/spaces-store";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DeleteHierarchyModal, type DeleteHierarchyTarget } from "@/components/spaces/DeleteHierarchyModal";
import { StatusSettingsDialog } from "@/components/spaces/StatusSettingsDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SpacesHierarchyDialog,
  type HierarchyDialogMode,
} from "@/components/spaces/SpacesHierarchyDialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { formatRequestError } from "@/lib/api/client";
import { toast } from "sonner";

function listHref(listId: string) {
  return `/spaces/l/${listId}`;
}

function isListActive(pathname: string, listId: string) {
  return pathname === listHref(listId);
}

type ShareTarget = {
  type: ShareResourceType;
  id: string;
  name: string;
};

type StatusTarget = {
  type: "space" | "list";
  id: string;
  name: string;
  statuses?: StatusConfigItem[];
  canInherit?: boolean;
};

export function SpacesSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const { secondaryPanelOpen, setSecondaryPanelOpen, secondaryPanelWidth } =
    useShellStore();
  const refreshKey = useSpacesStore((s) => s.refreshKey);
  const bumpRefresh = useSpacesStore((s) => s.bumpRefresh);
  const { data: spaces, loading, error } = useHomeQuery(
    (token, ws) => fetchSpacesTree(token, ws).then((r) => r.data),
    [refreshKey]
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dialogMode, setDialogMode] = useState<HierarchyDialogMode | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteHierarchyTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [statusTarget, setStatusTarget] = useState<StatusTarget | null>(null);
  const { data: sharedWithMe } = useHomeQuery(
    (token, ws) => fetchSharedWithMe(token, ws).then((r) => r.data),
    [refreshKey]
  );

  const defaultExpanded = useMemo(() => {
    const ids: Record<string, boolean> = {};
    spaces?.forEach((s) => {
      ids[s.id] = true;
    });
    return ids;
  }, [spaces]);

  const expandedState = { ...defaultExpanded, ...expanded };

  function openDialog(mode: HierarchyDialogMode) {
    setDialogMode(mode);
    setDialogOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget || !ready || !accessToken || !workspaceId) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === "space") {
        await deleteSpace(accessToken, workspaceId, deleteTarget.id);
        toast.success("Space deleted");
        if (
          pathname.includes(`/spaces/${deleteTarget.id}`) ||
          pathname.startsWith("/spaces")
        ) {
          router.push("/spaces");
        }
      } else if (deleteTarget.kind === "folder") {
        await deleteFolder(accessToken, workspaceId, deleteTarget.id);
        toast.success("Folder deleted");
        if (pathname.startsWith("/spaces")) {
          router.push("/spaces");
        }
      } else {
        await deleteList(accessToken, workspaceId, deleteTarget.id);
        toast.success("List deleted");
        if (
          pathname === listHref(deleteTarget.id) ||
          pathname.includes(deleteTarget.id) ||
          pathname.startsWith("/spaces")
        ) {
          router.push("/spaces");
        }
      }
      if (statusTarget && statusTarget.id === deleteTarget.id) {
        setStatusTarget(null);
      }
      bumpRefresh();
      setDeleteTarget(null);
    } catch (err) {
      toast.error(formatRequestError(err));
    } finally {
      setDeleting(false);
    }
  }

  if (!secondaryPanelOpen) return null;

  return (
    <>
      <aside
        className="relative flex min-h-0 shrink-0 flex-col border-r border-sidebar-border bg-sidebar"
        style={{ width: secondaryPanelWidth }}
      >
        <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sidebar-foreground">Spaces</span>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setSecondaryPanelOpen(false)}
            aria-label="Close panel"
          >
            <PanelLeftCloseIcon className="size-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 px-2 py-2">
          <nav className="mb-3 space-y-0.5 px-1" aria-label="Quick views">
            <Link
              href="/home/all-tasks"
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-sidebar-accent",
                pathname === "/home/all-tasks"
                  ? "bg-primary/10 font-semibold text-slate-900 dark:text-white"
                  : "text-slate-700 dark:text-slate-300"
              )}
            >
              <ListChecksIcon className="size-4 shrink-0" />
              All Tasks
            </Link>
            <Link
              href="/home/my-tasks/assigned"
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-sidebar-accent",
                pathname === "/home/my-tasks/assigned"
                  ? "bg-primary/10 font-semibold text-slate-900 dark:text-white"
                  : "text-slate-700 dark:text-slate-300"
              )}
            >
              <UsersIcon className="size-4 shrink-0" />
              Shared with me
            </Link>
          </nav>
          {sharedWithMe && sharedWithMe.length > 0 ? (
            <div className="mb-3 space-y-0.5 px-1">
              <div className="px-1.5 py-1 text-xs font-semibold text-muted-foreground">
                Shared with you
              </div>
              {sharedWithMe.map((entry) =>
                entry.type === "list" ? (
                  <Link
                    key={`${entry.type}-${entry.id}`}
                    href={listHref(entry.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-sidebar-accent",
                      isListActive(pathname, entry.id)
                        ? "bg-primary/10 font-semibold text-slate-900 dark:text-white"
                        : "text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <LayoutListIcon className="size-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{entry.name}</span>
                  </Link>
                ) : (
                  <div key={`${entry.type}-${entry.id}`}>
                    <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-300 font-medium">
                      <FolderIcon className="size-3.5 shrink-0 opacity-70" />
                      <span className="truncate">{entry.name}</span>
                    </div>
                    <div className="ml-4 space-y-0.5 border-l border-sidebar-border pl-1">
                      {entry.lists?.map((lst) => (
                        <Link
                          key={lst.id}
                          href={listHref(lst.id)}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-sidebar-accent",
                            isListActive(pathname, lst.id)
                              ? "bg-primary/10 font-semibold text-slate-900 dark:text-white"
                              : "text-slate-700 dark:text-slate-300"
                          )}
                        >
                          <LayoutListIcon className="size-3.5 shrink-0 opacity-70" />
                          <span className="truncate">{lst.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          ) : null}
          <HomeDataState
            loading={loading}
            error={error}
            empty={!loading && !error && spaces?.length === 0}
            emptyMessage="No spaces yet. Create one with +"
          >
            <div className="space-y-4 pb-2">
              {spaces?.map((space) => (
                <div key={space.id}>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-sidebar-accent"
                      onClick={() =>
                        setExpanded((e) => ({
                          ...e,
                          [space.id]: !expandedState[space.id],
                        }))
                      }
                    >
                      {expandedState[space.id] ? (
                        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span
                        className="flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
                        style={{ backgroundColor: space.color }}
                        aria-hidden
                      >
                        {space.name.slice(0, 1).toUpperCase()}
                      </span>
                      <Tooltip>
                        <TooltipTrigger render={<span className="truncate">{space.name}</span>} />
                        <TooltipContent side="bottom">{space.name}</TooltipContent>
                      </Tooltip>
                      {space.isPrivate ? (
                        <LockIcon className="size-3 shrink-0 opacity-70" />
                      ) : null}
                    </button>
                    {space.canManageStructure || space.canShare ? (
                      <Tooltip>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <TooltipTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="size-7 shrink-0"
                                    aria-label={`Actions for ${space.name}`}
                                  >
                                    <MoreHorizontalIcon className="size-3.5" />
                                  </Button>
                                }
                              />
                            }
                          />
                          <DropdownMenuContent align="end">
                          {space.canManageStructure ? (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  openDialog({ type: "folder", spaceId: space.id })
                                }
                              >
                                <FolderPlusIcon className="size-4" />
                                New folder
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  openDialog({ type: "list", spaceId: space.id })
                                }
                              >
                                <ListPlusIcon className="size-4" />
                                New list
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  openDialog({
                                    type: "edit-space",
                                    spaceId: space.id,
                                    initialName: space.name,
                                  })
                                }
                              >
                                <PencilIcon className="size-4" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setStatusTarget({
                                    type: "space",
                                    id: space.id,
                                    name: space.name,
                                    statuses: space.statusConfig,
                                  })
                                }
                              >
                                <Settings2Icon className="size-4" />
                                Statuses
                              </DropdownMenuItem>
                            </>
                          ) : null}
                          {space.canShare ? (
                            <DropdownMenuItem
                              onClick={() =>
                                setShareTarget({
                                  type: "space",
                                  id: space.id,
                                  name: space.name,
                                })
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
                                setDeleteTarget({
                                  kind: "space",
                                  id: space.id,
                                  name: space.name,
                                  folderCount: space.folders?.length || 0,
                                  listCount: space.standaloneLists?.length || 0,
                                })
                              }
                            >
                              <Trash2Icon className="size-4" />
                              Delete space
                            </DropdownMenuItem>
                          ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <TooltipContent side="bottom">Actions</TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                  {expandedState[space.id] ? (
                    <div className="mt-0.5 space-y-2 pl-2">
                      {space.folders?.map((folder) => (
                        <div key={folder.id}>
                          <div className="flex items-center justify-between px-2 py-0.5">
                            <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium text-muted-foreground">
                              <FolderIcon className="size-3.5 shrink-0" />
                              <span className="truncate">{folder.name}</span>
                              {folder.isPrivate ? (
                                <LockIcon className="size-3 shrink-0" />
                              ) : null}
                            </div>
                            {folder.canManageStructure || folder.canShare ? (
                              <Tooltip>
                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    render={
                                      <TooltipTrigger
                                        render={
                                          <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            className="size-6 shrink-0"
                                            aria-label={`Actions for ${folder.name}`}
                                          >
                                            <MoreHorizontalIcon className="size-3" />
                                          </Button>
                                        }
                                      />
                                    }
                                  />
                                  <DropdownMenuContent align="end">
                                  {folder.canManageStructure ? (
                                    <>
                                      <DropdownMenuItem
                                        onClick={() =>
                                          openDialog({
                                            type: "list",
                                            spaceId: space.id,
                                            folderId: folder.id,
                                          })
                                        }
                                      >
                                        <ListPlusIcon className="size-4" />
                                        New list
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() =>
                                          openDialog({
                                            type: "edit-folder",
                                            folderId: folder.id,
                                            initialName: folder.name,
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
                                        setShareTarget({
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
                                        setDeleteTarget({
                                          kind: "folder",
                                          id: folder.id,
                                          name: folder.name,
                                          listCount: folder.lists?.length || 0,
                                        })
                                      }
                                    >
                                      <Trash2Icon className="size-4" />
                                      Delete folder
                                    </DropdownMenuItem>
                                  ) : null}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <TooltipContent side="bottom">Actions</TooltipContent>
                              </Tooltip>
                            ) : null}
                          </div>
                          <ul className="space-y-0.5">
                            {folder.lists.map((list) => (
                              <ListNavItem
                                key={list.id}
                                listId={list.id}
                                name={list.name}
                                taskCount={list.taskCount}
                                active={isListActive(pathname, list.id)}
                                isPrivate={list.isPrivate}
                                canShare={list.canShare}
                                onRename={
                                  list.canManageStructure
                                    ? () =>
                                        openDialog({
                                          type: "edit-list",
                                          listId: list.id,
                                          initialName: list.name,
                                        })
                                    : undefined
                                }
                                onStatuses={
                                  list.canManageStructure
                                    ? () =>
                                        setStatusTarget({
                                          type: "list",
                                          id: list.id,
                                          name: list.name,
                                          statuses: list.statusConfig,
                                          canInherit: true,
                                        })
                                    : undefined
                                }
                                onDelete={
                                  list.canManageStructure
                                    ? () =>
                                        setDeleteTarget({
                                          kind: "list",
                                          id: list.id,
                                          name: list.name,
                                          isPersonal: false,
                                        })
                                    : undefined
                                }
                                onShare={() =>
                                  setShareTarget({
                                    type: "list",
                                    id: list.id,
                                    name: list.name,
                                  })
                                }
                              />
                            ))}
                          </ul>
                        </div>
                      ))}
                      {space.standaloneLists &&
                      space.standaloneLists.length > 0 ? (
                        <ul className="space-y-0.5">
                          {space.standaloneLists.map((list) => (
                            <ListNavItem
                              key={list.id}
                              listId={list.id}
                              name={list.name}
                              taskCount={list.taskCount}
                              active={isListActive(pathname, list.id)}
                              isPrivate={list.isPrivate}
                              canShare={list.canShare}
                              isPersonal={
                                space.isPersonal && list.name === "Personal List"
                              }
                              onRename={
                                list.canManageStructure
                                  ? () =>
                                      openDialog({
                                        type: "edit-list",
                                        listId: list.id,
                                        initialName: list.name,
                                      })
                                  : undefined
                              }
                              onStatuses={
                                list.canManageStructure
                                  ? () =>
                                      setStatusTarget({
                                        type: "list",
                                        id: list.id,
                                        name: list.name,
                                        statuses: list.statusConfig,
                                        canInherit: true,
                                      })
                                  : undefined
                              }
                              onDelete={
                                list.canManageStructure
                                  ? () =>
                                      setDeleteTarget({
                                        kind: "list",
                                        id: list.id,
                                        name: list.name,
                                        isPersonal:
                                          space.isPersonal &&
                                          list.name === "Personal List",
                                      })
                                  : undefined
                              }
                              onShare={() =>
                                setShareTarget({
                                  type: "list",
                                  id: list.id,
                                  name: list.name,
                                })
                              }
                            />
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </HomeDataState>
        </ScrollArea>
        <div className="border-t border-sidebar-border p-3">
          <Button
            variant="ghost"
            className="h-9 w-full justify-start gap-2 text-sm text-muted-foreground"
            onClick={() => openDialog({ type: "space" })}
          >
            <PlusIcon className="size-4" />
            New Space
          </Button>
        </div>
        <SidebarResizeHandle />
      </aside>
      <SpacesHierarchyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        onSpaceCreated={(spaceId) =>
          setExpanded((prev) => ({ ...prev, [spaceId]: true }))
        }
      />
      <DeleteHierarchyModal
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        target={deleteTarget}
        loading={deleting}
        onConfirm={() => void handleDelete()}
      />
      {statusTarget ? (
        <StatusSettingsDialog
          open={statusTarget !== null}
          onOpenChange={(open) => {
            if (!open) setStatusTarget(null);
          }}
          targetType={statusTarget.type}
          targetId={statusTarget.id}
          targetName={statusTarget.name}
          initialStatuses={statusTarget.statuses}
          canInherit={statusTarget.canInherit}
        />
      ) : null}
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
    </>
  );
}

function ListNavItem({
  listId,
  name,
  taskCount,
  active,
  isPersonal,
  isPrivate,
  canShare,
  onRename,
  onStatuses,
  onDelete,
  onShare,
}: {
  listId: string;
  name: string;
  taskCount?: number;
  active: boolean;
  isPersonal?: boolean;
  isPrivate?: boolean;
  canShare?: boolean;
  onRename?: () => void;
  onStatuses?: () => void;
  onDelete?: () => void;
  onShare: () => void;
}) {
  const router = useRouter();
  const canDelete = Boolean(onDelete) && !isPersonal;
  const hasMenu = Boolean(onRename) || Boolean(onStatuses) || canDelete || (Boolean(canShare) && Boolean(onShare));

  return (
    <ContextMenu>
      <ContextMenuTrigger className="block w-full">
        <li className="group flex items-center gap-0.5">
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href={listHref(listId)} />}
            className={cn(
              "h-8 min-w-0 flex-1 justify-start gap-2 rounded-md px-2.5 text-sm",
              active && "bg-primary/10 font-semibold text-slate-900 dark:text-white",
              !active && "font-medium text-slate-700 dark:text-slate-300 hover:bg-sidebar-accent"
            )}
          >
            <LayoutListIcon className="size-3.5 shrink-0 opacity-70" />
            <span className="truncate">{name}</span>
            {isPrivate ? <LockIcon className="size-3 shrink-0 opacity-70" /> : null}
            {typeof taskCount === "number" ? (
              <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {taskCount}
              </span>
            ) : null}
          </Button>
          {hasMenu ? (
            <Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-6 shrink-0 opacity-0 group-hover:opacity-100 data-[popup-open]:opacity-100"
                          aria-label={`Actions for ${name}`}
                        >
                          <MoreHorizontalIcon className="size-3" />
                        </Button>
                      }
                    />
                  }
                />
                <DropdownMenuContent align="end">
                  {onRename ? (
                    <DropdownMenuItem onClick={onRename}>
                      <PencilIcon className="size-4" />
                      Rename
                    </DropdownMenuItem>
                  ) : null}
                  {onStatuses ? (
                    <DropdownMenuItem onClick={onStatuses}>
                      <Settings2Icon className="size-4" />
                      Statuses
                    </DropdownMenuItem>
                  ) : null}
                  {canShare ? (
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
              <TooltipContent side="bottom">Actions</TooltipContent>
            </Tooltip>
          ) : null}
        </li>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => router.push(listHref(listId))}>
          <LayoutListIcon className="size-4" />
          Open list
        </ContextMenuItem>
        {onRename ? (
          <ContextMenuItem onClick={onRename}>
            <PencilIcon className="size-4" />
            Rename
          </ContextMenuItem>
        ) : null}
        {onStatuses ? (
          <ContextMenuItem onClick={onStatuses}>
            <Settings2Icon className="size-4" />
            Statuses
          </ContextMenuItem>
        ) : null}
        {canShare ? (
          <ContextMenuItem onClick={onShare}>
            <Share2Icon className="size-4" />
            Share
          </ContextMenuItem>
        ) : null}
        {canDelete ? <ContextMenuSeparator /> : null}
        {canDelete ? (
          <ContextMenuItem variant="destructive" onClick={onDelete}>
            <Trash2Icon className="size-4" />
            Delete list
          </ContextMenuItem>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}
