"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearSavedEditorSelection,
  getSelectionRect,
  restoreEditorSelection,
  saveEditorSelection,
  selectionInside,
} from "@/lib/chat/rich-text/dom";
import { applyLink } from "@/lib/chat/rich-text/commands";

export type FormatToolbarPosition = {
  top: number;
  left: number;
};

export function useComposerFormat(editorRef: React.RefObject<HTMLElement | null>) {
  const [position, setPosition] = useState<FormatToolbarPosition | null>(null);
  const [linkPosition, setLinkPosition] = useState<FormatToolbarPosition | null>(
    null
  );

  const refresh = useCallback(() => {
    if (linkPosition) return;
    const editor = editorRef.current;
    if (!editor || !selectionInside(editor)) {
      setPosition(null);
      return;
    }
    const rect = getSelectionRect(editor);
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      setPosition(null);
      return;
    }
    setPosition({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  }, [editorRef, linkPosition]);

  const hide = useCallback(() => {
    setPosition(null);
    setLinkPosition(null);
    clearSavedEditorSelection();
  }, []);

  const openLinkPopover = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || !saveEditorSelection(editor)) return;

    const rect = getSelectionRect(editor);
    if (!rect) {
      clearSavedEditorSelection();
      return;
    }

    setPosition(null);
    setLinkPosition({
      top: rect.top - 6,
      left: rect.left + rect.width / 2,
    });
  }, [editorRef]);

  const closeLinkPopover = useCallback(() => {
    setLinkPosition(null);
    clearSavedEditorSelection();
  }, []);

  const submitLink = useCallback(
    (url: string) => {
      const editor = editorRef.current;
      if (!editor) return;

      restoreEditorSelection();
      applyLink(url);
      setLinkPosition(null);
      clearSavedEditorSelection();
      editor.focus();
    },
    [editorRef]
  );

  useEffect(() => {
    const onSelectionChange = () => {
      if (linkPosition) return;

      const editor = editorRef.current;
      if (!editor) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        setPosition(null);
        return;
      }
      const anchor = sel.anchorNode;
      if (!anchor || !editor.contains(anchor)) {
        setPosition(null);
        return;
      }
      if (sel.isCollapsed) {
        setPosition(null);
        return;
      }
      refresh();
    };

    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [editorRef, refresh, linkPosition]);

  return {
    position,
    linkPosition,
    refresh,
    hide,
    openLinkPopover,
    closeLinkPopover,
    submitLink,
  };
}
