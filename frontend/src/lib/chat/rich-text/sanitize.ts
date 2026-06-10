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
  return chunks.join("").replace(/\n+$/g, "").trimEnd();
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

/** Ensure block siblings in rich HTML render on separate lines in message view. */
function normalizeRichMessageLineBreaks(root: HTMLElement): string {
  const out = document.createElement("div");

  root.childNodes.forEach((node, index) => {
    if (index > 0 && isBlockElement(node)) {
      out.appendChild(document.createElement("br"));
    }
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

/** Normalize contenteditable HTML before send — fixes literal &nbsp; in plain messages. */
export function normalizeComposerHtml(html: string): string {
  if (!html) return "";

  const decoded = decodeMessageEntities(html);

  if (typeof document === "undefined") {
    if (!messageBodyHasHtml(decoded)) {
      return plainTextFromHtmlFallback(decoded);
    }
    return sanitizeMessageHtml(decoded).replace(/&nbsp;/gi, " ");
  }

  const div = document.createElement("div");
  div.innerHTML = decoded;

  const hasFormatting = div.querySelector(FORMATTING_SELECTOR) !== null;
  if (!hasFormatting) {
    return extractPlainTextWithLineBreaks(div);
  }

  return normalizeRichMessageLineBreaks(div);
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
