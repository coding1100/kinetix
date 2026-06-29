"use client";

import { useEffect, useMemo, useState } from "react";
import { updateTeam, type TeamDetail } from "@/lib/api/teams";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TEAM_COLORS } from "@/components/teams/CreateTeamDialog";
import { toast } from "sonner";

export function EditTeamDialog({
  team,
  open,
  onOpenChange,
  onUpdated,
}: {
  team: TeamDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: (team: TeamDetail) => void;
}) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? "");
  const [color, setColor] = useState(team.color);
  const [icon, setIcon] = useState(team.icon ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(team.name);
    setDescription(team.description ?? "");
    setColor(team.color);
    setIcon(team.icon ?? "");
  }, [open, team]);

  const autoIcon = useMemo(() => {
    const trimmed = name.trim();
    return trimmed ? trimmed[0].toUpperCase() : "T";
  }, [name]);

  const handleSubmit = async () => {
    if (!ready || !name.trim()) return;
    setSaving(true);
    try {
      const updated = await updateTeam(accessToken, workspaceId, team.id, {
        name: name.trim(),
        color,
        icon: (icon.trim() || autoIcon).slice(0, 2),
        description: description.trim() || "",
      });
      toast.success("Team updated");
      onOpenChange(false);
      onUpdated?.(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update team");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit team</DialogTitle>
          <DialogDescription>
            Update the team name, color, icon, or description.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-team-name">Name</Label>
            <Input
              id="edit-team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Engineering"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-team-icon">Icon (1–2 characters)</Label>
            <div className="flex items-center gap-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {(icon.trim() || autoIcon).slice(0, 2)}
              </span>
              <Input
                id="edit-team-icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value.slice(0, 2))}
                placeholder={autoIcon}
                className="max-w-[80px]"
                maxLength={2}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {TEAM_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="size-7 rounded-full ring-offset-2 transition-transform hover:scale-105"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? `2px solid ${c}` : undefined,
                    outlineOffset: 2,
                  }}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-team-desc">Description</Label>
            <Textarea
              id="edit-team-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What does this team work on?"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
