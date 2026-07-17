"use client";

import { useMemo } from "react";
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
import { useMentionMembers } from "@/hooks/use-mention-members";
import { UserProfilePeek } from "@/components/chat/UserProfilePeek";
import type { ConversationType } from "@/lib/types/chat";

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

function PersonMentionToken({
  part,
  userId,
  channelId,
}: {
  part: string;
  userId?: string;
  channelId?: string;
}) {
  const label = displayMentionToken(part);
  if (!userId) {
    return <span className="font-medium text-violet-700">{label}</span>;
  }
  return (
    <UserProfilePeek
      userId={userId}
      channelId={channelId}
      trigger={
        <button
          type="button"
          className="rounded-sm font-medium text-violet-700 hover:underline"
        >
          {label}
        </button>
      }
    />
  );
}

export function MessageBodyWithMentions({
  body,
  conversationType,
  conversationId,
}: {
  body: string;
  conversationType?: ConversationType;
  conversationId?: string;
}) {
  const parts = body.split(MESSAGE_TOKEN_RE);
  const hasHtml = messageBodyHasHtml(body);
  const { members } = useMentionMembers(conversationType, conversationId);
  const channelId = conversationType === "channel" ? conversationId : undefined;

  const idByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) map.set(m.fullName.trim().toLowerCase(), m.id);
    return map;
  }, [members]);

  const resolveMentionUserId = (part: string) =>
    idByName.get(displayMentionToken(part).slice(1).trim().toLowerCase());

  if (!hasHtml) {
    return (
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
        {parts.map((part, i) => {
          if (part.startsWith("@")) {
            return (
              <PersonMentionToken
                key={i}
                part={part}
                userId={resolveMentionUserId(part)}
                channelId={channelId}
              />
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
            <PersonMentionToken
              key={i}
              part={part}
              userId={resolveMentionUserId(part)}
              channelId={channelId}
            />
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
