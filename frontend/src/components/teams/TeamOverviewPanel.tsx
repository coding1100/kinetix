"use client";

import { useEffect, useState } from "react";
import { ExternalLinkIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import {
  createTeamBookmark,
  deleteTeamBookmark,
  updateTeam,
  type TeamDetail,
} from "@/lib/api/teams";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const bumpTeamsRefresh = useTeamsStore((state) => state.bumpRefresh);
  const [editingDescription, setEditingDescription] = useState(false);
  const [description, setDescription] = useState(team.description ?? "");
  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const [bookmarkTitle, setBookmarkTitle] = useState("");
  const [bookmarkUrl, setBookmarkUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setDescription(team.description ?? ""), [team.description]);

  const saveDescription = async () => {
    if (!ready) return;
    setSaving(true);
    try {
      const updated = await updateTeam(accessToken, workspaceId, team.id, {
        description: description.trim(),
      });
      onUpdated(updated);
      bumpTeamsRefresh();
      setEditingDescription(false);
      toast.success("Description saved");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to save description");
    } finally {
      setSaving(false);
    }
  };

  const addBookmark = async () => {
    if (!ready || !bookmarkTitle.trim() || !bookmarkUrl.trim()) return;
    setSaving(true);
    try {
      const updated = await createTeamBookmark(accessToken, workspaceId, team.id, {
        title: bookmarkTitle.trim(),
        url: bookmarkUrl.trim(),
      });
      onUpdated(updated);
      setBookmarkOpen(false);
      setBookmarkTitle("");
      setBookmarkUrl("");
      toast.success("Bookmark added");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to add bookmark");
    } finally {
      setSaving(false);
    }
  };

  const removeBookmark = async (bookmarkId: string) => {
    if (!ready) return;
    try {
      await deleteTeamBookmark(accessToken, workspaceId, team.id, bookmarkId);
      onUpdated({
        ...team,
        bookmarks: team.bookmarks.filter((bookmark) => bookmark.id !== bookmarkId),
      });
      toast.success("Bookmark removed");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to remove bookmark");
    }
  };

  return (
    <div className="space-y-4 p-6">
      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
          <h2 className="text-sm font-semibold">Description</h2>
          {manage && !editingDescription ? (
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setEditingDescription(true)}>
              <PencilIcon className="size-3.5" /> Edit
            </Button>
          ) : null}
        </div>
        <div className="p-4">
          {editingDescription ? (
            <div className="space-y-3">
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} className="min-h-[120px] resize-y" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => { setDescription(team.description ?? ""); setEditingDescription(false); }}>Cancel</Button>
                <Button size="sm" disabled={saving} onClick={() => void saveDescription()}>{saving ? "Saving..." : "Save"}</Button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {team.description?.trim() || (manage ? "Add a team description." : "No description yet.")}
            </p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
          <h2 className="text-sm font-semibold">Bookmarks</h2>
          {manage ? (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setBookmarkOpen(true)}>
              <PlusIcon className="size-3.5" /> Add
            </Button>
          ) : null}
        </div>
        {team.bookmarks.length ? (
          <ul className="divide-y divide-border">
            {team.bookmarks.map((bookmark) => (
              <li key={bookmark.id} className="flex items-center gap-2 px-4 py-3">
                <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 text-sm font-medium hover:underline">
                  <span className="flex items-center gap-2"><ExternalLinkIcon className="size-3.5 shrink-0" /><span className="truncate">{bookmark.title}</span></span>
                </a>
                {manage ? (
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${bookmark.title}`} onClick={() => void removeBookmark(bookmark.id)}>
                    <Trash2Icon className="size-3.5" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No team bookmarks yet.</p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Team activity</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-muted-foreground">Members</dt><dd className="mt-1 font-medium">{team.memberCount}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Bookmarks</dt><dd className="mt-1 font-medium">{team.bookmarks.length}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Last updated</dt><dd className="mt-1 font-medium">{team.updatedAt ? new Date(team.updatedAt).toLocaleDateString() : "Not recorded"}</dd></div>
        </dl>
      </section>

      <Dialog open={bookmarkOpen} onOpenChange={setBookmarkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add team bookmark</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={bookmarkTitle} onChange={(event) => setBookmarkTitle(event.target.value)} placeholder="Resource name" maxLength={120} />
            <Input type="url" value={bookmarkUrl} onChange={(event) => setBookmarkUrl(event.target.value)} placeholder="https://example.com" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookmarkOpen(false)}>Cancel</Button>
            <Button disabled={saving || !bookmarkTitle.trim() || !bookmarkUrl.trim()} onClick={() => void addBookmark()}>{saving ? "Adding..." : "Add bookmark"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
