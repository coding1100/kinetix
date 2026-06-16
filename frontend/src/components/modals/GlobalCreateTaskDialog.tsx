"use client";

import { usePathname, useRouter } from "next/navigation";
import { CreateTaskDialog } from "@/components/spaces/CreateTaskDialog";
import { ingestTaskEvent } from "@/lib/tasks/realtime";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useUiStore } from "@/stores/ui-store";

export function GlobalCreateTaskDialog() {
  const router = useRouter();
  const pathname = usePathname();
  const { workspaceId } = useWorkspaceApi();
  const { activeModal, closeModal } = useUiStore();
  const open = activeModal === "create-task";

  const listMatch = pathname.match(/\/spaces\/l\/([^/?]+)/);
  const defaultListId = listMatch?.[1];

  return (
    <CreateTaskDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeModal();
      }}
      defaultListId={defaultListId}
      onCreated={(task) => {
        closeModal();
        if (workspaceId) {
          ingestTaskEvent({
            workspaceId,
            action: "created",
            taskId: task.id,
            listId: task.listId,
            task,
          });
        }
        if (task.listId) {
          router.push(`/spaces/l/${task.listId}?task=${task.id}`);
        }
      }}
    />
  );
}
