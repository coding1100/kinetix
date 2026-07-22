import {
  formatChannelMention,
  formatPersonMention,
} from "@/lib/chat/mention-utils";

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

const BLOCK_ANCESTOR_RE = /^(DIV|P|LI|BLOCKQUOTE|H[1-6]|PRE)$/i;

function getBlockAncestor(node: Node, root: HTMLElement): HTMLElement {
  let el: HTMLElement | null =
    node.nodeType === Node.TEXT_NODE
      ? node.parentElement
      : (node as HTMLElement);
  while (el && el !== root) {
    if (BLOCK_ANCESTOR_RE.test(el.tagName)) {
      return el;
    }
    el = el.parentElement;
  }
  return root;
}

/** Text in the current block only — avoids stale @ queries after blockquotes/quotes.
 * Already-picked mention chips are stripped out entirely first: an inserted
 * chip's own "@Name" text must never be mistaken for a still-being-typed
 * query just because whatever comes after it happens to run on without a
 * plain space (e.g. punctuation right after the mention). */
export function getPlainTextBeforeCursorInBlock(root: HTMLElement): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return "";
  const range = sel.getRangeAt(0);
  if (!root.contains(range.endContainer)) return "";

  const block = getBlockAncestor(range.endContainer, root);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(block);
  preRange.setEnd(range.endContainer, range.endOffset);

  const fragment = preRange.cloneContents();
  fragment.querySelectorAll("[data-mention-type]").forEach((chip) => chip.remove());
  return fragment.textContent ?? "";
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

/** Splice an atomic (contenteditable=false) chip node in at the cursor,
 * followed by a plain space, then collapse the cursor right after that
 * space - same "insert exactly where the caret is" contract as
 * insertTextAtCursor, just for a real element instead of a text node. */
export function insertChipAtCursor(chip: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();

  // Must be U+0020, not U+00A0 - this exact literal was previously
  // silently corrupted into a non-breaking space by file-write tooling,
  // which looks identical here but merges visually into the chip's run
  // with no visible gap once more text is typed after it.
  const space = document.createTextNode(" ");
  const frag = document.createDocumentFragment();
  frag.appendChild(chip);
  frag.appendChild(space);
  range.insertNode(frag);

  // Collapse *inside* the space text node (not a parent+offset boundary
  // just past it) - matches where native typing itself would leave the
  // caret, so the next keystroke extends this text node instead of the
  // browser folding it into the chip's run.
  range.setStart(space, space.length);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Defensive repair: if the browser ever lets typed characters land INSIDE
 * an atomic mention chip's own text (a contenteditable=false leaf edge case
 * that varies across browsers and can't be reliably prevented up front),
 * split the overflow back out into a plain sibling text node right after
 * the chip and restore the chip to just its own label. Run on every
 * input/selection sync so any such drift self-heals on the very next
 * keystroke instead of silently growing the chip. Returns true if it
 * changed anything. */
export function repairMentionChipOverflow(root: HTMLElement): boolean {
  let changed = false;
  // Compare with nbsp folded to a plain space: the chip's own label uses an
  // nbsp between first/last name, but the browser can normalize whitespace
  // when it merges typed text in, so a raw === / startsWith would miss it.
  const norm = (s: string) => s.replace(/\s+/g, " ");

  root.querySelectorAll<HTMLElement>("[data-mention-type]").forEach((chip) => {
    const label = chip.dataset.mentionLabel ?? "";
    const expected = (
      chip.dataset.mentionType === "channel"
        ? formatChannelMention(label)
        : formatPersonMention(label)
    ).trimEnd();

    // (1) Pull any text the browser folded INTO the chip back out into a
    //     plain sibling text node right after it.
    const actual = chip.textContent ?? "";
    if (
      norm(actual) !== norm(expected) &&
      norm(actual).startsWith(norm(expected))
    ) {
      const overflow = actual.slice(expected.length);
      chip.textContent = expected;

      const overflowNode = document.createTextNode(overflow);
      chip.parentNode?.insertBefore(overflowNode, chip.nextSibling);

      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.setStart(overflowNode, overflow.length);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }

      changed = true;
    }

    // (2) Guarantee a separator right after the chip. A lone trailing space
    //     text node after an atomic contenteditable=false element can get
    //     collapsed away, which both glues the next word onto the chip
    //     visually and drops the space from the serialized message body.
    const next = chip.nextSibling;
    const hasSeparator =
      next?.nodeType === Node.TEXT_NODE &&
      /^\s/.test((next as Text).data);
    if (!hasSeparator) {
      chip.parentNode?.insertBefore(
        document.createTextNode(" "),
        chip.nextSibling
      );
      changed = true;
    }
  });

  return changed;
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
