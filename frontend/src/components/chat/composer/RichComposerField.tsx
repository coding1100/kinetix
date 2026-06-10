"use client";

import { useEffect, useRef } from "react";
import type { ConversationType } from "@/lib/types/chat";
import type { ComposerSegment } from "@/lib/chat/mention-types";
import type { MentionSelection } from "@/lib/chat/mention-types";
import { cn } from "@/lib/utils";
import { MentionChip } from "@/components/chat/mentions/MentionChip";
import { MentionAutocompleteDropdown } from "@/components/chat/mentions/MentionAutocompleteDropdown";
import { ComposerFormatToolbar } from "@/components/chat/composer/ComposerFormatToolbar";
import { ComposerLinkPopover } from "@/components/chat/composer/ComposerLinkPopover";
import { useComposerFormat } from "@/hooks/use-composer-format";
import type { TurnIntoBlockType } from "@/lib/chat/rich-text/block-types";
import { applyTurnInto } from "@/lib/chat/rich-text/commands";
import { RICH_TEXT_CONTENT_CLASS } from "@/lib/chat/rich-text/rich-text-styles";

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
  onDismissMentionAutocomplete,
  onKeyDown,
  onInput,
  onPasteFiles,
  leadingContent,
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
  onDismissMentionAutocomplete: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onInput: () => void;
  onPasteFiles?: (files: File[]) => void;
  leadingContent?: React.ReactNode;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const {
    position,
    linkPosition,
    refresh,
    openLinkPopover,
    closeLinkPopover,
    submitLink,
  } = useComposerFormat(editorRef);
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

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey && e.ctrlKey && !e.shiftKey && !e.nativeEvent.isComposing) {
      const headingMap: Record<string, TurnIntoBlockType> = {
        "1": "h1",
        "2": "h2",
        "3": "h3",
        "4": "h4",
      };
      const turnInto = headingMap[e.key];
      if (turnInto) {
        e.preventDefault();
        applyTurnInto(turnInto);
        onInput();
        resizeEditor();
        return;
      }
    }
    onKeyDown?.(e);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (onPasteFiles) {
      const items = Array.from(e.clipboardData.items);
      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        onPasteFiles(imageFiles);
        return;
      }
    }

    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    document.execCommand("insertText", false, text);
    onInput();
    resizeEditor();
  };

  return (
    <>
      {linkPosition ? (
        <ComposerLinkPopover
          position={linkPosition}
          onSubmit={(url) => {
            submitLink(url);
            onInput();
          }}
          onClose={closeLinkPopover}
        />
      ) : null}
      <ComposerFormatToolbar
        position={position}
        onFormatApplied={() => {
          onInput();
          refresh();
        }}
        onOpenLink={openLinkPopover}
      />

      <div ref={fieldRef} className="relative">
        <MentionAutocompleteDropdown
          open={mentionAutocompleteOpen}
          anchorRef={fieldRef}
          conversationType={conversationType}
          conversationId={conversationId}
          query={mentionQuery ?? ""}
          onSelect={onSelectMention}
          onDismiss={onDismissMentionAutocomplete}
        />

        <div
          className={cn(
            "flex min-h-11 flex-wrap items-start gap-1 bg-card px-3 py-2.5",
            compact ? "min-h-10 py-2" : "max-h-44 overflow-y-auto"
          )}
        >
          {leadingContent}
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
              onKeyDown={handleEditorKeyDown}
              onPaste={handlePaste}
              onMouseUp={refresh}
              onKeyUp={refresh}
              className={cn(
                "w-full min-h-[1.25rem] border-0 bg-transparent p-0 text-sm leading-5 outline-none",
                RICH_TEXT_CONTENT_CLASS
              )}
            />
          </div>
        </div>
      </div>
    </>
  );
}
