import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "b",
  "strong",
  "i",
  "em",
  "u",
  "span",
  "a",
  "ul",
  "ol",
  "li",
  "p",
  "br",
  "div",
];

const ALLOWED_ATTR = ["href", "target", "rel", "style"];

export function sanitizeMessageHtml(html: string): string {
  if (!html.trim()) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  }).trim();
}

export function stripMessageHtml(html: string): string {
  if (!html.includes("<")) return html;
  if (typeof document === "undefined") {
    return html.replace(/<[^>]+>/g, "");
  }
  const div = document.createElement("div");
  div.innerHTML = sanitizeMessageHtml(html);
  return div.textContent ?? "";
}

export function isEmptyComposerHtml(html: string): boolean {
  return !stripMessageHtml(html).trim() && !html.includes("<img");
}
