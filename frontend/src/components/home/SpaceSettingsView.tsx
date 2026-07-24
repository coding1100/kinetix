"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { HomeDataState } from "@/components/home/HomeDataState";
import { StatusConfigEditor } from "@/components/settings/StatusConfigEditor";
import { fetchSpace } from "@/lib/api/home";
import { patchSpace } from "@/lib/api/spaces";
import type { StatusConfigItem } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { ApiError } from "@/lib/api/client";

export function SpaceSettingsView({ spaceId }: { spaceId: string }) {
  const { accessToken, workspaceId } = useWorkspaceApi();
  const { data: space, loading, error } = useHomeQuery(
    (token, ws) => fetchSpace(token, ws, spaceId),
    [spaceId]
  );

  const [statuses, setStatuses] = useState<StatusConfigItem[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (space?.statusConfig) setStatuses(space.statusConfig);
  }, [space?.statusConfig]);

  const canEdit = Boolean(space?.canManageStructure);
  const dirty =
    statuses != null &&
    JSON.stringify(statuses) !== JSON.stringify(space?.statusConfig ?? []);

  const handleSave = async () => {
    if (!statuses) return;
    setSaving(true);
    try {
      await patchSpace(accessToken, workspaceId, spaceId, { statusConfig: statuses });
      toast.success("Space statuses updated");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not update statuses"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <PageHeader title={space ? `${space.name} settings` : "Space settings"}>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={`/home/spaces/${spaceId}`} />}
        >
          <ChevronLeftIcon className="size-4" />
          Back
        </Button>
      </PageHeader>
      <HomeDataState loading={loading} error={error} empty={!space && !loading}>
        {space ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-2xl space-y-6">
              <section className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div>
                  <h2 className="text-sm font-semibold">Statuses</h2>
                  <p className="text-sm text-muted-foreground">
                    Default statuses for every List in this Space. A List can
                    override these with its own from its list settings page.
                  </p>
                </div>
                {statuses ? (
                  <StatusConfigEditor
                    statuses={statuses}
                    onChange={setStatuses}
                    disabled={!canEdit || saving}
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
                    You don&apos;t have permission to edit this Space&apos;s
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
