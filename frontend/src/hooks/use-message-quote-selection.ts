"use client";

import { useCallback, useEffect, useState } from "react";
import type { ComposerQuoteTarget } from "@/stores/chat-store";
import { useChatStore } from "@/stores/chat-store";

export type MessageQuoteSelection = {
  quoteText: string;
  authorId: string;
  authorName: string;
  target: ComposerQuoteTarget;
  top: number;
  left: number;
};

const QUOTE_BODY_SELECTOR = "[data-message-author-id][data-message-author-name]";

function isContentEditable(node: Node | null): boolean {
  let el: Element | null =
    node?.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node?.parentElement ?? null;
  while (el) {
    if (el.getAttribute("contenteditable") === "true") return true;
    el = el.parentElement;
  }
  return false;
}

function findQuoteBody(node: Node | null): HTMLElement | null {
  let el: Element | null =
    node?.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node?.parentElement ?? null;
  while (el) {
    if (el.matches(QUOTE_BODY_SELECTOR)) {
      return el as HTMLElement;
    }
    el = el.parentElement;
  }
  return null;
}

function selectionWithinSingleQuoteBody(sel: Selection): HTMLElement | null {
  const anchorBody = findQuoteBody(sel.anchorNode);
  const focusBody = findQuoteBody(sel.focusNode);
  if (!anchorBody || anchorBody !== focusBody) return null;
  return anchorBody;
}

function resolveQuoteTarget(body: HTMLElement): ComposerQuoteTarget {
  const scoped = body.closest("[data-quote-scope]");
  const scope = scoped?.getAttribute("data-quote-scope");
  return scope === "thread" ? "thread" : "main";
}

function getSelectionClientRect(sel: Selection): DOMRect | null {
  if (sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return rect;
}

export function useMessageQuoteSelection() {
  const requestComposerQuote = useChatStore((s) => s.requestComposerQuote);
  const [selection, setSelection] = useState<MessageQuoteSelection | null>(null);

  const hide = useCallback(() => setSelection(null), []);

  const refresh = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setSelection(null);
      return;
    }

    if (isContentEditable(sel.anchorNode) || isContentEditable(sel.focusNode)) {
      setSelection(null);
      return;
    }

    const body = selectionWithinSingleQuoteBody(sel);
    if (!body) {
      setSelection(null);
      return;
    }

    const quoteText = sel.toString().trim();
    if (!quoteText) {
      setSelection(null);
      return;
    }

    const authorId = body.getAttribute("data-message-author-id");
    const authorName = body.getAttribute("data-message-author-name");
    if (!authorId || !authorName) {
      setSelection(null);
      return;
    }

    const rect = getSelectionClientRect(sel);
    if (!rect) {
      setSelection(null);
      return;
    }

    setSelection({
      quoteText,
      authorId,
      authorName,
      target: resolveQuoteTarget(body),
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  }, []);

  const applyQuote = useCallback(() => {
    if (!selection) return;
    requestComposerQuote({
      quoteText: selection.quoteText,
      authorId: selection.authorId,
      authorName: selection.authorName,
      target: selection.target,
    });
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, [selection, requestComposerQuote]);

  useEffect(() => {
    const onSelectionChange = () => refresh();

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest("[data-message-quote-toolbar]")) return;
      if (target?.closest("[data-quote-scope]")) return;
      if (isContentEditable(target)) return;
      hide();
    };

    const onScroll = () => hide();

    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("scroll", onScroll, true);

    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [refresh, hide]);

  return { selection, applyQuote, hide };
}
