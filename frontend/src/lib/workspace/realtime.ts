import type { WorkspaceMemberRow } from "@/lib/api/workspace";
import { bumpWorkspacePeopleRefresh } from "@/stores/workspace-store";
import type { WorkspaceMemberJoinedPayload } from "@/lib/types/realtime";

export function applyWorkspaceMemberJoined(
  event: WorkspaceMemberJoinedPayload,
  workspaceId: string | undefined
) {
  if (!workspaceId || event.workspaceId !== workspaceId) return;
  bumpWorkspacePeopleRefresh();
}

export type { WorkspaceMemberJoinedPayload };
