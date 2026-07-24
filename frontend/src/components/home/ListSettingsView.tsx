"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { HomeDataState } from "@/components/home/HomeDataState";
import { StatusConfigEditor } from "@/components/settings/StatusConfigEditor";
import { fetchListMeta, patchList } from "@/lib/api/spaces";
import type { StatusConfigItem } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { ApiError } from "@/lib/api/client";

function toStatusConfigItems(
  statuses: { name: string; color: string; statusGroup: string; legacyKey?: string | null }[]
): StatusConfigItem[] {
  return statuses.map((s) => ({
    name: s.name,
    color: s.color,
    statusGroup: s.statusGroup,
    legacyKey: s.legacyKey,
  }));
}

export function ListSettingsView({ listId }: { listId: string }) {
  const { accessToken, workspaceId } = useWorkspaceApi();
  const { data: list, loading, error } = useHomeQuery(
    (token, ws) => fetchListMeta(token, ws, listId),
    [listId]
  );

  const [statuses, setStatuses] = useState<StatusConfigItem[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [reverting, setReverting] = useState(false);

  useEffect(() => {
    if (list?.statuses) setStatuses(toStatusConfigItems(list.statuses));
  }, [list?.statuses]);

  const canEdit = Boolean(list?.canManageStructure);
  const hasOwnConfig = Boolean(list?.hasOwnStatusConfig);
  const originalStatuses = list?.statuses ? toStatusConfigItems(list.statuses) : [];
  const dirty =
    statuses != null && JSON.stringify(statuses) !== JSON.stringify(originalStatuses);

  const handleSave = async () => {
    if (!statuses) return;
    setSaving(true);
    try {
      await patchList(accessToken, workspaceId, listId, { statusConfig: statuses });
      toast.success("List statuses updated");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not update statuses"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRevertToSpace = async () => {
    setReverting(true);
    try {
      await patchList(accessToken, workspaceId, listId, {
        inheritStatusConfig: true,
      });
      toast.success("List now inherits its Space's statuses");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not revert statuses"
      );
    } finally {
      setReverting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <PageHeader title={list ? `${list.name} settings` : "List settings"}>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={`/home/l/${listId}`} />}
        >
          <ChevronLeftIcon className="size-4" />
          Back
        </Button>
      </PageHeader>
      <HomeDataState loading={loading} error={error} empty={!list && !loading}>
        {list ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-2xl space-y-6">
              <section className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold">Statuses</h2>
                    <p className="text-sm text-muted-foreground">
                      {hasOwnConfig
                        ? "This List uses its own statuses instead of its Space's."
                        : "This List inherits its statuses from its Space. Editing and saving here creates a List-specific override."}
                    </p>
                  </div>
                  {canEdit && hasOwnConfig ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={reverting}
                      loading={reverting}
                      onClick={() => void handleRevertToSpace()}
                    >
                      Use Space statuses
                    </Button>
                  ) : null}
                </div>
                {statuses ? (
                  <StatusConfigEditor
                    statuses={statuses}
                    onChange={setStatuses}
                    disabled={!canEdit || saving || reverting}
                  />
                ) : null}
                {canEdit ? (
                  <Button
                    disabled={!dirty || saving}
                    loading={saving}
                    onClick={() => void handleSave()}
                  >
                    Save changes
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    You don&apos;t have permission to edit this List&apos;s
                    statuses.
                  </p>
                )}
              </section>
            </div>
          </div>
        ) : null}
      </HomeDataState>
    </div>
  );
}
