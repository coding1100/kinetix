"use client";

import { useMemo, useState } from "react";
import {
  ChevronDownIcon,
  FolderIcon,
  ListChecksIcon,
  SearchIcon,
  UserIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import type { SpaceDto } from "@/lib/api/home";
import { cn } from "@/lib/utils";

export type RecentListItem = {
  id: string;
  name: string;
  href: string;
  space: string;
};

type ListEntry = {
  id: string;
  name: string;
  taskCount: number;
  spaceId: string;
  spaceName: string;
  spaceColor: string;
  folderName?: string;
  isPersonal?: boolean;
};

function listIdFromHref(href: string): string | null {
  const match = href.match(/\/spaces\/l\/([^/?]+)/);
  return match?.[1] ?? null;
}

function buildListIndex(spaces: SpaceDto[]): Map<string, ListEntry> {
  const map = new Map<string, ListEntry>();
  for (const space of spaces) {
    for (const list of space.standaloneLists ?? []) {
      map.set(list.id, {
        id: list.id,
        name: list.name,
        taskCount: list.taskCount,
        spaceId: space.id,
        spaceName: space.name,
        spaceColor: space.color,
        isPersonal: space.isPersonal,
      });
    }
    for (const folder of space.folders ?? []) {
      for (const list of folder.lists) {
        map.set(list.id, {
          id: list.id,
          name: list.name,
          taskCount: list.taskCount,
          spaceId: space.id,
          spaceName: space.name,
          spaceColor: space.color,
          folderName: folder.name,
          isPersonal: space.isPersonal,
        });
      }
    }
  }
  return map;
}

function matchesQuery(entry: ListEntry, query: string) {
  const haystack = [
    entry.name,
    entry.spaceName,
    entry.folderName ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

function ListPickerRow({
  entry,
  selected,
  onSelect,
  indent = 0,
  icon: Icon = ListChecksIcon,
}: {
  entry: ListEntry;
  selected: boolean;
  onSelect: (id: string, name: string) => void;
  indent?: number;
  icon?: typeof ListChecksIcon;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm hover:bg-muted",
        selected && "bg-primary/10 text-primary"
      )}
      style={{ paddingLeft: 12 + indent * 14 }}
      onClick={() => onSelect(entry.id, entry.name)}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {entry.taskCount}
      </span>
    </button>
  );
}

export function CreateTaskListPicker({
  spaces,
  recents,
  listId,
  listName,
  onSelect,
  triggerClassName,
}: {
  spaces: SpaceDto[];
  recents: RecentListItem[];
  listId: string;
  listName: string;
  onSelect: (id: string, name: string) => void;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const listIndex = useMemo(() => buildListIndex(spaces), [spaces]);
  const query = search.trim().toLowerCase();

  const personalList = useMemo(() => {
    for (const entry of listIndex.values()) {
      if (entry.isPersonal) return entry;
    }
    return null;
  }, [listIndex]);

  const recentLists = useMemo(() => {
    const seen = new Set<string>();
    const rows: ListEntry[] = [];
    for (const recent of recents) {
      const id = listIdFromHref(recent.href);
      if (!id || seen.has(id)) continue;
      const entry = listIndex.get(id);
      if (!entry) continue;
      seen.add(id);
      rows.push(entry);
    }
    return rows;
  }, [recents, listIndex]);

  const filteredPersonal =
    personalList && (!query || matchesQuery(personalList, query))
      ? personalList
      : null;

  const filteredRecents = useMemo(
    () =>
      recentLists.filter((entry) => !query || matchesQuery(entry, query)).slice(0, 8),
    [recentLists, query]
  );

  const filteredSpaces = useMemo(() => {
    if (!query) return spaces;
    return spaces
      .map((space) => {
        const standalone = (space.standaloneLists ?? []).filter((list) => {
          const entry = listIndex.get(list.id);
          return entry && matchesQuery(entry, query);
        });
        const folders = (space.folders ?? [])
          .map((folder) => ({
            ...folder,
            lists: folder.lists.filter((list) => {
              const entry = listIndex.get(list.id);
              return entry && matchesQuery(entry, query);
            }),
          }))
          .filter((folder) => folder.lists.length > 0);
        const spaceMatches = space.name.toLowerCase().includes(query);
        if (!spaceMatches && standalone.length === 0 && folders.length === 0) {
          return null;
        }
        return { ...space, standaloneLists: standalone, folders };
      })
      .filter(Boolean) as SpaceDto[];
  }, [spaces, query, listIndex]);

  function handleSelect(id: string, name: string) {
    onSelect(id, name);
    setOpen(false);
    setSearch("");
  }

  const triggerLabel = listName || "Select List…";

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex h-8 max-w-[240px] items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-2.5 text-sm hover:bg-muted/60",
              triggerClassName
            )}
          >
            <ListChecksIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{triggerLabel}</span>
            <ChevronDownIcon className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
          </button>
        }
      />
      <PopoverContent
        align="start"
        className="z-[200] flex w-80 max-h-[min(28rem,calc(100vh-8rem))] flex-col overflow-hidden p-0"
      >
        <div className="shrink-0 border-b border-border p-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-8 pl-8"
            />
          </div>
        </div>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-2",
            "[scrollbar-gutter:stable]",
            "[&::-webkit-scrollbar]:w-2",
            "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/35",
            "[&::-webkit-scrollbar-track]:bg-transparent"
          )}
          style={{ maxHeight: "min(28rem, calc(100vh - 8rem - 3rem)" }}
        >
            {filteredPersonal ? (
              <div>
                <SectionLabel>Personal List</SectionLabel>
                <ListPickerRow
                  entry={filteredPersonal}
                  selected={listId === filteredPersonal.id}
                  onSelect={handleSelect}
                  icon={UserIcon}
                />
              </div>
            ) : null}

            {filteredRecents.length > 0 ? (
              <div>
                <SectionLabel>Recents</SectionLabel>
                {filteredRecents.map((entry) => (
                  <ListPickerRow
                    key={`recent-${entry.id}`}
                    entry={entry}
                    selected={listId === entry.id}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            ) : null}

            <SectionLabel>Spaces</SectionLabel>
            {filteredSpaces.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                No lists found
              </p>
            ) : (
              filteredSpaces.map((space) => (
                <div key={space.id} className="px-1">
                  <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-semibold">
                    <span
                      className="flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
                      style={{ backgroundColor: space.color }}
                    >
                      {space.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="truncate">{space.name}</span>
                  </div>

                  {(space.standaloneLists ?? []).map((list) => {
                    const entry = listIndex.get(list.id);
                    if (!entry) return null;
                    return (
                      <ListPickerRow
                        key={list.id}
                        entry={entry}
                        selected={listId === list.id}
                        onSelect={handleSelect}
                        indent={1}
                      />
                    );
                  })}

                  {(space.folders ?? []).map((folder) => (
                    <div key={folder.id}>
                      <div
                        className="flex items-center gap-2 py-1 text-sm text-muted-foreground"
                        style={{ paddingLeft: 26 }}
                      >
                        <FolderIcon className="size-3.5 shrink-0" />
                        <span className="truncate">{folder.name}</span>
                        <span className="ml-auto pr-2 text-xs tabular-nums">
                          {folder.lists.reduce((n, l) => n + l.taskCount, 0)}
                        </span>
                      </div>
                      {folder.lists.map((list) => {
                        const entry = listIndex.get(list.id);
                        if (!entry) return null;
                        return (
                          <ListPickerRow
                            key={list.id}
                            entry={entry}
                            selected={listId === list.id}
                            onSelect={handleSelect}
                            indent={2}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
