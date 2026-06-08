"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageTabs } from "@/components/shared/Tabs";
import { HomeDataState } from "@/components/home/HomeDataState";
import { fetchChatActivity } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";

export default function ChatActivityPage() {
  const [kind, setKind] = useState<"all" | "mention" | "reaction" | "assigned">(
    "all"
  );
  const load = useCallback(
    (token: string, workspaceId: string) =>
      fetchChatActivity(token, workspaceId, kind).then((r) => r.data),
    [kind]
  );
  const { data: items, loading, error } = useHomeQuery(load, [kind]);

  return (
    <>
      <PageHeader title="Chat Activity" />
      <PageTabs
        tabs={[
          { id: "all" as const, label: "All" },
          { id: "mention" as const, label: "Mentions" },
          { id: "reaction" as const, label: "Reactions" },
          { id: "assigned" as const, label: "Assigned" },
        ]}
        active={kind}
        onChange={setKind}
      />
      <HomeDataState
        loading={loading}
        error={error}
        empty={!loading && !error && items?.length === 0}
      >
        <ul className="flex-1 overflow-y-auto p-4">
          {items?.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="mb-2 flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:border-primary"
              >
                <p className="text-sm">{item.text}</p>
                <span className="text-xs text-muted-foreground">{item.time}</span>
              </Link>
            </li>
          ))}
        </ul>
      </HomeDataState>
    </>
  );
}
