"use client";

import { useEffect, useState } from "react";
import { PlusIcon, Trash2Icon, RotateCcwIcon, CheckIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { patchList, patchSpace, type StatusConfigItem } from "@/lib/api/spaces";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useSpacesStore } from "@/stores/spaces-store";
import { formatRequestError } from "@/lib/api/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DEFAULT_COLOR_PALETTE = [
  "#87909E", // Gray
  "#7B68EE", // Purple
  "#4194F6", // Blue
  "#36B37E", // Green
  "#F57C00", // Orange
  "#E53935", // Red
  "#EC4899", // Pink
  "#0F766E", // Teal
];

type StatusGroupType = "NOT_STARTED" | "ACTIVE" | "DONE" | "CLOSED";

const STATUS_GROUP_LABELS: Record<StatusGroupType, { label: string; defaultColor: string }> = {
  NOT_STARTED: { label: "Not Started", defaultColor: "#87909E" },
  ACTIVE: { label: "Active", defaultColor: "#4194F6" },
  DONE: { label: "Done", defaultColor: "#36B37E" },
  CLOSED: { label: "Closed", defaultColor: "#0F766E" },
};

interface LocalStatusItem {
  id: string;
  name: string;
  color: string;
  statusGroup: StatusGroupType;
  legacyKey?: string | null;
}

interface StatusSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: "space" | "list";
  targetId: string;
  targetName: string;
  initialStatuses?: StatusConfigItem[];
  canInherit?: boolean;
}

