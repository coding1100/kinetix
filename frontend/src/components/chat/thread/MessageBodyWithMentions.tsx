"use client";

import { MESSAGE_TOKEN_RE } from "@/lib/chat/mention-utils";
import { cn } from "@/lib/utils";
import { sanitizeMessageHtml } from "@/lib/chat/rich-text/sanitize";

function RichTextPart({ html }: { html: string }) {
  const safe = sanitizeMessageHtml(html);
  if (!safe) return null;

  return (
    <span
      className={cn(
        "[&_a]:text-primary [&_a]:underline",
        "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_p]:my-0.5"
      )}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}

export function MessageBodyWithMentions({ body }: { body: string }) {
  const parts = body.split(MESSAGE_TOKEN_RE);
  const hasHtml = body.includes("<");

  if (!hasHtml) {
    return (
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
        {parts.map((part, i) => {
          if (part.startsWith("@")) {
            return (
              <span key={i} className="font-medium text-violet-700">
                {part}
              </span>
            );
          }
          if (part.startsWith("#")) {
            return (
              <span key={i} className="font-medium text-sky-700">
                {part}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </p>
    );
  }

  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith("@")) {
          return (
            <span key={i} className="font-medium text-violet-700">
              {part}
            </span>
          );
        }
        if (part.startsWith("#")) {
          return (
            <span key={i} className="font-medium text-sky-700">
              {part}
            </span>
          );
        }
        return <RichTextPart key={i} html={part} />;
      })}
    </div>
  );
}
