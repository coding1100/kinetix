"use client";

import { useRef } from "react";
import type { ConversationType } from "@/lib/types/chat";
import type { ComposerSegment } from "@/lib/chat/mention-types";
import type { MentionSelection } from "@/lib/chat/mention-types";
import { cn } from "@/lib/utils";
import { MentionChip } from "./MentionChip";
import { MentionAutocompleteDropdown } from "./MentionAutocompleteDropdown";

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
  inputRef: React.RefObject<HTMLInputElement | null>;
  placeholder: string;
  compact?: boolean;
  mentionAutocompleteOpen: boolean;
  mentionQuery: string | null;
  conversationType?: ConversationType;
  conversationId?: string;
  onSelectMention: (selection: MentionSelection) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const showPlaceholder = segments.length === 0 && !draft;

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
          "flex min-h-11 flex-wrap items-center gap-1 bg-card px-3 py-2.5",
          compact ? "min-h-10 py-2" : "max-h-28 overflow-y-auto"
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
            <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {placeholder}
            </span>
          ) : null}
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={onKeyDown}
            className="w-full border-0 bg-transparent p-0 text-sm outline-none"
            aria-label={placeholder}
          />
        </div>
      </div>
    </div>
  );
}
