"use client";

import { useEffect, useRef } from "react";
import type { ConversationType } from "@/lib/types/chat";
import type { ComposerSegment } from "@/lib/chat/mention-types";
import type { MentionSelection } from "@/lib/chat/mention-types";
import { cn } from "@/lib/utils";
import { MentionChip } from "./MentionChip";
import { MentionAutocompleteDropdown } from "./MentionAutocompleteDropdown";

const MAX_TEXTAREA_HEIGHT_PX = 112;

export function MentionComposerField({
  segments,
  draft,
  onDraftChange,
  inputRef,
  placeholder,
  compact,
  mentionAutocompleteOpen,
  mentionQuery,
  conversationType,
  conversationId,
  onSelectMention,
  onKeyDown,
}: {
  segments: ComposerSegment[];
  draft: string;
  onDraftChange: (value: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  placeholder: string;
  compact?: boolean;
  mentionAutocompleteOpen: boolean;
  mentionQuery: string | null;
  conversationType?: ConversationType;
  conversationId?: string;
  onSelectMention: (selection: MentionSelection) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const showPlaceholder = segments.length === 0 && !draft;

  const resizeTextarea = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
  };

  useEffect(() => {
    resizeTextarea();
  }, [draft, inputRef]);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${text}${draft.slice(end)}`;
    onDraftChange(next);
    const cursor = start + text.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
      resizeTextarea();
    });
  };

  return (
    <div ref={fieldRef} className="relative">
      <MentionAutocompleteDropdown
        open={mentionAutocompleteOpen}
        anchorRef={fieldRef}
        conversationType={conversationType}
        conversationId={conversationId}
        query={mentionQuery ?? ""}
        onSelect={onSelectMention}
      />

      <div
        className={cn(
          "flex min-h-11 flex-wrap items-start gap-1 bg-card px-3 py-2.5",
          compact ? "min-h-10 py-2" : "max-h-36 overflow-y-auto"
        )}
      >
        {segments.map((seg, index) =>
          seg.type === "mention" ? (
            <MentionChip
              key={`${seg.mentionType}-${seg.id}-${index}`}
              mentionType={seg.mentionType}
              label={seg.label}
            />
          ) : (
            <span key={`text-${index}`} className="whitespace-pre-wrap text-sm">
              {seg.value}
            </span>
          )
        )}
        <div className="relative min-w-[8rem] flex-1">
          {showPlaceholder ? (
            <span className="pointer-events-none absolute left-0 top-2 text-sm text-muted-foreground">
              {placeholder}
            </span>
          ) : null}
          <textarea
            ref={inputRef}
            value={draft}
            rows={1}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={handlePaste}
            className="w-full resize-none border-0 bg-transparent p-0 pt-0.5 text-sm leading-5 outline-none"
            aria-label={placeholder}
          />
        </div>
      </div>
    </div>
  );
}
