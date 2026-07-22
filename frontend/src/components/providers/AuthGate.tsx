"use client";

import { Suspense, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageLoader } from "@/components/ui/page-loader";
import { useAuthReady } from "@/components/providers/AuthProvider";
import { firstSelectableWorkspaceId, useAuthStore } from "@/stores/auth-store";

function WorkspaceLoading({ label }: { label: string }) {
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <PageLoader label={label} overlay />
    </div>
  );
}

function AuthGateInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { ready, authenticated } = useAuthReady();
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore((s) => s.hydrated);
  const workspaces = useAuthStore((s) => s.workspaces);
  const activeWorkspaceId = useAuthStore((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useAuthStore((s) => s.setActiveWorkspace);

  const effectiveWorkspaceId = useMemo(() => {
    const active = workspaces.find((w) => w.id === activeWorkspaceId);
    if (active && active.membershipStatus !== "SUSPENDED") {
      return activeWorkspaceId;
    }
    return firstSelectableWorkspaceId(workspaces);
  }, [activeWorkspaceId, workspaces]);

  useEffect(() => {
    if (!ready || !hydrated) return;
    if (
      effectiveWorkspaceId &&
      effectiveWorkspaceId !== activeWorkspaceId
    ) {
      setActiveWorkspace(effectiveWorkspaceId);
    }
  }, [
    ready,
    hydrated,
    effectiveWorkspaceId,
    activeWorkspaceId,
    setActiveWorkspace,
  ]);

  const clearSession = useAuthStore((s) => s.clearSession);
  const noWorkspacesLeft = workspaces.length > 0 && !effectiveWorkspaceId;

  useEffect(() => {
    if (!ready) return;
    if ((!accessToken && !authenticated) || noWorkspacesLeft) {
      if (noWorkspacesLeft) clearSession();
      const query = searchParams.toString();
      const next = `${pathname}${query ? `?${query}` : ""}`;
      router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
    }
  }, [
    ready,
    accessToken,
    authenticated,
    noWorkspacesLeft,
    clearSession,
    pathname,
    searchParams,
    router,
  ]);

  if (!ready) {
    return <WorkspaceLoading label="Loading workspace…" />;
  }

  if (!accessToken || noWorkspacesLeft) {
    return <WorkspaceLoading label="Redirecting to log in…" />;
  }

  if (!effectiveWorkspaceId || workspaces.length === 0) {
    return <WorkspaceLoading label="Loading workspace…" />;
  }

  return <>{children}</>;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={<WorkspaceLoading label="Loading workspace…" />}
    >
      <AuthGateInner>{children}</AuthGateInner>
    </Suspense>
  );
}
