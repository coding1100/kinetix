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
            <div className="space-y-6">
              {/* Executive Overview Box */}
              <div className="rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/80 via-card to-purple-50/40 p-5 dark:border-indigo-900/50 dark:from-indigo-950/40 dark:to-purple-950/30 shadow-sm">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                    <SparklesIcon className="size-3.5" />
                    Channel Status & Overview
                  </span>
                  <Badge variant="secondary" className="text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {data.messageCount} messages analyzed
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed text-foreground font-normal">
                  {cleanString(data.summary)}
                </p>
              </div>

              {/* Two-Column Layout for Decisions & Action Items */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Key Decisions */}
                <div className="space-y-3">
                  <h4 className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <CheckCircle2Icon className="size-4 text-emerald-500" />
                    Key Decisions ({data.keyDecisions.length})
                  </h4>
                  {data.keyDecisions.length > 0 ? (
                    <div className="space-y-2.5">
                      {data.keyDecisions.map((decision, i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-emerald-200/60 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/20 p-3.5 text-xs leading-relaxed text-foreground shadow-sm"
                        >
                          {cleanString(decision)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground italic">
                      No explicit decisions recorded in recent messages.
                    </div>
                  )}
                </div>

                {/* Action Items / Issues */}
                <div className="space-y-3">
                  <h4 className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <AlertCircleIcon className="size-4 text-amber-500" />
                    Action Items & Active Issues ({data.actionItems.length})
                  </h4>
                  {data.actionItems.length > 0 ? (
                    <div className="space-y-2.5">
                      {data.actionItems.map((action, i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-amber-200/60 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/20 p-3.5 text-xs leading-relaxed text-foreground shadow-sm flex items-start gap-2.5"
                        >
                          <span className="shrink-0 mt-1 size-2 rounded-full bg-amber-500" />
                          <span className="flex-1">{cleanString(action)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground italic">
                      No action items or active issues logged.
                    </div>
                  )}
                </div>
              </div>

              {/* Mentions & Direct Highlights */}
              {data.mentions.length > 0 && (
                <div className="space-y-3 pt-1">
                  <h4 className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <MessageSquareIcon className="size-4 text-blue-500" />
                    Direct Mentions & Highlights ({data.mentions.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {data.mentions.map((mention, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-blue-200/60 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/20 p-3.5 text-xs leading-relaxed text-foreground"
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
