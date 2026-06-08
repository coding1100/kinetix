"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SearchIcon,
  HashIcon,
  MessageCircleIcon,
  UserIcon,
  CheckSquareIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { matchesQuery } from "@/lib/search/match-query";
import { fetchWorkspaceMembers } from "@/lib/api/chat";
import { loadSidebarLists } from "@/lib/chat/sidebar-lists-loader";
import { fetchTasks } from "@/lib/api/home";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import type { Channel, DirectMessage } from "@/lib/types/chat";
import type { Task } from "@/lib/types/task";

type SearchResults = {
  channels: Channel[];
  dms: DirectMessage[];
  allDms: DirectMessage[];
  people: { id: string; fullName: string; email: string }[];
  tasks: Task[];
};

const EMPTY: SearchResults = {
  channels: [],
  dms: [],
  allDms: [],
  people: [],
  tasks: [],
};

export function GlobalSearch() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const { workspaceId, ready } = useWorkspaceApi();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const rootRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(
    async (term: string) => {
      if (!accessToken || !workspaceId || !term.trim()) {
        setResults(EMPTY);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [lists, membersRes, tasksRes] = await Promise.all([
          loadSidebarLists(accessToken, workspaceId),
          fetchWorkspaceMembers(accessToken, workspaceId),
          fetchTasks(accessToken, workspaceId, undefined, term),
        ]);
        setResults({
          channels: lists.channels.filter((c) =>
            matchesQuery(term, c.name, c.topic, c.lastMessage)
          ),
          dms: lists.dms.filter((d) =>
            matchesQuery(term, d.name, d.lastMessage)
          ),
          allDms: lists.dms,
          people: membersRes.data
            .filter((m) => matchesQuery(term, m.fullName, m.email))
            .map((m) => ({ id: m.id, fullName: m.fullName, email: m.email })),
          tasks: tasksRes.data,
        });
      } catch {
        setResults(EMPTY);
      } finally {
        setLoading(false);
      }
    },
    [accessToken, workspaceId]
  );

  useEffect(() => {
    const term = query.trim();
    if (!term || !ready) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void runSearch(term);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query, ready, runSearch]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const term = query.trim();
  const hasResults =
    results.channels.length > 0 ||
    results.dms.length > 0 ||
    results.people.length > 0 ||
    results.tasks.length > 0;
  const showPanel = open && term.length > 0;

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const personHref = (personId: string) => {
    const dm = results.allDms.find(
      (d) => !d.isGroup && d.otherUserId === personId
    );
    return dm ? `/chat/dm/${dm.id}` : "/people";
  };

  return (
    <div ref={rootRef} className="relative w-full max-w-[520px]">
      <SearchIcon className="absolute top-1/2 left-3 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="h-8 rounded-full bg-background pl-8 text-sm"
        placeholder="Search Kinetix"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label="Search workspace"
        aria-expanded={showPanel}
        aria-controls="global-search-results"
        autoComplete="off"
      />
      {showPanel ? (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute top-[calc(100%+6px)] z-50 max-h-[min(420px,70vh)] w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md"
        >
          {loading ? (
            <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Spinner size="sm" label="Searching" />
              Searching…
            </p>
          ) : !hasResults ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              No results for &ldquo;{term}&rdquo;
            </p>
          ) : (
            <>
            <SearchSection title="Channels" show={results.channels.length > 0}>
              {results.channels.map((c) => (
                <SearchRow
                  key={`c-${c.id}`}
                  icon={<HashIcon className="size-3.5" />}
                  label={c.name}
                  hint={c.topic || c.lastMessage}
                  onSelect={() => go(`/chat/c/${c.id}`)}
                />
              ))}
            </SearchSection>
            <SearchSection title="Direct messages" show={results.dms.length > 0}>
              {results.dms.map((d) => (
                <SearchRow
                  key={`d-${d.id}`}
                  icon={<MessageCircleIcon className="size-3.5" />}
                  label={d.name}
                  hint={d.lastMessage}
                  onSelect={() => go(`/chat/dm/${d.id}`)}
                />
              ))}
            </SearchSection>
            <SearchSection title="People" show={results.people.length > 0}>
              {results.people.map((p) => (
                <SearchRow
                  key={`p-${p.id}`}
                  icon={<UserIcon className="size-3.5" />}
                  label={p.fullName}
                  hint={p.email}
                  onSelect={() => go(personHref(p.id))}
                />
              ))}
            </SearchSection>
            <SearchSection title="Tasks" show={results.tasks.length > 0}>
              {results.tasks.map((t) => (
                <SearchRow
                  key={`t-${t.id}`}
                  icon={<CheckSquareIcon className="size-3.5" />}
                  label={t.name}
                  hint={[t.space, t.list].filter(Boolean).join(" · ")}
                  onSelect={() => go(`/home/tasks/${t.id}`)}
                />
              ))}
            </SearchSection>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SearchSection({
  title,
  show,
  children,
}: {
  title: string;
  show: boolean;
  children: React.ReactNode;
}) {
  if (!show) return null;
  return (
    <div className="border-b border-border/60 py-1 last:border-0">
      <p className="px-2 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

function SearchRow({
  icon,
  label,
  hint,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
        "hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
      )}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{label}</span>
        {hint ? (
          <span className="block truncate text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </span>
    </button>
  );
}
