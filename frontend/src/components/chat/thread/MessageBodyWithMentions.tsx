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
import { useMentionMembers, type MentionMember } from "@/hooks/use-mention-members";
import { UserProfilePeek } from "@/components/chat/UserProfilePeek";
import { useAuthStore } from "@/stores/auth-store";
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
  member,
  channelId,
  isSelf,
}: {
  part: string;
  member?: MentionMember;
  channelId?: string;
  isSelf?: boolean;
}) {
  const label = displayMentionToken(part);
  if (!member) {
    return <span className="font-medium text-[#4F8EF7]">{label}</span>;
  }
  return (
    <UserProfilePeek
      userId={member.id}
      channelId={channelId}
      trigger={
        <button
          type="button"
          className={cn(
            "rounded-sm px-0.5 font-medium text-[#4F8EF7] hover:bg-[#4F8EF7]/15",
            isSelf && "bg-[#4F8EF7]/15"
          )}
        >
          {label}
          {member.isDisabled && (
            <span className="text-destructive"> (deactivated)</span>
          )}
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
  const currentUserId = useAuthStore((s) => s.user?.id);

  const memberByName = useMemo(() => {
    const map = new Map<string, MentionMember>();
    for (const m of members) map.set(m.fullName.trim().toLowerCase(), m);
    return map;
  }, [members]);

  const resolveMentionMember = (part: string) =>
    memberByName.get(displayMentionToken(part).slice(1).trim().toLowerCase());

  if (!hasHtml) {
    return (
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
        {parts.map((part, i) => {
          if (part.startsWith("@")) {
            return (
              <PersonMentionToken
                key={i}
                part={part}
                member={resolveMentionMember(part)}
                channelId={channelId}
                isSelf={
                  !!currentUserId &&
                  resolveMentionMember(part)?.id === currentUserId
                }
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
              member={resolveMentionMember(part)}
              channelId={channelId}
              isSelf={
                !!currentUserId && resolveMentionMember(part)?.id === currentUserId
              }
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
