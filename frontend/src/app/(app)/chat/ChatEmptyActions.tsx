"use client";

import Link from "next/link";
import { loadSidebarLists } from "@/lib/chat/sidebar-lists-loader";
import { useHomeQuery } from "@/hooks/use-home-query";
import { Button } from "@/components/ui/button";

export function ChatEmptyActions() {
  const listsQuery = useHomeQuery(
    (token, ws) => loadSidebarLists(token, ws),
    []
  );

  const general =
    listsQuery.data?.channels.find((c) => c.name === "general") ??
    listsQuery.data?.channels[0];
  const alexDm =
    listsQuery.data?.dms.find((d) => d.name.includes("Alex")) ??
    listsQuery.data?.dms[0];

  return (
    <div className="flex flex-wrap justify-center gap-2 px-4 pb-8">
      {general ? (
        <Button
          nativeButton={false}
          render={<Link href={`/chat/c/${general.id}`} />}
        >
          Open #{general.name}
        </Button>
      ) : null}
      {alexDm ? (
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/chat/dm/${alexDm.id}`} />}
        >
          Message {alexDm.name.split(" ")[0]}
        </Button>
      ) : null}
    </div>
  );
}
