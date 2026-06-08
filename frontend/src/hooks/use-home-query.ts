"use client";

import { useEffect, useRef, useState } from "react";
import { getMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useAuthStore } from "@/stores/auth-store";

export function useHomeQuery<T>(
  fetcher: (token: string, workspaceId: string) => Promise<T>,
  deps: unknown[] = [],
  options?: {
    initialData?: T | null;
    skipInitialFetch?: boolean;
    refreshKey?: number | string;
  }
) {
  const hydrated = useAuthStore((s) => s.hydrated);
  const updateSession = useAuthStore((s) => s.updateSession);
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [data, setData] = useState<T | null>(options?.initialData ?? null);
  const [loading, setLoading] = useState(!options?.initialData);
  const [error, setError] = useState<string | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const prevWorkspaceId = useRef(workspaceId);

  const depsSignature = JSON.stringify(deps);
  const canFetch = hydrated && ready;

  useEffect(() => {
    if (prevWorkspaceId.current !== workspaceId) {
      prevWorkspaceId.current = workspaceId;
      setData(null);
      setLoading(true);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (options?.initialData != null && data === null) {
      setData(options.initialData);
      setLoading(false);
    }
  }, [options?.initialData, data]);

  useEffect(() => {
    if (!hydrated) {
      if (data !== null) {
        setLoading(false);
        return;
      }
      setLoading(true);
      return;
    }

    if (!ready) {
      setLoading(false);
      setError(accessToken ? "Select a workspace to load data." : null);
      if (!options?.initialData) setData(null);
      return;
    }

    const shouldSkipFetch =
      options?.skipInitialFetch === true &&
      options?.initialData != null &&
      (options?.refreshKey ?? 0) === 0;

    if (shouldSkipFetch) {
      setData(options.initialData ?? null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const showInitialSpinner = data === null;
    if (showInitialSpinner) setLoading(true);
    setError(null);

    const run = async () => {
      const token = accessToken;
      const wsId = workspaceId;

      try {
        const result = await fetcherRef.current(token, wsId);
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (cancelled) return;

        if (
          err instanceof ApiError &&
          err.status === 403 &&
          err.message.toLowerCase().includes("workspace")
        ) {
          try {
            const me = await getMe(token);
            const nextWorkspaceId = me.workspaces[0]?.id;
            if (!nextWorkspaceId) {
              setError("No workspace available for your account.");
              return;
            }
            updateSession({
              accessToken: token,
              user: {
                id: me.id,
                email: me.email,
                fullName: me.fullName,
                avatarUrl: me.avatarUrl,
              },
              workspaces: me.workspaces,
              activeWorkspaceId: nextWorkspaceId,
            });
            const retry = await fetcherRef.current(token, nextWorkspaceId);
            if (!cancelled) {
              setData(retry);
              setError(null);
            }
            return;
          } catch {
            // fall through
          }
        }

        if (err instanceof ApiError && err.status === 404) {
          setError(
            "API not found. Restart backend-py on port 4001 (latest PY-4 build)."
          );
          return;
        }

        setError(
          err instanceof ApiError ? err.message : "Failed to load data"
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    hydrated,
    ready,
    accessToken,
    workspaceId,
    depsSignature,
    updateSession,
    options?.skipInitialFetch,
    options?.initialData,
    options?.refreshKey,
  ]);

  const showLoading = data === null && (!canFetch || loading);

  return { data, loading: showLoading, error, ready: canFetch };
}
