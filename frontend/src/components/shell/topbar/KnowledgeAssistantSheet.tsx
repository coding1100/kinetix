"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { useAiStore } from "@/stores/ai-store";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { queryKnowledgeBase, type KnowledgeQueryResponse } from "@/lib/api/ai";
import {
  SparklesIcon,
  SendIcon,
  BookOpenIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HelpCircleIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatRequestError } from "@/lib/api/client";

const SUGGESTED_QUERIES = [
  "What is our annual leave & PTO policy?",
  "How do I request IT hardware or VPN access?",
  "What are our company security guidelines?",
  "How are expenses and reimbursements handled?",
];

export function KnowledgeAssistantSheet() {
  const { isKnowledgeAssistantOpen, closeKnowledgeAssistant, activeQuery } =
    useAiStore();
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [queryInput, setQueryInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<KnowledgeQueryResponse | null>(null);

  useEffect(() => {
    if (activeQuery) {
      setQueryInput(activeQuery);
      if (ready && accessToken && workspaceId) {
        void handleSearch(activeQuery);
      }
    }
  }, [activeQuery, ready, accessToken, workspaceId]);

  const handleSearch = async (qText?: string) => {
    const q = (qText ?? queryInput).trim();
    if (!q || !ready || !accessToken || !workspaceId) return;

    setLoading(true);
    setResponse(null);

    try {
      const res = await queryKnowledgeBase(accessToken, workspaceId, { query: q });
      setResponse(res);
    } catch (err) {
      toast.error(`Knowledge query failed — ${formatRequestError(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet
      open={isKnowledgeAssistantOpen}
      onOpenChange={(open) => {
        if (!open) closeKnowledgeAssistant();
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0 gap-0 border-l border-border shadow-2xl">
        <SheetHeader className="p-4 border-b border-border bg-gradient-to-r from-indigo-50/80 via-background to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/20">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
              <SparklesIcon className="size-4" />
            </div>
            <div>
              <SheetTitle className="text-base font-bold text-foreground">
                Company Knowledge Assistant
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Authoritative AI Q&A across company policies, HR guides, and SOPs.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Input Form */}
        <div className="p-3.5 border-b border-border bg-muted/20">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSearch();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Ask about company policies, leave, IT..."
              className="h-9 text-xs bg-background"
            />
            <Button
              type="submit"
              size="sm"
              disabled={loading || !queryInput.trim()}
              className="h-9 px-3 gap-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              {loading ? (
                <Spinner className="size-3.5" />
              ) : (
                <SendIcon className="size-3.5" />
              )}
            </Button>
          </form>
        </div>

        <ScrollArea className="flex-1 p-4">
          {loading ? (
            <div className="flex h-56 flex-col items-center justify-center gap-3">
              <Spinner className="size-8 text-indigo-600" />
              <p className="text-xs font-medium text-foreground animate-pulse">
                Searching company policy vector index...
              </p>
            </div>
          ) : response ? (
            <div className="space-y-4">
              {/* Query Badge */}
              <div className="text-xs text-muted-foreground font-medium">
                Query: <span className="text-foreground italic">"{response.query}"</span>
              </div>

              {/* Answer Card */}
              <div className="rounded-xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/50 via-card to-purple-50/20 p-4 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/30">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                  <BookOpenIcon className="size-3.5" />
                  Official Answer
                </div>
                <div className="text-xs leading-relaxed text-foreground whitespace-pre-line">
                  {response.answer}
                </div>
              </div>

              {/* Action Chips */}
              {response.actionChips.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Recommended Action Shortcuts
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {response.actionChips.map((chip, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/50 py-1 px-3 text-xs text-indigo-700 dark:text-indigo-300 gap-1 border border-indigo-200 dark:border-indigo-800 transition-colors"
                        onClick={() => {
                          toast.info(`Action Triggered: ${chip.label}`);
                        }}
                      >
                        {chip.label}
                        <ExternalLinkIcon className="size-3" />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Cited Documents */}
              {response.citations.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Cited Sources ({response.citations.length})
                  </h4>
                  <div className="space-y-2">
                    {response.citations.map((cite) => (
                      <div
                        key={cite.id}
                        className="rounded-lg border border-border bg-card p-3 text-xs shadow-sm hover:border-indigo-200 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            <FileTextIcon className="size-3.5 text-indigo-500" />
                            {cite.title}
                          </span>
                          <Badge variant="outline" className="text-[10px] bg-muted/50">
                            {cite.category}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3 bg-muted/30 p-2 rounded">
                          "{cite.snippet}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="mx-auto grid size-12 place-items-center rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                  <ShieldCheckIcon className="size-6" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Ask the Company AI Assistant</h3>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Instant answers grounded in official company policy documents, HR guidelines, and IT standard operating procedures.
                </p>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <HelpCircleIcon className="size-3.5" />
                  Suggested Questions:
                </h4>
                <div className="space-y-1.5">
                  {SUGGESTED_QUERIES.map((sq, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setQueryInput(sq);
                        void handleSearch(sq);
                      }}
                      className="w-full text-left rounded-lg border border-border bg-card p-2.5 text-xs text-foreground hover:bg-indigo-50/50 hover:border-indigo-200 dark:hover:bg-indigo-950/30 transition-colors"
                    >
                      {sq}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
