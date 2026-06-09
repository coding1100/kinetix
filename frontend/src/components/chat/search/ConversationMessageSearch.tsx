"use client";

import { useEffect, useState } from "react";
import { SearchIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import type { ChatSearchHit } from "@/lib/types/chat";
import { formatChatMessageTime } from "@/lib/chat/dates";
import {
  highlightSearchSnippet,
  plainMessageBody,
} from "@/lib/chat/message-search";
import { resolveMessageAuthorName } from "@/lib/chat/messages";
import { useAuthStore } from "@/stores/auth-store";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ConversationMessageSearchProps = {
  placeholder: string;
  emptyHint: string;
  query: string;
  onQueryChange: (value: string) => void;
  results: ChatSearchHit[];
  loading: boolean;
  onSelect: (hit: ChatSearchHit) => void;
};

export function ConversationMessageSearch({
  placeholder,
  emptyHint,
  query,
  onQueryChange,
  results,
  loading,
  onSelect,
}: ConversationMessageSearchProps) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const currentUserFullName = useAuthStore((s) => s.user?.fullName);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const trimmed = query.trim();

  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          className="pl-8"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          autoFocus={mounted}
        />
        {loading ? (
          <Spinner
            size="sm"
            label="Searching"
            className="absolute top-2.5 right-2.5 text-muted-foreground"
          />
        ) : null}
      </div>

      {trimmed === "" ? (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      ) : !loading && results.length === 0 ? (
        <p className="text-sm text-muted-foreground">No messages found.</p>
      ) : (
        <ul className="space-y-2">
          {results.map((hit) => {
            const snippet = highlightSearchSnippet(hit.body, trimmed);
            const authorName = resolveMessageAuthorName(hit, {
              currentUserId,
              currentUserFullName,
            });
            return (
              <li key={hit.id}>
                <button
                  type="button"
                  onClick={() => onSelect(hit)}
                  className={cn(
                    "w-full cursor-pointer rounded-lg border border-border px-3 py-2 text-left transition-colors",
                    "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium">{authorName}</p>
                    {hit.inThread ? (
                      <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                        Thread
                      </Badge>
                    ) : null}
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {formatChatMessageTime(new Date(hit.createdAt))}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {snippet?.match ? (
                      <>
                        {snippet.before}
                        <span className="font-medium text-foreground">
                          {snippet.match}
                        </span>
                        {snippet.after}
                      </>
                    ) : (
                      plainMessageBody(hit.body)
                    )}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
