"use client";

import { useEffect, useState } from "react";
import { CopyIcon, SparklesIcon, XIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function TemplateLibraryModal({
  open,
  onOpenChange,
  workspaceId,
  targetListId,
  onInstantiated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  targetListId?: string;
  onInstantiated?: () => void;
}) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [instantiating, setInstantiating] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!open || !workspaceId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/workspaces/${workspaceId}/templates`);
        if (res.ok) {
          const data = await res.json();
          setTemplates(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [open, workspaceId]);

  async function handleInstantiate(templateId: string) {
    setInstantiating(templateId);
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/templates/${templateId}/instantiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: targetListId }),
      });
      if (res.ok) {
        onInstantiated?.();
        onOpenChange(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInstantiating(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-primary" />
            Template Library
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-3 max-h-96 overflow-auto pr-1">
          {loading ? (
            <div className="py-6 text-center text-xs text-muted-foreground">Loading templates…</div>
          ) : templates.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No saved templates found in this workspace. Create templates from the Task Drawer or List settings.
            </div>
          ) : (
            templates.map((tpl) => (
              <div key={tpl.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{tpl.name}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase font-bold text-muted-foreground">
                      {tpl.scope}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{tpl.description || "Reusable entity template"}</p>
                </div>
                <Button
                  size="xs"
                  disabled={instantiating === tpl.id}
                  onClick={() => handleInstantiate(tpl.id)}
                  className="gap-1"
                >
                  <CopyIcon className="size-3" />
                  {instantiating === tpl.id ? "Applying…" : "Use Template"}
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
