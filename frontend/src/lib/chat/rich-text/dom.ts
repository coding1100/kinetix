type CharRef = { node: Text; offset: number };

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
