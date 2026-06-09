import { insertTextAtCursor } from "@/lib/chat/rich-text/dom";

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
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
