"use client";

import { StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChannelNameLabel({
  name,
  starred,
  prefix = "#",
  className,
  nameClassName,
}: {
  name: string;
  starred?: boolean;
  prefix?: string | false;
  className?: string;
  nameClassName?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      
      {prefix ? (
        <span className="shrink-0 font-normal text-muted-foreground">{prefix}</span>
      ) : null}
      {starred ? (
        <StarIcon
          className="size-3.5 shrink-0 fill-amber-400 text-amber-400"
          aria-label="Favorite"
        />
      ) : null}
      <span className={cn("truncate", nameClassName)}>{name}</span>
      
    </span>
  );
}
