import { formatPersonMention } from "@/lib/chat/mention-utils";

function escapeHtml(text: string): string {
  if (typeof document === "undefined") {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  const el = document.createElement("div");
  el.textContent = text;
  return el.innerHTML;
}

function quoteBodyHtml(quoteText: string): string {
  return escapeHtml(quoteText).replace(/\n/g, "<br>");
}

export function buildComposerQuoteHtml(
  quoteText: string,
  authorName: string
): string {
  const trimmed = quoteText.trim();
  if (!trimmed) return "";

  const blockquote = `<blockquote>${quoteBodyHtml(trimmed)}</blockquote>`;
  const mention = `<div>${escapeHtml(formatPersonMention(authorName))}</div>`;
  const cursorLine = "<div><br></div>";
  return `${blockquote}${mention}${cursorLine}`;
}
