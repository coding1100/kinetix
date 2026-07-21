"use client";

import { Suspense, useState } from "react";
import { BellIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { HomeDataState } from "@/components/home/HomeDataState";
import { MyTasksPageShell } from "@/components/home/MyTasksPageShell";
import { createReminder, deleteReminder, fetchReminders } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const BASE_PATH = "/home/my-tasks/reminders";

function RemindersContent() {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: reminders, loading, error } = useHomeQuery(
    (token, ws) => fetchReminders(token, ws).then((r) => r.data),
    [refreshKey]
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
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
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
      setRefreshKey((k) => k + 1);
      toast.success("Reminder deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    }
  }

  return (
    <MyTasksPageShell
      title="Reminders"
      subtitle="Set reminders so nothing slips through the cracks."
      basePath={BASE_PATH}
      showToolbar={false}
    >
      <div className="mb-4 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm">
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <label htmlFor="reminder-title" className="text-xs font-medium text-muted-foreground">
              Title
            </label>
            <Input
              id="reminder-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Reminder title"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reminder-due" className="text-xs font-medium text-muted-foreground">
              Due
            </label>
            <Input
              id="reminder-due"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="h-9"
            />
          </div>
          <Button
            type="submit"
            disabled={!title.trim()}
            loading={saving}
            className="h-9"
          >
            <PlusIcon className="size-4" />
            Add reminder
          </Button>
        </form>
      </div>

      <HomeDataState
        loading={loading}
        error={error}
        empty={!loading && list.length === 0}
        emptyMessage="No reminders yet. Create one above."
      >
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 px-4 py-2.5">
            <span className="inline-flex items-center rounded-md bg-amber-500 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">
              Reminders
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {list.length}
            </span>
          </div>
          <ul>
            {list.map((reminder, index) => (
              <li
                key={reminder.id}
                className={index > 0 ? "border-t border-border/60" : undefined}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <BellIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{reminder.title}</p>
                      <p className="text-xs text-muted-foreground">{reminder.due}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete reminder"
                    onClick={() => void handleDelete(reminder.id)}
                  >
                    <Trash2Icon className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </HomeDataState>
    </MyTasksPageShell>
  );
}

export default function RemindersPage() {
  return (
    <Suspense fallback={null}>
      <RemindersContent />
    </Suspense>
  );
}
