"use client";

import { useState } from "react";
import { ZapIcon, ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AutomationsBuilderModal({
  open,
  onOpenChange,
  workspaceId,
  spaceId,
  listId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  spaceId?: string;
  listId?: string;
}) {
  const [name, setName] = useState("Auto-Assign Lead on Completion");
  const [triggerType, setTriggerType] = useState("STATUS_CHANGED");
  const [actionType, setActionType] = useState("ADD_TAG");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/automations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          spaceId,
          listId,
          triggerType,
          triggerConfig: { targetStatus: "DONE" },
          actionType,
          actionConfig: { tag: "reviewed" },
        }),
      });
      if (res.ok) {
        onOpenChange(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ZapIcon className="size-4 text-amber-500" />
            Create Task Automation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Automation Rule Name</label>
            <Input className="mt-1 h-8 text-xs" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-3">
            <div>
              <span className="text-[11px] font-bold uppercase text-primary">WHEN (Trigger)</span>
              <Select value={triggerType} onValueChange={(v) => setTriggerType(v || "STATUS_CHANGED")}>
                <SelectTrigger className="mt-1 h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STATUS_CHANGED">Status changes to Done</SelectItem>
                  <SelectItem value="TASK_CREATED">New Task is created</SelectItem>
                  <SelectItem value="DUE_DATE_ARRIVED">Due Date arrives</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-center">
              <ArrowRightIcon className="size-4 text-muted-foreground rotate-90" />
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase text-amber-500">THEN (Action)</span>
              <Select value={actionType} onValueChange={(v) => setActionType(v || "ADD_TAG")}>

                <SelectTrigger className="mt-1 h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADD_TAG">Add Tag "#reviewed"</SelectItem>
                  <SelectItem value="CHANGE_STATUS">Set Status to In Review</SelectItem>
                  <SelectItem value="ASSIGN_USER">Assign to Project Lead</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" disabled={saving} onClick={handleCreate}>
              {saving ? "Saving Rule…" : "Create Automation"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
