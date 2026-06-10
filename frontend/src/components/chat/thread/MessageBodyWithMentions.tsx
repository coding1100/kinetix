"use client";

import {
  displayMentionToken,
  MESSAGE_TOKEN_RE,
} from "@/lib/chat/mention-utils";
import { cn } from "@/lib/utils";
import { RICH_TEXT_CONTENT_CLASS } from "@/lib/chat/rich-text/rich-text-styles";
import {
  decodeMessageEntities,
  messageBodyHasHtml,
  sanitizeMessageHtml,
} from "@/lib/chat/rich-text/sanitize";

function RichTextPart({ html }: { html: string }) {
  const safe = sanitizeMessageHtml(html);
  if (!safe) return null;

  return (
    <div
      className={cn(RICH_TEXT_CONTENT_CLASS, "inline")}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}

export function MessageBodyWithMentions({ body }: { body: string }) {
  const parts = body.split(MESSAGE_TOKEN_RE);
  const hasHtml = messageBodyHasHtml(body);

  if (!hasHtml) {
    return (
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
        {parts.map((part, i) => {
          if (part.startsWith("@")) {
            return (
              <span key={i} className="font-medium text-violet-700">
                {displayMentionToken(part)}
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
          return <span key={i}>{decodeMessageEntities(part)}</span>;
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
              {displayMentionToken(part)}
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
