"use client";

import { useCallback, useEffect, useState } from "react";
import { getSelectionRect, selectionInside } from "@/lib/chat/rich-text/dom";

export type FormatToolbarPosition = {
  top: number;
  left: number;
};

export function useComposerFormat(editorRef: React.RefObject<HTMLElement | null>) {
  const [position, setPosition] = useState<FormatToolbarPosition | null>(null);

  const refresh = useCallback(() => {
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
  }, [editorRef]);

  const hide = useCallback(() => {
    setPosition(null);
  }, []);

  useEffect(() => {
    const onSelectionChange = () => {
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
  }, [editorRef, refresh]);

  return { position, refresh, hide };
}
