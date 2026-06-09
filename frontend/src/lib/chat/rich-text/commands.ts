import type { BannerVariant, TurnIntoBlockType } from "@/lib/chat/rich-text/block-types";
import { insertTextAtCursor } from "@/lib/chat/rich-text/dom";

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

function wrapSelectionInTag(tag: string, className?: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

  const range = sel.getRangeAt(0);
  const el = document.createElement(tag);
  if (className) el.className = className;

  try {
    range.surroundContents(el);
  } catch {
    const fragment = range.extractContents();
    el.appendChild(fragment);
    range.insertNode(el);
  }

  sel.removeAllRanges();
  const next = document.createRange();
  next.selectNodeContents(el);
  next.collapse(false);
  sel.addRange(next);
}

export function applyBold() {
  exec("bold");
}

export function applyItalic() {
  exec("italic");
}

export function applyUnderline() {
  exec("underline");
}

export function applyOverline() {
  wrapSelectionWithSpan({ textDecoration: "overline" });
}

export function applyTextColor(color: string) {
  exec("foreColor", color);
}

export function applyBulletList() {
  exec("insertUnorderedList");
}

export function applyNumberedList() {
  exec("insertOrderedList");
}

export function applyIndent() {
  exec("indent");
}

export function applyOutdent() {
  exec("outdent");
}

export function applyStrikethrough() {
  exec("strikeThrough");
}

export function applyInlineCode() {
  wrapSelectionInTag("code");
}

export function applyTurnInto(type: TurnIntoBlockType) {
  if (type.startsWith("banner-")) {
    applyBannerBlock(type.replace("banner-", "") as BannerVariant);
    return;
  }

  if (type === "pre") {
    exec("formatBlock", "<pre>");
    return;
  }

  if (type === "blockquote") {
    exec("formatBlock", "<blockquote>");
    return;
  }

  const tag = type === "p" ? "p" : type;
  exec("formatBlock", `<${tag}>`);
}

export function applyBannerBlock(variant: BannerVariant) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);
  const div = document.createElement("div");
  div.setAttribute("data-banner", variant);

  try {
    range.surroundContents(div);
  } catch {
    const fragment = range.extractContents();
    div.appendChild(fragment);
    range.insertNode(div);
  }

  sel.removeAllRanges();
  const next = document.createRange();
  next.selectNodeContents(div);
  next.collapse(false);
  sel.addRange(next);
}

export function applyLink(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return;
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  exec("createLink", href);
}

export function wrapSelectionWithSpan(style: Record<string, string>) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

  const range = sel.getRangeAt(0);
  const span = document.createElement("span");
  for (const [key, value] of Object.entries(style)) {
    span.style.setProperty(
      key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`),
      value
    );
  }

  try {
    range.surroundContents(span);
  } catch {
    const fragment = range.extractContents();
    span.appendChild(fragment);
    range.insertNode(span);
  }

  sel.removeAllRanges();
  const next = document.createRange();
  next.selectNodeContents(span);
  next.collapse(false);
  sel.addRange(next);
}

export function insertPlainText(text: string) {
  insertTextAtCursor(text);
}
