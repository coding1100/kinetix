"use client";

import { useEffect, useMemo, useState } from "react";
import { createTeam } from "@/lib/api/teams";
import { fetchWorkspacePeople } from "@/lib/api/workspace";
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
import { toast } from "sonner";

const TEAM_COLORS = [
  "#7B68EE",
  "#F97316",
  "#22C55E",
  "#3B82F6",
  "#EC4899",
  "#14B8A6",
] as const;

export { TEAM_COLORS };

export function CreateTeamDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>(TEAM_COLORS[0]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [people, setPeople] = useState<
    { id: string; fullName: string; email: string }[]
  >([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !ready) return;
    let cancelled = false;
    void fetchWorkspacePeople(accessToken, workspaceId).then((res) => {
      if (!cancelled) setPeople(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, ready, accessToken, workspaceId]);

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setColor(TEAM_COLORS[0]);
      setMemberIds([]);
    }
  }, [open]);

  const icon = useMemo(() => {
    const trimmed = name.trim();
    return trimmed ? trimmed[0].toUpperCase() : "T";
  }, [name]);

  const toggleMember = (id: string) => {
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!ready || !name.trim()) return;
    setSaving(true);
    try {
      await createTeam(accessToken, workspaceId, {
        name: name.trim(),
        color,
        icon,
        description: description.trim() || undefined,
        memberIds,
      });
      toast.success("Team created");
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create team");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create team</DialogTitle>
          <DialogDescription>
            Group workspace members into a team for People and Teams views.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="team-name">Name</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Engineering"
            />
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
            <Label htmlFor="team-desc">Description (optional)</Label>
            <Textarea
              id="team-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What does this team work on?"
            />
          </div>

          <div className="space-y-2">
            <Label>Members</Label>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border p-2">
              {people.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    className="size-4 rounded border border-input"
                    checked={memberIds.includes(p.id)}
                    onChange={() => toggleMember(p.id)}
                  />
                  <span className="text-sm">
                    {p.fullName}
                    <span className="ml-1 text-muted-foreground">({p.email})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving || !name.trim()}>
            {saving ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
