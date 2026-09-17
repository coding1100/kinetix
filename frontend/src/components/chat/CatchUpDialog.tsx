"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { fetchCatchUp, type CatchUpResponse, type CatchUpItem } from "@/lib/api/ai";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useChatStore } from "@/stores/chat-store";
import { createTaskFromThreadMessage } from "@/lib/spaces/create-task-from-thread";
import {
  SparklesIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  MessageSquareIcon,
  CopyIcon,
  CheckIcon,
  RefreshCwIcon,
  ArrowUpRightIcon,
  PlusIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatRequestError } from "@/lib/api/client";

interface CatchUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationType: "channel" | "dm";
  conversationId: string;
  title: string;
}

function cleanString(str: string): string {
  if (!str) return "";
  // Strip raw HTML tags
  let cleaned = str.replace(/<[^>]*>?/gm, " ").replace(/&nbsp;/g, " ");
  // Prohibit em dashes
  cleaned = cleaned.replace(/—/g, " - ").replace(/–/g, " - ");
  // Fix missing spaces around parentheses like "Testing(UAT)- Kinetix" -> "Testing (UAT) - Kinetix"
  cleaned = cleaned.replace(/([a-zA-Z0-9])\(/g, "$1 (");
  cleaned = cleaned.replace(/\)([a-zA-Z0-9])/g, ") $1");
  cleaned = cleaned.replace(/-([a-zA-Z0-9])/g, " - $1");
  return cleaned.replace(/\s+/g, " ").trim();
}

function getItemDetails(item: string | CatchUpItem): { text: string; messageId?: string | null } {
  if (typeof item === "string") {
    return { text: item, messageId: null };
  }
  return { text: item.text, messageId: item.messageId ?? null };
}

