"use client";

import { MESSAGE_TOKEN_RE } from "@/lib/chat/mention-utils";
import { cn } from "@/lib/utils";

export function MessageBodyWithMentions({ body }: { body: string }) {
  const parts = body.split(MESSAGE_TOKEN_RE);

  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          return (
            <span
              key={i}
              className="font-medium text-violet-700"
            >
              {part}
            </span>
          );
        }
        if (part.startsWith("#")) {
          return (
            <span
              key={i}
              className={cn("font-medium text-sky-700")}
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}
