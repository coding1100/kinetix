"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { HomeDataState } from "@/components/home/HomeDataState";
import { createReminder, deleteReminder, fetchReminders } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";

export default function RemindersPage() {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const { data: reminders, loading, error } = useHomeQuery((token, ws) =>
    fetchReminders(token, ws).then((r) => r.data)
  );
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [localReminders, setLocalReminders] = useState<
    { id: string; title: string; due: string }[] | null
  >(null);

  const list = localReminders ?? reminders ?? [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || !ready || !accessToken || !workspaceId) return;
    setSaving(true);
    try {
      const created = await createReminder(accessToken, workspaceId, {
        title: trimmed,
        dueAt: dueAt
          ? new Date(dueAt).toISOString()
          : undefined,
      });
      setLocalReminders([created, ...list]);
      setTitle("");
      setDueAt("");
      toast.success("Reminder created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create reminder");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!ready || !accessToken || !workspaceId) return;
    try {
      await deleteReminder(accessToken, workspaceId, id);
      setLocalReminders(list.filter((r) => r.id !== id));
      toast.success("Reminder deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    }
  }

  return (
    <>
      <PageHeader title="Reminders" />
      <div className="border-b border-border px-4 py-4">
        <form onSubmit={(e) => void handleCreate(e)} className="flex flex-wrap gap-3">
          <div className="min-w-[200px] flex-1 space-y-1">
            <Label htmlFor="reminder-title">Title</Label>
            <Input
              id="reminder-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Reminder title"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="reminder-due">Due</Label>
            <Input
              id="reminder-due"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={!title.trim()} loading={saving}>
              Add reminder
            </Button>
          </div>
        </form>
      </div>
      <HomeDataState loading={loading} error={error} empty={!loading && list.length === 0}>
        <ul className="flex-1 overflow-y-auto p-4">
          {list.map((r) => (
            <li
              key={r.id}
              className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.due}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Delete reminder"
                onClick={() => void handleDelete(r.id)}
              >
                <Trash2Icon className="size-4 text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
      </HomeDataState>
    </>
  );
}