export function CatchUpDialog({
  open,
  onOpenChange,
  conversationType,
  conversationId,
  title,
}: CatchUpDialogProps) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState<CatchUpResponse | null>(null);
  const [creatingTaskIndex, setCreatingTaskIndex] = useState<number | null>(null);
  const [createdTaskIndices, setCreatedTaskIndices] = useState<Set<number>>(new Set());

  const cleanTitle = cleanString(title);

  const loadCatchUp = async () => {
    if (!open || !ready || !accessToken || !workspaceId) return;

    setLoading(true);
    setData(null);
    setCreatedTaskIndices(new Set());

    try {
      const res = await fetchCatchUp(accessToken, workspaceId, {
        conversationType,
        conversationId,
      });
      setData(res);
    } catch (err) {
      toast.error(`Catch Up failed — ${formatRequestError(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void loadCatchUp();
    }
  }, [open, ready, accessToken, workspaceId, conversationType, conversationId]);

  const handleJumpToMessage = (messageId: string) => {
    useChatStore.getState().requestMessageScroll(messageId);
    onOpenChange(false);
    toast.success("Navigated to original message in chat");
  };

  const handleCreateTask = async (actionText: string, index: number) => {
    if (!accessToken || !workspaceId) return;
    setCreatingTaskIndex(index);
    try {
      const { task } = await createTaskFromThreadMessage(
        accessToken,
        workspaceId,
        actionText
      );
      setCreatedTaskIndices((prev) => new Set(prev).add(index));
      toast.success(`Task created: "${task.name.slice(0, 32)}..."`);
    } catch (err) {
      toast.error(`Failed to create task — ${formatRequestError(err)}`);
    } finally {
      setCreatingTaskIndex(null);
    }
  };

  const handleCopySummary = () => {
    if (!data) return;
    const textToCopy = `Catch Up Status (${cleanTitle}):\n${cleanString(data.summary)}\n\nKey Decisions:\n${data.keyDecisions.map((d) => cleanString(getItemDetails(d).text)).join(
      "\n"
    )}\n\nAction Items & Issues:\n${data.actionItems.map((a) => cleanString(getItemDetails(a).text)).join("\n")}`;
    void navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success("Status summary copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl lg:max-w-4xl w-[92vw] sm:rounded-2xl p-0 overflow-hidden border-border shadow-2xl bg-background">
        {/* Header */}
        <DialogHeader className="p-5 border-b border-border bg-gradient-to-r from-indigo-50/90 via-background to-purple-50/60 dark:from-indigo-950/40 dark:to-purple-950/30 pr-14">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25">
                <SparklesIcon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground truncate tracking-tight">
                  Catch Me Up: {cleanTitle}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  AI-powered channel status report, decisions, and active issues.
                </DialogDescription>
              </div>
            </div>

            {data && (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-semibold bg-background hover:bg-muted"
                  onClick={handleCopySummary}
                >
                  {copied ? (
                    <CheckIcon className="size-3.5 text-emerald-500" />
                  ) : (
                    <CopyIcon className="size-3.5" />
                  )}
                  <span>{copied ? "Copied" : "Copy Status"}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => void loadCatchUp()}
                  title="Refresh Summary"
                >
                  <RefreshCwIcon className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Content Body */}
        {loading ? (
          <div className="flex h-80 flex-col items-center justify-center gap-3 p-6">
            <Spinner className="size-8 text-indigo-600" />
            <p className="text-sm font-semibold text-foreground animate-pulse">
              Generating executive channel status with Gemini...
            </p>
            <p className="text-xs text-muted-foreground">
              Analyzing latest messages, decisions, and active issues
            </p>
          </div>
        ) : data ? (
          <ScrollArea className="max-h-[70vh] p-6">
            <div className="space-y-5">
              {/* Executive Overview Box */}
              <div className="rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/80 via-card to-purple-50/40 p-5 dark:border-indigo-900/50 dark:from-indigo-950/40 dark:to-purple-950/30 shadow-sm">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                    <SparklesIcon className="size-3.5" />
                    Summary
                  </span>
                  <Badge variant="secondary" className="text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {data.messageCount} messages
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed text-foreground font-normal">
                  {cleanString(data.summary)}
                </p>
              </div>

              {/* Key Decisions - compact scannable list */}
              <div className="space-y-2">
                <h4 className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <CheckCircle2Icon className="size-3.5 text-emerald-500" />
                  Key Decisions
                </h4>
                {data.keyDecisions.length > 0 ? (
                  <ul className="space-y-1.5">
                    {data.keyDecisions.map((decision, i) => {
                      const { text, messageId } = getItemDetails(decision);
                      return (
                        <li
                          key={i}
                          className="group flex items-start justify-between gap-2 text-xs leading-relaxed text-foreground rounded-lg p-1.5 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <span className="shrink-0 mt-1.5 size-1.5 rounded-full bg-emerald-500" />
                            <span className="flex-1">{cleanString(text)}</span>
                          </div>
                          {messageId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleJumpToMessage(messageId)}
                              title="Jump to message in chat"
                              className="h-6 px-1.5 text-[11px] gap-1 opacity-80 group-hover:opacity-100 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 shrink-0"
                            >
                              <span>Jump</span>
                              <ArrowUpRightIcon className="size-3" />
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No explicit decisions in this range.
                  </p>
                )}
              </div>

              {/* Action Items / Issues - compact scannable list */}
              <div className="space-y-2">
                <h4 className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <AlertCircleIcon className="size-3.5 text-amber-500" />
                  Action Items & Open Issues
                </h4>
                {data.actionItems.length > 0 ? (
                  <ul className="space-y-1.5">
                    {data.actionItems.map((action, i) => {
                      const { text, messageId } = getItemDetails(action);
                      const isCreating = creatingTaskIndex === i;
                      const isCreated = createdTaskIndices.has(i);
                      return (
                        <li
                          key={i}
                          className="group flex items-start justify-between gap-2 text-xs leading-relaxed text-foreground rounded-lg p-1.5 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <span className="shrink-0 mt-1.5 size-1.5 rounded-full bg-amber-500" />
                            <span className="flex-1">{cleanString(text)}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {messageId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleJumpToMessage(messageId)}
                                title="Jump to message in chat"
                                className="h-6 px-1.5 text-[11px] gap-1 opacity-80 group-hover:opacity-100 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                              >
                                <span>Jump</span>
                                <ArrowUpRightIcon className="size-3" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isCreating || isCreated}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleCreateTask(text, i);
                              }}
                              title="Convert this action item to a workspace task"
                              className="h-6 px-2 text-[11px] gap-1 font-medium bg-background hover:bg-accent"
                            >
                              {isCreating ? (
                                <Spinner className="size-3" />
                              ) : isCreated ? (
                                <>
                                  <CheckIcon className="size-3 text-emerald-500" />
                                  <span className="text-emerald-600 dark:text-emerald-400">Created</span>
                                </>
                              ) : (
                                <>
                                  <PlusIcon className="size-3 text-muted-foreground" />
                                  <span>Add Task</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No open action items logged.
                  </p>
                )}
              </div>

              {/* Mentions & Direct Highlights */}
              {data.mentions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <MessageSquareIcon className="size-3.5 text-blue-500" />
                    Mentioned You
                  </h4>
                  <ul className="space-y-1.5">
                    {data.mentions.map((mention, i) => {
                      const { text, messageId } = getItemDetails(mention);
                      return (
                        <li
                          key={i}
                          className="group flex items-start justify-between gap-2 text-xs leading-relaxed text-foreground rounded-lg p-1.5 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <span className="shrink-0 mt-1.5 size-1.5 rounded-full bg-blue-500" />
                            <span className="flex-1">{cleanString(text)}</span>
                          </div>
                          {messageId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleJumpToMessage(messageId)}
                              title="Jump to message in chat"
                              className="h-6 px-1.5 text-[11px] gap-1 opacity-80 group-hover:opacity-100 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 shrink-0"
                            >
                              <span>Jump</span>
                              <ArrowUpRightIcon className="size-3" />
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No summary data available.
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end border-t border-border bg-muted/20 p-3.5">
          <Button variant="outline" size="sm" className="px-5 font-semibold" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
