"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { useHomeQuery } from "@/hooks/use-home-query";
import { loadSidebarLists } from "@/lib/chat/sidebar-lists-loader";
import { HomeDataState } from "@/components/home/HomeDataState";

export default function AllChannelsPage() {
  const channelsQuery = useHomeQuery(
    (token, ws) => loadSidebarLists(token, ws).then((r) => r.channels),
    []
  );

  const channels = channelsQuery.data ?? [];

  return (
    <>
      <PageHeader title="All Channels" />
      <div className="border-b border-border px-6 py-3">
        <p className="text-sm text-muted-foreground">
          Browse and create channels in Chat.{" "}
          <Link href="/chat/channels" className="font-medium text-primary">
            Open Chat channels →
          </Link>
        </p>
      </div>
      <HomeDataState
        loading={channelsQuery.loading}
        error={channelsQuery.error}
        empty={channels.length === 0}
      >
        <ul className="flex-1 overflow-y-auto p-4">
          {channels.map((c) => (
            <li key={c.id}>
              <Link
                href={`/chat/c/${c.id}`}
                className="mb-2 flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:border-primary"
              >
                <div>
                  <span className="font-medium">#{c.name}</span>
                  <p className="text-sm text-muted-foreground">{c.lastMessage}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {c.memberCount} members
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </HomeDataState>
    </>
  );
}
