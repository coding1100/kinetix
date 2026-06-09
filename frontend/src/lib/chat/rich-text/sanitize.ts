import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "del",
  "code",
  "pre",
  "span",
  "a",
  "ul",
  "ol",
  "li",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "br",
  "div",
];

const ALLOWED_ATTR = ["href", "target", "rel", "style", "data-banner"];

const FORMATTING_SELECTOR =
  "b,strong,i,em,u,s,strike,del,code,pre,a,ul,ol,li,h1,h2,h3,h4,blockquote,[data-banner]";

export function decodeMessageEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\u00A0/g, " ");
}

export function messageBodyHasHtml(body: string): boolean {
  return /<[a-z][^>]*>/i.test(body);
}

/** Normalize contenteditable HTML before send — fixes literal &nbsp; in plain messages. */
export function normalizeComposerHtml(html: string): string {
  if (!html) return "";

  const decoded = decodeMessageEntities(html);

  if (typeof document === "undefined") {
    if (!messageBodyHasHtml(decoded)) {
      return decoded.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    }
    return sanitizeMessageHtml(decoded).replace(/&nbsp;/gi, " ");
  }

  const div = document.createElement("div");
  div.innerHTML = decoded;

  const hasFormatting = div.querySelector(FORMATTING_SELECTOR) !== null;
  if (!hasFormatting) {
    return (div.innerText ?? "").replace(/\u00A0/g, " ").trimEnd();
  }

  return sanitizeMessageHtml(div.innerHTML).replace(/&nbsp;/gi, " ");
}

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
  const decoded = decodeMessageEntities(html);
  if (!messageBodyHasHtml(decoded)) return decoded.trim();
  if (typeof document === "undefined") {
    return decoded
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/li>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  const div = document.createElement("div");
  div.innerHTML = sanitizeMessageHtml(decoded);
  return (div.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function isEmptyComposerHtml(html: string): boolean {
  return !stripMessageHtml(html).trim() && !html.includes("<img");
}