export function StatusSettingsDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  targetName,
  initialStatuses,
  canInherit = false,
}: StatusSettingsDialogProps) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const bumpSpacesRefresh = useSpacesStore((s) => s.bumpRefresh);

  const [statuses, setStatuses] = useState<LocalStatusItem[]>([]);
  const [inheritFromSpace, setInheritFromSpace] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusGroup, setNewStatusGroup] = useState<StatusGroupType>("ACTIVE");
  const [newStatusColor, setNewStatusColor] = useState("#4194F6");

  useEffect(() => {
    if (!open) return;
    if (initialStatuses && initialStatuses.length > 0) {
      setStatuses(
        initialStatuses.map((s, idx) => ({
          id: `status-${idx}-${Date.now()}`,
          name: s.name,
          color: s.color,
          statusGroup: s.statusGroup as StatusGroupType,
          legacyKey: s.legacyKey,
        }))
      );
      setInheritFromSpace(false);
    } else {
      // Default fallback ClickUp status set
      setStatuses([
        { id: "1", name: "TO DO", color: "#87909E", statusGroup: "NOT_STARTED", legacyKey: "TODO" },
        { id: "2", name: "IN PROGRESS", color: "#4194F6", statusGroup: "ACTIVE", legacyKey: "IN_PROGRESS" },
        { id: "3", name: "COMPLETE", color: "#36B37E", statusGroup: "DONE", legacyKey: "DONE" },
      ]);
      setInheritFromSpace(canInherit);
    }
  }, [open, initialStatuses, canInherit]);

  function handleAddStatus() {
    const trimmed = newStatusName.trim();
    if (!trimmed) return;
    if (statuses.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("A status with this name already exists");
      return;
    }
    setStatuses((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        name: trimmed.toUpperCase(),
        color: newStatusColor,
        statusGroup: newStatusGroup,
      },
    ]);
    setNewStatusName("");
  }

  function handleRemoveStatus(id: string) {
    if (statuses.length <= 1) {
      toast.error("You must have at least one status");
      return;
    }
    setStatuses((prev) => prev.filter((s) => s.id !== id));
  }

  function handleColorChange(id: string, color: string) {
    setStatuses((prev) =>
      prev.map((s) => (s.id === id ? { ...s, color } : s))
    );
  }

  async function handleSave() {
    if (!ready || !accessToken || !workspaceId) return;
    setSaving(true);
    try {
      if (targetType === "space") {
        await patchSpace(accessToken, workspaceId, targetId, {
          statusConfig: statuses.map((s) => ({
            name: s.name,
            color: s.color,
            statusGroup: s.statusGroup,
            legacyKey: s.legacyKey,
          })),
        });
        toast.success("Space statuses updated");
      } else {
        if (inheritFromSpace) {
          await patchList(accessToken, workspaceId, targetId, {
            inheritStatusConfig: true,
          });
          toast.success("List set to inherit Space statuses");
        } else {
          await patchList(accessToken, workspaceId, targetId, {
            statusConfig: statuses.map((s) => ({
              name: s.name,
              color: s.color,
              statusGroup: s.statusGroup,
              legacyKey: s.legacyKey,
            })),
          });
          toast.success("List statuses updated");
        }
      }
      bumpSpacesRefresh();
      onOpenChange(false);
    } catch (err) {
      toast.error(formatRequestError(err));
    } finally {
      setSaving(false);
    }
  }

  const groupedStatuses = {
    NOT_STARTED: statuses.filter((s) => s.statusGroup === "NOT_STARTED"),
    ACTIVE: statuses.filter((s) => s.statusGroup === "ACTIVE"),
    DONE: statuses.filter((s) => s.statusGroup === "DONE"),
    CLOSED: statuses.filter((s) => s.statusGroup === "CLOSED"),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Statuses — {targetName}</DialogTitle>
          <DialogDescription>
            Customize statuses and groups for tasks in this {targetType}.
          </DialogDescription>
        </DialogHeader>

        {targetType === "list" && canInherit ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="inherit-statuses">Inherit Space statuses</Label>
              <p className="text-xs text-muted-foreground">
                Use the default status workflow configured at the Space level.
              </p>
            </div>
            <Switch
              id="inherit-statuses"
              checked={inheritFromSpace}
              onCheckedChange={setInheritFromSpace}
            />
          </div>
        ) : null}

        {!inheritFromSpace ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Add New Status
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Status name (e.g. In Review)"
                  value={newStatusName}
                  onChange={(e) => setNewStatusName(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddStatus();
                    }
                  }}
                />
                <Select
                  value={newStatusGroup}
                  onValueChange={(v) => setNewStatusGroup(v as StatusGroupType)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="DONE">Done</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon-sm"
                  onClick={handleAddStatus}
                  disabled={!newStatusName.trim()}
                >
                  <PlusIcon className="size-4" />
                </Button>
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                {DEFAULT_COLOR_PALETTE.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setNewStatusColor(hex)}
                    className={cn(
                      "size-5 rounded-full border border-black/10 transition-transform hover:scale-110 flex items-center justify-center",
                      newStatusColor === hex && "ring-2 ring-primary ring-offset-1"
                    )}
                    style={{ backgroundColor: hex }}
                  >
                    {newStatusColor === hex && <CheckIcon className="size-3 text-white" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-60 space-y-3 overflow-y-auto pr-1">
              {(["NOT_STARTED", "ACTIVE", "DONE", "CLOSED"] as StatusGroupType[]).map((group) => {
                const groupItems = groupedStatuses[group];
                if (groupItems.length === 0) return null;

                return (
                  <div key={group} className="space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {STATUS_GROUP_LABELS[group].label}
                    </span>
                    <div className="space-y-1">
                      {groupItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-1.5"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span
                              className="size-3 shrink-0 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="truncate text-xs font-medium">
                              {item.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <div className="flex items-center gap-1">
                              {DEFAULT_COLOR_PALETTE.slice(0, 4).map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => handleColorChange(item.id, c)}
                                  className={cn(
                                    "size-3.5 rounded-full transition-transform hover:scale-110",
                                    item.color === c && "ring-1 ring-primary"
                                  )}
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleRemoveStatus(item.id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2Icon className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} loading={saving} loadingText="Saving…">
            Save Statuses
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
