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
    const textToCopy = `Catch Up Summary (${title}):\n${data.summary}\n\nKey Decisions:\n${data.keyDecisions.join(
      "\n"
    )}\n\nAction Items:\n${data.actionItems.join("\n")}`;
    void navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success("Summary copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:rounded-2xl p-0 overflow-hidden border-border shadow-2xl">
        <DialogHeader className="p-5 border-b border-border bg-gradient-to-r from-indigo-50/80 via-background to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
                <SparklesIcon className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  Catch Me Up — {title}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  AI-extracted summary, key decisions, and action items.
                </DialogDescription>
              </div>
            </div>
            {data && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs"
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
            <p className="text-sm font-medium text-foreground animate-pulse">
              Analyzing recent conversation...
            </p>
            <p className="text-xs text-muted-foreground">
              Extracting key decisions and action items
            </p>
          </div>
        ) : data ? (
          <ScrollArea className="max-h-[65vh] p-5">
            <div className="space-y-5">
              {/* Executive Overview Box */}
              <div className="rounded-xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/70 to-purple-50/30 p-4 dark:border-indigo-900/40 dark:from-indigo-950/30 dark:to-purple-950/20 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                    Discussion Overview
                  </span>
                  <Badge variant="secondary" className="text-[10px] bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                    {data.messageCount} messages analyzed
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm leading-relaxed text-foreground">
                  {data.summary}
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
                        className="rounded-lg border border-border bg-card p-3 text-xs leading-relaxed text-foreground shadow-sm"
                      >
                        {decision}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic pl-1">
                    No explicit decisions detected in recent messages.
                  </p>
                )}
              </div>

              {/* Action Items */}
              <div>
                <h4 className="flex items-center gap-2 text-xs font-bold text-foreground mb-2.5">
                  <AlertCircleIcon className="size-4 text-amber-500" />
                  Action Items & Tasks ({data.actionItems.length})
                </h4>
                {data.actionItems.length > 0 ? (
                  <div className="space-y-2">
                    {data.actionItems.map((action, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-border bg-card p-3 text-xs leading-relaxed text-foreground shadow-sm flex items-start gap-2"
                      >
                        <span className="shrink-0 mt-0.5 size-1.5 rounded-full bg-amber-500" />
                        <span>{action}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic pl-1">
                    No action items or assigned tasks detected.
                  </p>
                )}
              </div>

              {/* Relevant Mentions */}
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
                        className="rounded-lg border border-blue-200/60 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/20 p-3 text-xs leading-relaxed text-foreground"
                      >
                        {mention}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No summary data loaded.
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
