"use client";

import { HashIcon } from "lucide-react";
import type { MentionChannel } from "@/hooks/use-mention-channels";
import { cn } from "@/lib/utils";

export function MentionChannelList({
  channels,
  loading,
  onSelect,
  emptyLabel = "No channels found",
}: {
  channels: MentionChannel[];
  loading?: boolean;
  onSelect: (channel: MentionChannel) => void;
  emptyLabel?: string;
}) {
  if (loading) {
    return (
      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
        Loading channels…
      </p>
    );
  }

  if (channels.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="max-h-56 w-full overflow-y-auto py-1">
      {channels.map((channel) => (
        <li key={channel.id} className="w-full">
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm",
              "bg-card hover:bg-muted/80"
            )}
            onClick={() => onSelect(channel)}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <HashIcon className="size-3.5" strokeWidth={2} />
            </span>
            <span className="truncate font-medium">{channel.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
