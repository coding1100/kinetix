"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderPlusIcon,
  LayoutListIcon,
  ListPlusIcon,
  PanelLeftCloseIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import type { SpaceDto } from "@/lib/api/home";
import { fetchSpacesTree } from "@/lib/api/spaces";
import { useHomeQuery } from "@/hooks/use-home-query";
import { HomeDataState } from "@/components/home/HomeDataState";
import { useShellStore } from "@/stores/shell-store";
import { useSpacesStore } from "@/stores/spaces-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SpacesHierarchyDialog,
  type HierarchyDialogMode,
} from "@/components/spaces/SpacesHierarchyDialog";

function listHref(listId: string) {
  return `/spaces/l/${listId}`;
}

function isListActive(pathname: string, listId: string) {
  return pathname === listHref(listId);
}

export function SpacesSidebar() {
  const pathname = usePathname();
  const { secondaryPanelOpen, setSecondaryPanelOpen } = useShellStore();
  const refreshKey = useSpacesStore((s) => s.refreshKey);
  const { data: spaces, loading, error } = useHomeQuery(
    (token, ws) => fetchSpacesTree(token, ws).then((r) => r.data),
    [refreshKey]
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dialogMode, setDialogMode] = useState<HierarchyDialogMode | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  if (!secondaryPanelOpen) return null;

  return (
    <>
      <aside className="flex min-h-0 w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex items-center justify-between px-3 py-3">
          <span className="text-sm font-semibold">Spaces</span>
          <div className="flex gap-0.5">
            <Button variant="ghost" size="icon-sm" title="Search spaces">
              <SearchIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="New space"
              onClick={() => openDialog({ type: "space" })}
            >
              <PlusIcon className="size-4" />
            </Button>
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
        <ScrollArea className="min-h-0 flex-1 px-2 py-4">
          <HomeDataState
            loading={loading}
            error={error}
            empty={!loading && !error && spaces?.length === 0}
            emptyMessage="No spaces yet. Create one with +"
          >
            <div className="space-y-3 pb-4">
              {spaces?.map((space) => (
                <div key={space.id}>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-2 py-1 text-left text-sm font-semibold hover:bg-sidebar-accent"
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
                        className="size-2 shrink-0 rounded-sm"
                        style={{ backgroundColor: space.color }}
                        aria-hidden
                      />
                      <span className="truncate">{space.name}</span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="size-7 shrink-0"
                            aria-label={`Add to ${space.name}`}
                          >
                            <PlusIcon className="size-3.5" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
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
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {expandedState[space.id] ? (
                    <div className="mt-0.5 space-y-2 pl-2">
                      {space.folders?.map((folder) => (
                        <div key={folder.id}>
                          <div className="flex items-center justify-between px-2 py-0.5">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                              <FolderIcon className="size-3.5" />
                              {folder.name}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="size-6"
                              title="New list in folder"
                              onClick={() =>
                                openDialog({
                                  type: "list",
                                  spaceId: space.id,
                                  folderId: folder.id,
                                })
                              }
                            >
                              <PlusIcon className="size-3" />
                            </Button>
                          </div>
                          <ul className="space-y-0.5">
                            {folder.lists.map((list) => (
                              <ListNavItem
                                key={list.id}
                                listId={list.id}
                                name={list.name}
                                active={isListActive(pathname, list.id)}
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
                              active={isListActive(pathname, list.id)}
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
      </aside>
      <SpacesHierarchyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
      />
    </>
  );
}

function ListNavItem({
  listId,
  name,
  active,
}: {
  listId: string;
  name: string;
  active: boolean;
}) {
  return (
    <li>
      <Button
        variant="ghost"
        nativeButton={false}
        render={<Link href={listHref(listId)} />}
        className={cn(
          "h-8 w-full justify-start gap-2 rounded-md px-2 text-sm",
          active && "bg-sidebar-accent font-medium text-foreground",
          !active && "font-normal text-muted-foreground"
        )}
      >
        <LayoutListIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{name}</span>
      </Button>
    </li>
  );
}
