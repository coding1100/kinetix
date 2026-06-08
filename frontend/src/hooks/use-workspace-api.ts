"use client";

import { useAuthStore } from "@/stores/auth-store";

export function useWorkspaceApi() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId);
  const ready = Boolean(accessToken && workspaceId);

  return {
    accessToken: accessToken!,
    workspaceId: workspaceId!,
    ready,
  };
}
