"use client";

import { useEffect, useRef } from "react";
import type { ConversationType } from "@/lib/types/chat";
import type { ComposerSegment } from "@/lib/chat/mention-types";
import type { MentionSelection } from "@/lib/chat/mention-types";
import { cn } from "@/lib/utils";
import { MentionChip } from "@/components/chat/mentions/MentionChip";
import { MentionAutocompleteDropdown } from "@/components/chat/mentions/MentionAutocompleteDropdown";
import { ComposerFormatToolbar } from "@/components/chat/composer/ComposerFormatToolbar";
import { useComposerFormat } from "@/hooks/use-composer-format";

const MAX_EDITOR_HEIGHT_PX = 160;

export function RichComposerField({
  segments,
  draftPlain,
  editorRef,
  placeholder,
  compact,
  mentionAutocompleteOpen,
  mentionQuery,
  conversationType,
  conversationId,
  onSelectMention,
  onKeyDown,
  onInput,
}: {
  segments: ComposerSegment[];
  draftPlain: string;
  editorRef: React.RefObject<HTMLDivElement | null>;
  placeholder: string;
  compact?: boolean;
  mentionAutocompleteOpen: boolean;
  mentionQuery: string | null;
  conversationType?: ConversationType;
  conversationId?: string;
  onSelectMention: (selection: MentionSelection) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onInput: () => void;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const { position, refresh } = useComposerFormat(editorRef);
  const showPlaceholder = segments.length === 0 && !draftPlain.trim();

  const resizeEditor = () => {
    const el = editorRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_EDITOR_HEIGHT_PX)}px`;
  };

  useEffect(() => {
    resizeEditor();
  }, [draftPlain, editorRef]);

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    document.execCommand("insertText", false, text);
    onInput();
    resizeEditor();
  };

  return (
    <>
      <ComposerFormatToolbar position={position} onFormatApplied={refresh} />

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
            compact ? "min-h-10 py-2" : "max-h-44 overflow-y-auto"
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
              <span className="pointer-events-none absolute left-0 top-0.5 text-sm text-muted-foreground">
                {placeholder}
              </span>
            ) : null}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline
              aria-label={placeholder}
              onInput={() => {
                onInput();
                resizeEditor();
              }}
              onKeyDown={onKeyDown}
              onPaste={handlePaste}
              onMouseUp={refresh}
              onKeyUp={refresh}
              className={cn(
                "w-full min-h-[1.25rem] border-0 bg-transparent p-0 text-sm leading-5 outline-none",
                "[&_a]:text-primary [&_a]:underline",
                "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5",
                "[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5"
              )}
            />
          </div>
        </div>
      </div>
    </>
  );
}
