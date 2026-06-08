"use client";

import { useCallback, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageTabs } from "@/components/shared/Tabs";
import { HomeDataState } from "@/components/home/HomeDataState";
import { fetchDraftsSent } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";

export default function DraftsSentPage() {
  const [tab, setTab] = useState<"drafts" | "sent" | "scheduled">("drafts");
  const load = useCallback(
    (token: string, workspaceId: string) =>
      fetchDraftsSent(token, workspaceId, tab).then((r) => r.data),
    [tab]
  );
  const { data: rows, loading, error } = useHomeQuery(load, [tab]);

  return (
    <>
      <PageHeader title="Drafts & Sent" />
      <PageTabs
        tabs={[
          { id: "drafts" as const, label: "Drafts" },
          { id: "sent" as const, label: "Sent" },
          { id: "scheduled" as const, label: "Scheduled" },
        ]}
        active={tab}
        onChange={setTab}
      />
      <HomeDataState
        loading={loading}
        error={error}
        empty={!loading && !error && rows?.length === 0}
      >
        <ul className="flex-1 overflow-y-auto p-4">
          {rows?.map((r) => (
            <li
              key={r.id}
              className="mb-2 rounded-lg border border-border bg-card px-4 py-3"
            >
              <p className="text-sm font-medium">{r.target}</p>
              <p className="text-sm text-muted-foreground">{r.preview}</p>
              {r.at ? (
                <p className="mt-1 text-xs text-muted-foreground">{r.at}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </HomeDataState>
    </>
  );
}
