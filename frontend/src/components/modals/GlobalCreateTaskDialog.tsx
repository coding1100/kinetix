"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CreateTaskDialog } from "@/components/spaces/CreateTaskDialog";
import { ingestTaskEvent } from "@/lib/tasks/realtime";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useUiStore } from "@/stores/ui-store";

export function GlobalCreateTaskDialog() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { workspaceId } = useWorkspaceApi();
  const { activeModal, modalListId, modalStatusId, closeModal } = useUiStore();
  const open = activeModal === "create-task";

  const listMatch = pathname.match(/\/spaces\/l\/([^/?]+)/);
  const defaultListId = modalListId ?? listMatch?.[1];

  return (
    <CreateTaskDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeModal();
      }}
      defaultListId={defaultListId}
      defaultStatusId={modalStatusId ?? undefined}
      onCreated={(task, options) => {
        if (workspaceId) {
          ingestTaskEvent({
            workspaceId,
            action: "created",
            taskId: task.id,
            listId: task.listId,
            task,
          });
        }
        if (options?.open) {
          // Open in place wherever the dialog was opened from (Home,
          // Space list, list-primary chat channel, ...) instead of
          // forcing a navigation to the task's own Space page -
          // TaskDrawer fetches by task id, so it works regardless of
          // whether the current page's list matches the task's list.
          const params = new URLSearchParams(searchParams.toString());
          params.set("task", task.id);
          router.push(`${pathname}?${params.toString()}`);
        }
      }}
    />
  );
}
