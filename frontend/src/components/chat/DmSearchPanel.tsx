"use client";

import { useCallback, useEffect, useState } from "react";
import { XIcon } from "lucide-react";
import type { ChatSearchHit } from "@/lib/types/chat";
import { searchDmMessages } from "@/lib/api/chat";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useChatStore } from "@/stores/chat-store";
import { PanelCardShell } from "@/components/shared/PanelCardShell";
import { ConversationMessageSearch } from "@/components/chat/search/ConversationMessageSearch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

export function DmSearchPanel({
  conversationId,
  onSelect,
}: {
  conversationId: string;
  onSelect: (hit: ChatSearchHit) => void;
}) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const setDmDetailsView = useChatStore((s) => s.setDmDetailsView);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChatSearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(
    async (term: string) => {
      if (!ready || !term.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await searchDmMessages(
          accessToken,
          workspaceId,
          conversationId,
          term
        );
        setResults(res.data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [accessToken, conversationId, ready, workspaceId]
  );

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults([]);
      setLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      void runSearch(term);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const handleSelect = (hit: ChatSearchHit) => {
    setDmDetailsView(null);
    onSelect(hit);
  };

  return (
    <PanelCardShell
      widthClass="w-[340px]"
      marginClassName="box-border flex h-full shrink-0 py-3 pl-2 pr-1"
    >
      <div className="flex h-12 shrink-0 items-center justify-between px-4 pt-1">
        <span className="text-sm font-semibold">Search messages</span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 rounded-full"
          onClick={() => setDmDetailsView(null)}
          aria-label="Close search"
        >
          <XIcon className="size-4" strokeWidth={1.5} />
        </Button>
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          <ConversationMessageSearch
            placeholder="Search messages in this DM"
            emptyHint="Search keywords or phrases in this conversation only."
            query={query}
            onQueryChange={setQuery}
            results={results}
            loading={loading}
            onSelect={handleSelect}
          />
        </div>
      </ScrollArea>
    </PanelCardShell>
  );
}
