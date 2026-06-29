"use client";

import { useEffect, useState } from "react";
import { BookmarkIcon, MessageSquareTextIcon, PencilIcon } from "lucide-react";
import { updateTeam, type TeamDetail } from "@/lib/api/teams";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTeamsStore } from "@/stores/teams-store";
import { toast } from "sonner";

export function TeamOverviewPanel({
  team,
  manage,
  onUpdated,
}: {
  team: TeamDetail;
  manage: boolean;
  onUpdated: (team: TeamDetail) => void;
}) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const bumpTeamsRefresh = useTeamsStore((s) => s.bumpRefresh);
  const [editingDesc, setEditingDesc] = useState(false);
  const [description, setDescription] = useState(team.description ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDescription(team.description ?? "");
  }, [team.description]);

  const saveDescription = async () => {
    if (!ready) return;
    setSaving(true);
    try {
      const updated = await updateTeam(accessToken, workspaceId, team.id, {
        description: description.trim(),
      });
      onUpdated(updated);
      bumpTeamsRefresh();
      setEditingDesc(false);
      toast.success("Description saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save description");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-6">
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
          <h2 className="text-sm font-semibold">Description</h2>
          {manage && !editingDesc ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setEditingDesc(true)}
            >
              <PencilIcon className="size-3.5" />
              Edit
            </Button>
          ) : null}
        </div>

        <div className="p-4">
          {editingDesc ? (
            <div className="space-y-3">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Add team description, information, and wiki…"
                className="min-h-[120px] resize-y"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDescription(team.description ?? "");
                    setEditingDesc(false);
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" disabled={saving} onClick={() => void saveDescription()}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          ) : team.description?.trim() ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {team.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {manage
                ? "Add team description, information, and wiki."
                : "No description yet."}
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-2.5">
          <h2 className="text-sm font-semibold">Bookmarks</h2>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <BookmarkIcon className="size-5 text-muted-foreground" />
          </div>
          <p className="max-w-xs text-sm text-muted-foreground">
            Save links and resources your team uses every day.
          </p>
          <Button
            size="sm"
            onClick={() => toast("Bookmarks — coming soon")}
          >
            Add Bookmark
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-2.5">
          <h2 className="text-sm font-semibold">Feed</h2>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <MessageSquareTextIcon className="size-5 text-muted-foreground" />
          </div>
          <p className="max-w-xs text-sm text-muted-foreground">
            Team activity and updates will appear here.
          </p>
        </div>
      </section>
    </div>
  );
}
