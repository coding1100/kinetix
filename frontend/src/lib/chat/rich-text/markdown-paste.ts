import { sanitizeMessageHtml } from "@/lib/chat/rich-text/sanitize";

/**
 * Lightweight Markdown -> composer-HTML conversion for pasted text.
 *
 * Scoped deliberately to the exact subset of formatting the composer
 * itself can produce and render (see ALLOWED_TAGS in sanitize.ts) — this
 * is not a general CommonMark implementation (no tables/images/footnotes),
 * so it doesn't need an external parser dependency. Output always passes
 * through sanitizeMessageHtml before use.
 */

const MARKDOWN_SYNTAX_RE =
  /(\*\*[^*\n]+\*\*|__[^_\n]+__|(?:^|\s)\*[^*\n]+\*(?=\s|$)|(?:^|\s)_[^\s_\n]+_(?=\s|$)|~~[^~\n]+~~|`[^`\n]+`|^#{1,4}\s+\S|^>\s+\S|^[-*+]\s+\S|^\d+\.\s+\S|\[[^\]]+\]\([^)]+\))/m;

/** Cheap pre-check so plain prose (e.g. "5 - 3 = 2") never gets converted. */
export function looksLikeMarkdown(text: string): boolean {
  return MARKDOWN_SYNTAX_RE.test(text);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Inline Markdown: bold, italic, strikethrough, inline code, links. */
function renderInline(text: string): string {
  // Inline code first (and skip re-processing its contents).
  const codeParts: string[] = [];
  let masked = text.replace(/`([^`\n]+)`/g, (_, code: string) => {
    codeParts.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000CODE_${codeParts.length - 1}\u0000`;
  });

  masked = escapeHtml(masked);

  masked = masked
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, (_, label: string, url: string) => {
      return `<a href="${url}" target="_blank" rel="noreferrer noopener">${label}</a>`;
    })
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?:^|(?<=\s|[({\[<]))__([^\s_](?:[^_\n]*?[^\s_])?)__(?=[\s)\]}>.,!?;:]|$)/g, "<strong>$1</strong>")
    .replace(/(?:^|(?<=\s|[({\[<]))\*([^*\n]+)\*(?=[\s)\]}>.,!?;:]|$)/g, "<em>$1</em>")
    .replace(/(?:^|(?<=\s|[({\[<]))_([^\s_](?:[^_\n]*?[^\s_])?)_(?=[\s)\]}>.,!?;:]|$)/g, "<em>$1</em>")
    .replace(/~~([^~\n]+)~~/g, "<del>$1</del>");

  return masked.replace(/\u0000CODE_(\d+)\u0000/g, (_, i: string) => codeParts[Number(i)] ?? "");
}

type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4; text: string }
  | { type: "blockquote"; text: string }
  | { type: "code"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "paragraph"; text: string };

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    const fence = line.match(/^```/);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push({ type: "code", text: code.join("\n") });
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3 | 4,
        text: heading[2].trim(),
      });
      i++;
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      const quoteLines: string[] = [quote[1]];
      i++;
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "blockquote", text: quoteLines.join("\n") });
      continue;
    }

    const bullet = line.match(/^[-*+]\s+(.*)$/);
    const numbered = line.match(/^\d+\.\s+(.*)$/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      const items: string[] = [(bullet ?? numbered)![1]];
      i++;
      const itemRe = ordered ? /^\d+\.\s+(.*)$/ : /^[-*+]\s+(.*)$/;
      while (i < lines.length && itemRe.test(lines[i])) {
        items.push(lines[i].match(itemRe)![1]);
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    // Paragraph: consume until a blank line or the start of another block type.
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4}\s|>\s?|[-*+]\s|\d+\.\s|```)/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", text: paraLines.join("\n") });
  }

  return blocks;
}

function renderBlock(block: Block): string {
  switch (block.type) {
    case "heading":
      return `<h${block.level}>${renderInline(block.text)}</h${block.level}>`;
    case "blockquote":
      return `<blockquote>${block.text
        .split("\n")
        .map((l) => renderInline(l))
        .join("<br>")}</blockquote>`;
    case "code":
      return `<pre>${escapeHtml(block.text)}</pre>`;
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      const items = block.items.map((item) => `<li>${renderInline(item)}</li>`).join("");
      return `<${tag}>${items}</${tag}>`;
    }
    case "paragraph":
      return block.text
        .split("\n")
        .map((l) => renderInline(l))
        .join("<br>");
  }
}

/**
 * Builds the raw HTML string from Markdown, with no DOM sanitization pass.
 * Safe on its own merit — every tag comes from our own template strings,
 * all user text is escapeHtml()'d, and link hrefs are constrained to
 * https/mailto at match time in renderInline — but exported separately so
 * the pure string logic can be unit tested without a browser DOM (DOMPurify
 * requires one). Runtime callers should use markdownToComposerHtml instead,
 * which adds sanitizeMessageHtml as defense-in-depth.
 */
export function buildMarkdownHtml(markdown: string): string {
  const blocks = parseBlocks(markdown.replace(/\r\n/g, "\n").split("\n"));
  return blocks.map(renderBlock).join("");
}

/**
 * Convert pasted Markdown text into sanitized composer HTML. Callers should
 * gate this behind looksLikeMarkdown() so plain prose paste is unaffected.
 */
export function markdownToComposerHtml(markdown: string): string {
  return sanitizeMessageHtml(buildMarkdownHtml(markdown));
}
