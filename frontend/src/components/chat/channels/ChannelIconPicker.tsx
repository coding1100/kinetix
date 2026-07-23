"use client";

import { CheckIcon, HashIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHANNEL_ICON_COLORS } from "@/lib/chat/channel-icon-colors";

export function ChannelIconPicker({
  value,
  onChange,
  channelInitial,
}: {
  value: string | null;
  onChange: (color: string | null) => void;
  channelInitial: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Icon color</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-label="Default icon"
          onClick={() => onChange(null)}
          className={cn(
            "flex size-7 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground",
            !value && "ring-2 ring-primary ring-offset-2 ring-offset-background"
          )}
        >
          <HashIcon className="size-3.5" />
        </button>
        {CHANNEL_ICON_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            onClick={() => onChange(color)}
            className={cn(
              "flex size-7 items-center justify-center rounded-full text-[10px] font-semibold text-white",
              color,
              value === color &&
                "ring-2 ring-primary ring-offset-2 ring-offset-background"
            )}
          >
            {value === color ? (
              <CheckIcon className="size-3.5" strokeWidth={3} />
            ) : (
              channelInitial
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
