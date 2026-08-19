"use client";

import { useEffect, useRef } from "react";
import type { ConversationType } from "@/lib/types/chat";
import type { MentionMember } from "@/hooks/use-mention-members";
import type { ComposerSegment } from "@/lib/chat/mention-types";
import type { MentionSelection } from "@/lib/chat/mention-types";
import { cn } from "@/lib/utils";
import { MentionChip } from "@/components/chat/mentions/MentionChip";
import { MentionAutocompleteDropdown } from "@/components/chat/mentions/MentionAutocompleteDropdown";
import { ComposerFormatToolbar } from "@/components/chat/composer/ComposerFormatToolbar";
import { ComposerLinkPopover } from "@/components/chat/composer/ComposerLinkPopover";
import { ComposerMentionHoverPeek } from "@/components/chat/composer/ComposerMentionHoverPeek";
import { useComposerFormat } from "@/hooks/use-composer-format";
import { useMentionHoverPeek } from "@/hooks/use-mention-hover-peek";
import type { TurnIntoBlockType } from "@/lib/chat/rich-text/block-types";
import { applyTurnInto } from "@/lib/chat/rich-text/commands";
import { RICH_TEXT_CONTENT_CLASS } from "@/lib/chat/rich-text/rich-text-styles";
import { extractFilesFromClipboard } from "@/lib/chat/composer-image-files";

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
  members,
  onSelectMention,
  onDismissMentionAutocomplete,
  onKeyDown,
  onInput,
  onPasteFiles,
  leadingContent,
  peopleOnlyMentions = false,
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
  members?: MentionMember[];
  onSelectMention: (selection: MentionSelection) => void;
  onDismissMentionAutocomplete: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onInput: () => void;
  onPasteFiles?: (files: File[]) => void;
  leadingContent?: React.ReactNode;
  peopleOnlyMentions?: boolean;
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
  const mentionHoverPeek = useMentionHoverPeek(editorRef);
  const channelId = conversationType === "channel" ? conversationId : undefined;

  const resizeEditor = () => {
    const el = editorRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = compact ? 120 : MAX_EDITOR_HEIGHT_PX;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
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
      const files = extractFilesFromClipboard(e.clipboardData);
      if (files.length > 0) {
        e.preventDefault();
        onPasteFiles(files);
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
      {mentionHoverPeek.target ? (
        <ComposerMentionHoverPeek
          userId={mentionHoverPeek.target.userId}
          rect={mentionHoverPeek.target.rect}
          channelId={channelId}
          onMouseEnter={mentionHoverPeek.holdOpen}
          onMouseLeave={mentionHoverPeek.releaseAndClose}
        />
      ) : null}
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
          members={members}
          query={mentionQuery ?? ""}
          onSelect={onSelectMention}
          onDismiss={onDismissMentionAutocomplete}
          peopleOnly={peopleOnlyMentions}
        />

        <div
          className={cn(
            "flex min-h-11 flex-wrap items-start gap-1 overflow-y-auto bg-card px-3 py-2.5",
            compact ? "max-h-32 min-h-10 py-2" : "max-h-44"
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
                "w-full min-h-[1.25rem] border-0 bg-transparent p-0 text-sm leading-5 outline-none break-words [overflow-wrap:anywhere]",
                RICH_TEXT_CONTENT_CLASS
              )}
            />
          </div>
        </div>
      </div>
    </>
  );
}
