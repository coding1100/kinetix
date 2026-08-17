"use client";

import { HashIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSpecialMention } from "@/lib/chat/mention-utils";

export function MentionChip({
  mentionType,
  label,
  className,
}: {
  mentionType: "person" | "channel";
  label: string;
  className?: string;
}) {
  const isPerson = mentionType === "person";
  const isSpecial = isPerson && isSpecialMention(label);

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 rounded px-1.5 py-0.5 text-[13px] font-medium leading-tight",
        isSpecial
          ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30 font-semibold"
          : isPerson
          ? "bg-violet-100 text-violet-900"
          : "bg-sky-100 text-sky-900",
        className
      )}
    >
      {isPerson ? (
        <span>@{label}</span>
      ) : (
        <>
          <HashIcon className="size-3 shrink-0 opacity-80" strokeWidth={2} />
          <span>{label.replace(/^#/, "")}</span>
        </>
      )}
    </span>
  );
}
