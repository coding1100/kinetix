type CharRef = { node: Text; offset: number };

let savedEditorRange: Range | null = null;

export function saveEditorSelection(root: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return false;
  savedEditorRange = range.cloneRange();
  return true;
}

export function restoreEditorSelection(): boolean {
  if (!savedEditorRange) return false;
  const sel = window.getSelection();
  if (!sel) return false;
  sel.removeAllRanges();
  sel.addRange(savedEditorRange);
  return true;
}

export function clearSavedEditorSelection() {
  savedEditorRange = null;
}

function collectCharRefs(root: HTMLElement): CharRef[] {
  const refs: CharRef[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node as Text;
    for (let i = 0; i < text.data.length; i++) {
      refs.push({ node: text, offset: i });
    }
    node = walker.nextNode();
  }
  return refs;
}

function cursorCharIndex(root: HTMLElement, range: Range): number {
  const refs = collectCharRefs(root);
  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i];
    if (
      range.endContainer === ref.node &&
      range.endOffset === ref.offset + 1
    ) {
      return i;
    }
    if (range.endContainer === ref.node && range.endOffset === ref.offset) {
      return i;
    }
  }
  if (range.endContainer === root) {
    return Math.max(0, range.endOffset - 1);
  }
  return refs.length - 1;
}

export function getPlainTextBeforeCursor(root: HTMLElement): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return root.innerText;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.endContainer)) return root.innerText;

  const preRange = range.cloneRange();
  preRange.selectNodeContents(root);
  preRange.setEnd(range.endContainer, range.endOffset);
  return preRange.toString();
}

export function deleteTextBeforeCursor(root: HTMLElement, charCount: number): void {
  if (charCount <= 0) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);
  if (!root.contains(range.endContainer)) return;

  const refs = collectCharRefs(root);
  if (refs.length === 0) return;

  const endIdx = cursorCharIndex(root, range);
  const startIdx = endIdx - charCount + 1;
  if (startIdx < 0) return;

  const start = refs[startIdx];
  const end = refs[endIdx];
  const deleteRange = document.createRange();
  deleteRange.setStart(start.node, start.offset);
  deleteRange.setEnd(end.node, end.offset + 1);
  deleteRange.deleteContents();

  sel.removeAllRanges();
  const next = document.createRange();
  next.setStart(start.node, start.offset);
  next.collapse(true);
  sel.addRange(next);
}

export function insertTextAtCursor(text: string): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

export function focusEditorEnd(root: HTMLElement): void {
  root.focus();
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

export function selectionInside(root: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  return root.contains(range.commonAncestorContainer);
}

export function getSelectionRect(root: HTMLElement): DOMRect | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  return range.getBoundingClientRect();
}

function isCursorAtEndOf(container: HTMLElement, range: Range): boolean {
  const probe = range.cloneRange();
  probe.selectNodeContents(container);
  probe.setStart(range.endContainer, range.endOffset);
  return probe.toString().replace(/\u00A0/g, " ").length === 0;
}

function isElementVisuallyEmpty(el: Element): boolean {
  const html = el.innerHTML.replace(/<br\s*\/?>/gi, "").trim();
  const text = (el.textContent ?? "").replace(/\u00A0/g, " ").trim();
  return !text && !html;
}

function getBlockquoteBlock(node: Node, blockquote: Element): Element | null {
  let el: Element | null =
    node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
  while (el && el !== blockquote) {
    if (el.parentElement === blockquote && /^(DIV|P)$/i.test(el.tagName)) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

function placeCursorInBlock(block: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(block);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Shift+Enter inside a blockquote: exit to a new line after the quote. */
export function exitBlockquoteOnShiftEnter(root: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;

  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return false;

  let node: Node | null = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
  const blockquote = (node as Element | null)?.closest?.("blockquote");
  if (!blockquote || !root.contains(blockquote)) return false;

  const atEnd = isCursorAtEndOf(blockquote as HTMLElement, range);
  const block = getBlockquoteBlock(range.startContainer, blockquote);
  const blockEmpty = block ? isElementVisuallyEmpty(block) : false;

  if (!atEnd && !blockEmpty) return false;

  if (blockEmpty && block && block.parentElement === blockquote) {
    block.remove();
  }

  const nextBlock = document.createElement("div");
  nextBlock.appendChild(document.createElement("br"));

  const parent = blockquote.parentNode;
  if (!parent) return false;

  parent.insertBefore(nextBlock, blockquote.nextSibling);
  placeCursorInBlock(nextBlock);
  return true;
}
