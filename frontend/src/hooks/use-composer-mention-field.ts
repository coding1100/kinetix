"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { ComposerSegment } from "@/lib/chat/mention-types";
import type { MentionSelection } from "@/lib/chat/mention-types";
import {
  getDraftMentionQuery,
  mentionSelectionToSegment,
  serializeComposerBody,
  stripDraftMentionQuery,
} from "@/lib/chat/mention-utils";

export function useComposerMentionField() {
  const [segments, setSegments] = useState<ComposerSegment[]>([]);
  const [draft, setDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const bodyText = useMemo(
    () => serializeComposerBody(segments, draft),
    [segments, draft]
  );

  const mentionQuery = useMemo(() => getDraftMentionQuery(draft), [draft]);
  const mentionAutocompleteOpen = mentionQuery !== null;

  const insertMention = useCallback((selection: MentionSelection) => {
    const segment = mentionSelectionToSegment(selection);
    setSegments((prev) => [...prev, segment]);
    setDraft((prev) => stripDraftMentionQuery(prev));
    setPickerOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const insertEmoji = useCallback((emoji: string) => {
    setDraft((prev) => `${prev}${emoji}`);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const clear = useCallback(() => {
    setSegments([]);
    setDraft("");
  }, []);

  const restore = useCallback((text: string) => {
    setSegments([]);
    setDraft(text);
  }, []);

  const removeLastSegment = useCallback(() => {
    setSegments((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const last = next[next.length - 1];
      if (last.type === "text" && last.value.length > 1) {
        next[next.length - 1] = {
          type: "text",
          value: last.value.slice(0, -1),
        };
        return next;
      }
      next.pop();
      return next;
    });
  }, []);

  const handleInputKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLTextAreaElement>,
      onEnter?: () => void
    ) => {
      if (e.key === "Backspace" && draft.length === 0 && segments.length > 0) {
        e.preventDefault();
        removeLastSegment();
        return;
      }

      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        onEnter?.();
      }
    },
    [draft.length, segments.length, removeLastSegment]
  );

  return {
    segments,
    draft,
    setDraft,
    bodyText,
    inputRef,
    pickerOpen,
    setPickerOpen,
    mentionQuery,
    mentionAutocompleteOpen,
    insertMention,
    insertEmoji,
    handleInputKeyDown,
    clear,
    restore,
  };
}
