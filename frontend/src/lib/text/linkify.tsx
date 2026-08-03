import type { ReactNode } from "react";

const URL_RE =
  /((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,:;!?)\]}])/gi;

function toHref(match: string): string {
  return /^https?:\/\//i.test(match) ? match : `https://${match}`;
}

/** Split plain text on URLs and wrap them in clickable anchors. */
export function linkifyText(text: string, keyPrefix = ""): ReactNode[] {
  const parts = text.split(URL_RE);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <a
          key={`${keyPrefix}${i}`}
          href={toHref(part)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#4F8EF7] underline underline-offset-2 hover:opacity-80"
        >
          {part}
        </a>
      );
    }
    return part ? <span key={`${keyPrefix}${i}`}>{part}</span> : null;
  });
}

/** Walk sanitized HTML and wrap bare URL text nodes in <a> tags, skipping existing links. */
export function linkifyHtml(html: string): string {
  if (!html.trim() || typeof document === "undefined") return html;

  const root = document.createElement("div");
  root.innerHTML = html;

  const walk = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === "A") return;
      Array.from(node.childNodes).forEach(walk);
      return;
    }
    if (node.nodeType !== Node.TEXT_NODE) return;

    const text = node.textContent ?? "";
    URL_RE.lastIndex = 0;
    if (!URL_RE.test(text)) return;
    URL_RE.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = URL_RE.exec(text)) !== null) {
      if (m.index > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
      }
      const a = document.createElement("a");
      a.href = toHref(m[0]);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.className = "text-[#4F8EF7] underline underline-offset-2 hover:opacity-80";
      a.textContent = m[0];
      frag.appendChild(a);
      lastIndex = m.index + m[0].length;
    }
    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    node.parentNode?.replaceChild(frag, node);
  };

  Array.from(root.childNodes).forEach(walk);
  return root.innerHTML;
}
