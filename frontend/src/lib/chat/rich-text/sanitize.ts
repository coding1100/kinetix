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

const ALLOWED_ATTR = ["href", "target", "rel", "data-banner"];

const FORMATTING_SELECTOR =
  "b,strong,i,em,u,s,strike,del,code,pre,a,ul,ol,li,h1,h2,h3,h4,blockquote,[data-banner]";

const BLOCK_TAG_RE = /^(DIV|P|H[1-6]|BLOCKQUOTE|PRE|LI|UL|OL)$/i;

function isBlockElement(node: Node): node is HTMLElement {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    BLOCK_TAG_RE.test((node as HTMLElement).tagName)
  );
}

/** Walk contenteditable DOM and keep line breaks from div/p/br blocks. */
export function extractPlainTextWithLineBreaks(root: HTMLElement): string {
  const chunks: string[] = [];

  const push = (text: string) => {
    if (text) chunks.push(text);
  };

  const walk = (node: Node, topLevel = false) => {
    if (node.nodeType === Node.TEXT_NODE) {
      push(node.textContent?.replace(/\u00A0/g, " ") ?? "");
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    if (el.tagName === "BR") {
      push("\n");
      return;
    }

    const topBlock = topLevel && isBlockElement(el);
    if (topBlock && chunks.length > 0 && !chunks[chunks.length - 1].endsWith("\n")) {
      push("\n");
    }

    el.childNodes.forEach((child) => walk(child, false));

    if (topBlock) {
      push("\n");
    }
  };

  root.childNodes.forEach((child) => walk(child, true));
  return collapseBlankLines(chunks.join("")).replace(/\n+$/g, "").trimEnd();
}

/**
 * Collapse runs of 3+ newlines down to a single blank line (2 newlines).
 * Pasted text from Word/Google Docs/Notion often inserts a blank line after
 * every paragraph, which otherwise survives untouched and makes messages
 * look multiple times longer than the original.
 */
function collapseBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n");
}

/**
 * Normalize clipboard plain text before inserting it into the composer.
 * Word/Google Docs/Notion frequently emit a blank line after every
 * paragraph and trailing whitespace per line in their text/plain payload,
 * which otherwise makes a pasted message look 2-3x longer than the source.
 */
export function normalizePastedText(text: string): string {
  return collapseBlankLines(
    text
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.replace(/[ \t]+$/g, ""))
      .join("\n")
  );
}

function plainTextFromHtmlFallback(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|h[1-6]|li|blockquote|pre)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

/** Clean up HTML structure without inserting extra <br> elements between block elements. */
function normalizeRichMessageLineBreaks(root: HTMLElement): string {
  const out = document.createElement("div");

  root.childNodes.forEach((node) => {
    out.appendChild(node.cloneNode(true));
  });

  return sanitizeMessageHtml(out.innerHTML).replace(/&nbsp;/gi, " ");
}

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

/** Load a stored message body into the contenteditable composer without losing line breaks. */
export function bodyToComposerHtml(body: string): string {
  if (!body.trim()) return "";

  if (messageBodyHasHtml(body)) {
    return sanitizeMessageHtml(body);
  }

  if (typeof document === "undefined") {
    return body
      .split("\n")
      .map((line) =>
        line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
      )
      .join("<br>");
  }

  const div = document.createElement("div");
  body.split("\n").forEach((line, index) => {
    if (index > 0) {
      div.appendChild(document.createElement("br"));
    }
    div.appendChild(document.createTextNode(line));
  });
  return div.innerHTML;
}

/** Normalize contenteditable HTML before send — fixes literal &nbsp; in plain messages. */
export function normalizeComposerHtml(html: string): string {
  if (!html) return "";

  const cleanHtml = html.replace(/&nbsp;/gi, " ").replace(/\u00A0/g, " ");

  if (typeof document === "undefined") {
    if (!messageBodyHasHtml(cleanHtml)) {
      return plainTextFromHtmlFallback(cleanHtml);
    }
    return sanitizeMessageHtml(cleanHtml).replace(/&nbsp;/gi, " ");
  }

  const div = document.createElement("div");
  div.innerHTML = cleanHtml;

  const hasFormatting = div.querySelector(FORMATTING_SELECTOR) !== null;
  if (!hasFormatting) {
    return extractPlainTextWithLineBreaks(div);
  }

  return normalizeRichMessageLineBreaks(div);
}

export function sanitizeMessageHtml(html: string): string {
  if (!html.trim()) return "";
  const purify = (DOMPurify as unknown as { default?: typeof DOMPurify }).default ?? DOMPurify;
  if (typeof purify?.sanitize === "function") {
    return purify
      .sanitize(html, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        ALLOWED_URI_REGEXP:
          /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
      })
      .trim();
  }
  return html.trim();
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
