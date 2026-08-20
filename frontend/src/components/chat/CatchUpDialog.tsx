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
import { fetchCatchUp, type CatchUpResponse } from "@/lib/api/ai";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import {
  SparklesIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  MessageSquareIcon,
  CopyIcon,
  CheckIcon,
  RefreshCwIcon,
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
  // Strip any raw HTML tags and em dashes
  const noHtml = str.replace(/<[^>]*>?/gm, " ").replace(/&nbsp;/g, " ");
  const noEmDash = noHtml.replace(/—/g, " - ").replace(/–/g, " - ");
  return noEmDash.replace(/\s+/g, " ").trim();
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

  const cleanTitle = cleanString(title);

  const loadCatchUp = async () => {
    if (!open || !ready || !accessToken || !workspaceId) return;

    setLoading(true);
    setData(null);

    try {
      const res = await fetchCatchUp(accessToken, workspaceId, {
        conversationType,
        conversationId,
        limit: 50,
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

  const handleCopySummary = () => {
    if (!data) return;
    const textToCopy = `Catch Up Status (${cleanTitle}):\n${cleanString(data.summary)}\n\nKey Decisions:\n${data.keyDecisions.map(cleanString).join(
      "\n"
    )}\n\nAction Items & Issues:\n${data.actionItems.map(cleanString).join("\n")}`;
    void navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success("Status summary copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:rounded-2xl p-0 overflow-hidden border-border shadow-2xl">
        <DialogHeader className="p-5 border-b border-border bg-gradient-to-r from-indigo-50/80 via-background to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/20 pr-12">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20 mt-0.5">
                <SparklesIcon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-bold text-foreground truncate leading-snug">
                  Catch Me Up: {cleanTitle}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  AI status summary, key decisions, and action items.
                </DialogDescription>
              </div>
            </div>
            {data && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-semibold"
                  onClick={handleCopySummary}
                >
                  {copied ? (
                    <CheckIcon className="size-3.5 text-emerald-500" />
                  ) : (
                    <CopyIcon className="size-3.5" />
                  )}
                  <span>{copied ? "Copied" : "Copy"}</span>
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

        {loading ? (
          <div className="flex h-72 flex-col items-center justify-center gap-3 p-6">
            <Spinner className="size-8 text-indigo-600" />
            <p className="text-sm font-semibold text-foreground animate-pulse">
              Analyzing conversation status with Gemini...
            </p>
            <p className="text-xs text-muted-foreground">
              Extracting decisions, issues, and channel updates
            </p>
          </div>
        ) : data ? (
          <ScrollArea className="max-h-[65vh] p-5">
            <div className="space-y-5">
              {/* Status & Overview Box */}
              <div className="rounded-xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/70 to-purple-50/30 p-4 dark:border-indigo-900/40 dark:from-indigo-950/30 dark:to-purple-950/20 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                    Channel Status & Overview
                  </span>
                  <Badge variant="secondary" className="text-[10px] bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                    {data.messageCount} messages analyzed
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm leading-relaxed text-foreground font-normal">
                  {cleanString(data.summary)}
                </p>
              </div>

              {/* Key Decisions */}
              <div>
                <h4 className="flex items-center gap-2 text-xs font-bold text-foreground mb-2.5">
                  <CheckCircle2Icon className="size-4 text-emerald-500" />
                  Key Decisions ({data.keyDecisions.length})
                </h4>
                {data.keyDecisions.length > 0 ? (
                  <div className="space-y-2">
                    {data.keyDecisions.map((decision, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-border bg-card p-3 text-xs leading-relaxed text-foreground shadow-sm font-normal"
                      >
                        {cleanString(decision)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic pl-1">
                    No explicit decisions recorded in recent messages.
                  </p>
                )}
              </div>

              {/* Action Items / Issues */}
              <div>
                <h4 className="flex items-center gap-2 text-xs font-bold text-foreground mb-2.5">
                  <AlertCircleIcon className="size-4 text-amber-500" />
                  Action Items & Issues ({data.actionItems.length})
                </h4>
                {data.actionItems.length > 0 ? (
                  <div className="space-y-2">
                    {data.actionItems.map((action, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-border bg-card p-3 text-xs leading-relaxed text-foreground shadow-sm flex items-start gap-2.5 font-normal"
                      >
                        <span className="shrink-0 mt-1 size-2 rounded-full bg-amber-500" />
                        <span className="flex-1">{cleanString(action)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic pl-1">
                    No action items or active issues logged.
                  </p>
                )}
              </div>

              {/* Mentions */}
              {data.mentions.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-2 text-xs font-bold text-foreground mb-2.5">
                    <MessageSquareIcon className="size-4 text-blue-500" />
                    Direct Mentions & Highlights ({data.mentions.length})
                  </h4>
                  <div className="space-y-2">
                    {data.mentions.map((mention, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-blue-200/60 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/20 p-3 text-xs leading-relaxed text-foreground font-normal"
                      >
                        {cleanString(mention)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No summary data available.
          </div>
        )}

        <div className="flex justify-end border-t border-border bg-muted/20 p-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
