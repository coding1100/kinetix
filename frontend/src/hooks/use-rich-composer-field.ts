"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComposerSegment } from "@/lib/chat/mention-types";
import type { MentionSelection } from "@/lib/chat/mention-types";
import {
  getDraftMentionQuery,
  mentionSelectionToSegment,
  stripDraftMentionQuery,
} from "@/lib/chat/mention-utils";
import {
  deleteTextBeforeCursor,
  exitBlockquoteOnShiftEnter,
  focusEditorEnd,
  getPlainTextBeforeCursor,
  getPlainTextBeforeCursorInBlock,
  insertTextAtCursor,
} from "@/lib/chat/rich-text/dom";
import {
  isEmptyComposerHtml,
  sanitizeMessageHtml,
} from "@/lib/chat/rich-text/sanitize";
import { buildComposerQuoteHtml } from "@/lib/chat/quote-utils";
import { serializeRichComposerBody } from "@/lib/chat/rich-text/serialize";

export function useRichComposerField() {
  const [segments, setSegments] = useState<ComposerSegment[]>([]);
  const [draftHtml, setDraftHtml] = useState("");
  const [draftPlain, setDraftPlain] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const syncFromEditor = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    setDraftHtml(el.innerHTML);
    const plain = el.innerText;
    setDraftPlain(plain);
    setMentionQuery(
      getDraftMentionQuery(getPlainTextBeforeCursorInBlock(el))
    );
  }, []);

  useEffect(() => {
    const onSelectionChange = () => {
      const el = editorRef.current;
      if (!el || !document.activeElement || !el.contains(document.activeElement)) {
        return;
      }
      setMentionQuery(
        getDraftMentionQuery(getPlainTextBeforeCursorInBlock(el))
      );
    };

    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  const getBodyText = useCallback(
    (html = editorRef.current?.innerHTML ?? draftHtml) =>
      serializeRichComposerBody(segments, html),
    [segments, draftHtml]
  );

  const bodyText = useMemo(
    () => getBodyText(draftHtml),
    [getBodyText, draftHtml]
  );

  const mentionAutocompleteOpen = mentionQuery !== null;

  const dismissMentionAutocomplete = useCallback(() => {
    setMentionQuery(null);
  }, []);

  const insertMention = useCallback(
    (selection: MentionSelection) => {
      const el = editorRef.current;
      const segment = mentionSelectionToSegment(selection);
      setSegments((prev) => [...prev, segment]);

      if (el) {
        const before = getPlainTextBeforeCursorInBlock(el);
        const stripped = stripDraftMentionQuery(before);
        const removeCount = before.length - stripped.length;
        if (removeCount > 0) {
          deleteTextBeforeCursor(el, removeCount);
        }
        syncFromEditor();
        focusEditorEnd(el);
      }

      setPickerOpen(false);
    },
    [syncFromEditor]
  );

  const insertEmoji = useCallback(
    (emoji: string) => {
      const el = editorRef.current;
      if (el) {
        el.focus();
        insertTextAtCursor(emoji);
        syncFromEditor();
      }
    },
    [syncFromEditor]
  );

  const clear = useCallback(() => {
    setSegments([]);
    setDraftHtml("");
    setDraftPlain("");
    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }
  }, []);

  const insertQuote = useCallback(
    ({
      quoteText,
      authorName,
    }: {
      quoteText: string;
      authorName: string;
    }) => {
      const el = editorRef.current;
      const quoteHtml = buildComposerQuoteHtml(quoteText, authorName);
      if (!quoteHtml) return;

      if (el) {
        const existing = el.innerHTML.trim();
        el.innerHTML = existing ? `${quoteHtml}${existing}` : quoteHtml;
        focusEditorEnd(el);
        syncFromEditor();
      } else {
        setDraftHtml(quoteHtml);
        setDraftPlain(`${quoteText.trim()}\n@${authorName.trim()}`);
      }
    },
    [syncFromEditor]
  );

  const restore = useCallback((text: string) => {
    setSegments([]);
    const content = text.includes("<") ? sanitizeMessageHtml(text) : text;
    if (editorRef.current) {
      editorRef.current.innerHTML = content;
      setDraftHtml(editorRef.current.innerHTML);
      setDraftPlain(editorRef.current.innerText);
      setMentionQuery(getDraftMentionQuery(editorRef.current.innerText));
    } else {
      setDraftHtml(content);
      setDraftPlain(text);
      setMentionQuery(null);
    }
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
    (e: React.KeyboardEvent<HTMLDivElement>, onEnter?: () => void) => {
      const el = editorRef.current;
      const plain = el?.innerText ?? "";

      if (e.key === "Backspace" && !plain.trim() && segments.length > 0) {
        e.preventDefault();
        removeLastSegment();
        return;
      }

      if (e.key === "Enter" && e.shiftKey && !e.nativeEvent.isComposing && el) {
        if (exitBlockquoteOnShiftEnter(el)) {
          e.preventDefault();
          syncFromEditor();
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        onEnter?.();
      }
    },
    [segments.length, removeLastSegment, syncFromEditor]
  );

  const isEmpty =
    segments.length === 0 && isEmptyComposerHtml(draftHtml) && !draftPlain.trim();

  return {
    segments,
    draftHtml,
    draftPlain,
    setDraftHtml,
    bodyText,
    getBodyText,
    editorRef,
    pickerOpen,
    setPickerOpen,
    mentionQuery,
    mentionAutocompleteOpen,
    dismissMentionAutocomplete,
    insertMention,
    insertQuote,
    insertEmoji,
    handleInputKeyDown,
    syncFromEditor,
    clear,
    restore,
    isEmpty,
  };
}
