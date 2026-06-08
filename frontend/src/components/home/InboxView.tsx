"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageTabs } from "@/components/shared/Tabs";
import { HomeDataState } from "@/components/home/HomeDataState";
import { fetchInbox, type InboxItemDto } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export function InboxView() {
  const [tab, setTab] = useState<"all" | "later">("all");
  const load = useCallback(
    (token: string, workspaceId: string) =>
      fetchInbox(token, workspaceId, tab).then((r) => r.data),
    [tab]
  );
  const { data: items, loading, error } = useHomeQuery(load, [tab]);

  const today = items?.filter((i) => i.group === "today") ?? [];
  const earlier = items?.filter((i) => i.group === "earlier") ?? [];

  return (
    <>
      <PageHeader title="Inbox" />
      <PageTabs
        tabs={[
          { id: "all" as const, label: "All" },
          { id: "later" as const, label: "Later" },
        ]}
        active={tab}
        onChange={setTab}
      />
      <HomeDataState
        loading={loading}
        error={error}
        empty={!loading && !error && items?.length === 0}
      >
        <ScrollArea className="flex-1">
          <div className="p-4">
            <InboxSection title="Today" items={today} />
            <InboxSection title="Earlier" items={earlier} />
          </div>
        </ScrollArea>
      </HomeDataState>
    </>
  );
}

function InboxSection({ title, items }: { title: string; items: InboxItemDto[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-6">
      <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Card
              size="sm"
              className="group transition-colors hover:ring-1 hover:ring-primary/30"
            >
              <CardContent className="flex gap-3 py-3">
                {item.unread && (
                  <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
                )}
                <div className={cn("min-w-0 flex-1", !item.unread && "ml-5")}>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {item.preview}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.source}</p>
                </div>
                {item.href && (
                  <Button
                    variant="link"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={item.href} />}
                    className="self-center opacity-0 group-hover:opacity-100"
                  >
                    Open
                  </Button>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
